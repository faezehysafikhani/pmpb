import * as React from 'react';
import type {
  ProgressUpdate, Project, ProjectDocument, ProjectRisk, ProjectStakeholder, RiskProbabilityImpactDefinitions, StakeholderStrategies, WorkStatus
} from '../types';
import { useAuth } from './AuthContext';
import { useDirectory } from './DirectoryContext';
import type { Outcome } from './DirectoryContext';
import { projects as projectsApi, projectTeam } from '../services/backend/projects';
import type { BackendProjectMember } from '../services/backend/projects';
import { backendStatusOf, backendTypeOf, PROJECT_CORE_KEYS, toProjectBody, toUiProject } from '../services/backend/mappers';
import {
  approvals, delayReasons as delayReasonsApi, documents as documentsApi, risks as risksApi, stakeholders as stakeholdersApi,
  statusUpdates as statusUpdatesApi
} from '../services/backend/registers';
import type { RegisterKind } from '../services/backend/registers';
import {
  backendDocumentTypeOf, backendResponseStatusOf, buildPeople, OTHER_ROOT_CAUSE, toRiskBody, toRiskColorsBody, toRiskDefinitionsBody,
  toStakeholderBody
} from '../services/backend/registerMappers';
import { loadRegisters } from '../services/backend/registerLoad';
import { loadPlanning } from '../services/backend/planningLoad';
import { createPlanningOps } from './planningOps';
import type { PlanningOps } from './planningOps';
import type { ProjectRegisters } from '../services/backend/registerLoad';

export interface ProjectOutcome extends Outcome {
  /** The backend's error code (for example `project.name_exists`), so a screen can show its own wording. */
  code?: string;
  /** The project as the backend now holds it. */
  project?: Project;
}

interface ProjectsState extends PlanningOps {
  /** The progress reports and status requests the backend holds (every visible project), newest first; each has its approval state and history. */
  progressUpdates: ProgressUpdate[];
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

  // ---- registers (phase 3): every write goes to the backend, then that project's registers are read back ----
  /** Creates (no id) or updates a risk; a new risk is sent for approval, as is an edited one that had been rejected. */
  saveRisk: (projectId: string, risk: ProjectRisk | Omit<ProjectRisk, 'id'>) => Promise<ProjectOutcome>;
  deleteRisk: (projectId: string, id: string) => Promise<ProjectOutcome>;
  /** The execution state of a risk's response plan. */
  setRiskResponseStatus: (projectId: string, id: string, status: WorkStatus) => Promise<ProjectOutcome>;
  saveRiskDefinitions: (projectId: string, definitions: RiskProbabilityImpactDefinitions) => Promise<ProjectOutcome>;
  saveRiskMatrixColors: (projectId: string, colors: Record<string, 'red' | 'yellow' | 'green'>) => Promise<ProjectOutcome>;
  saveStakeholder: (projectId: string, stakeholder: ProjectStakeholder | Omit<ProjectStakeholder, 'id'>) => Promise<ProjectOutcome>;
  deleteStakeholder: (projectId: string, id: string) => Promise<ProjectOutcome>;
  saveStakeholderStrategies: (projectId: string, strategies: StakeholderStrategies) => Promise<ProjectOutcome>;
  /** The progress numbers are what the screen shows today; the backend will compute them itself once the schedule is connected. */
  saveStatusUpdate: (projectId: string, description: string, progress: { planned: number; actual: number }, id?: string) => Promise<ProjectOutcome>;
  deleteStatusUpdate: (projectId: string, id: string) => Promise<ProjectOutcome>;
  saveDelayReason: (projectId: string, description: string, id?: string) => Promise<ProjectOutcome>;
  deleteDelayReason: (projectId: string, id: string) => Promise<ProjectOutcome>;
  uploadDocument: (
    projectId: string, document: Pick<ProjectDocument, 'description' | 'type' | 'aiSummary' | 'aiRelevance' | 'aiRelevanceReason'>, file: File
  ) => Promise<ProjectOutcome>;
  /** Keeps the AI notes of a document (not stored by the backend) on the document. */
  setDocumentNotes: (projectId: string, id: string, notes: Pick<ProjectDocument, 'aiSummary' | 'aiRelevance' | 'aiRelevanceReason'>) => void;
  deleteDocument: (projectId: string, id: string) => Promise<ProjectOutcome>;
  downloadDocument: (document: ProjectDocument) => Promise<ProjectOutcome>;
  /**
   * Saves the register items that `after` has and `before` does not (what the AI assistant and its forms add), one by one. Nothing is
   * deleted. Stops at the first refusal and reports it.
   */
  syncRegisters: (projectId: string, before: Partial<Project>, after: Partial<Project>, progress: { planned: number; actual: number }) => Promise<ProjectOutcome>;
  /** Approves or rejects a register item at the step the backend's workflow is on; the backend checks that the caller may. */
  decide: (kind: RegisterKind, projectId: string, itemId: string, approve: boolean, comment?: string) => Promise<ProjectOutcome>;
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

/** The parts of a project that no backend area holds yet (what a screen's copy may overwrite). */
export function localPartsOf(project: Project): Partial<Project> {
  return extrasOf(project);
}

function extrasOf(project: Project): Partial<Project> {
  const skip = new Set<string>([...PROJECT_CORE_KEYS, ...NEVER_KEPT]);
  return Object.fromEntries(Object.entries(project).filter(([key]) => !skip.has(key))) as Partial<Project>;
}

const fail = (message?: string, code?: string): ProjectOutcome => ({ ok: false, message, code });

/**
 * Transitional, two small pieces the backend does not hold yet; they stay in this browser, keyed by item id, and are put back on
 * the items the backend returns:
 *  - the second approval round on a risk's response (the assignee reports a new response status and a verifier confirms it):
 *    it is connected with the task centre in a later phase;
 *  - the AI summary / relevance notes on a document (the AI features are not part of this connection).
 */
const LOCAL_KEY = 'pms_register_local';
const RISK_LOCAL_FIELDS = [
  'submittedResponseStatus', 'verificationStatus', 'verificationStageIndex', 'verificationApproverId', 'verificationHistory', 'verificationComment'
] as const;
const DOCUMENT_LOCAL_FIELDS = ['aiSummary', 'aiRelevance', 'aiRelevanceReason'] as const;

interface LocalOnly {
  risks: Record<string, Partial<ProjectRisk>>;
  documents: Record<string, Partial<ProjectDocument>>;
}

function readLocalOnly(): LocalOnly {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return { risks: parsed.risks ?? {}, documents: parsed.documents ?? {} };
  } catch {
    return { risks: {}, documents: {} };
  }
}

