import { api } from '../api';

// Backend enums, as numbers on the wire.
export const BackendProjectType = { Waterfall: 0, Agile: 1 } as const;
export const BackendProjectStatus = { Draft: 0, Active: 1, OnHold: 2, Completed: 3, Archived: 4 } as const;
export const BackendApprovalStatus = { NotSubmitted: 0, PendingApproval: 1, Approved: 2, Rejected: 3 } as const;

export interface BackendProject {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  type: number;
  status: number;
  approvalStatus: number;
  ownerUserId: string | null;
  managerUserId: string | null;
  organizationUnitId: string | null;
  workCalendarId: string | null;
  startDate: string | null;
  endDate: string | null;
  cost: number | null;
  goal: string | null;
  requirements: string | null;
  constraints: string | null;
  assumptions: string | null;
  description: string | null;
  charter: string | null;
  createdAtUtc: string;
}

export interface BackendProjectMember {
  id: string;
  projectId: string;
  userId: string;
  roleTitle: string | null;
}

export interface ProjectSaveBody {
  name: string;
  code?: string | null;
  managerUserId: string | null;
  ownerUserId: string | null;
  organizationUnitId: string | null;
  workCalendarId: string | null;
  startDate: string | null;
  endDate: string | null;
  cost: number | null;
  goal: string | null;
  requirements: string | null;
  constraints: string | null;
  assumptions: string | null;
  description: string | null;
  charter: string | null;
}

export const projects = {
  /** The projects the signed-in user may see (the backend applies the visibility rules). */
  visible: () => api.get<BackendProject[]>('/api/portfolio/projects'),
  /** Dry run of create / update: the backend's own checks, nothing saved. */
  check: (tenantId: string, type: number, body: ProjectSaveBody, projectId?: string) =>
    api.post<void>(`/api/project-management/projects/check${projectId ? `?projectId=${projectId}` : ''}`, { tenantId, type, ...body }),
  get: (id: string) => api.get<BackendProject>(`/api/project-management/projects/${id}`),
  create: (tenantId: string, type: number, body: ProjectSaveBody) =>
    api.post<BackendProject>('/api/project-management/projects/', { tenantId, type, ...body }),
  update: (id: string, body: ProjectSaveBody) => api.put<BackendProject>(`/api/project-management/projects/${id}`, body),
  setStatus: (id: string, status: number) => api.put<BackendProject>(`/api/project-management/projects/${id}/status`, { status }),
  submit: (id: string) => api.post<BackendProject>(`/api/project-management/projects/${id}/submit-for-approval`),
  archive: (id: string) => api.post<void>(`/api/project-management/projects/${id}/archive`),
  remove: (id: string) => api.delete<void>(`/api/project-management/projects/${id}`)
};

export const projectTeam = {
  forProjects: (projectIds: string[]) =>
    api.post<BackendProjectMember[]>('/api/project-management/team/members/for-projects', { projectIds }),
  set: (tenantId: string, projectId: string, userIds: string[]) =>
    api.put<BackendProjectMember[]>('/api/project-management/team/members/set', { tenantId, projectId, userIds })
};

