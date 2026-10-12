import * as React from 'react';
import type { Project, WorkStatus } from '../types';
import { useAuth } from './AuthContext';
import { useDirectory } from './DirectoryContext';
import type { Outcome } from './DirectoryContext';
import { projects as projectsApi, projectTeam } from '../services/backend/projects';
import type { BackendProjectMember } from '../services/backend/projects';
import { backendStatusOf, backendTypeOf, PROJECT_CORE_KEYS, toProjectBody, toUiProject } from '../services/backend/mappers';

export interface ProjectOutcome extends Outcome {
  /** The backend's error code (for example `project.name_exists`), so a screen can show its own wording. */
  code?: string;
  /** The project as the backend now holds it. */
  project?: Project;
}

interface ProjectsState {
  loading: boolean;
  error: string | null;
  /** The projects the signed-in user may see - the backend decides which. */
  projects: Project[];
  /**
   * For the parts of a project that are not connected to the backend yet (risks, schedule, documents ...). Anything set on the
   * backend-owned fields through this is lost on the next reload; use saveProject / updateProject / changeStatus for those.
   */
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  reload: () => Promise<void>;
  /** The backend's own checks on a project about to be saved (nothing is saved). Pass the project's id when it is an edit. */
  checkProject: (project: Project) => Promise<ProjectOutcome>;
  /** Creates the project and, when `submit` is set, sends it for approval. The backend decides the approval outcome. */
  saveProject: (project: Project, submit: boolean) => Promise<ProjectOutcome>;
  updateProject: (project: Project, submit: boolean) => Promise<ProjectOutcome>;
  changeStatus: (id: string, status: WorkStatus) => Promise<ProjectOutcome>;
  deleteProject: (id: string) => Promise<Outcome>;
}

const ProjectsContext = React.createContext<ProjectsState>(null as unknown as ProjectsState);

const EXTRAS_KEY = 'pms_project_extras';

/** Approval bookkeeping belongs to the backend's workflow; it is never kept here. */
const NEVER_KEPT: (keyof Project)[] = ['approvalHistory', 'approvalComment', 'submissionDate', 'currentApprovalStageIndex'];

type Extras = Record<string, Partial<Project>>;

function readExtras(): Extras {
  try {
    return JSON.parse(localStorage.getItem(EXTRAS_KEY) || '{}');
  } catch {
    return {};
  }
}

function extrasOf(project: Project): Partial<Project> {
  const skip = new Set<string>([...PROJECT_CORE_KEYS, ...NEVER_KEPT]);
  return Object.fromEntries(Object.entries(project).filter(([key]) => !skip.has(key))) as Partial<Project>;
}

const fail = (message?: string, code?: string): ProjectOutcome => ({ ok: false, message, code });

/**
 * The projects as the backend holds them (charter, owner, manager, unit, calendar, dates, status, team, approval state).
 * The remaining parts of a project that the screens keep inside it - risks, stakeholders, status reports, documents, schedule ... -
 * stay in this browser, per project id, until each of those areas is connected; they are the only thing left in local storage.
 */
