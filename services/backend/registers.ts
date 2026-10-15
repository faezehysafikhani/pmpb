import { api } from '../api';

// Backend enums, as numbers on the wire.
export const BackendPower = { Low: 0, Medium: 1, High: 2 } as const;
export const BackendDocumentType = { Report: 0, Letter: 1, MeetingMinutes: 2, Other: 3 } as const;
export const BackendDelayRootCause = { Funding: 0, Procurement: 1, Permits: 2, HumanResources: 3, Other: 4 } as const;
export const BackendRiskResponse = { Planning: 0, InProgress: 1, OnHold: 2, Completed: 3 } as const;
export const BackendInstanceStatus = { InProgress: 0, Approved: 1, Rejected: 2 } as const;

/** The kinds of things the Workflow backend is asked about (the `subjectType` the register services submit under). */
export const SubjectType = {
  risk: 'Risk',
  stakeholder: 'Stakeholder',
  status: 'ProgressUpdate',
  delay: 'DelayReason',
  document: 'ProjectDocument',
  activityProgress: 'ActivityProgress',
  taskStatus: 'AgileTaskStatus',
  riskResponse: 'RiskResponseStatus'
} as const;
export type RegisterKind = keyof typeof SubjectType;

export interface BackendRisk {
  id: string;
  projectId: string;
  description: string;
  probabilityLevel: string;
  impactLevel: string;
  level: string;
  responsePlan: string | null;
  riskOwnerUserId: string | null;
  responseStatus: number;
  approvalStatus: number;
  createdByUserId: string | null;
  createdAtUtc: string;
}

export interface BackendStakeholder {
  id: string;
  projectId: string;
  name: string;
  power: number;
  interest: number;
  requirements: string | null;
  strategy: string | null;
  engagementStrategy: string | null;
  approvalStatus: number;
  createdByUserId: string | null;
}

export interface BackendStatusUpdate {
  id: string;
  projectId: string;
  statusDescription: string | null;
  registerDate: string;
  approvalStatus: number;
  createdByUserId: string | null;
}

export interface BackendDelayReason {
  id: string;
  projectId: string;
  registerDate: string;
  rootCause: number;
  description: string;
  approvalStatus: number;
  createdByUserId: string | null;
}

export interface BackendDocument {
  id: string;
  projectId: string;
  description: string;
  documentType: number;
  registerDate: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  approvalStatus: number;
  createdByUserId: string | null;
}

export interface BackendRiskSettings {
  projectId: string;
  definitions: { axis: string; level: string; range: string; description: string }[];
  matrixColors: { probability: string; impact: string; color: string }[];
  isDefault: boolean;
}

export interface BackendStakeholderSettings {
  projectId: string;
  manageClosely: string;
  keepSatisfied: string;
  keepInformed: string;
  monitor: string;
  isDefault: boolean;
}

export interface BackendDecision {
  stepOrder: number;
  decidedByUserId: string;
  approved: boolean;
  comment: string | null;
  decidedAtUtc: string;
  onBehalfOfUserId: string | null;
}

export interface BackendInstance {
  id: string;
  subjectType: string;
  subjectId: string;
  totalSteps: number;
  currentStepOrder: number;
  status: number;
  decisions: BackendDecision[];
  currentApproverUserId: string | null;
  delegatedFromUserId: string | null;
}

export interface RiskBody {
  description: string;
  probabilityLevel: string;
  impactLevel: string;
  responsePlan: string | null;
  riskOwnerUserId: string | null;
}

export interface StakeholderBody {
  name: string;
  power: number;
  interest: number;
  requirements: string | null;
  engagementStrategy: string | null;
}

const base = '/api/project-management';
const forProjects = <T>(path: string, projectIds: string[]) => api.post<T[]>(`${base}/${path}/for-projects`, { projectIds });

export interface BackendRiskResponseReport {
  id: string;
  projectId: string;
  riskId: string;
  previousStatus: number;
  submittedStatus: number;
  comment: string | null;
  approvalStatus: number;
  submittedByUserId: string | null;
  submittedAtUtc: string;
}

export const riskResponses = {
  forProjects: (projectIds: string[]) => api.post<BackendRiskResponseReport[]>(`${base}/risks/response-submissions/for-projects`, { projectIds }),
  submit: (tenantId: string, riskId: string, status: number, comment: string | null) =>
    api.post<BackendRiskResponseReport>(`${base}/risks/response-submissions`, { tenantId, riskId, status, comment })
};

