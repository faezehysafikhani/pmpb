import type { ContractAmendment, ContractFigures, Project, ProjectContract, ProjectInvoice } from '../types';
import { BackendApprovalStatus } from '../services/backend/projects';
import { BackendContractStatus, contractsApi } from '../services/backend/contracts';
import { approvals } from '../services/backend/registers';
import { toAddendumBody, toContractBody, toInvoiceBody, toProjectFigures } from '../services/backend/contractMappers';
import { loadContracts } from '../services/backend/contractLoad';
import type { People } from '../services/backend/registerMappers';
import type { ProjectOutcome } from './ProjectsContext';

type Result = { ok: boolean; error?: { message: string; code: string } };

export interface ContractDeps {
  tenantId: string | undefined;
  people: People;
  getProject: (id: string) => Project | undefined;
  patchProject: (id: string, patch: Partial<Project>) => void;
  /** The Workflow instance that decides each contract / addendum / invoice, by its id. */
  instances: Map<string, string>;
}

const fail = (message?: string, code?: string): ProjectOutcome => ({ ok: false, message, code });

/** A record the backend does not know yet carries the id the form gave it; the backend's ids are GUIDs. */
const isStored = (id: string | number | undefined) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);

/**
 * Everything the contract and invoice tabs ask of the backend. Each write goes to the backend and the project's contracts are read back;
 * nothing here works out an amount (what a contract is worth with its addenda, what was invoiced, what is left is the backend's).
 */
