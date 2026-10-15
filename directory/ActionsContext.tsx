import * as React from 'react';
import type { ActionItem, ProgressUpdate, WorkStatus } from '../types';
import { useAuth } from './AuthContext';
import { useDirectory } from './DirectoryContext';
import { useProjects } from './ProjectsContext';
import type { ProjectOutcome } from './ProjectsContext';
import { actionsApi, ActionSubject } from '../services/backend/actions';
import type { BackendAction, BackendActionStatusRequest } from '../services/backend/actions';
import { backendActionStatusOf, toActionBody, toUiAction, toUiActionStatusRequest } from '../services/backend/actionMappers';
import { buildPeople } from '../services/backend/registerMappers';
import { approvals } from '../services/backend/registers';
import type { BackendInstance } from '../services/backend/registers';

export interface ActionsState {
  loading: boolean;
  error: string | null;
  /** The actions the backend returns for the signed-in user (which ones that is - the backend's visibility rules - is its business). */
  actions: ActionItem[];
  /** The requests to change an action's status, each with its approval state and history. */
  updates: ProgressUpdate[];
  reload: () => Promise<void>;
  /** Creates (no id) or updates an action. */
  saveAction: (action: ActionItem) => Promise<ProjectOutcome & { action?: ActionItem }>;
  deleteAction: (id: string) => Promise<ProjectOutcome>;
  /** Asks for an action to take another status; the backend sends the request for approval (or applies it at once when no workflow is set). */
  requestStatus: (actionId: string, status: WorkStatus, comment: string) => Promise<ProjectOutcome>;
  /** Approves or rejects a status request in the approval workflow. */
  decide: (updateId: string, approve: boolean, comment?: string) => Promise<ProjectOutcome>;
}

const ActionsContext = React.createContext<ActionsState>(null as unknown as ActionsState);

const fail = (message?: string, code?: string): ProjectOutcome => ({ ok: false, message, code });

/** Actions and their status requests as the backend holds them. Every change goes to the backend and the lists are read back after it. */
export const ActionsProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const directory = useDirectory();
  const projects = useProjects().projects;
  const tenantId = session?.user.tenantId;
  const people = React.useMemo(() => buildPeople(directory.users), [directory.users]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [raw, setRaw] = React.useState<BackendAction[]>([]);
  const [requests, setRequests] = React.useState<BackendActionStatusRequest[]>([]);
  const [instances, setInstances] = React.useState<Map<string, BackendInstance>>(new Map());
  /** The Workflow instance that decides each status request, by request id. */
  const instanceOf = React.useRef(new Map<string, string>());

  const load = React.useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const [list, asked] = await Promise.all([actionsApi.list(), actionsApi.statusRequests()]);
    const problem = !list.ok ? list.error?.message : !asked.ok ? asked.error?.message : null;
    setError(problem ?? null);

    const sent = (items: { id: string; approvalStatus: number }[]) => items.filter(i => i.approvalStatus !== 0).map(i => i.id);
    const found = new Map<string, BackendInstance>();
    const lookup = async (subjectType: string, ids: string[]) => {
      if (!ids.length) return;
      const result = await approvals.forSubjects(subjectType, ids);
      for (const instance of result.value ?? []) {
        found.set(instance.subjectId, instance);
        instanceOf.current.set(instance.subjectId, instance.id);
      }
    };
    await Promise.all([
      lookup(ActionSubject.action, sent(list.value ?? [])),
      lookup(ActionSubject.status, sent(asked.value ?? []))
    ]);

    setRaw(list.value ?? []);
    setRequests(asked.value ?? []);
    setInstances(found);
    setLoading(false);
  }, [session]);

  // Read once the people and organisation units are known (an action refers to its unit by path).
  React.useEffect(() => {
    if (!session) {
      setRaw([]);
      setRequests([]);
    } else if (!directory.loading) {
      void load();
    }
  }, [session, load, directory.loading]);

  const actions = React.useMemo(
    () => raw.map(a => toUiAction(a, instances.get(a.id), people, { unitPathById: directory.unitPathById, projects })),
    [raw, instances, people, directory.unitPathById, projects]);

  const updates = React.useMemo(
    () => requests.map(r => toUiActionStatusRequest(r, instances.get(r.id), people)).sort((a, b) => b.submissionDate.localeCompare(a.submissionDate)),
    [requests, instances, people]);

  const value = React.useMemo<ActionsState>(() => ({
    loading,
    error,
    actions,
    updates,
    reload: load,

    saveAction: async action => {
      const body = toActionBody(action, directory.unitIdByPath);
      if (!body) return fail('واحد سازمانی یا تقویم انتخاب‌شده پیدا نشد.');
      const saved = action.id ? await actionsApi.update(action.id, body) : await actionsApi.create(tenantId ?? '', body);
      if (!saved.ok || !saved.value) return fail(saved.error?.message, saved.error?.code);
      await load();
      return { ok: true, action: toUiAction(saved.value, undefined, people, { unitPathById: directory.unitPathById, projects }) };
    },

    deleteAction: async id => {
      const removed = await actionsApi.remove(id);
      if (!removed.ok) return fail(removed.error?.message, removed.error?.code);
      await load();
      return { ok: true };
    },

    requestStatus: async (actionId, status, comment) => {
      const asked = await actionsApi.requestStatus(tenantId ?? '', actionId, backendActionStatusOf(status), comment || null);
      await load();
      return asked.ok ? { ok: true } : fail(asked.error?.message, asked.error?.code);
    },

    decide: async (updateId, approve, comment) => {
      let instanceId = instanceOf.current.get(updateId);
      if (!instanceId) {
        await load();
        instanceId = instanceOf.current.get(updateId);
      }
      if (!instanceId) return fail('این مورد در گردش کار تأیید قرار ندارد.', 'not_found');
      const decided = approve ? await approvals.approve(instanceId, comment ?? null) : await approvals.reject(instanceId, comment ?? null);
      await load();
      return decided.ok ? { ok: true } : fail(decided.error?.message, decided.error?.code);
    }
  }), [loading, error, actions, updates, load, directory.unitIdByPath, directory.unitPathById, people, projects, tenantId]);

  return React.createElement(ActionsContext.Provider, { value }, children);
};

export const useActions = () => React.useContext(ActionsContext);
