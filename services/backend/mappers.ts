import type { Calendar, OwningUnitTreeNode, Project, ProjectApprovalStatus, ProjectType, User, UserRole, WorkStatus } from '../../types';
import type { BackendUser } from './auth';
import type { BackendCalendar, BackendMember, BackendUnit, CalendarSaveBody } from './directory';
import { BackendApprovalStatus, BackendProjectStatus, BackendProjectType } from './projects';
import type { BackendProject, ProjectSaveBody } from './projects';

/**
 * Shape adapters only: the backend's records become the objects the screens already use. No rule lives here.
 *
 * Roles are the one transitional piece: the old screens group people as Admin / Project Manager / Project Team,
 * which are the names of the backend roles (the built-in "Administrator" and the seeded "Project Manager" and
 * "Project Team"). What a person may actually DO is decided by the backend from their permissions.
 */
export const ADMIN_ROLE_NAME = 'Administrator';
export const UI_ROLE_TO_BACKEND_ROLE: Record<UserRole, string> = {
  Admin: ADMIN_ROLE_NAME,
  'Project Manager': 'Project Manager',
  'Project Team': 'Project Team'
};

export function uiRoleOf(user: Pick<BackendUser, 'roles' | 'isSystem'>): UserRole {
  if (user.isSystem || user.roles.includes(ADMIN_ROLE_NAME)) return 'Admin';
  if (user.roles.includes('Project Manager')) return 'Project Manager';
  return 'Project Team';
}

export function toUiUser(user: BackendUser, memberByUser: Map<string, BackendMember>): User {
  return {
    id: user.id,
    username: user.username || user.email || user.id,
    name: user.displayName,
    role: uiRoleOf(user),
    isActive: user.isActive,
    owningUnit: memberByUser.get(user.id)?.unitPath,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    phoneNumber: user.phoneNumber ?? undefined,
    email: user.email ?? undefined,
    roleNames: user.roles
  };
}

export function toUnitNodes(units: BackendUnit[]): OwningUnitTreeNode[] {
  return units.map(u => ({ id: u.id, name: u.name, parentId: u.parentId }));
}

/** Day numbers the screens use: 0 = Sunday ... 6 = Saturday - the same as the backend's bit positions. */
export function maskToDays(mask: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter(day => (mask & (1 << day)) !== 0);
}

export function daysToMask(days: number[]): number {
  return days.reduce((mask, day) => mask | (1 << day), 0);
}

export function toUiCalendar(calendar: BackendCalendar): Calendar {
  return {
    id: calendar.id,
    name: calendar.name,
    isDefault: calendar.isDefault,
    workingDays: maskToDays(calendar.workingDays),
    specificHolidays: calendar.exceptions.filter(e => !e.isWorkingDay).map(e => ({ date: e.date, reason: e.description ?? '' })),
    extraWorkingDays: calendar.exceptions.filter(e => e.isWorkingDay).map(e => ({ date: e.date, reason: e.description ?? '' })),
    applyOfficialHolidays: calendar.applyOfficialHolidays,
    workHoursPerDay: calendar.workHoursPerDay
  };
}

export function toCalendarBody(calendar: Calendar): CalendarSaveBody {
  return {
    name: calendar.name.trim(),
    workingDays: daysToMask(calendar.workingDays),
    isDefault: !!calendar.isDefault,
    workHoursPerDay: calendar.workHoursPerDay,
    applyOfficialHolidays: calendar.applyOfficialHolidays !== false,
    exceptions: [
      ...(calendar.specificHolidays ?? []).map(h => ({ date: h.date, isWorkingDay: false, description: h.reason || null })),
      ...(calendar.extraWorkingDays ?? []).map(h => ({ date: h.date, isWorkingDay: true, description: h.reason || null }))
    ]
  };
}

// ------------------------------------------------------------------------------------------------- projects

const UI_STATUS_BY_BACKEND: Record<number, WorkStatus> = {
  [BackendProjectStatus.Draft]: 'Planning',
  [BackendProjectStatus.Active]: 'In Progress',
  [BackendProjectStatus.OnHold]: 'On Hold',
  [BackendProjectStatus.Completed]: 'Completed',
  [BackendProjectStatus.Archived]: 'Completed'
};

const BACKEND_STATUS_BY_UI: Record<WorkStatus, number> = {
  Planning: BackendProjectStatus.Draft,
  'In Progress': BackendProjectStatus.Active,
  'On Hold': BackendProjectStatus.OnHold,
  Completed: BackendProjectStatus.Completed
};

const UI_APPROVAL_BY_BACKEND: Record<number, ProjectApprovalStatus> = {
  [BackendApprovalStatus.NotSubmitted]: 'Draft',
  [BackendApprovalStatus.PendingApproval]: 'Pending Approval',
  [BackendApprovalStatus.Approved]: 'Approved',
  [BackendApprovalStatus.Rejected]: 'Rejected'
};

