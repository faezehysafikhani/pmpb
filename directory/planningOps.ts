import type { KanbanStatus, KanbanTask, ProgressUpdate, Project, ProjectActivity, ScheduleSnapshot } from '../types';
import { agile, BackendBaselineKind, progressOverview, waterfall } from '../services/backend/planning';
import { approvals } from '../services/backend/registers';
import {
  backendTaskStatusOf, dependencyCode, toActivityBody, toTaskBody, toUiPlan, toUiProgressFigures, toUiSnapshot, toUiSnapshotActivities,
  toWaterfallSettingsBody
} from '../services/backend/planningMappers';
import { loadPlanning } from '../services/backend/planningLoad';
import type { People } from '../services/backend/registerMappers';
import type { ProjectOutcome } from './ProjectsContext';

type Result = { ok: boolean; error?: { message: string; code: string } };

export interface PlanningDeps {
  tenantId: string | undefined;
  people: People;
  getProject: (id: string) => Project | undefined;
  patchProject: (id: string, patch: Partial<Project>) => void;
  /** Replaces the progress reports / status requests of one project (those the backend returned), leaving other projects' alone. */
  replaceUpdates: (projectId: string, updates: ProgressUpdate[]) => void;
  /** The Workflow instance that decides each item, by item id. */
  instances: Map<string, string>;
  /** The agile task a status request is about. */
  taskOfUpdate: (updateId: string) => string | undefined;
}

const fail = (message?: string, code?: string): ProjectOutcome => ({ ok: false, message, code });

/**
 * Everything the schedule, kanban and progress screens ask of the backend. Each write goes to the backend and the project's plan is read
 * back; nothing here works anything out (dates, weights, floats, percentages and approval states are the backend's).
 */
