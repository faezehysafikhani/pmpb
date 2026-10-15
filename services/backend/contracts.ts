import { api } from '../api';

// Backend enums, as numbers on the wire.
export const BackendContractStatus = { Draft: 0, Active: 1 } as const;

/** The `subjectType`s the contract services submit under in the Workflow backend. */
export const ContractSubject = { contract: 'Contract', addendum: 'ContractAddendum', invoice: 'ContractInvoice' } as const;

export interface BackendMoney {
  rials: number;
  formatted: string;
}

export interface BackendContractSummary {
  currentAmount: BackendMoney;
  invoicedAmount: BackendMoney;
  paidAmount: BackendMoney;
  remainingCommitment: BackendMoney;
  invoicedPercent: number;
  isOverInvoiced: boolean;
}

export interface BackendContract {
  id: string;
  projectId: string;
  contractNumber: string;
  title: string;
  counterparty: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  originalAmount: BackendMoney;
  status: number;
  approvalStatus: number;
  summary: BackendContractSummary;
  createdByUserId: string | null;
  supervisorName: string | null;
  beneficiaryName: string | null;
}

export interface BackendAddendum {
  id: string;
  contractId: string;
  number: number;
  title: string;
  description: string | null;
  addendumDate: string | null;
  amountChange: number;
  extensionDays: number;
  approvalStatus: number;
  createdByUserId: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface BackendInvoice {
  id: string;
  contractId: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: BackendMoney;
  description: string | null;
  approvalStatus: number;
  createdByUserId: string | null;
  title: string | null;
  periodStartDate: string | null;
  periodEndDate: string | null;
}

export interface BackendContractDetail {
  contract: BackendContract;
  addenda: BackendAddendum[];
  invoices: BackendInvoice[];
}

export interface BackendProjectContractsSummary {
  projectId: string;
  contractCount: number;
  totalContractAmount: BackendMoney;
  totalInvoiced: BackendMoney;
  totalPaid: BackendMoney;
  totalRemainingCommitment: BackendMoney;
  invoicedPercent: number;
  paidPercent: number;
  overInvoicedContracts: number;
  totalOriginalAmount: BackendMoney | null;
  totalApprovedAddenda: BackendMoney | null;
}

export interface ContractBody {
  contractNumber: string;
  title: string;
  counterparty: string;
  description: string | null;
  signDate: string | null;
  startDate: string | null;
  endDate: string | null;
  originalAmount: number;
  supervisorName: string;
  beneficiaryName: string;
}

export interface AddendumBody {
  title: string;
  description: string | null;
  addendumDate: string | null;
  amountChange: number;
  extensionDays: number;
  startDate: string | null;
  endDate: string | null;
}

export interface InvoiceBody {
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  description: string | null;
  title: string | null;
  periodStartDate: string | null;
  periodEndDate: string | null;
}

const base = '/api/project-management/contracts';

export const contractsApi = {
  forProjects: (projectIds: string[]) => api.post<BackendContractDetail[]>(`${base}/for-projects`, { projectIds }),
  summary: (projectId: string) => api.get<BackendProjectContractsSummary>(`${base}/summary?projectId=${encodeURIComponent(projectId)}`),
  create: (tenantId: string, projectId: string, body: ContractBody) => api.post<BackendContract>(`${base}/`, { tenantId, projectId, ...body }),
  update: (id: string, body: ContractBody) => api.put<BackendContract>(`${base}/${id}`, body),
  setStatus: (id: string, status: number) => api.put<BackendContract>(`${base}/${id}/status`, { status }),
  submit: (id: string) => api.post<BackendContract>(`${base}/${id}/submit-for-approval`),
  remove: (id: string) => api.delete<void>(`${base}/${id}`),

  createAddendum: (tenantId: string, contractId: string, body: AddendumBody) =>
    api.post<BackendAddendum>(`${base}/${contractId}/addenda`, { tenantId, ...body }),
  updateAddendum: (contractId: string, id: string, body: AddendumBody) => api.put<BackendAddendum>(`${base}/${contractId}/addenda/${id}`, body),
  submitAddendum: (contractId: string, id: string) => api.post<BackendAddendum>(`${base}/${contractId}/addenda/${id}/submit-for-approval`),
  removeAddendum: (contractId: string, id: string) => api.delete<void>(`${base}/${contractId}/addenda/${id}`),

  createInvoice: (tenantId: string, contractId: string, body: InvoiceBody) =>
    api.post<BackendInvoice>(`${base}/${contractId}/invoices`, { tenantId, ...body }),
  updateInvoice: (contractId: string, id: string, body: InvoiceBody) => api.put<BackendInvoice>(`${base}/${contractId}/invoices/${id}`, body),
  submitInvoice: (contractId: string, id: string) => api.post<BackendInvoice>(`${base}/${contractId}/invoices/${id}/submit-for-approval`),
  removeInvoice: (contractId: string, id: string) => api.delete<void>(`${base}/${contractId}/invoices/${id}`)
};
