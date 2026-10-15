import { api, query } from '../api';

// Backend enums, as numbers on the wire.
export const BackendActionStatus = { Planning: 0, 'In Progress': 1, Completed: 2, Cancelled: 3, 'On Hold': 4 } as const;
export const BackendActionPriority = { Low: 0, Normal: 1, High: 2, Urgent: 3 } as const;
export const BackendRecurrenceUnit = { daily: 0, weekly: 1, monthly: 2, yearly: 3 } as const;

/** The `subjectType` the action services submit under in the Workflow backend. */
export const ActionSubject = { action: 'Action', status: 'ActionStatus' } as const;

export interface BackendActionRecurrence {
  unit: number;
  interval: number;
  endDate: string | null;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
  months: number[] | null;
  durationHours: number | null;
}

export interface BackendAction {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  ownerUserId: string | null;
  responsibleUserId: string | null;
  status: number;
  organizationUnitId: string;
  workCalendarId: string;
  projectId: string | null;
  startDate: string | null;
  endDate: string | null;
  approvalStatus: number;
  priority: number;
  recurrence: BackendActionRecurrence | null;
  sourceType: string | null;
  sourceId: string | null;
  approverUserIds: string[] | null;
}

export interface BackendActionStatusRequest {
  id: string;
  projectId: string | null;
  actionId: string;
  previousStatus: number;
  submittedStatus: number;
  comment: string | null;
  approvalStatus: number;
  submittedByUserId: string | null;
  submittedAtUtc: string;
}

export interface BackendOccurrence {
  index: number;
  date: string;
  durationHours: number | null;
}

export interface ActionBody {
  title: string;
  description: string | null;
  ownerUserId: string | null;
  responsibleUserId: string | null;
  organizationUnitId: string;
  workCalendarId: string;
  projectId: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceType: string | null;
  sourceId: string | null;
  approverUserIds: string[];
  recurrence: {
    unit: number | null;
    interval: number;
    daysOfWeek: number[] | null;
    dayOfMonth: number | null;
    months: number[] | null;
    durationHours: number | null;
  };
}

const base = '/api/actions';

export const actionsApi = {
  list: (projectId?: string) => api.get<BackendAction[]>(`${base}/${query({ projectId })}`),
  create: (tenantId: string, body: ActionBody) => api.post<BackendAction>(`${base}/`, { tenantId, ...body }),
  update: (id: string, body: ActionBody) => api.put<BackendAction>(`${base}/${id}`, body),
  remove: (id: string) => api.delete<void>(`${base}/${id}`),
  setStatus: (id: string, status: number) => api.put<BackendAction>(`${base}/${id}/status`, { status }),
  submit: (id: string) => api.post<BackendAction>(`${base}/${id}/submit-for-approval`),
  occurrences: (id: string) => api.get<BackendOccurrence[]>(`${base}/${id}/occurrences`),
  statusRequests: () => api.get<BackendActionStatusRequest[]>(`${base}/status-submissions/`),
  requestStatus: (tenantId: string, actionId: string, status: number, comment: string | null) =>
    api.post<BackendActionStatusRequest>(`${base}/status-submissions/`, { tenantId, actionId, status, comment })
};
