import { api, query } from '../api';
import type { ApiResult } from '../api';
import type { BackendUser } from './auth';

// ---------------------------------------------------------------------------------------------- users & roles

export interface BackendRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}

interface Page<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

export const users = {
  /** Every user of the tenant (the backend pages them; this walks the pages). */
  async list(): Promise<ApiResult<BackendUser[]>> {
    const all: BackendUser[] = [];
    for (let page = 1; page < 1000; page++) {
      const result = await api.get<Page<BackendUser>>(`/api/identity/users/${query({ pageNumber: page, pageSize: 200 })}`);
      if (!result.ok || !result.value) return { ok: false, error: result.error };
      all.push(...result.value.items);
      if (all.length >= result.value.totalCount || result.value.items.length === 0) break;
    }
    return { ok: true, value: all };
  },

  create: (body: { tenantId: string; username: string; firstName: string; lastName: string; phoneNumber: string; password: string; isActive?: boolean; email?: string }) =>
    api.post<BackendUser>('/api/identity/users/', body),

  update: (id: string, body: { displayName: string; isActive: boolean; email?: string; password?: string; username?: string; phoneNumber?: string; firstName?: string; lastName?: string }) =>
    api.put<BackendUser>(`/api/identity/users/${id}`, body),

  setStatus: (id: string, isActive: boolean) => api.patch<void>(`/api/identity/users/${id}/status`, { isActive }),

  remove: (id: string) => api.delete<void>(`/api/identity/users/${id}`),

  setRoles: (id: string, roleIds: string[]) => api.put<BackendUser>(`/api/identity/users/${id}/roles`, { roleIds })
};

export const roles = {
  list: () => api.get<BackendRole[]>('/api/identity/roles/')
};

// ------------------------------------------------------------------------------------------ organisation chart

export interface BackendUnit {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  parentId: string | null;
  managerUserId: string | null;
  isActive: boolean;
  path: string | null;
}

export interface BackendMember {
  userId: string;
  unitId: string;
  unitName: string;
  unitPath: string;
}

export const organization = {
  units: () => api.get<BackendUnit[]>(`/api/organization/units/${query({ activeOnly: true })}`),
  createUnit: (body: { tenantId: string; name: string; code?: string; parentId: string | null }) => api.post<BackendUnit>('/api/organization/units/', body),
  updateUnit: (id: string, body: { name: string; code: string; parentId: string | null; managerUserId: string | null; isActive: boolean }) =>
    api.put<BackendUnit>(`/api/organization/units/${id}`, body),
  deactivateUnit: (id: string) => api.delete<void>(`/api/organization/units/${id}?includeBranch=true`),
  members: () => api.get<BackendMember[]>('/api/organization/members'),
  setUserUnit: (userId: string, unitId: string | null) => api.put<BackendMember | null>(`/api/organization/users/${userId}/unit`, { unitId })
};

// ----------------------------------------------------------------------------------------------- work calendars

export interface BackendCalendarException {
  id: string;
  date: string;
  isWorkingDay: boolean;
  description: string | null;
}

export interface BackendCalendar {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  workingDays: number;            // bit mask: bit n = day n of the week, 0 = Sunday
  isDefault: boolean;
  exceptions: BackendCalendarException[];
  workHoursPerDay: number;
  applyOfficialHolidays: boolean;
}

export interface BackendCalendarDay {
  date: string;
  isWorkingDay: boolean;
  source: number;                 // 0 weekly, 1 exception, 2 official holiday
  reason: string | null;
}

export interface CalendarSaveBody {
  name: string;
  workingDays: number;
  isDefault: boolean;
  workHoursPerDay?: number;
  applyOfficialHolidays?: boolean;
  description?: string | null;
  exceptions?: { date: string; isWorkingDay: boolean; description: string | null }[];
}

export const calendars = {
  list: () => api.get<BackendCalendar[]>('/api/calendar/work-calendars/'),
  create: (tenantId: string, body: CalendarSaveBody) => api.post<BackendCalendar>('/api/calendar/work-calendars/', { tenantId, ...body }),
  update: (id: string, body: CalendarSaveBody) => api.put<BackendCalendar>(`/api/calendar/work-calendars/${id}`, body),
  remove: (id: string) => api.delete<void>(`/api/calendar/work-calendars/${id}`),
  days: (id: string, from: string, to: string) => api.get<BackendCalendarDay[]>(`/api/calendar/work-calendars/${id}/days${query({ from, to })}`),
  officialHolidays: (from: string, to: string) =>
    api.get<{ date: string; reason: string }[]>(`/api/calendar/work-calendars/official-holidays${query({ from, to })}`)
};
