import type { ActionItem, ActionRecurrence, ProgressUpdate, Project, WorkStatus } from '../../types';
import { BackendApprovalStatus } from './projects';
import { BackendActionStatus, BackendRecurrenceUnit } from './actions';
import type { ActionBody, BackendAction, BackendActionRecurrence, BackendActionStatusRequest } from './actions';
import { BackendInstanceStatus } from './registers';
import type { BackendInstance } from './registers';
import { approvalOf } from './registerMappers';
import type { People } from './registerMappers';

/**
 * Shape adapters only: the backend's action records become the objects the action screens already use. Whether an action is approved,
 * pending or rejected, who decides next and the decision history all come from the backend (its approval status plus its Workflow instance).
 */

const UI_STATUS: Record<number, WorkStatus> = {
  [BackendActionStatus.Planning]: 'Planning',
  [BackendActionStatus['In Progress']]: 'In Progress',
  [BackendActionStatus.Completed]: 'Completed',
  [BackendActionStatus.Cancelled]: 'On Hold',
  [BackendActionStatus['On Hold']]: 'On Hold'
};

export const backendActionStatusOf = (status: WorkStatus | undefined): number =>
  BackendActionStatus[(status ?? 'Planning') as keyof typeof BackendActionStatus] ?? BackendActionStatus.Planning;

const UNIT_NAME: Record<number, ActionRecurrence['frequency']> = {
  [BackendRecurrenceUnit.daily]: 'daily',
  [BackendRecurrenceUnit.weekly]: 'weekly',
  [BackendRecurrenceUnit.monthly]: 'monthly',
  [BackendRecurrenceUnit.yearly]: 'monthly'
};

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

function toUiRecurrence(rule: BackendActionRecurrence | null): ActionRecurrence | undefined {
  if (!rule) return undefined;
  const months = rule.months ?? [];
  return {
    isRecurring: true,
    enabled: true,
    frequency: UNIT_NAME[rule.unit] ?? 'daily',
    interval: rule.interval,
    durationHours: rule.durationHours ?? undefined,
    daysOfWeek: rule.daysOfWeek ?? undefined,
    dayOfMonth: rule.dayOfMonth ?? undefined,
    monthsOfYear: months.length ? months : undefined,
    allMonths: months.length === 0
  };
}

export interface ActionLookups {
  /** The organisation unit's path (what the screens show and choose) for a unit id. */
  unitPathById: Map<string, string>;
  /** The projects, to describe where an action came from (a risk or a stakeholder of one of them). */
  projects: Project[];
}

function sourceOf(action: BackendAction, lookups: ActionLookups): Pick<ActionItem, 'sourceType' | 'sourceRiskId' | 'sourceStakeholderId' | 'sourceInfo'> {
  const project = lookups.projects.find(p => p.id === action.projectId);
  if (action.sourceType === 'Risk' && action.sourceId) {
    const risk = project?.risks?.find(r => r.id === action.sourceId);
    return {
      sourceType: 'risk',
      sourceRiskId: action.sourceId,
      sourceInfo: { type: 'risk', projectName: project?.name, riskTitle: risk?.description, riskPlan: risk?.responsePlan }
    };
  }
  if (action.sourceType === 'Stakeholder' && action.sourceId) {
    const stakeholder = project?.stakeholders?.find(s => s.id === action.sourceId);
    return {
      sourceType: 'stakeholder',
      sourceStakeholderId: action.sourceId,
      sourceInfo: { type: 'stakeholder', projectName: project?.name, stakeholderName: stakeholder?.name, stakeholderStrategy: stakeholder?.strategy }
    };
  }
  return { sourceType: 'manual' };
}

export function toUiAction(action: BackendAction, instance: BackendInstance | undefined, people: People, lookups: ActionLookups): ActionItem {
  const approval = approvalOf(action.approvalStatus, instance, people);
  const approvers = action.approverUserIds ?? [];
  return {
    id: action.id,
    title: action.title,
    description: action.description ?? '',
    ownerUserId: action.ownerUserId,
    responsibleUserId: action.responsibleUserId,
    approver1Id: approvers[0] ?? null,
    approver2Id: approvers[1] ?? null,
    approver3Id: approvers[2] ?? null,
    status: UI_STATUS[action.status] ?? 'Planning',
    calendarId: action.workCalendarId,
    startDate: day(action.startDate),
    endDate: day(action.endDate),
    owningUnit: lookups.unitPathById.get(action.organizationUnitId) ?? '',
    projectId: action.projectId ?? undefined,
    recurrence: toUiRecurrence(action.recurrence),
    workflowType: 'actions',
    isApproved: approval.isApproved,
    isRejected: approval.isRejected,
    isPending: action.approvalStatus === BackendApprovalStatus.PendingApproval,
    currentStageIndex: approval.currentStageIndex,
    currentApproverId: approval.currentApproverId,
    approvalHistory: approval.approvalHistory,
    ...sourceOf(action, lookups)
  };
}