export function createContractOps(deps: ContractDeps) {
  const tenant = () => deps.tenantId ?? '';

  const refresh = async (projectId: string) => {
    const loaded = await loadContracts([projectId], deps.people);
    loaded.instanceByItem.forEach((instanceId, itemId) => deps.instances.set(itemId, instanceId));
    const summary = await contractsApi.summary(projectId);
    deps.patchProject(projectId, {
      ...(loaded.byProject.get(projectId) ?? { contracts: [], invoices: [] }),
      contractsSummary: summary.ok && summary.value ? toProjectFigures(summary.value) : undefined
    });
  };

  const settle = async (projectId: string, result: Result): Promise<ProjectOutcome> => {
    await refresh(projectId);
    return result.ok ? { ok: true } : fail(result.error?.message, result.error?.code);
  };

  /** What the creator of a record does next: send it for approval (the backend approves at once when no workflow is set). */
  const submitContract = async (id: string): Promise<Result & { approved?: boolean }> => {
    const submitted = await contractsApi.submit(id);
    const approved = submitted.ok && submitted.value?.approvalStatus === BackendApprovalStatus.Approved;
    // A contract that has been approved is in force: the status the screens never show moves out of Draft.
    if (approved && submitted.value?.status === BackendContractStatus.Draft) {
      const activated = await contractsApi.setStatus(id, BackendContractStatus.Active);
      return { ok: activated.ok, error: activated.error, approved };
    }
    return { ok: submitted.ok, error: submitted.error, approved };
  };

  /** The addenda a form holds against what the backend has: new ones are created and sent, changed ones updated, removed ones deleted. */
  const syncAddenda = async (contractId: string, wanted: ContractAmendment[], stored: ContractAmendment[]): Promise<Result> => {
    for (const old of stored.filter(s => !wanted.some(w => w.id === s.id))) {
      const removed = await contractsApi.removeAddendum(contractId, old.id);
      if (!removed.ok) return removed;
    }
    for (const a of wanted) {
      const before = stored.find(s => s.id === a.id);
      if (!isStored(a.id) || !before) {
        const created = await contractsApi.createAddendum(tenant(), contractId, toAddendumBody(a, a.amendmentNumber));
        if (!created.ok || !created.value) return created;
        const submitted = await contractsApi.submitAddendum(contractId, created.value.id);
        if (!submitted.ok) return submitted;
      } else if (before.startDate !== a.startDate || before.endDate !== a.endDate || before.amount !== a.amount || (before.description ?? '') !== (a.description ?? '')) {
        const updated = await contractsApi.updateAddendum(contractId, a.id, toAddendumBody(a, a.amendmentNumber));
        if (!updated.ok) return updated;
        const submitted = await contractsApi.submitAddendum(contractId, a.id);
        if (!submitted.ok) return submitted;
      }
    }
    return { ok: true };
  };

  return {
    /** Creates (id not stored) or updates a contract, then its addenda. A new contract is sent for approval; addenda need an approved contract. */
    saveContract: async (projectId: string, contract: ProjectContract): Promise<ProjectOutcome & { pendingAddenda?: boolean }> => {
      const stored = (deps.getProject(projectId)?.contracts ?? []).find(c => c.id === contract.id);
      let contractId = contract.id;
      if (stored && isStored(contract.id)) {
        const updated = await contractsApi.update(contract.id, toContractBody(contract));
        if (!updated.ok) return settle(projectId, updated);
        // An edited contract that had been refused goes back for approval.
        if (stored.isRejected) {
          const resubmitted = await submitContract(contract.id);
          if (!resubmitted.ok) return settle(projectId, resubmitted);
        }
      } else {
        const created = await contractsApi.create(tenant(), projectId, toContractBody(contract));
        if (!created.ok || !created.value) return settle(projectId, created);
        contractId = created.value.id;
        const submitted = await submitContract(contractId);
        if (!submitted.ok) return settle(projectId, submitted);
        if (!submitted.approved && (contract.amendments ?? []).length > 0) {
          // The backend takes addenda only for an approved contract; they are entered once it is.
          await refresh(projectId);
          return { ok: true, pendingAddenda: true };
        }
      }

      const synced = await syncAddenda(contractId, contract.amendments ?? [], stored?.amendments ?? []);
      return settle(projectId, synced);
    },

    deleteContract: async (projectId: string, id: string): Promise<ProjectOutcome> => settle(projectId, await contractsApi.remove(id)),

    saveInvoice: async (projectId: string, invoice: ProjectInvoice): Promise<ProjectOutcome> => {
      const contractId = invoice.contractId;
      if (!contractId) return fail('قرارداد صورتحساب انتخاب نشده است.');
      const stored = (deps.getProject(projectId)?.invoices ?? []).find(i => i.id === invoice.id);
      if (stored && isStored(invoice.id)) {
        const updated = await contractsApi.updateInvoice(stored.contractId ?? contractId, invoice.id, toInvoiceBody(invoice));
        if (!updated.ok) return settle(projectId, updated);
        if (stored.isRejected) return settle(projectId, await contractsApi.submitInvoice(stored.contractId ?? contractId, invoice.id));
        return settle(projectId, updated);
      }
      const created = await contractsApi.createInvoice(tenant(), contractId, toInvoiceBody(invoice));
      if (!created.ok || !created.value) return settle(projectId, created);
      return settle(projectId, await contractsApi.submitInvoice(contractId, created.value.id));
    },

    deleteInvoice: async (projectId: string, invoice: ProjectInvoice): Promise<ProjectOutcome> =>
      settle(projectId, await contractsApi.removeInvoice(invoice.contractId ?? '', invoice.id)),

    /** Reads one project's contracts again (for example when its tab is opened). */
    refreshContracts: refresh,

    /** Approves or rejects a contract, addendum or invoice at the step the backend's workflow is on. */
    decideContractItem: async (projectId: string, itemId: string, approve: boolean, comment?: string): Promise<ProjectOutcome> => {
      let instanceId = deps.instances.get(itemId);
      if (!instanceId) {
        await refresh(projectId);
        instanceId = deps.instances.get(itemId);
      }
      if (!instanceId) return fail('این مورد در گردش کار تأیید قرار ندارد.', 'not_found');
      const decided = approve ? await approvals.approve(instanceId, comment ?? null) : await approvals.reject(instanceId, comment ?? null);
      return settle(projectId, decided);
    }
  };
}

export type ContractOps = ReturnType<typeof createContractOps>;
export type { ContractFigures };
