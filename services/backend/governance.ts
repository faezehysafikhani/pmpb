import { api, query } from '../api';
import type { BackendInstance } from './registers';

/** Who may see what, and how approvals behave, as the backend holds them (organisation-wide switches). */
export interface BackendVisibilityRules {
  viewByOwner: boolean;
  viewByManagerOrResponsible: boolean;
  viewByApprovers: boolean;
  viewByResources: boolean;
  viewByOrgHeads: boolean;
}

export interface BackendGovernanceSettings {
  visibility: BackendVisibilityRules;
  allowConfirmedProgressOnRejection: boolean;
}

export interface BackendAccessMatrix {
  viewByAdmin: boolean;
  viewByPM: boolean;
  viewByTeam: boolean;
  manageByAdmin: boolean;
  manageByPM: boolean;
}

export interface BackendProjectGovernance {
  projectId: string;
  enabledTabs: string[] | null;
  contractAccess: BackendAccessMatrix;
  invoiceAccess: BackendAccessMatrix;
}

/** A step of an approval chain: a fixed user, or a participant of the thing approved (Manager, Owner, Approver1..3). */
export interface BackendWorkflowStep {
  name: string;
  approverUserId: string | null;
  approverKey: string | null;
  isOptional: boolean;
}

export interface BackendWorkflowGroup {
  key: string;
  subjectTypes: string[];
  isConfigured: boolean;
  isCustom: boolean;
  steps: BackendWorkflowStep[];
  defaultSteps: BackendWorkflowStep[];
}

const wf = '/api/integrations/project-workflow';
const gov = '/api/integrations/project-governance';

export const governanceApi = {
  settings: () => api.get<BackendGovernanceSettings>(`${gov}/settings`),
  saveSettings: (settings: BackendGovernanceSettings) => api.put<BackendGovernanceSettings>(`${gov}/settings`, settings),
  projectSettings: () => api.get<BackendProjectGovernance[]>(`${gov}/projects`),
  saveProjectSettings: (projectId: string, body: { enabledTabs: string[] | null; contractAccess: BackendAccessMatrix | null; invoiceAccess: BackendAccessMatrix | null }) =>
    api.put<BackendProjectGovernance>(`${gov}/projects/${projectId}/settings`, body)
};

export const workflowSettingsApi = {
  groups: (projectId?: string) => api.get<BackendWorkflowGroup[]>(`${wf}/settings${query({ projectId })}`),
  saveGeneral: (key: string, steps: BackendWorkflowStep[] | null) => api.put<BackendWorkflowGroup[]>(`${wf}/settings/${key}`, { steps }),
  applyDefaults: () => api.post<BackendWorkflowGroup[]>(`${wf}/settings/apply-defaults`),
  saveProject: (projectId: string, key: string, steps: BackendWorkflowStep[] | null) =>
    api.put<BackendWorkflowGroup[]>(`${wf}/projects/${projectId}/settings/${key}`, { steps }),
  resetProject: (projectId: string, key: string) => api.delete<BackendWorkflowGroup[]>(`${wf}/projects/${projectId}/settings/${key}`)
};

/** The approvals waiting for the signed-in user (their own, and those of the people they stand in for). */
export const approvalInboxApi = {
  list: () => api.get<BackendInstance[]>('/api/workflow/approval-center')
};

export interface BackendItemDelegation {
  id: string;
  itemType: number;
  itemId: string;
  projectId: string | null;
  delegatorUserId: string;
  delegateUserId: string;
  isActive: boolean;
  delegatedAtUtc: string;
  endedAtUtc: string | null;
}

export const BackendDelegatedItemType = { waterfall: 0, agile: 1, action: 2 } as const;

export const delegationApi = {
  list: () => api.get<BackendItemDelegation[]>('/api/project-management/delegations?activeOnly=true'),
  create: (itemType: number, itemId: string, projectId: string | null, delegateUserId: string) =>
    api.post<BackendItemDelegation>('/api/project-management/delegations', { itemType, itemId, projectId, delegateUserId }),
  end: (id: string) => api.post<{ restoreToUserId: string; endedIds: string[] }>(`/api/project-management/delegations/${id}/end`)
};

/** The actions the backend's visibility rules let the signed-in user see (the portfolio's action items). */
export const visibleActionsApi = {
  ids: () => api.get<{ projects: unknown[]; actions: { id: string }[] }>(`/api/portfolio${query({ type: 'Action' })}`)
};