function withLocalOnly(registers: ProjectRegisters): ProjectRegisters {
  const kept = readLocalOnly();
  return {
    ...registers,
    risks: registers.risks.map(r => (kept.risks[r.id] ? { ...r, ...kept.risks[r.id] } : r)),
    documents: registers.documents.map(d => (kept.documents[d.id] ? { ...d, ...kept.documents[d.id] } : d))
  };
}

function rememberLocalOnly(projects: Project[]) {
  const kept: LocalOnly = { risks: {}, documents: {} };
  const pick = <T extends object>(item: T, keys: readonly (keyof T)[]) =>
    Object.fromEntries(keys.filter(key => item[key] !== undefined).map(key => [key, item[key]]));
  for (const project of projects) {
    for (const risk of project.risks ?? []) {
      const fields = pick(risk, RISK_LOCAL_FIELDS);
      if (Object.keys(fields).length) kept.risks[risk.id] = fields as Partial<ProjectRisk>;
    }
    for (const document of project.documents ?? []) {
      const fields = pick(document, DOCUMENT_LOCAL_FIELDS);
      if (Object.keys(fields).length) kept.documents[document.id] = fields as Partial<ProjectDocument>;
    }
  }
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(kept));
  } catch { /* storage full or blocked: these notes are simply not kept */ }
}

