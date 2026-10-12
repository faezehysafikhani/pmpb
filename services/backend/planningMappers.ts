import type {
  KanbanStatus, KanbanTask, ProgressUpdate, Project, ProjectActivity, ProjectApprovalRecord, ProjectProgressFigures, ScheduleSnapshot, TaskPriority
} from '../../types';
import { BackendApprovalStatus } from './projects';
import { BackendInstanceStatus } from './registers';
import type { BackendInstance } from './registers';
import {
  BackendBaselineKind, BackendDependency, BackendLevel, BackendPlannedMode, BackendTaskPriority, BackendTaskStatus, BackendWeighting
} from './planning';
import type {
  ActivityBody, AgileTaskBody, BackendActivity, BackendAgileTask, BackendBaseline, BackendBaselineActivity, BackendPlan, BackendProgressReport,
  BackendProjectProgress, BackendSCurve, BackendSprint, BackendStatusRequest, BackendWaterfallSettings
} from './planning';
import type { People } from './registerMappers';

/**
 * Shape adapters only (no rule lives here): the backend's plan, tasks and reports become the objects the schedule / kanban screens use.
 * Dates, floats, the critical path, WBS codes, weights and every progress figure are the backend's own calculation.
 */
const day = (iso: string | null | undefined): Date | undefined => {
  if (!iso) return undefined;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const LEVEL_BY_NAME: Record<string, number> = { Low: BackendLevel.Low, Medium: BackendLevel.Medium, High: BackendLevel.High };
const NAME_BY_LEVEL: Record<number, 'Low' | 'Medium' | 'High'> = { 0: 'Low', 1: 'Medium', 2: 'High' };
const DEP_NAME: Record<number, 'FS' | 'SS' | 'FF' | 'SF'> = { 0: 'FS', 1: 'SS', 2: 'FF', 3: 'SF' };

// ------------------------------------------------------------------------------------------------- waterfall plan

export interface PlanView {
  schedule: ProjectActivity[];
  weightingType: NonNullable<Project['weightingType']>;
  plannedProgressType: NonNullable<Project['plannedProgressType']>;
  timeWeightFactor: number;
  costWeightFactor: number;
  complexityWeightFactor: number;
  scheduleInfo: NonNullable<Project['scheduleInfo']>;
  planned: number;
  actual: number;
}

const WEIGHTING_BY_VALUE = Object.fromEntries(Object.entries(BackendWeighting).map(([name, value]) => [value, name])) as Record<number, NonNullable<Project['weightingType']>>;
const PLANNED_BY_VALUE = Object.fromEntries(Object.entries(BackendPlannedMode).map(([name, value]) => [value, name])) as Record<number, string>;

export function toUiPlan(plan: BackendPlan): PlanView {
  const scheduled = new Map(plan.schedule.activities.map(a => [a.id, a]));
  const incoming = new Map(plan.dependencies.map(d => [d.successorActivityId, d]));
  const outgoing = new Map<string, string[]>();
  for (const d of plan.dependencies) outgoing.set(d.predecessorActivityId, [...(outgoing.get(d.predecessorActivityId) ?? []), d.successorActivityId]);
  const hasChildren = new Set(plan.activities.map(a => a.parentActivityId).filter((id): id is string => !!id));

  const schedule: ProjectActivity[] = plan.activities.map(a => {
    const s = scheduled.get(a.id);
    const link = incoming.get(a.id);
    return {
      id: a.id,
      name: a.name,
      duration: s?.durationDays ?? a.durationDays ?? 1,
      prerequisiteId: link?.predecessorActivityId ?? null,
      prerequisiteType: link ? DEP_NAME[link.type] : 'FS',
      lag: link?.lagDays ?? 0,
      cost: s?.cost ?? a.cost ?? 0,
      manHour: s?.manHours ?? a.manHours ?? 0,
      importance: NAME_BY_LEVEL[a.importance] ?? 'Medium',
      complexity: NAME_BY_LEVEL[a.complexity] ?? 'Medium',
      weight: s?.weight ?? a.weight,
      manualWeight: a.weight,
      isMilestone: a.isMilestone,
      assignedToId: a.responsibleUserId,
      approver1Id: a.approverUserId,
      approver2Id: null,
      approver3Id: null,
      actualProgress: s?.actualProgress ?? a.actualProgress,
      plannedProgress: s?.plannedProgress ?? a.plannedProgress,
      parentId: a.parentActivityId,
      wbsCode: s?.wbsCode,
      startDate: day(s?.start ?? a.startDate),
      endDate: day(s?.finish ?? a.endDate),
      lateStartDate: day(s?.lateStart),
      lateEndDate: day(s?.lateFinish),
      totalFloat: s?.totalFloatDays ?? 0,
      freeFloat: s?.freeFloatDays ?? 0,
      isCritical: s?.isCritical ?? false,
      level: s?.level ?? 1,
      isParent: hasChildren.has(a.id),
      successors: outgoing.get(a.id) ?? []
    };
  });

  const settings = plan.settings;
  return {
    schedule,
    weightingType: WEIGHTING_BY_VALUE[settings.weighting] ?? 'manual',
    plannedProgressType: (PLANNED_BY_VALUE[settings.plannedProgress] === 'zero-hundred' ? 'zero-hundred' : 'continuous'),
    timeWeightFactor: settings.timeFactor,
    costWeightFactor: settings.costFactor,
    complexityWeightFactor: settings.complexityFactor,
    scheduleInfo: {
      projectStart: plan.schedule.projectStart,
      projectFinish: plan.schedule.projectFinish,
      projectDurationDays: plan.schedule.projectDurationDays,
      warnings: plan.schedule.warnings,
      criticalPath: plan.schedule.criticalPath
    },
    planned: plan.schedule.plannedProgress,
    actual: plan.schedule.actualProgress
  };
}

/** What the backend needs to store an activity. `weighting` decides whether the typed weight or the one worked out is the one to keep. */
export function toActivityBody(activity: ProjectActivity, weighting: Project['weightingType']): ActivityBody {
  const isGroup = !!activity.isParent;
  const weight = isGroup ? 0 : weighting === 'manual' || weighting === undefined ? activity.weight : activity.manualWeight ?? 0;
  return {
    parentActivityId: activity.parentId,
    name: (activity.name ?? '').trim() || '-',
    description: null,
    deliverableId: null,
    responsibleUserId: activity.assignedToId ? String(activity.assignedToId) : null,
    approverUserId: activity.approver1Id ? String(activity.approver1Id) : null,
    startDate: null,
    endDate: null,
    durationDays: isGroup ? null : Math.max(0, Math.round(Number(activity.duration) || 0)),
    manHours: isGroup ? null : Number(activity.manHour) || 0,
    weight: Math.min(100, Math.max(0, Number(weight) || 0)),
    isMilestone: null,
    cost: isGroup ? null : Math.max(0, Number(activity.cost) || 0),
    importance: LEVEL_BY_NAME[activity.importance ?? 'Medium'] ?? BackendLevel.Medium,
    complexity: LEVEL_BY_NAME[activity.complexity ?? 'Medium'] ?? BackendLevel.Medium
  };
}

export const dependencyCode = (type: ProjectActivity['prerequisiteType']): number => BackendDependency[type ?? 'FS'];

export function toWaterfallSettingsBody(project: Partial<Project>): Omit<BackendWaterfallSettings, 'projectId' | 'isDefault'> {
  return {
    weighting: BackendWeighting[project.weightingType ?? 'manual'],
    timeFactor: Math.round(project.timeWeightFactor ?? 34),
    costFactor: Math.round(project.costWeightFactor ?? 33),
    complexityFactor: Math.round(project.complexityWeightFactor ?? 33),
    plannedProgress: BackendPlannedMode[project.plannedProgressType ?? 'continuous']
  };
}

// ------------------------------------------------------------------------------------------------- saved copies and the S-curve

export const toUiSnapshot = (b: BackendBaseline): ScheduleSnapshot => ({
  id: b.id,
  name: b.name,
  date: b.createdAtUtc,
  type: b.kind === BackendBaselineKind.ProgressInformation ? 'Progress Information' : 'Baseline',
  actualProgress: b.actualProgress,
  plannedProgress: b.plannedProgress
});

/** The activities of a saved copy, as the screens' tree (parents and WBS order come from the copy; its numbers are the ones saved then). */
export function toUiSnapshotActivities(rows: BackendBaselineActivity[]): ProjectActivity[] {
  const parents = new Set(rows.map(r => r.parentActivityId).filter((id): id is string => !!id));
  return rows.map(r => ({
    id: r.activityId,
    name: r.name,
    duration: r.durationDays,
    prerequisiteId: null,
    weight: r.weight,
    assignedToId: r.responsibleUserId,
    actualProgress: r.actualProgress,
    plannedProgress: r.plannedProgress,
    parentId: r.parentActivityId,
    wbsCode: r.wbsCode,
    startDate: day(r.startDate),
    endDate: day(r.endDate),
    isParent: parents.has(r.activityId),
    level: Math.max(1, (r.wbsCode.match(/\./g)?.length ?? 0) + 1)
  }));
}

export interface SCurvePointView {
  dateLabel: string;
  isoDate: string;
  date: Date;
  plannedProgress: number;
  actualProgress: number | null;
  hasActualSnapshot: boolean;
  dayIndex: number;
}

/** The planned line sampled by the backend, with each saved progress point of the project put on its own date. */
export function toSCurvePoints(curve: BackendSCurve, label: (date: Date) => string): SCurvePointView[] {
  const start = day(curve.projectStart)!;
  const byDate = new Map<string, SCurvePointView>();
  const put = (iso: string, planned: number | null, actual: number | null) => {
    const date = day(iso)!;
    const existing = byDate.get(iso);
    byDate.set(iso, {
      dateLabel: label(date),
      isoDate: iso,
      date,
      plannedProgress: planned ?? existing?.plannedProgress ?? 0,
      actualProgress: actual ?? existing?.actualProgress ?? null,
      hasActualSnapshot: actual !== null || !!existing?.hasActualSnapshot,
      dayIndex: Math.round((date.getTime() - start.getTime()) / 86400000)
    });
  };
  for (const p of curve.planned) put(p.date, p.plannedProgress, null);
  for (const a of curve.actual) put(a.date, a.plannedProgress, a.actualProgress);
  return [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ------------------------------------------------------------------------------------------------- agile

const UI_STATUS: Record<number, KanbanStatus> = { 0: 'To-Do', 1: 'Doing', 2: 'Done', 3: 'Doing' };
const UI_PRIORITY: Record<number, TaskPriority> = { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'High' };

export const uiTaskStatusOf = (status: number): KanbanStatus => UI_STATUS[status] ?? 'To-Do';

export const toUiTask = (t: BackendAgileTask): KanbanTask => ({
  id: t.id,
  description: t.title,
  dueDate: t.dueDate ?? '',
  priority: UI_PRIORITY[t.priority] ?? 'Medium',
  assignedToId: t.responsibleUserId,
  status: UI_STATUS[t.status] ?? 'To-Do',
  sprintNumber: t.sprintNumber ?? undefined,
  approver1Id: t.approverUserId,
  approver2Id: null,
  approver3Id: null
});

export const toTaskBody = (task: Partial<KanbanTask>): AgileTaskBody => ({
  title: (task.description ?? '').trim(),
  description: null,
  responsibleUserId: task.assignedToId ? String(task.assignedToId) : null,
  approverUserId: task.approver1Id ? String(task.approver1Id) : null,
  dueDate: task.dueDate ? task.dueDate.slice(0, 10) : null,
  priority: BackendTaskPriority[task.priority ?? 'Medium'],
  sprintNumber: task.sprintNumber ?? null
});

export const backendTaskStatusOf = (status: KanbanStatus): number => BackendTaskStatus[status];

export const sprintCountOf = (sprints: BackendSprint[]): number => (sprints.length ? Math.max(...sprints.map(s => s.number)) : 0);

// ------------------------------------------------------------------------------------------------- progress reports and status requests

const UI_REVIEW = (status: number): ProgressUpdate['status'] =>
  status === BackendApprovalStatus.Approved ? 'Approved' : status === BackendApprovalStatus.Rejected ? 'Rejected' : 'Pending Approval';

function historyOf(instance: BackendInstance | undefined, people: People): ProjectApprovalRecord[] {
  return (instance?.decisions ?? [])
    .slice()
    .sort((a, b) => a.stepOrder - b.stepOrder || a.decidedAtUtc.localeCompare(b.decidedAtUtc))
    .map(d => ({
      action: d.approved ? 'Approved' : 'Rejected',
      date: d.decidedAtUtc,
      comment: d.comment ?? undefined,
      actor: people.labelOf(d.decidedByUserId),
      stageTitle: `${d.stepOrder}`
    }));
}

function reviewOf(instance: BackendInstance | undefined): Pick<ProgressUpdate, 'currentApproverId' | 'currentStageIndex' | 'reviewComment' | 'reviewDate'> {
  const last = instance?.decisions.slice().sort((a, b) => b.decidedAtUtc.localeCompare(a.decidedAtUtc))[0];
  return {
    currentApproverId: instance?.status === BackendInstanceStatus.InProgress ? instance.currentApproverUserId ?? undefined : undefined,
    currentStageIndex: instance ? Math.max(0, instance.currentStepOrder - 1) : 0,
    reviewComment: last?.comment ?? undefined,
    reviewDate: last?.decidedAtUtc
  };
}

export function toUiReport(r: BackendProgressReport, instance: BackendInstance | undefined, people: People): ProgressUpdate {
  return {
    id: r.id,
    projectId: r.projectId,
    activityId: r.activityId,
    submittedBy: r.submittedByUserId ?? '',
    submittedProgress: r.submittedProgress,
    approvedProgress: r.approvedProgress ?? (r.approvalStatus === BackendApprovalStatus.Approved ? r.submittedProgress : undefined),
    isPartialRejection: r.isPartialRejection,
    status: UI_REVIEW(r.approvalStatus),
    submissionDate: r.submittedAtUtc,
    submissionComment: r.comment ?? undefined,
    documentName: r.documentName ?? undefined,
    approvalHistory: [
      { action: 'Submitted', date: r.submittedAtUtc, actor: people.labelOf(r.submittedByUserId), comment: r.comment ?? undefined },
      ...historyOf(instance, people)
    ],
    ...reviewOf(instance)
  };
}

export function toUiStatusRequest(r: BackendStatusRequest, instance: BackendInstance | undefined, people: People): ProgressUpdate {
  return {
    id: r.id,
    projectId: r.projectId,
    taskId: r.taskId,
    submittedBy: r.submittedByUserId ?? '',
    submittedStatus: UI_STATUS[r.submittedStatus] ?? 'To-Do',
    currentStatus: UI_STATUS[r.previousStatus] ?? 'To-Do',
    status: UI_REVIEW(r.approvalStatus),
    submissionDate: r.submittedAtUtc,
    submissionComment: r.comment ?? undefined,
    approvalHistory: [
      { action: 'Submitted', date: r.submittedAtUtc, actor: people.labelOf(r.submittedByUserId), comment: r.comment ?? undefined },
      ...historyOf(instance, people)
    ],
    ...reviewOf(instance)
  };
}

export const toUiProgressFigures = (p: BackendProjectProgress): ProjectProgressFigures => ({
  plannedProgress: p.plannedProgress,
  actualProgress: p.actualProgress,
  performance: p.performance,
  totalTasks: p.totalTasks ?? undefined,
  todoTasks: p.todoTasks ?? undefined,
  doingTasks: p.doingTasks ?? undefined,
  doneTasks: p.doneTasks ?? undefined
});

export type { BackendActivity };
