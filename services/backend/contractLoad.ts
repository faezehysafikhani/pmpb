import type { Project } from '../../types';
import { BackendApprovalStatus } from './projects';
import { contractsApi, ContractSubject } from './contracts';
import { approvals } from './registers';
import type { BackendInstance } from './registers';
import { toUiContracts } from './contractMappers';
import type { People } from './registerMappers';

export type ProjectContracts = Pick<Project, 'contracts' | 'invoices'>;

export interface LoadedContracts {
  byProject: Map<string, ProjectContracts>;
  /** The Workflow instance that decides each contract / addendum / invoice, by its id. */
  instanceByItem: Map<string, string>;
  error: string | null;
}

/** Reads the contracts (with addenda and invoices) of the given projects in one call, plus the approval history of what was sent for approval. */
export async function loadContracts(projectIds: string[], people: People): Promise<LoadedContracts> {
  const byProject = new Map<string, ProjectContracts>(projectIds.map(id => [id, { contracts: [], invoices: [] }]));
  const instanceByItem = new Map<string, string>();
  if (!projectIds.length) return { byProject, instanceByItem, error: null };

  const listed = await contractsApi.forProjects(projectIds);
  const details = listed.value ?? [];
  const sent = <T extends { id: string; approvalStatus: number }>(items: T[]) =>
    items.filter(i => i.approvalStatus !== BackendApprovalStatus.NotSubmitted).map(i => i.id);

  const found = new Map<string, BackendInstance>();
  const lookup = async (subjectType: string, ids: string[]) => {
    if (!ids.length) return;
    const result = await approvals.forSubjects(subjectType, ids);
    for (const instance of result.value ?? []) {
      found.set(instance.subjectId, instance);
      instanceByItem.set(instance.subjectId, instance.id);
    }
  };
  await Promise.all([
    lookup(ContractSubject.contract, sent(details.map(d => d.contract))),
    lookup(ContractSubject.addendum, sent(details.flatMap(d => d.addenda))),
    lookup(ContractSubject.invoice, sent(details.flatMap(d => d.invoices)))
  ]);

  for (const projectId of projectIds) {
    byProject.set(projectId, toUiContracts(details.filter(d => d.contract.projectId === projectId), found, people));
  }
  return { byProject, instanceByItem, error: listed.ok ? null : listed.error?.message ?? 'Loading the contracts failed.' };
}
