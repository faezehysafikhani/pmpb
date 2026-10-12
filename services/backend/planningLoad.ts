import type { ProgressUpdate, Project } from '../../types';
import { agile, progressOverview, waterfall } from './planning';
import { approvals, SubjectType } from './registers';
import type { BackendInstance } from './registers';
import {
  sprintCountOf, toUiPlan, toUiProgressFigures, toUiReport, toUiStatusRequest, toUiTask
} from './planningMappers';
import type { People } from './registerMappers';

/** What the backend holds about one project's plan, as the fields of the screens' Project object. */
export type ProjectPlanning = Pick<
  Project,
  'schedule' | 'kanbanTasks' | 'sprintCount' | 'weightingType' | 'plannedProgressType' | 'timeWeightFactor' | 'costWeightFactor'
  | 'complexityWeightFactor' | 'progressFigures' | 'scheduleInfo'
>;

export interface LoadedPlanning {
  byProject: Map<string, ProjectPlanning>;
  /** Progress reports and status requests of every project (what the task centre and approval centre list). */
  progressUpdates: ProgressUpdate[];
  /** The Workflow instance that decides each report / request, by its id. */
  instanceByItem: Map<string, string>;
  error: string | null;
}

export interface ProjectKind {
  id: string;
  type: 'waterfall' | 'agile';
}

/**
 * Reads the plan of every project with a handful of batch calls: the waterfall plans (settings, activities, dependencies, the calculated
 * schedule), the agile tasks and sprints, the progress figures, and the reports / status requests with their approval histories. A part that
 * fails to load is left empty and reported in `error`.
 */
export async function loadPlanning(projects: ProjectKind[], people: People): Promise<LoadedPlanning> {
  const byProject = new Map<string, ProjectPlanning>(projects.map(p => [p.id, { schedule: [], kanbanTasks: [] }]));
  const instanceByItem = new Map<string, string>();
  const progressUpdates: ProgressUpdate[] = [];
  if (projects.length === 0) return { byProject, progressUpdates, instanceByItem, error: null };

  let error: string | null = null;
  const note = (result: { ok: boolean; error?: { message: string } }) => {
    if (!result.ok && !error) error = result.error?.message ?? 'Loading failed.';
  };

  const all = projects.map(p => p.id);
  const waterfallIds = projects.filter(p => p.type === 'waterfall').map(p => p.id);
  const agileIds = projects.filter(p => p.type === 'agile').map(p => p.id);

  const none = <T,>() => ({ ok: true, value: [] as T[] });
  const [plans, reports, tasks, sprints, requests, figures] = await Promise.all([
    waterfallIds.length ? waterfall.plans(waterfallIds) : Promise.resolve(none<never>()),
    waterfallIds.length ? waterfall.reports(waterfallIds) : Promise.resolve(none<never>()),
    agileIds.length ? agile.tasks(agileIds) : Promise.resolve(none<never>()),
    agileIds.length ? agile.sprints(agileIds) : Promise.resolve(none<never>()),
    agileIds.length ? agile.statusRequests(agileIds) : Promise.resolve(none<never>()),
    progressOverview.forProjects(all)
  ]);
  [plans, reports, tasks, sprints, requests, figures].forEach(note);

  const lookup = async (subjectType: string, ids: string[]): Promise<Map<string, BackendInstance>> => {
    const found = new Map<string, BackendInstance>();
    if (ids.length === 0) return found;
    const result = await approvals.forSubjects(subjectType, ids);
    note(result);
    for (const instance of result.value ?? []) {
      found.set(instance.subjectId, instance);
      instanceByItem.set(instance.subjectId, instance.id);
    }
    return found;
  };
  const sent = <T extends { id: string; approvalStatus: number }>(items: T[] | undefined) => (items ?? []).filter(i => i.approvalStatus !== 0).map(i => i.id);
  const [reportFlow, requestFlow] = await Promise.all([
    lookup(SubjectType.activityProgress, sent(reports.value as any)),
    lookup(SubjectType.taskStatus, sent(requests.value as any))
  ]);

  const of = (projectId: string) => byProject.get(projectId) ?? { schedule: [], kanbanTasks: [] };

  for (const plan of (plans.value ?? []) as any[]) {
    const view = toUiPlan(plan);
    Object.assign(of(plan.projectId), {
      schedule: view.schedule,
      weightingType: view.weightingType,
      plannedProgressType: view.plannedProgressType,
      timeWeightFactor: view.timeWeightFactor,
      costWeightFactor: view.costWeightFactor,
      complexityWeightFactor: view.complexityWeightFactor,
      scheduleInfo: view.scheduleInfo
    });
  }

  const sprintsByProject = new Map<string, any[]>();
  for (const sprint of (sprints.value ?? []) as any[]) sprintsByProject.set(sprint.projectId, [...(sprintsByProject.get(sprint.projectId) ?? []), sprint]);
  for (const id of agileIds) of(id).sprintCount = sprintCountOf(sprintsByProject.get(id) ?? []);
  for (const task of (tasks.value ?? []) as any[]) of(task.projectId).kanbanTasks!.push(toUiTask(task));

  for (const figure of figures.value ?? []) of(figure.projectId).progressFigures = toUiProgressFigures(figure);

  for (const report of (reports.value ?? []) as any[]) progressUpdates.push(toUiReport(report, reportFlow.get(report.id), people));
  for (const request of (requests.value ?? []) as any[]) progressUpdates.push(toUiStatusRequest(request, requestFlow.get(request.id), people));
  progressUpdates.sort((a, b) => b.submissionDate.localeCompare(a.submissionDate));

  return { byProject, progressUpdates, instanceByItem, error };
}
