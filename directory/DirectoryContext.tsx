import * as React from 'react';
import type { Calendar, OwningUnitTreeNode, User, UserRole } from '../types';
import { useAuth } from './AuthContext';
import { calendars as calendarsApi, organization, roles as rolesApi, users as usersApi } from '../services/backend/directory';
import type { BackendRole, BackendUnit } from '../services/backend/directory';
import { setRuntimeDirectory } from '../services/backend/runtimeDirectory';
import { toCalendarBody, toUiCalendar, toUiUser, toUnitNodes, UI_ROLE_TO_BACKEND_ROLE } from '../services/backend/mappers';

export interface Outcome {
  ok: boolean;
  message?: string;
}

export interface NewUserForm {
  username: string;       // national code
  firstName: string;
  lastName: string;
  phoneNumber: string;
  password: string;
  email?: string;
  role: UserRole;
  unitPath?: string;
}

export interface EditUserForm {
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  password?: string;      // only when it is being changed
  role: UserRole;
  unitPath?: string;
  isActive: boolean;
}

interface DirectoryState {
  loading: boolean;
  /** The last load failure, if any. */
  error: string | null;
  users: User[];
  calendars: Calendar[];
  /** Active organisation units as a tree, and as the full paths the old unit pickers work with. */
  unitNodes: OwningUnitTreeNode[];
  unitPaths: string[];
  /** Unit id <-> full path, for screens that store a unit as its path. */
  unitIdByPath: Map<string, string>;
  unitPathById: Map<string, string>;
  reload: () => Promise<void>;

  createUser: (form: NewUserForm) => Promise<Outcome>;
  updateUser: (id: string, form: EditUserForm) => Promise<Outcome>;
  setUserActive: (id: string, isActive: boolean) => Promise<Outcome>;
  deleteUser: (id: string) => Promise<Outcome>;

  createUnit: (name: string, parentId: string | null) => Promise<Outcome>;
  renameUnit: (id: string, name: string) => Promise<Outcome>;
  moveUnit: (id: string, parentId: string | null) => Promise<Outcome>;
  deleteUnit: (id: string) => Promise<Outcome>;

  saveCalendar: (calendar: Calendar) => Promise<Outcome>;
  deleteCalendar: (id: string) => Promise<Outcome>;
}

const fail = (message?: string): Outcome => ({ ok: false, message });

const DirectoryContext = React.createContext<DirectoryState>(null as unknown as DirectoryState);

