import { api, query } from '../api';

// Backend enums, as numbers on the wire.
export const BackendLevel = { Low: 0, Medium: 1, High: 2 } as const;
export const BackendDependency = { FS: 0, SS: 1, FF: 2, SF: 3 } as const;
export const BackendWeighting = { manual: 0, 'time-based': 1, 'cost-based': 2, 'complexity-based': 3, combined: 4 } as const;
export const BackendPlannedMode = { stored: 0, continuous: 1, 'zero-hundred': 2 } as const;
export const BackendTaskStatus = { 'To-Do': 0, Doing: 1, Done: 2, 'Under Review': 3 } as const;
export const BackendTaskPriority = { Low: 0, Medium: 1, High: 2, Critical: 3 } as const;
export const BackendBaselineKind = { Baseline: 0, ProgressInformation: 1 } as const;

const wf = '/api/project-management/waterfall';
const ag = '/api/project-management/agile';

export interface BackendActivity {
  id: string;
  projectId: string;
  parentActivityId: string | null;
  name: string;
  description: string | null;
  responsibleUserId: string | null;
  approverUserId: string | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  manHours: number | null;
  weight: number;
  plannedProgress: number;
  actualProgress: number;
  approvalStatus: number;
  isMilestone: boolean;
  cost: number | null;
  importance: number;
  complexity: number;
}

export interface BackendDependencyLink {
  id: string;
  predecessorActivityId: string;
  successorActivityId: string;
  type: number;
  lagDays: number;
}

export interface BackendScheduledActivity {
  id: string;
  parentActivityId: string | null;
  name: string;
  isSummary: boolean;
  isMilestone: boolean;
  start: string;
  finish: string;
  durationDays: number;
  lateStart: string;
  lateFinish: string;
  totalFloatDays: number;
  freeFloatDays: number;
  isCritical: boolean;
  plannedProgress: number;
  actualProgress: number;
  wbsCode: string;
  level: number;
  weight: number;
  cost: number;
  manHours: number;
}

export interface BackendSchedule {
  projectId: string;
  projectStart: string;
  projectFinish: string;
  projectDurationDays: number;
  plannedProgress: number;
  actualProgress: number;
  criticalPath: string[];
  activities: BackendScheduledActivity[];
  warnings: string[];
}

export interface BackendWaterfallSettings {
  projectId: string;
  weighting: number;
  timeFactor: number;
  costFactor: number;
  complexityFactor: number;
  plannedProgress: number;
  isDefault: boolean;
}

export interface BackendPlan {
  projectId: string;
  settings: BackendWaterfallSettings;
  activities: BackendActivity[];
  dependencies: BackendDependencyLink[];
  schedule: BackendSchedule;
}

export interface BackendBaseline {
  id: string;
  projectId: string;
  number: number;
  name: string;
  note: string | null;
  projectStart: string;
  projectFinish: string;
  activityCount: number;
  createdAtUtc: string;
  kind: number;
  plannedProgress: number;
  actualProgress: number;
}

export interface BackendBaselineActivity {
  activityId: string;
  parentActivityId: string | null;
  name: string;
  isSummary: boolean;
  isMilestone: boolean;
  startDate: string;
  endDate: string;
  durationDays: number;
  weight: number;
  plannedProgress: number;
  actualProgress: number;
  responsibleUserId: string | null;
  wbsCode: string;
}

export interface BackendSCurve {
  projectStart: string;
  projectFinish: string;
  planned: { date: string; plannedProgress: number }[];
  actual: { date: string; actualProgress: number; plannedProgress: number }[];
}

export interface BackendProgressReport {
  id: string;
  projectId: string;
  activityId: string;
  submittedProgress: number;
  approvedProgress: number | null;
  isPartialRejection: boolean;
  comment: string | null;
  documentName: string | null;
  approvalStatus: number;
  submittedByUserId: string | null;
  submittedAtUtc: string;
}

export interface BackendAgileTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: number;
  responsibleUserId: string | null;
  approverUserId: string | null;
  dueDate: string | null;
  priority: number;
  sprintNumber: number | null;
  approvalStatus: number;
}

export interface BackendSprint {
  id: string;
  projectId: string;
  number: number;
  name: string;
}

export interface BackendStatusRequest {
  id: string;
  projectId: string;
  taskId: string;
  previousStatus: number;
  submittedStatus: number;
  comment: string | null;
  approvalStatus: number;
  submittedByUserId: string | null;
  submittedAtUtc: string;
}

export interface BackendProjectProgress {
  projectId: string;
  type: number;
  plannedProgress: number;
  actualProgress: number;
  performance: number;
  totalTasks: number | null;
  todoTasks: number | null;
  doingTasks: number | null;
  doneTasks: number | null;
}

export interface ActivityBody {
  parentActivityId: string | null;
  name: string;
  description: string | null;
  deliverableId: null;
  responsibleUserId: string | null;
  approverUserId: string | null;
  startDate: null;
  endDate: null;
  durationDays: number | null;
  manHours: number | null;
  weight: number;
  isMilestone: boolean | null;
  cost: number | null;
  importance: number | null;
  complexity: number | null;
}

