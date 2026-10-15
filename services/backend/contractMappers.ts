import type { ContractAmendment, ContractFigures, Project, ProjectContract, ProjectInvoice } from '../../types';
import { BackendApprovalStatus } from './projects';
import type {
  AddendumBody, BackendAddendum, BackendContractDetail, BackendContractSummary, BackendProjectContractsSummary, ContractBody, InvoiceBody
} from './contracts';
import type { BackendInstance } from './registers';
import { approvalOf } from './registerMappers';
import type { People } from './registerMappers';

/**
 * Shape adapters only: the backend's contracts, addenda and invoices become the objects the contract and invoice tabs use. The amounts
 * (current value, what was invoiced, what is left) are the backend's; so is whether a record counts yet (it counts once approved).
 */

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

function approvalFields(status: number, instance: BackendInstance | undefined, people: People) {
  const approval = approvalOf(status, instance, people);
  return { ...approval, isPending: status === BackendApprovalStatus.PendingApproval };
}

export const toFigures = (s: BackendContractSummary): ContractFigures => ({
  currentAmount: s.currentAmount.rials,
  invoicedAmount: s.invoicedAmount.rials,
  paidAmount: s.paidAmount.rials,
  remainingCommitment: s.remainingCommitment.rials,
  invoicedPercent: s.invoicedPercent,
  isOverInvoiced: s.isOverInvoiced
});

export const toProjectFigures = (s: BackendProjectContractsSummary): ContractFigures => ({
  currentAmount: s.totalContractAmount.rials,
  invoicedAmount: s.totalInvoiced.rials,
  paidAmount: s.totalPaid.rials,
  remainingCommitment: s.totalRemainingCommitment.rials,
  invoicedPercent: s.invoicedPercent,
  contractCount: s.contractCount,
  originalAmount: s.totalOriginalAmount?.rials,
  approvedAddenda: s.totalApprovedAddenda?.rials
});

const toUiAmendment = (a: BackendAddendum, instance: BackendInstance | undefined, people: People): ContractAmendment => ({
  id: a.id,
  amendmentNumber: a.number,
  startDate: day(a.startDate ?? a.addendumDate),
  endDate: day(a.endDate ?? a.addendumDate),
  amount: a.amountChange,
  description: a.description ?? '',
  ...approvalFields(a.approvalStatus, instance, people)
});

export interface InstancesByItem {
  get: (itemId: string) => BackendInstance | undefined;
}

/** A project's contracts (with their addenda) and invoices, from the batch the backend returned for it. */
export function toUiContracts(details: BackendContractDetail[], instances: InstancesByItem, people: People): Pick<Project, 'contracts' | 'invoices'> {
  const contracts: ProjectContract[] = [];
  const invoices: ProjectInvoice[] = [];
  for (const { contract: c, addenda, invoices: items } of details) {
    contracts.push({
      id: c.id,
      contractNumber: c.contractNumber,
      title: c.title,
      startDate: day(c.startDate),
      endDate: day(c.endDate),
      amount: c.originalAmount.rials,
      contractorName: c.counterparty,
      supervisorName: c.supervisorName ?? '',
      beneficiaryName: c.beneficiaryName ?? '',
      description: c.description ?? '',
      amendments: addenda.map(a => toUiAmendment(a, instances.get(a.id), people)),
      submittedBy: c.createdByUserId ?? undefined,
      figures: toFigures(c.summary),
      ...approvalFields(c.approvalStatus, instances.get(c.id), people)
    });
    for (const i of items) {
      invoices.push({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        title: i.title ?? '',
        startDate: day(i.periodStartDate ?? i.invoiceDate),
        endDate: day(i.periodEndDate ?? i.invoiceDate),
        amount: i.amount.rials,
        contractId: c.id,
        contractTitle: c.title,
        description: i.description ?? '',
        submittedBy: i.createdByUserId ?? undefined,
        ...approvalFields(i.approvalStatus, instances.get(i.id), people)
      });
    }
  }
  return { contracts, invoices };
}

export const toContractBody = (c: Partial<ProjectContract>): ContractBody => ({
  contractNumber: (c.contractNumber ?? '').trim(),
  title: (c.title ?? '').trim(),
  counterparty: (c.contractorName ?? '').trim(),
  description: c.description?.trim() || null,
  signDate: null,
  startDate: c.startDate ? c.startDate.slice(0, 10) : null,
  endDate: c.endDate ? c.endDate.slice(0, 10) : null,
  originalAmount: Math.round(Number(c.amount) || 0),
  supervisorName: (c.supervisorName ?? '').trim(),
  beneficiaryName: (c.beneficiaryName ?? '').trim()
});

export const toAddendumBody = (a: ContractAmendment, number: number): AddendumBody => ({
  title: `الحاقیه شماره ${number}`,
  description: a.description?.trim() || null,
  addendumDate: a.startDate ? a.startDate.slice(0, 10) : null,
  amountChange: Math.round(Number(a.amount) || 0),
  extensionDays: 0,
  startDate: a.startDate ? a.startDate.slice(0, 10) : null,
  endDate: a.endDate ? a.endDate.slice(0, 10) : null
});

export const toInvoiceBody = (i: Partial<ProjectInvoice>): InvoiceBody => ({
  invoiceNumber: (i.invoiceNumber ?? '').trim(),
  invoiceDate: (i.endDate ?? i.startDate ?? '').slice(0, 10),
  amount: Math.round(Number(i.amount) || 0),
  description: i.description?.trim() || null,
  title: (i.title ?? '').trim() || null,
  periodStartDate: i.startDate ? i.startDate.slice(0, 10) : null,
  periodEndDate: i.endDate ? i.endDate.slice(0, 10) : null
});
