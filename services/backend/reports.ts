import { api, query } from '../api';

/** One organisation unit (rolled up to a level) as the backend's performance report states it. */
export interface BackendUnitPerformance {
  unitId: string | null;
  unitName: string;
  projectCount: number;
  runningProjects: number;
  completedProjects: number;
  averagePlannedProgress: number | null;
  averageActualProgress: number | null;
  averageDeviation: number | null;
  delayedProjects: number;
  averagePerformance: number | null;
  rating: string | null;
  projectIds: string[] | null;
}

export interface BackendPerformanceSummary {
  projectCount: number;
  runningProjects: number;
  delayedProjects: number;
  averagePerformance: number | null;
  rating: string | null;
}

export interface BackendUnitReport {
  units: BackendUnitPerformance[];
  summary: BackendPerformanceSummary | null;
}

export interface BackendManagerEvaluation {
  managerUserId: string | null;
  projectCount: number;
  runningProjects: number;
  completedProjects: number;
  averagePlannedProgress: number | null;
  averageActualProgress: number | null;
  delayedProjects: number;
  averagePerformance: number | null;
  rating: string | null;
  projectIds: string[] | null;
}

export interface BackendStatusMatrix {
  statuses: string[];
  rows: { unitId: string | null; unitName: string; counts: number[]; total: number; projectIdsByStatus: string[][] | null }[];
  columnTotals: number[];
  total: number;
}

export interface BackendSprintProgress {
  projectId: string;
  sprints: {
    sprintNumber: number; name: string; sprintTotal: number; sprintCompleted: number;
    cumulativeTotal: number; cumulativeCompleted: number; cumulativeRemaining: number;
  }[];
}

const rep = '/api/reporting';

export const reportsApi = {
  /** The second level of the organisation chart is the "unit" the screens speak of (level 1 is the organisation itself). */
  units: (level = 2) => api.get<BackendUnitReport>(`${rep}/units/performance${query({ level })}`),
  managers: () => api.get<{ managers: BackendManagerEvaluation[] }>(`${rep}/project-managers/evaluation`),
  matrix: (level = 2) => api.get<BackendStatusMatrix>(`${rep}/units/status-matrix${query({ level })}`),
  sprintProgress: (projectId: string) =>
    api.get<BackendSprintProgress>(`/api/project-management/agile/sprint-progress${query({ projectId, metric: 1 })}`)
};