export const ProjectsProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const directory = useDirectory();
  const tenantId = session?.user.tenantId;

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const loaded = React.useRef(false);

  const load = React.useCallback(async (): Promise<Project[] | null> => {
    if (!session) return null;
    setLoading(true);
    const visible = await projectsApi.visible();
    if (!visible.ok) {
      setError(visible.error?.message ?? 'Loading failed.');
      setLoading(false);
      return null;
    }

    const list = visible.value ?? [];
    const members = list.length ? await projectTeam.forProjects(list.map(p => p.id)) : { ok: true, value: [] as BackendProjectMember[] };
    setError(members.ok ? null : members.error?.message ?? 'Loading the teams failed.');

    const membersByProject = new Map<string, string[]>();
    for (const member of members.value ?? []) {
      membersByProject.set(member.projectId, [...(membersByProject.get(member.projectId) ?? []), member.userId]);
    }

    const extras = readExtras();
    const mapped = list.map(p => toUiProject(p, directory.unitPathById, membersByProject.get(p.id) ?? [], extras[p.id]));
    setProjects(mapped);
    loaded.current = true;
    setLoading(false);
    return mapped;
  }, [session, directory.unitPathById]);

  const reload = React.useCallback(async () => {
    await load();
  }, [load]);

  React.useEffect(() => {
    if (session) void reload();
    else {
      loaded.current = false;
      setProjects([]);
    }
  }, [session, reload]);

  // Keep the not-yet-connected parts of each project (only those) so a reload does not lose them.
  React.useEffect(() => {
    if (!loaded.current) return;
    const kept = readExtras();
    for (const project of projects) kept[project.id] = extrasOf(project);
    try {
      localStorage.setItem(EXTRAS_KEY, JSON.stringify(kept));
    } catch { /* storage full or blocked: the parts simply are not kept */ }
  }, [projects]);

  const remember = (id: string, project: Project) => {
    const kept = readExtras();
    kept[id] = extrasOf(project);
    try {
      localStorage.setItem(EXTRAS_KEY, JSON.stringify(kept));
    } catch { /* see above */ }
  };

  const bodyOf = React.useCallback((project: Project) => {
    if (project.owningUnit && !directory.unitIdByPath.has(project.owningUnit)) return null;
    return toProjectBody(project, directory.unitIdByPath);
  }, [directory.unitIdByPath]);

  /** Applies the team and, when asked, the approval submission to a project the backend already holds. */
  const finish = React.useCallback(async (id: string, project: Project, submit: boolean): Promise<ProjectOutcome> => {
    remember(id, project);
    if (tenantId) {
      const team = await projectTeam.set(tenantId, id, (project.teamMemberIds ?? []).map(String));
      if (!team.ok) {
        await load();
        return fail(team.error?.message, team.error?.code);
      }
    }

    if (submit) {
      const submitted = await projectsApi.submit(id);
      if (!submitted.ok) {
        await load();
        return fail(submitted.error?.message, submitted.error?.code);
      }
    }

    const list = await load();
    return { ok: true, project: list?.find(p => p.id === id) };
  }, [tenantId, load]);

  const value = React.useMemo<ProjectsState>(() => ({
    loading,
    error,
    projects,
    setProjects,
    reload,

    checkProject: async project => {
      if (!tenantId) return fail();
      const body = bodyOf(project);
      if (!body) return fail('واحد سازمانی انتخاب‌شده پیدا نشد.');
      const checked = await projectsApi.check(tenantId, backendTypeOf(project.type), body, project.id ? String(project.id) : undefined);
      return checked.ok ? { ok: true } : fail(checked.error?.message, checked.error?.code);
    },

    saveProject: async (project, submit) => {
      if (!tenantId) return fail();
      const body = bodyOf(project);
      if (!body) return fail('واحد سازمانی انتخاب‌شده پیدا نشد.');
      const created = await projectsApi.create(tenantId, backendTypeOf(project.type), body);
      if (!created.ok || !created.value) return fail(created.error?.message, created.error?.code);
      return finish(created.value.id, project, submit);
    },

    updateProject: async (project, submit) => {
      const body = bodyOf(project);
      if (!body) return fail('واحد سازمانی انتخاب‌شده پیدا نشد.');
      const updated = await projectsApi.update(project.id, body);
      if (!updated.ok) return fail(updated.error?.message, updated.error?.code);

      // The work status is its own call on the backend; only ask for it when the screen changed it.
      const before = projects.find(p => p.id === project.id);
      if (before && before.status !== project.status) {
        const moved = await projectsApi.setStatus(project.id, backendStatusOf(project.status));
        if (!moved.ok) {
          await load();
          return fail(moved.error?.message, moved.error?.code);
        }
      }

      return finish(project.id, project, submit);
    },

    changeStatus: async (id, status) => {
      const changed = await projectsApi.setStatus(id, backendStatusOf(status));
      if (!changed.ok) return fail(changed.error?.message, changed.error?.code);
      const list = await load();
      return { ok: true, project: list?.find(p => p.id === id) };
    },

    deleteProject: async id => {
      const removed = await projectsApi.remove(id);
      if (!removed.ok) return fail(removed.error?.message, removed.error?.code);
      const kept = readExtras();
      delete kept[id];
      try {
        localStorage.setItem(EXTRAS_KEY, JSON.stringify(kept));
      } catch { /* see above */ }
      await reload();
      return { ok: true };
    }
  }), [loading, error, projects, reload, load, tenantId, bodyOf, finish]);

  return React.createElement(ProjectsContext.Provider, { value }, children);
};

export const useProjects = () => React.useContext(ProjectsContext);