/** What the form holds becomes the request. A missing organisation unit is reported by the caller (the form checks it). */
export function toActionBody(action: Partial<ActionItem>, unitIdByPath: Map<string, string>): ActionBody | null {
  const unitId = unitIdByPath.get(action.owningUnit ?? '');
  if (!unitId || !action.calendarId) return null;
  const rule = action.recurrence;
  const recurring = !!(rule?.isRecurring || rule?.enabled);
  const sourceType = action.sourceType === 'risk' ? 'Risk' : action.sourceType === 'stakeholder' ? 'Stakeholder' : null;
  const sourceId = action.sourceType === 'risk' ? action.sourceRiskId : action.sourceType === 'stakeholder' ? action.sourceStakeholderId : null;
  const months = recurring && rule?.frequency === 'monthly' && !rule.allMonths ? rule.monthsOfYear ?? [] : [];
  return {
    title: (action.title ?? '').trim(),
    description: action.description?.trim() || null,
    ownerUserId: action.ownerUserId ? String(action.ownerUserId) : null,
    responsibleUserId: action.responsibleUserId ? String(action.responsibleUserId) : null,
    organizationUnitId: unitId,
    workCalendarId: String(action.calendarId),
    projectId: action.projectId ? String(action.projectId) : null,
    startDate: action.startDate ? action.startDate.slice(0, 10) : null,
    endDate: action.endDate ? action.endDate.slice(0, 10) : null,
    sourceType,
    sourceId: sourceId ? String(sourceId) : null,
    approverUserIds: [action.approver1Id, action.approver2Id, action.approver3Id].filter((id): id is string => !!id).map(String),
    recurrence: {
      unit: recurring ? BackendRecurrenceUnit[rule!.frequency] : null,
      interval: Math.max(1, Math.round(rule?.interval || 1)),
      daysOfWeek: recurring && rule?.frequency === 'weekly' ? rule.daysOfWeek ?? null : null,
      dayOfMonth: recurring && rule?.frequency === 'monthly' ? rule.dayOfMonth ?? null : null,
      months: months.length ? months : null,
      durationHours: recurring ? rule?.durationHours ?? null : null
    }
  };
}

/** A request to change an action's status, as the task and approval centres list it. */
export function toUiActionStatusRequest(r: BackendActionStatusRequest, instance: BackendInstance | undefined, people: People): ProgressUpdate {
  const last = instance?.decisions.slice().sort((a, b) => b.decidedAtUtc.localeCompare(a.decidedAtUtc))[0];
  const status = r.approvalStatus === BackendApprovalStatus.Approved ? 'Approved' : r.approvalStatus === BackendApprovalStatus.Rejected ? 'Rejected' : 'Pending Approval';
  return {
    id: r.id,
    projectId: r.projectId ?? undefined,
    actionId: r.actionId,
    submittedBy: r.submittedByUserId ?? '',
    submittedStatus: UI_STATUS[r.submittedStatus],
    currentStatus: UI_STATUS[r.previousStatus],
    status,
    submissionDate: r.submittedAtUtc,
    submissionComment: r.comment ?? undefined,
    approvalHistory: [
      { action: 'Submitted', date: r.submittedAtUtc, actor: people.labelOf(r.submittedByUserId), comment: r.comment ?? undefined },
      ...(instance?.decisions ?? [])
        .slice()
        .sort((a, b) => a.stepOrder - b.stepOrder || a.decidedAtUtc.localeCompare(b.decidedAtUtc))
        .map(d => ({
          action: d.approved ? ('Approved' as const) : ('Rejected' as const),
          date: d.decidedAtUtc,
          comment: d.comment ?? undefined,
          actor: people.labelOf(d.decidedByUserId),
          stageTitle: `${d.stepOrder}`
        }))
    ],
    currentApproverId: instance?.status === BackendInstanceStatus.InProgress ? instance.currentApproverUserId ?? undefined : undefined,
    currentStageIndex: instance ? Math.max(0, instance.currentStepOrder - 1) : 0,
    reviewComment: last?.comment ?? undefined,
    reviewDate: last?.decidedAtUtc
  };
}