/** Notes on a document that are not on the backend (the AI summary); remembered under the document's id. */
function rememberDocumentNotes(documentId: string, notes: Partial<ProjectDocument>) {
  const kept = readLocalOnly();
  kept.documents[documentId] = { ...kept.documents[documentId], ...notes };
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(kept));
  } catch { /* see above */ }
}

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
  /** The Workflow instance that decides each register item, by item id. */
  const instanceByItem = React.useRef(new Map<string, string>());
  const [progressUpdates, setProgressUpdates] = React.useState<ProgressUpdate[]>([]);
  const projectsRef = React.useRef<Project[]>([]);
  projectsRef.current = projects;
  const progressUpdatesRef = React.useRef<ProgressUpdate[]>([]);
  progressUpdatesRef.current = progressUpdates;
  const people = React.useMemo(() => buildPeople(directory.users), [directory.users]);

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

    const registers = await loadRegisters(list.map(p => p.id), people);
    const planning = await loadPlanning(list.map(p => ({ id: p.id, type: p.type === 1 ? 'agile' as const : 'waterfall' as const })), people);
    instanceByItem.current = new Map([...registers.instanceByItem, ...planning.instanceByItem]);
    setProgressUpdates(planning.progressUpdates);
    if (registers.error) setError(registers.error);
    else if (planning.error) setError(planning.error);

    const extras = readExtras();
    const mapped = list.map(p => toUiProject(
      p, directory.unitPathById, membersByProject.get(p.id) ?? [], extras[p.id],
      withLocalOnly(registers.byProject.get(p.id) as ProjectRegisters), planning.byProject.get(p.id)));
    setProjects(mapped);
    loaded.current = true;
    setLoading(false);
    return mapped;
  }, [session, directory.unitPathById, people]);

  const reload = React.useCallback(async () => {
    await load();
  }, [load]);

  // The people and organisation units are read first (the registers refer to people by account name, projects to units by path).
  React.useEffect(() => {
    if (!session) {
      loaded.current = false;
      setProjects([]);
    } else if (!directory.loading) {
      void reload();
    }
  }, [session, reload, directory.loading]);

  // Keep the not-yet-connected parts of each project (only those) so a reload does not lose them.
  React.useEffect(() => {
    if (!loaded.current) return;
    const kept = readExtras();
    for (const project of projects) kept[project.id] = extrasOf(project);
    try {
      localStorage.setItem(EXTRAS_KEY, JSON.stringify(kept));
    } catch { /* storage full or blocked: the parts simply are not kept */ }
    rememberLocalOnly(projects);
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


  /** Reads one project's registers back from the backend and puts them on the project. */
  const refreshRegisters = React.useCallback(async (projectId: string): Promise<void> => {
    const result = await loadRegisters([projectId], people);
    result.instanceByItem.forEach((instanceId, itemId) => instanceByItem.current.set(itemId, instanceId));
    const registers = withLocalOnly(result.byProject.get(projectId) as ProjectRegisters);
    setProjects(prev => prev.map(p => (p.id === projectId ? { ...p, ...registers } : p)));
  }, [people]);

  /** The common ending of a register write: report a failure as the backend worded it, otherwise show the fresh registers. */
  const settle = React.useCallback(async (projectId: string, result: { ok: boolean; error?: { message: string; code: string } }): Promise<ProjectOutcome> => {
    if (!result.ok) {
      await refreshRegisters(projectId);
      return fail(result.error?.message, result.error?.code);
    }
    await refreshRegisters(projectId);
    return { ok: true };
  }, [refreshRegisters]);

  /** Creates the item, then sends it for approval (the backend approves it straight away when it has no workflow for it). */
  const createAndSubmit = React.useCallback(async (
    projectId: string,
    create: () => Promise<{ ok: boolean; value?: { id: string }; error?: { message: string; code: string } }>,
    submit: (id: string) => Promise<{ ok: boolean; error?: { message: string; code: string } }>
  ): Promise<ProjectOutcome> => {
    const created = await create();
    if (!created.ok || !created.value) return settle(projectId, created);
    return settle(projectId, await submit(created.value.id));
  }, [settle]);

  const registerOps = React.useMemo(() => {
    const tenant = () => tenantId ?? '';
    const existing = (projectId: string) => projects.find(p => p.id === projectId);
    const ops = {
      saveRisk: async (projectId: string, risk: ProjectRisk | Omit<ProjectRisk, 'id'>): Promise<ProjectOutcome> => {
        if (!tenantId) return fail();
        const body = toRiskBody(risk, people);
        if (!('id' in risk)) return createAndSubmit(projectId, () => risksApi.create(tenant(), projectId, body), risksApi.submit);
        const before = existing(projectId)?.risks.find(r => r.id === risk.id);
        const updated = await risksApi.update(risk.id, body);
        if (!updated.ok) return settle(projectId, updated);
        return settle(projectId, before?.isRejected ? await risksApi.submit(risk.id) : updated);
      },
      deleteRisk: async (projectId: string, id: string) => settle(projectId, await risksApi.remove(id)),
      setRiskResponseStatus: async (projectId: string, id: string, status: WorkStatus) =>
        settle(projectId, await risksApi.setResponseStatus(id, backendResponseStatusOf(status))),
      saveRiskDefinitions: async (projectId: string, definitions: RiskProbabilityImpactDefinitions) =>
        settle(projectId, await risksApi.saveSettings(tenant(), projectId, toRiskDefinitionsBody(definitions), null)),
      saveRiskMatrixColors: async (projectId: string, colors: Record<string, 'red' | 'yellow' | 'green'>) =>
        settle(projectId, await risksApi.saveSettings(tenant(), projectId, null, toRiskColorsBody(colors))),

      saveStakeholder: async (projectId: string, stakeholder: ProjectStakeholder | Omit<ProjectStakeholder, 'id'>): Promise<ProjectOutcome> => {
        if (!tenantId) return fail();
        const body = toStakeholderBody(stakeholder);
        if (!('id' in stakeholder)) return createAndSubmit(projectId, () => stakeholdersApi.create(tenant(), projectId, body), stakeholdersApi.submit);
        const before = existing(projectId)?.stakeholders?.find(s => s.id === stakeholder.id);
        const updated = await stakeholdersApi.update(stakeholder.id, body);
        if (!updated.ok) return settle(projectId, updated);
        return settle(projectId, before?.isRejected ? await stakeholdersApi.submit(stakeholder.id) : updated);
      },
      deleteStakeholder: async (projectId: string, id: string) => settle(projectId, await stakeholdersApi.remove(id)),
      saveStakeholderStrategies: async (projectId: string, strategies: StakeholderStrategies) =>
        settle(projectId, await stakeholdersApi.saveSettings(tenant(), projectId, {
          manageClosely: strategies.highPower_highInterest,
          keepSatisfied: strategies.highPower_lowInterest,
          keepInformed: strategies.lowPower_highInterest,
          monitor: strategies.lowPower_lowInterest
        })),

      saveStatusUpdate: async (projectId: string, description: string, progress: { planned: number; actual: number }, id?: string): Promise<ProjectOutcome> => {
        if (!tenantId) return fail();
        const round = (value: number) => Math.round(Math.max(0, Math.min(100, value || 0)) * 100) / 100;
        if (!id) {
          const today = new Date().toISOString().slice(0, 10);
          return createAndSubmit(
            projectId, () => statusUpdatesApi.create(tenant(), projectId, description, today, round(progress.planned), round(progress.actual)), statusUpdatesApi.submit);
        }
        const before = existing(projectId)?.statusUpdates.find(u => u.id === id);
        const updated = await statusUpdatesApi.update(id, description, round(progress.planned), round(progress.actual));
        if (!updated.ok) return settle(projectId, updated);
        return settle(projectId, before?.isRejected ? await statusUpdatesApi.submit(id) : updated);
      },
      deleteStatusUpdate: async (projectId: string, id: string) => settle(projectId, await statusUpdatesApi.remove(id)),

      saveDelayReason: async (projectId: string, description: string, id?: string): Promise<ProjectOutcome> => {
        if (!tenantId) return fail();
        const today = new Date().toISOString().slice(0, 10);
        if (!id) return createAndSubmit(projectId, () => delayReasonsApi.create(tenant(), projectId, description, today), delayReasonsApi.submit);
        const before = existing(projectId)?.delayReasons?.find(d => d.id === id);
        const updated = await delayReasonsApi.update(id, description, before?.date ?? today, OTHER_ROOT_CAUSE);
        if (!updated.ok) return settle(projectId, updated);
        return settle(projectId, before?.isRejected ? await delayReasonsApi.submit(id) : updated);
      },
      deleteDelayReason: async (projectId: string, id: string) => settle(projectId, await delayReasonsApi.remove(id)),

      uploadDocument: async (
        projectId: string, document: Pick<ProjectDocument, 'description' | 'type' | 'aiSummary' | 'aiRelevance' | 'aiRelevanceReason'>, file: File
      ) => createAndSubmit(
        projectId,
        async () => {
          const uploaded = await documentsApi.upload(projectId, document.description, backendDocumentTypeOf(document.type), file);
          if (uploaded.ok && uploaded.value) {
            const { aiSummary, aiRelevance, aiRelevanceReason } = document;
            rememberDocumentNotes(uploaded.value.id, { aiSummary, aiRelevance, aiRelevanceReason });
          }
          return uploaded;
        },
        documentsApi.submit),
      setDocumentNotes: (projectId: string, id: string, notes: Pick<ProjectDocument, 'aiSummary' | 'aiRelevance' | 'aiRelevanceReason'>) => {
        rememberDocumentNotes(id, notes);
        setProjects(prev => prev.map(p => (p.id !== projectId ? p : { ...p, documents: p.documents.map(d => (d.id === id ? { ...d, ...notes } : d)) })));
      },
      deleteDocument: async (projectId: string, id: string) => settle(projectId, await documentsApi.remove(id)),
      downloadDocument: async (document: ProjectDocument): Promise<ProjectOutcome> => {
        const downloaded = await documentsApi.download(document.id, document.fileName ?? document.name);
        return downloaded.ok ? { ok: true } : fail(downloaded.error?.message, downloaded.error?.code);
      },

      decide: async (kind: RegisterKind, projectId: string, itemId: string, approve: boolean, comment?: string): Promise<ProjectOutcome> => {
        let instanceId = instanceByItem.current.get(itemId);
        if (!instanceId) {
          await refreshRegisters(projectId);
          instanceId = instanceByItem.current.get(itemId);
        }
        if (!instanceId) return fail('این مورد در گردش کار تأیید قرار ندارد.', 'not_found');
        const decided = approve ? await approvals.approve(instanceId, comment ?? null) : await approvals.reject(instanceId, comment ?? null);
        return settle(projectId, decided);
      }
    };

    const syncRegisters = async (
      projectId: string, before: Partial<Project>, after: Partial<Project>, progress: { planned: number; actual: number }
    ): Promise<ProjectOutcome> => {
      const isNew = <T extends { id: string }>(list: T[] | undefined, item: T) => !(list ?? []).some(x => x.id === item.id);
      const steps: (() => Promise<ProjectOutcome>)[] = [
        ...(after.risks ?? []).filter(r => isNew(before.risks, r)).map(r => () => {
          const { id: _unsaved, ...fresh } = r;
          return ops.saveRisk(projectId, fresh);
        }),
        ...(after.stakeholders ?? []).filter(s => isNew(before.stakeholders, s)).map(s => () => {
          const { id: _unsaved, ...fresh } = s;
          return ops.saveStakeholder(projectId, fresh);
        }),
        ...(after.statusUpdates ?? []).filter(u => isNew(before.statusUpdates, u)).map(u => () => ops.saveStatusUpdate(projectId, u.description, progress)),
        ...(after.delayReasons ?? []).filter(d => isNew(before.delayReasons, d)).map(d => () => ops.saveDelayReason(projectId, d.description))
      ];
      for (const step of steps) {
        const outcome = await step();
        if (!outcome.ok) return outcome;
      }
      return { ok: true };
    };

    return { ...ops, syncRegisters };
  }, [tenantId, people, projects, settle, createAndSubmit, refreshRegisters]);

  const patchProject = React.useCallback((id: string, patch: Partial<Project>) => {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const replaceUpdates = React.useCallback((projectId: string, updates: ProgressUpdate[]) => {
    setProgressUpdates(prev => [...prev.filter(u => u.projectId !== projectId), ...updates].sort((a, b) => b.submissionDate.localeCompare(a.submissionDate)));
  }, []);

  const planningOps = React.useMemo(() => createPlanningOps({
    tenantId,
    people,
    getProject: id => projectsRef.current.find(p => p.id === id),
    patchProject,
    replaceUpdates,
    get instances() { return instanceByItem.current; },
    taskOfUpdate: updateId => progressUpdatesRef.current.find(u => u.id === updateId)?.taskId
  }), [tenantId, people, patchProject, replaceUpdates]);

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
      // A project that arrives with register items already filled in (the AI assistant builds them) has them saved with it.
      const synced = await registerOps.syncRegisters(created.value.id, {}, project, { planned: 0, actual: 0 });
      if (!synced.ok) console.warn('Some register items of the new project were not saved:', synced.message);
      // Activities / tasks / sprints that arrive with the new project (the AI assistant builds them) go in before it is submitted, so the
      // backend's checks on submission see them.
      const planned = await planningOps.syncNewProjectPlan(created.value.id, project);
      if (!planned.ok) console.warn('Some planning items of the new project were not saved:', planned.message);
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

      // The number of sprints is the project's own setting on the backend; ask for it only when the form changed it.
      if (project.type === 'agile' && before && project.sprintCount && project.sprintCount !== before.sprintCount) {
        const counted = await planningOps.setSprintCount(project.id, project.sprintCount);
        if (!counted.ok) {
          await load();
          return fail(counted.message, counted.code);
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
    },

    ...registerOps,
    ...planningOps,
    progressUpdates
  }), [loading, error, projects, reload, load, tenantId, bodyOf, finish, registerOps, planningOps, progressUpdates]);

  return React.createElement(ProjectsContext.Provider, { value }, children);
};

export const useProjects = () => React.useContext(ProjectsContext);