export const risks = {
  forProjects: (projectIds: string[]) => forProjects<BackendRisk>('risks', projectIds),
  // The three 1-5 scores are required by the backend's contract; the level wins over them, so they are sent neutral.
  create: (tenantId: string, projectId: string, body: RiskBody) =>
    api.post<BackendRisk>(`${base}/risks/`, { tenantId, projectId, probabilityScore: 3, severityScore: 3, impactScore: 3, ...body }),
  update: (id: string, body: RiskBody) =>
    api.put<BackendRisk>(`${base}/risks/${id}`, { probabilityScore: 3, severityScore: 3, impactScore: 3, ...body }),
  remove: (id: string) => api.delete<void>(`${base}/risks/${id}`),
  submit: (id: string) => api.post<BackendRisk>(`${base}/risks/${id}/submit-for-approval`),
  setResponseStatus: (id: string, status: number) => api.put<BackendRisk>(`${base}/risks/${id}/response-status`, { status }),
  settings: (projectIds: string[]) => api.post<BackendRiskSettings[]>(`${base}/risks/settings/for-projects`, { projectIds }),
  saveSettings: (tenantId: string, projectId: string, definitions: BackendRiskSettings['definitions'] | null, matrixColors: BackendRiskSettings['matrixColors'] | null) =>
    api.put<BackendRiskSettings>(`${base}/risks/settings`, { tenantId, projectId, definitions, matrixColors })
};

export const stakeholders = {
  forProjects: (projectIds: string[]) => forProjects<BackendStakeholder>('stakeholders', projectIds),
  create: (tenantId: string, projectId: string, body: StakeholderBody) =>
    api.post<BackendStakeholder>(`${base}/stakeholders/`, { tenantId, projectId, isInternal: true, expectations: null, notes: null, ...body }),
  update: (id: string, body: StakeholderBody) =>
    api.put<BackendStakeholder>(`${base}/stakeholders/${id}`, { isInternal: true, expectations: null, notes: null, ...body }),
  remove: (id: string) => api.delete<void>(`${base}/stakeholders/${id}`),
  submit: (id: string) => api.post<BackendStakeholder>(`${base}/stakeholders/${id}/submit-for-approval`),
  settings: (projectIds: string[]) => api.post<BackendStakeholderSettings[]>(`${base}/stakeholders/settings/for-projects`, { projectIds }),
  saveSettings: (tenantId: string, projectId: string, texts: Pick<BackendStakeholderSettings, 'manageClosely' | 'keepSatisfied' | 'keepInformed' | 'monitor'>) =>
    api.put<BackendStakeholderSettings>(`${base}/stakeholders/settings`, { tenantId, projectId, ...texts })
};

export const statusUpdates = {
  forProjects: (projectIds: string[]) => forProjects<BackendStatusUpdate>('progress-updates', projectIds),
  create: (tenantId: string, projectId: string, statusDescription: string, registerDate: string, plannedProgress: number, actualProgress: number) =>
    api.post<BackendStatusUpdate>(`${base}/progress-updates/`, { tenantId, projectId, statusDescription, registerDate, plannedProgress, actualProgress, delayReasons: null }),
  update: (id: string, statusDescription: string, plannedProgress: number, actualProgress: number) =>
    api.put<BackendStatusUpdate>(`${base}/progress-updates/${id}`, { statusDescription, plannedProgress, actualProgress, delayReasons: null }),
  remove: (id: string) => api.delete<void>(`${base}/progress-updates/${id}`),
  submit: (id: string) => api.post<BackendStatusUpdate>(`${base}/progress-updates/${id}/submit-for-approval`)
};

export const delayReasons = {
  forProjects: (projectIds: string[]) => forProjects<BackendDelayReason>('delay-reasons', projectIds),
  create: (tenantId: string, projectId: string, description: string, registerDate: string) =>
    api.post<BackendDelayReason>(`${base}/delay-reasons/`, {
      tenantId, projectId, registerDate, rootCause: BackendDelayRootCause.Other, description, timeImpactDays: null, costImpact: null, correctiveAction: null
    }),
  update: (id: string, description: string, registerDate: string, rootCause: number) =>
    api.put<BackendDelayReason>(`${base}/delay-reasons/${id}`, { registerDate, rootCause, description, timeImpactDays: null, costImpact: null, correctiveAction: null }),
  remove: (id: string) => api.delete<void>(`${base}/delay-reasons/${id}`),
  submit: (id: string) => api.post<BackendDelayReason>(`${base}/delay-reasons/${id}/submit-for-approval`)
};

export const documents = {
  forProjects: (projectIds: string[]) => forProjects<BackendDocument>('documents', projectIds),
  upload: (projectId: string, description: string, documentType: number, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return api.post<BackendDocument>(
      `${base}/documents/?projectId=${projectId}&description=${encodeURIComponent(description)}&documentType=${documentType}`, form);
  },
  update: (id: string, description: string, documentType: number) =>
    api.put<BackendDocument>(`${base}/documents/${id}`, { description, documentType }),
  remove: (id: string) => api.delete<void>(`${base}/documents/${id}`),
  submit: (id: string) => api.post<BackendDocument>(`${base}/documents/${id}/submit-for-approval`),
  download: (id: string, fileName: string) => api.download(`${base}/documents/${id}/download`, fileName)
};

export const approvals = {
  forSubjects: (subjectType: string, subjectIds: string[]) =>
    api.post<BackendInstance[]>('/api/workflow/approval-center/for-subjects', { subjectType, subjectIds }),
  approve: (instanceId: string, comment: string | null) => api.post<BackendInstance>(`/api/workflow/approval-center/${instanceId}/approve`, { comment }),
  reject: (instanceId: string, comment: string | null) => api.post<BackendInstance>(`/api/workflow/approval-center/${instanceId}/reject`, { comment })
};