/** Users, the organisation chart and work calendars as the backend holds them. Every change goes to the backend and the lists are read back after it. */
export const DirectoryProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const tenantId = session?.user.tenantId;

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [calendars, setCalendars] = React.useState<Calendar[]>([]);
  const [units, setUnits] = React.useState<BackendUnit[]>([]);
  const [roles, setRoles] = React.useState<BackendRole[]>([]);

  const reload = React.useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const [u, r, un, m, c] = await Promise.all([
      usersApi.list(), rolesApi.list(), organization.units(), organization.members(), calendarsApi.list()
    ]);
    const firstError = [u, r, un, m, c].find(result => !result.ok);
    setError(firstError ? firstError.error?.message ?? 'Loading failed.' : null);

    const members = new Map((m.value ?? []).map(member => [member.userId, member]));
    if (u.ok) setUsers((u.value ?? []).map(user => toUiUser(user, members)));
    if (r.ok) setRoles(r.value ?? []);
    if (un.ok) setUnits(un.value ?? []);
    if (c.ok) setCalendars((c.value ?? []).map(toUiCalendar));
    setLoading(false);
  }, [session]);

  React.useEffect(() => {
    if (session) void reload();
    else {
      setUsers([]);
      setCalendars([]);
      setUnits([]);
      setRoles([]);
    }
  }, [session, reload]);

  // Publish what was read, for the plain helper functions that cannot use context (see runtimeDirectory).
  const unitNodesNow = React.useMemo(() => toUnitNodes(units), [units]);
  setRuntimeDirectory({ unitNodes: unitNodesNow, calendars });

  const unitIdByPath = React.useMemo(() => new Map(units.map(u => [u.path ?? u.name, u.id])), [units]);
  const unitPathById = React.useMemo(() => new Map(units.map(u => [u.id, u.path ?? u.name])), [units]);
  const roleIdByName = React.useMemo(() => new Map(roles.map(r => [r.name, r.id])), [roles]);

  /** Runs a backend call, then refreshes. A failed call reports the backend's own message. */
  const run = React.useCallback(async (call: () => Promise<{ ok: boolean; error?: { message: string } }>): Promise<Outcome> => {
    const result = await call();
    if (!result.ok) return fail(result.error?.message);
    await reload();
    return { ok: true };
  }, [reload]);

  const applyRoleAndUnit = React.useCallback(async (userId: string, role: UserRole, unitPath?: string): Promise<Outcome> => {
    const roleId = roleIdByName.get(UI_ROLE_TO_BACKEND_ROLE[role]);
    if (!roleId) return fail(`نقش «${UI_ROLE_TO_BACKEND_ROLE[role]}» در سرور تعریف نشده است.`);
    const assigned = await usersApi.setRoles(userId, [roleId]);
    if (!assigned.ok) return fail(assigned.error?.message);
    if (unitPath !== undefined) {
      const unitId = unitPath ? unitIdByPath.get(unitPath) ?? null : null;
      if (unitPath && !unitId) return fail('واحد سازمانی انتخاب‌شده پیدا نشد.');
      const placed = await organization.setUserUnit(userId, unitId);
      if (!placed.ok) return fail(placed.error?.message);
    }
    return { ok: true };
  }, [roleIdByName, unitIdByPath]);

  const value = React.useMemo<DirectoryState>(() => ({
    loading,
    error,
    users,
    calendars,
    unitNodes: toUnitNodes(units),
    unitPaths: units.map(u => u.path ?? u.name),
    unitIdByPath,
    unitPathById,
    reload,

    createUser: async form => {
      if (!tenantId) return fail();
      const created = await usersApi.create({
        tenantId, username: form.username, firstName: form.firstName, lastName: form.lastName,
        phoneNumber: form.phoneNumber, password: form.password, email: form.email || undefined
      });
      if (!created.ok || !created.value) return fail(created.error?.message);
      const applied = await applyRoleAndUnit(created.value.id, form.role, form.unitPath);
      await reload();
      return applied.ok ? { ok: true } : { ok: false, message: `کاربر ساخته شد اما: ${applied.message}` };
    },

    updateUser: async (id, form) => {
      const updated = await usersApi.update(id, {
        displayName: `${form.firstName} ${form.lastName}`.trim(), isActive: form.isActive, email: form.email ?? '',
        password: form.password || undefined, username: form.username, phoneNumber: form.phoneNumber,
        firstName: form.firstName, lastName: form.lastName
      });
      if (!updated.ok) return fail(updated.error?.message);
      const applied = await applyRoleAndUnit(id, form.role, form.unitPath);
      await reload();
      return applied.ok ? { ok: true } : fail(applied.message);
    },

    setUserActive: (id, isActive) => run(() => usersApi.setStatus(id, isActive)),
    deleteUser: id => run(() => usersApi.remove(id)),

    createUnit: (name, parentId) => run(() =>
      tenantId ? organization.createUnit({ tenantId, name, parentId }) : Promise.resolve({ ok: false })),
    renameUnit: (id, name) => {
      const unit = units.find(u => u.id === id);
      return unit ? run(() => organization.updateUnit(id, { name, code: unit.code, parentId: unit.parentId, managerUserId: unit.managerUserId, isActive: true })) : Promise.resolve(fail());
    },
    moveUnit: (id, parentId) => {
      const unit = units.find(u => u.id === id);
      return unit ? run(() => organization.updateUnit(id, { name: unit.name, code: unit.code, parentId, managerUserId: unit.managerUserId, isActive: true })) : Promise.resolve(fail());
    },
    deleteUnit: id => run(() => organization.deactivateUnit(id)),

    saveCalendar: calendar => run(() =>
      calendar.id ? calendarsApi.update(calendar.id, toCalendarBody(calendar)) : calendarsApi.create(tenantId!, toCalendarBody(calendar))),
    deleteCalendar: id => run(() => calendarsApi.remove(id))
  }), [loading, error, users, calendars, units, unitIdByPath, unitPathById, tenantId, reload, run, applyRoleAndUnit]);

  return <DirectoryContext.Provider value={value}>{children}</DirectoryContext.Provider>;
};

export const useDirectory = () => React.useContext(DirectoryContext);