export interface AgileTaskBody {
  title: string;
  description: string | null;
  responsibleUserId: string | null;
  approverUserId: string | null;
  dueDate: string | null;
  priority: number;
  sprintNumber: number | null;
}

export const waterfall = {
  plans: (projectIds: string[]) => api.post<BackendPlan[]>(`${wf}/schedule/plans`, { projectIds }),
  plan: (projectId: string) => api.get<BackendPlan>(`${wf}/schedule/plan${query({ projectId })}`),
  createActivity: (tenantId: string, projectId: string, body: ActivityBody) =>
    api.post<BackendActivity>(`${wf}/activities/`, { tenantId, projectId, ...body }),
  updateActivity: (id: string, body: ActivityBody) => api.put<BackendActivity>(`${wf}/activities/${id}`, body),
  setActualProgress: (id: string, actualProgress: number) => api.put<BackendActivity>(`${wf}/activities/${id}/actual-progress`, { actualProgress }),
  deleteActivity: (id: string, withSubActivities: boolean) => api.delete<void>(`${wf}/activities/${id}${withSubActivities ? '?withSubActivities=true' : ''}`),
  setPredecessor: (tenantId: string, projectId: string, successorActivityId: string, predecessorActivityId: string | null, type: number, lagDays: number) =>
    api.put<BackendDependencyLink[]>(`${wf}/dependencies/predecessor`, { tenantId, projectId, successorActivityId, predecessorActivityId, type, lagDays }),
  saveSettings: (tenantId: string, projectId: string, s: Omit<BackendWaterfallSettings, 'projectId' | 'isDefault'>) =>
    api.put<BackendWaterfallSettings>(`${wf}/settings`, { tenantId, projectId, ...s }),

  baselines: (projectId: string) => api.get<BackendBaseline[]>(`${wf}/baselines${query({ projectId })}`),
  baseline: (id: string) => api.get<{ baseline: BackendBaseline; activities: BackendBaselineActivity[] }>(`${wf}/baselines/${id}`),
  createBaseline: (tenantId: string, projectId: string, name: string, kind: number) =>
    api.post<{ baseline: BackendBaseline; activities: BackendBaselineActivity[] }>(`${wf}/baselines/`, { tenantId, projectId, name, note: null, kind }),
  deleteBaseline: (id: string) => api.delete<void>(`${wf}/baselines/${id}`),

  sCurve: (projectId: string) => api.get<BackendSCurve>(`${wf}/s-curve${query({ projectId })}`),

  exportMsProject: (projectId: string, fileName: string) => api.download(`${wf}/msproject/export${query({ projectId })}`, fileName),
  importMsProject: (projectId: string, file: File, replaceExisting: boolean) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return api.post<{ activitiesImported: number; dependenciesImported: number; activitiesReplaced: number; warnings: string[] }>(
      `${wf}/msproject/import${query({ projectId, replaceExisting })}`, form);
  },

  reports: (projectIds: string[]) => api.post<BackendProgressReport[]>(`${wf}/progress-submissions/for-projects`, { projectIds }),
  submitReport: (tenantId: string, projectId: string, activityId: string, progress: number, comment: string | null, documentName: string | null) =>
    api.post<BackendProgressReport>(`${wf}/progress-submissions/`, { tenantId, projectId, activityId, progress, comment, documentName }),
  confirmProgress: (reportId: string, progress: number) =>
    api.put<BackendProgressReport>(`${wf}/progress-submissions/${reportId}/confirmed-progress`, { progress })
};

export const agile = {
  tasks: (projectIds: string[]) => api.post<BackendAgileTask[]>(`${ag}/tasks/for-projects`, { projectIds }),
  sprints: (projectIds: string[]) => api.post<BackendSprint[]>(`${ag}/sprints/for-projects`, { projectIds }),
  statusRequests: (projectIds: string[]) => api.post<BackendStatusRequest[]>(`${ag}/status-submissions/for-projects`, { projectIds }),
  createTask: (tenantId: string, projectId: string, body: AgileTaskBody) => api.post<BackendAgileTask>(`${ag}/tasks/`, { tenantId, projectId, ...body }),
  updateTask: (id: string, body: AgileTaskBody) => api.put<BackendAgileTask>(`${ag}/tasks/${id}`, body),
  setTaskStatus: (id: string, status: number) => api.put<BackendAgileTask>(`${ag}/tasks/${id}/status`, { status }),
  deleteTask: (id: string) => api.delete<void>(`${ag}/tasks/${id}`),
  submitTask: (id: string) => api.post<BackendAgileTask>(`${ag}/tasks/${id}/submit-for-approval`),
  setSprintCount: (tenantId: string, projectId: string, count: number) => api.put<BackendSprint[]>(`${ag}/sprints/count`, { tenantId, projectId, count }),
  requestStatus: (tenantId: string, projectId: string, taskId: string, status: number, comment: string | null) =>
    api.post<BackendStatusRequest>(`${ag}/status-submissions/`, { tenantId, projectId, taskId, status, comment })
};

export const progressOverview = {
  forProjects: (projectIds: string[]) => api.post<BackendProjectProgress[]>('/api/project-management/projects/progress', { projectIds })
};
