import type { Calendar, OwningUnitTreeNode, User, UserRole } from '../../types';
import type { BackendUser } from './auth';
import type { BackendCalendar, BackendMember, BackendUnit, CalendarSaveBody } from './directory';

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