export function createPlanningOps(deps: PlanningDeps) {
  const { tenantId, people } = deps;
  const tenant = () => tenantId ?? '';

  /** The plan only (settings, activities, schedule) and the progress figures: what an edit to an activity can change. */
  const refreshPlan = async (projectId: string) => {
    const [plan, figures] = await Promise.all([waterfall.plan(projectId), progressOverview.forProjects([projectId])]);
    const patch: Partial<Project> = {};
    if (plan.ok && plan.value) {
      const view = toUiPlan(plan.value);
      Object.assign(patch, {
        schedule: view.schedule, weightingType: view.weightingType, plannedProgressType: view.plannedProgressType,
        timeWeightFactor: view.timeWeightFactor, costWeightFactor: view.costWeightFactor, complexityWeightFactor: view.complexityWeightFactor,
        scheduleInfo: view.scheduleInfo
      });
    }
    const figure = figures.value?.[0];
    if (figure) patch.progressFigures = toUiProgressFigures(figure);
    deps.patchProject(projectId, patch);
  };

  /** Everything about the project's plan, including its reports and requests (after a submission or a decision). */
  const refreshAll = async (projectId: string) => {
    const project = deps.getProject(projectId);
    if (!project) return;
    const loaded = await loadPlanning([{ id: projectId, type: project.type }], people);
    loaded.instanceByItem.forEach((instanceId, itemId) => deps.instances.set(itemId, instanceId));
    const planning = loaded.byProject.get(projectId);
    if (planning) deps.patchProject(projectId, planning);
    deps.replaceUpdates(projectId, loaded.progressUpdates);
  };

  const settle = async (projectId: string, result: Result, full = false): Promise<ProjectOutcome> => {
    await (full ? refreshAll(projectId) : project(projectId).type === 'agile' ? refreshAll(projectId) : refreshPlan(projectId));
    return result.ok ? { ok: true } : fail(result.error?.message, result.error?.code);
  };
  /** The task a status request is about, from the requests the project last loaded. */
  const loadedTaskOf = (_projectId: string, updateId: string): string | undefined => deps.taskOfUpdate(updateId);
  const project = (id: string) => deps.getProject(id) ?? ({ type: 'waterfall' } as Project);

  const ops = {
    // ---------------------------------------------------------------------------- waterfall: activities
    /** Adds an activity (under `parentId`, or at the top). The backend places it after the others and calculates the rest. */
    addActivity: async (projectId: string, parentId: string | null, name: string): Promise<ProjectOutcome & { activityId?: string }> => {
      const body = toActivityBody({
        id: '', name, duration: 1, prerequisiteId: null, weight: 0, assignedToId: null, actualProgress: 0, parentId,
        cost: 0, manHour: 0, importance: 'Medium', complexity: 'Medium', approver1Id: deps.getProject(projectId)?.projectManagerId ?? null
      }, 'manual');
      const created = await waterfall.createActivity(tenant(), projectId, body);
      const outcome = await settle(projectId, created);
      return { ...outcome, activityId: created.value?.id };
    },

    updateActivity: async (projectId: string, activity: ProjectActivity): Promise<ProjectOutcome> =>
      settle(projectId, await waterfall.updateActivity(activity.id, toActivityBody(activity, deps.getProject(projectId)?.weightingType))),

    setActivityPredecessor: async (
      projectId: string, activityId: string, predecessorId: string | null, type: ProjectActivity['prerequisiteType'], lag: number
    ): Promise<ProjectOutcome> =>
      settle(projectId, await waterfall.setPredecessor(tenant(), projectId, activityId, predecessorId, dependencyCode(type), Math.round(lag || 0))),

    deleteActivity: async (projectId: string, activityId: string): Promise<ProjectOutcome> =>
      settle(projectId, await waterfall.deleteActivity(activityId, true)),

    /** A direct correction of how much is done (no report, no approval). */
    setActivityActualProgress: async (projectId: string, activityId: string, progress: number): Promise<ProjectOutcome> =>
      settle(projectId, await waterfall.setActualProgress(activityId, Math.round(Math.min(100, Math.max(0, progress)) * 100) / 100)),

    /** Saves the project's weighting mode, factors and planned-progress mode. */
    saveWaterfallSettings: async (projectId: string, settings: Partial<Project>): Promise<ProjectOutcome> => {
      const current = deps.getProject(projectId);
      return settle(projectId, await waterfall.saveSettings(tenant(), projectId, toWaterfallSettingsBody({ ...current, ...settings })));
    },

    /**
     * Creates several activities in order (the AI assistant's suggestions): the ids the caller gave stand only for who is whose parent and
     * who comes after whom; the backend makes the real ones. Nothing is deleted unless `replace` is set (then every existing activity goes first).
     */
    saveActivities: async (projectId: string, activities: ProjectActivity[], replace: boolean): Promise<ProjectOutcome> => {
      const existing = deps.getProject(projectId)?.schedule ?? [];
      if (replace) {
        const topLevel = existing.filter(a => !a.parentId || !existing.some(x => x.id === a.parentId));
        for (const activity of topLevel) {
          const removed = await waterfall.deleteActivity(activity.id, true);
          if (!removed.ok) return settle(projectId, removed);
        }
      }

      const realId = new Map<string, string>();
      const pending = activities.filter(a => !existing.some(e => e.id === a.id) || replace);
      for (const activity of pending) {
        const parentId = activity.parentId ? realId.get(activity.parentId) ?? (existing.some(e => e.id === activity.parentId) ? activity.parentId : null) : null;
        const created = await waterfall.createActivity(tenant(), projectId, toActivityBody({ ...activity, parentId, isParent: false }, 'manual'));
        if (!created.ok || !created.value) return settle(projectId, created);
        realId.set(activity.id, created.value.id);
      }
      for (const activity of pending) {
        const predecessor = activity.prerequisiteId ? realId.get(activity.prerequisiteId) ?? null : null;
        if (!predecessor) continue;
        const linked = await waterfall.setPredecessor(tenant(), projectId, realId.get(activity.id)!, predecessor, dependencyCode(activity.prerequisiteType), Math.round(activity.lag || 0));
        if (!linked.ok) return settle(projectId, linked);
      }
      return settle(projectId, { ok: true });
    },

    // ---------------------------------------------------------------------------- waterfall: saved copies, S-curve, MS Project
    loadSnapshots: async (projectId: string): Promise<void> => {
      const list = await waterfall.baselines(projectId);
      if (list.ok) deps.patchProject(projectId, { scheduleSnapshots: (list.value ?? []).map(toUiSnapshot) });
    },

    createSnapshot: async (projectId: string, name: string, type: ScheduleSnapshot['type']): Promise<ProjectOutcome> => {
      const created = await waterfall.createBaseline(
        tenant(), projectId, name, type === 'Progress Information' ? BackendBaselineKind.ProgressInformation : BackendBaselineKind.Baseline);
      const list = await waterfall.baselines(projectId);
      if (list.ok) deps.patchProject(projectId, { scheduleSnapshots: (list.value ?? []).map(toUiSnapshot) });
      return created.ok ? { ok: true } : fail(created.error?.message, created.error?.code);
    },

    deleteSnapshot: async (projectId: string, snapshotId: string): Promise<ProjectOutcome> => {
      const removed = await waterfall.deleteBaseline(snapshotId);
      const list = await waterfall.baselines(projectId);
      if (list.ok) deps.patchProject(projectId, { scheduleSnapshots: (list.value ?? []).map(toUiSnapshot) });
      return removed.ok ? { ok: true } : fail(removed.error?.message, removed.error?.code);
    },

    /** The activities of one saved copy, for the page that shows it. */
    getSnapshotActivities: async (snapshotId: string): Promise<{ ok: boolean; message?: string; activities?: ProjectActivity[] }> => {
      const detail = await waterfall.baseline(snapshotId);
      return detail.ok && detail.value
        ? { ok: true, activities: toUiSnapshotActivities(detail.value.activities) }
        : { ok: false, message: detail.error?.message };
    },

    importMsProject: async (projectId: string, file: File, replaceExisting: boolean): Promise<ProjectOutcome & { warnings?: string[]; imported?: number }> => {
      const imported = await waterfall.importMsProject(projectId, file, replaceExisting);
      const outcome = await settle(projectId, imported);
      return { ...outcome, warnings: imported.value?.warnings, imported: imported.value?.activitiesImported };
    },

    exportMsProject: async (projectId: string, fileName: string): Promise<ProjectOutcome> => {
      const exported = await waterfall.exportMsProject(projectId, fileName);
      return exported.ok ? { ok: true } : fail(exported.error?.message, exported.error?.code);
    },

    // ---------------------------------------------------------------------------- agile
    saveKanbanTask: async (projectId: string, task: Partial<KanbanTask>): Promise<ProjectOutcome> => {
      const body = toTaskBody(task);
      const saved = task.id ? await agile.updateTask(task.id, body) : await agile.createTask(tenant(), projectId, body);
      return settle(projectId, saved, true);
    },

    deleteKanbanTask: async (projectId: string, taskId: string): Promise<ProjectOutcome> =>
      settle(projectId, await agile.deleteTask(taskId), true),

    setSprintCount: async (projectId: string, count: number): Promise<ProjectOutcome> =>
      settle(projectId, await agile.setSprintCount(tenant(), projectId, count), true),

    /** Applies a whole list of tasks from the AI assistant: new ones are created, nothing is removed unless `replace` is set. */
    saveKanbanTasks: async (projectId: string, tasks: KanbanTask[], replace: boolean): Promise<ProjectOutcome> => {
      const existing = deps.getProject(projectId)?.kanbanTasks ?? [];
      if (replace) {
        for (const task of existing) {
          const removed = await agile.deleteTask(task.id);
          if (!removed.ok) return settle(projectId, removed, true);
        }
      }
      for (const task of tasks.filter(t => replace || !existing.some(e => e.id === t.id))) {
        const created = await agile.createTask(tenant(), projectId, toTaskBody(task));
        if (!created.ok) return settle(projectId, created, true);
      }
      return settle(projectId, { ok: true }, true);
    },

    /** A project just created with its plan already filled in (the AI assistant): sprints, tasks and activities are saved with it. */
    syncNewProjectPlan: async (projectId: string, source: Project): Promise<ProjectOutcome> => {
      let result: Result = { ok: true };
      if (source.type === 'agile') {
        if (source.sprintCount) result = await agile.setSprintCount(tenant(), projectId, source.sprintCount);
        for (const task of source.kanbanTasks ?? []) {
          if (!result.ok) break;
          result = await agile.createTask(tenant(), projectId, toTaskBody(task));
        }
      } else if ((source.schedule ?? []).length) {
        return ops.saveActivities(projectId, source.schedule!, false);
      }
      return result.ok ? { ok: true } : fail(result.error?.message, result.error?.code);
    },

    // ---------------------------------------------------------------------------- progress reports and status requests
    /** A team member reports how far an activity has got; an approver confirms it (or the backend does at once when nothing is configured). */
    submitActivityProgress: async (
      projectId: string, activityId: string, progress: number, comment: string, documentName?: string
    ): Promise<ProjectOutcome> =>
      settle(projectId, await waterfall.submitReport(tenant(), projectId, activityId, progress, comment || null, documentName ?? null), true),

    requestTaskStatus: async (projectId: string, taskId: string, status: KanbanStatus, comment: string): Promise<ProjectOutcome> =>
      settle(projectId, await agile.requestStatus(tenant(), projectId, taskId, backendTaskStatusOf(status), comment || null), true),

    /**
     * Approves or rejects a report / status request in the approval workflow. An approver who confirms a different figure than the reported
     * one (or rejects but keeps a confirmed one) passes it as `confirmedProgress`; the backend applies it.
     */
    decideUpdate: async (
      projectId: string, updateId: string, approve: boolean, comment?: string, confirmedProgress?: number, confirmedStatus?: KanbanStatus
    ): Promise<ProjectOutcome> => {
      let instanceId = deps.instances.get(updateId);
      if (!instanceId) {
        await refreshAll(projectId);
        instanceId = deps.instances.get(updateId);
      }
      if (!instanceId) return fail('این مورد در گردش کار تأیید قرار ندارد.', 'not_found');

      if (confirmedProgress !== undefined) {
        const confirmed = await waterfall.confirmProgress(updateId, confirmedProgress);
        if (!confirmed.ok) return settle(projectId, confirmed, true);
      }
      const decided = approve ? await approvals.approve(instanceId, comment ?? null) : await approvals.reject(instanceId, comment ?? null);
      // A task request refused with a confirmed state (the approver says it is further along than it was, but not as far as asked): the task takes it.
      if (decided.ok && confirmedStatus) {
        const taskId = (loadedTaskOf(projectId, updateId));
        if (taskId) await agile.setTaskStatus(taskId, backendTaskStatusOf(confirmedStatus));
      }
      return settle(projectId, decided, true);
    }
  };
  return ops;
}

export type PlanningOps = ReturnType<typeof createPlanningOps>;