export const backendStatusOf = (status: WorkStatus): number => BACKEND_STATUS_BY_UI[status] ?? BackendProjectStatus.Draft;
export const backendTypeOf = (type: ProjectType): number => (type === 'agile' ? BackendProjectType.Agile : BackendProjectType.Waterfall);

/**
 * What the backend owns about a project. Everything else on the screens' Project object (risks, schedule, documents, tab
 * settings ...) is still kept by the browser until its own area is connected; see ProjectsContext.
 */
export const PROJECT_CORE_KEYS: (keyof Project)[] = [
  'id', 'type', 'approvalStatus', 'name', 'code', 'cost', 'ownerId', 'projectManagerId', 'startDate', 'endDate', 'status',
  'owningUnit', 'description', 'goal', 'requirements', 'constraintsAndAssumptions', 'calendarId', 'teamMemberIds',
  // the registers (phase 3)
  'risks', 'stakeholders', 'statusUpdates', 'delayReasons', 'documents', 'riskDefinitions', 'riskMatrixColors', 'stakeholderStrategies',
  // the plan (phase 4)
  'schedule', 'kanbanTasks', 'sprintCount', 'weightingType', 'plannedProgressType', 'timeWeightFactor', 'costWeightFactor', 'complexityWeightFactor',
  'scheduleSnapshots', 'progressFigures', 'scheduleInfo'
];

export function toUiProject(
  project: BackendProject,
  unitPathById: Map<string, string>,
  memberIds: string[],
  extras: Partial<Project> | undefined,
  registers?: Partial<Project>,
  planning?: Partial<Project>
): Project {
  // The backend keeps constraints and assumptions apart; the charter screen has one box for both.
  const constraintsAndAssumptions = [project.constraints, project.assumptions].filter(Boolean).join('\n');
  return {
    ...defaultProjectExtras(),
    ...(extras ?? {}),
    // Whatever an older build kept in this browser about the registers is never used: the backend holds them now.
    risks: [], stakeholders: [], statusUpdates: [], delayReasons: [], documents: [],
    riskDefinitions: undefined, riskMatrixColors: undefined, stakeholderStrategies: undefined,
    ...(registers ?? {}),
    // Likewise for the plan: whatever an older build kept here is never used.
    schedule: [], kanbanTasks: [], scheduleSnapshots: [], progressFigures: undefined, scheduleInfo: undefined,
    ...(planning ?? {}),
    id: project.id,
    type: project.type === BackendProjectType.Agile ? 'agile' : 'waterfall',
    approvalStatus: UI_APPROVAL_BY_BACKEND[project.approvalStatus] ?? 'Draft',
    name: project.name,
    code: project.code,
    cost: project.cost ?? undefined,
    ownerId: project.ownerUserId,
    projectManagerId: project.managerUserId,
    startDate: project.startDate ?? '',
    endDate: project.endDate ?? '',
    status: UI_STATUS_BY_BACKEND[project.status] ?? 'Planning',
    owningUnit: project.organizationUnitId ? unitPathById.get(project.organizationUnitId) ?? '' : '',
    description: project.description ?? '',
    goal: project.goal ?? '',
    requirements: project.requirements ?? '',
    constraintsAndAssumptions,
    calendarId: project.workCalendarId ?? '',
    teamMemberIds: memberIds
  } as Project;
}

export function defaultProjectExtras(): Partial<Project> {
  return {
    risks: [],
    stakeholders: [],
    statusUpdates: [],
    delayReasons: [],
    documents: [],
    schedule: [],
    kanbanTasks: [],
    sprintCount: 3,
    weightingType: 'manual',
    plannedProgressType: 'continuous',
    scheduleSnapshots: [],
    tabWorkflows: { charter: true, schedule: true, team: true, risks: true, stakeholders: true, status: true, delays: true, docs: true, actions: true }
  };
}

export function toProjectBody(project: Partial<Project>, unitIdByPath: Map<string, string>): ProjectSaveBody {
  const text = (value?: string | null) => (value && value.trim() ? value : null);
  return {
    name: (project.name ?? '').trim(),
    code: project.code?.trim() || null,
    managerUserId: project.projectManagerId ? String(project.projectManagerId) : null,
    ownerUserId: project.ownerId ? String(project.ownerId) : null,
    organizationUnitId: project.owningUnit ? unitIdByPath.get(project.owningUnit) ?? null : null,
    workCalendarId: project.calendarId ? String(project.calendarId) : null,
    startDate: text(project.startDate),
    endDate: text(project.endDate),
    cost: project.cost ?? null,
    goal: text(project.goal),
    requirements: text(project.requirements),
    constraints: text(project.constraintsAndAssumptions),
    assumptions: null,
    description: text(project.description),
    charter: null
  };
}
