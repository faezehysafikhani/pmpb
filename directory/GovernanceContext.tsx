import * as React from 'react';
import type {
  Delegation, DynamicWorkflowSettings, ProjectContractPermissions, ProjectInvoicePermissions, VisibilitySettings, WorkflowEntityType, WorkflowStage
} from '../types';
import { useAuth } from './AuthContext';
import { useProjects } from './ProjectsContext';
import type { ProjectOutcome } from './ProjectsContext';
import {
  approvalInboxApi, BackendDelegatedItemType, delegationApi, governanceApi, workflowSettingsApi
} from '../services/backend/governance';
import type {
  BackendAccessMatrix, BackendItemDelegation, BackendWorkflowGroup, BackendWorkflowStep
} from '../services/backend/governance';
import type { BackendInstance } from '../services/backend/registers';
import { BackendInstanceStatus } from '../services/backend/registers';

/** The approval chains the editor shows: one per kind of thing approved (the backend's "groups"). */
export const WORKFLOW_ENTITIES: WorkflowEntityType[] = [
  'charter', 'activity_progress', 'risks', 'stakeholders', 'status_updates', 'delay_reasons', 'documents', 'contracts', 'invoices'
];

/** The project screens call a kind of thing by its tabs (the schedule and the actions tab are both about activity progress). */
export const TABS_OF_ENTITY: Record<WorkflowEntityType, string[]> = {
  charter: ['charter'], activity_progress: ['schedule', 'actions'], risks: ['risks'], stakeholders: ['stakeholders'], status_updates: ['status'],
  delay_reasons: ['delays'], documents: ['docs'], contracts: ['contracts'], invoices: ['invoices']
};

export interface ProjectGovernanceView {
  /** Sections the project shows; undefined = all of them. */
  enabledTabs?: string[];
  contractPermissions: ProjectContractPermissions;
  invoicePermissions: ProjectInvoicePermissions;
}

export interface ProjectWorkflowView {
  /** By tab: true when the project has its own approval chain for it, false when it follows the organisation's. */
  custom: Record<string, boolean>;
  /** The chain that applies per kind of thing (the project's own where it has one). */
  settings: DynamicWorkflowSettings;
}

interface GovernanceState {
  loading: boolean;
  /** Approvals waiting for the signed-in user - their own and those of the people they stand in for - as the backend lists them. */
  inbox: BackendInstance[];
  /** True when the approval of this subject (the id of the risk, report, contract ...) is waiting for the signed-in user to decide. */
  waitingForMe: (subjectId: string | null | undefined) => boolean;
  refreshInbox: () => Promise<void>;

  /** The organisation's approval chain per kind of thing; a kind nobody has set up shows the standard chain (see `configured`). */
  workflow: DynamicWorkflowSettings;
  /** Whether the backend holds a chain for the kind. Without one, approvals of that kind are not required. */
  configured: Record<WorkflowEntityType, boolean>;
  saveWorkflow: (settings: DynamicWorkflowSettings) => Promise<ProjectOutcome>;
  /** Switches the approval of one kind on (the backend's standard chain) or off (no chain: those things are approved at once). */
  setWorkflowEnabled: (entity: WorkflowEntityType, enabled: boolean) => Promise<ProjectOutcome>;
  applyWorkflowDefaults: () => Promise<ProjectOutcome>;
  loadProjectWorkflow: (projectId: string) => Promise<ProjectWorkflowView | null>;
  saveProjectWorkflow: (projectId: string, view: ProjectWorkflowView) => Promise<ProjectOutcome>;

  /** The organisation's switches. */
  visibility: VisibilitySettings;
  allowApprovedProgress: boolean;
  saveSwitches: (visibility: VisibilitySettings, allowApprovedProgress: boolean) => Promise<ProjectOutcome>;

  projectSettings: Map<string, ProjectGovernanceView>;
  /** A project's settings; one nobody has changed has every section and the backend's default access. */
  settingsOf: (projectId: string) => ProjectGovernanceView;
  saveProjectSettings: (projectId: string, settings: ProjectGovernanceView) => Promise<ProjectOutcome>;

  delegations: Delegation[];
  delegate: (type: Delegation['type'], itemId: string, projectId: string | undefined, delegateeId: string) => Promise<ProjectOutcome>;
  /** Ends a hand-over (and those made after it); resolves with whom the item goes back to. */
  endDelegation: (id: string) => Promise<ProjectOutcome & { restoreToUserId?: string }>;
}

const GovernanceContext = React.createContext<GovernanceState>(null as unknown as GovernanceState);

const fail = (message?: string, code?: string): ProjectOutcome => ({ ok: false, message, code });

const DEFAULT_ACCESS: ProjectContractPermissions = { viewByAdmin: true, viewByPM: true, viewByTeam: true, manageByAdmin: true, manageByPM: true };

const ALL_ON: VisibilitySettings = {
  viewByOwner: true, viewByManagerOrResponsible: true, viewByApprovers: true, viewByResources: true, viewByOrgHeads: true
};

const stageOf = (key: WorkflowEntityType, step: BackendWorkflowStep, index: number): WorkflowStage => ({
  id: `${key}_${index + 1}`,
  stageNumber: index + 1,
  stageTitle: step.name,
  approverId: step.approverUserId ?? (step.approverKey === 'Owner' ? 'ROLE_OWNER' : 'ROLE_PM')
});

const stepOf = (stage: WorkflowStage): BackendWorkflowStep => {
  const placeholder = stage.approverId === 'ROLE_PM' ? 'Manager' : stage.approverId === 'ROLE_OWNER' ? 'Owner' : null;
  return {
    name: stage.stageTitle,
    approverUserId: placeholder ? null : String(stage.approverId),
    approverKey: placeholder,
    isOptional: false
  };
};

const toSettings = (groups: BackendWorkflowGroup[], pick: (g: BackendWorkflowGroup) => BackendWorkflowStep[]): DynamicWorkflowSettings =>
  Object.fromEntries(WORKFLOW_ENTITIES.map(key => {
    const group = groups.find(g => g.key === key);
    return [key, (group ? pick(group) : []).map((step, i) => stageOf(key, step, i))];
  })) as unknown as DynamicWorkflowSettings;

const emptySettings = (): DynamicWorkflowSettings =>
  Object.fromEntries(WORKFLOW_ENTITIES.map(key => [key, [] as WorkflowStage[]])) as unknown as DynamicWorkflowSettings;

const allUnconfigured = () => Object.fromEntries(WORKFLOW_ENTITIES.map(key => [key, false])) as Record<WorkflowEntityType, boolean>;

const toMatrix = (m: BackendAccessMatrix): ProjectContractPermissions => ({
  viewByAdmin: m.viewByAdmin, viewByPM: m.viewByPM, viewByTeam: m.viewByTeam, manageByAdmin: m.manageByAdmin, manageByPM: m.manageByPM
});

const fromMatrix = (m: ProjectContractPermissions | undefined): BackendAccessMatrix | null => m ? {
  viewByAdmin: !!m.viewByAdmin, viewByPM: !!m.viewByPM, viewByTeam: !!m.viewByTeam, manageByAdmin: !!m.manageByAdmin, manageByPM: !!m.manageByPM
} : null;

const ITEM_TYPE_NAME: Record<number, Delegation['type']> = {
  [BackendDelegatedItemType.waterfall]: 'waterfall', [BackendDelegatedItemType.agile]: 'agile', [BackendDelegatedItemType.action]: 'action'
};

const toUiDelegation = (d: BackendItemDelegation): Delegation => ({
  id: d.id,
  type: ITEM_TYPE_NAME[d.itemType] ?? 'waterfall',
  itemId: d.itemId,
  projectId: d.projectId ?? undefined,
  delegatorId: d.delegatorUserId,
  delegateeId: d.delegateUserId,
  delegationDate: d.delegatedAtUtc,
  isActive: d.isActive
});

/** Approval chains, who sees what, hand-overs of work and per-project switches - all as the backend holds them. */
export const GovernanceProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const projects = useProjects().projects;

  const [loading, setLoading] = React.useState(false);
  const [inbox, setInbox] = React.useState<BackendInstance[]>([]);
  const [groups, setGroups] = React.useState<BackendWorkflowGroup[]>([]);
  const [visibility, setVisibility] = React.useState<VisibilitySettings>(ALL_ON);
  const [allowApprovedProgress, setAllowApprovedProgress] = React.useState(false);
  const [projectSettings, setProjectSettings] = React.useState<Map<string, ProjectGovernanceView>>(new Map());
  const [delegations, setDelegations] = React.useState<Delegation[]>([]);

  const refreshInbox = React.useCallback(async () => {
    if (!session) return;
    const list = await approvalInboxApi.list();
    if (list.ok) setInbox((list.value ?? []).filter(i => i.status === BackendInstanceStatus.InProgress));
  }, [session]);

  const loadGroups = React.useCallback(async () => {
    const result = await workflowSettingsApi.groups();
    if (result.ok) setGroups(result.value ?? []);
  }, []);

  const loadSwitches = React.useCallback(async () => {
    const result = await governanceApi.settings();
    if (!result.ok || !result.value) return;
    setVisibility({ ...ALL_ON, ...result.value.visibility });
    setAllowApprovedProgress(!!result.value.allowConfirmedProgressOnRejection);
  }, []);

  const loadProjectSettings = React.useCallback(async () => {
    const result = await governanceApi.projectSettings();
    if (!result.ok) return;
    setProjectSettings(new Map((result.value ?? []).map(p => [p.projectId, {
      enabledTabs: p.enabledTabs ?? undefined,
      contractPermissions: toMatrix(p.contractAccess),
      invoicePermissions: toMatrix(p.invoiceAccess)
    }] as const)));
  }, []);

  const loadDelegations = React.useCallback(async () => {
    const result = await delegationApi.list();
    if (result.ok) setDelegations((result.value ?? []).map(toUiDelegation));
  }, []);

  React.useEffect(() => {
    if (!session) {
      setInbox([]); setGroups([]); setVisibility(ALL_ON); setAllowApprovedProgress(false); setProjectSettings(new Map()); setDelegations([]);
      return;
    }
    setLoading(true);
    void Promise.all([loadGroups(), loadSwitches(), loadProjectSettings(), loadDelegations()]).then(() => setLoading(false));
  }, [session, loadGroups, loadSwitches, loadProjectSettings, loadDelegations]);

  // What is waiting for the user changes whenever a register, report or contract does (a decision, a new submission).
  React.useEffect(() => { void refreshInbox(); }, [projects, refreshInbox]);

  const inboxIds = React.useMemo(() => new Set(inbox.map(i => i.subjectId)), [inbox]);

  const workflow = React.useMemo(() => toSettings(groups, g => (g.isConfigured ? g.steps : g.defaultSteps)), [groups]);
  const configured = React.useMemo(() => {
    const flags = allUnconfigured();
    for (const key of WORKFLOW_ENTITIES) flags[key] = !!groups.find(g => g.key === key)?.isConfigured;
    return flags;
  }, [groups]);

  const value = React.useMemo<GovernanceState>(() => ({
    loading,
    inbox,
    waitingForMe: subjectId => !!subjectId && inboxIds.has(subjectId),
    refreshInbox,

    workflow,
    configured,

    saveWorkflow: async settings => {
      // Only the kinds whose chain differs from what the backend holds are sent.
      for (const key of WORKFLOW_ENTITIES) {
        const stages = settings[key] ?? [];
        const before = JSON.stringify((workflow[key] ?? []).map(stepOf));
        const now = JSON.stringify(stages.map(stepOf));
        if (before === now && configured[key]) continue;
        const saved = await workflowSettingsApi.saveGeneral(key, stages.map(stepOf));
        if (!saved.ok) return fail(saved.error?.message, saved.error?.code);
        setGroups(saved.value ?? []);
      }
      return { ok: true };
    },

    setWorkflowEnabled: async (entity, enabled) => {
      const saved = await workflowSettingsApi.saveGeneral(entity, enabled ? null : []);
      if (!saved.ok) return fail(saved.error?.message, saved.error?.code);
      setGroups(saved.value ?? []);
      return { ok: true };
    },

    applyWorkflowDefaults: async () => {
      const applied = await workflowSettingsApi.applyDefaults();
      if (!applied.ok) return fail(applied.error?.message, applied.error?.code);
      setGroups(applied.value ?? []);
      return { ok: true };
    },

    loadProjectWorkflow: async projectId => {
      const result = await workflowSettingsApi.groups(projectId);
      if (!result.ok || !result.value) return null;
      const custom: Record<string, boolean> = {};
      for (const key of WORKFLOW_ENTITIES) for (const tab of TABS_OF_ENTITY[key]) custom[tab] = !!result.value.find(g => g.key === key)?.isCustom;
      return { custom, settings: toSettings(result.value, g => (g.isConfigured ? g.steps : g.defaultSteps)) };
    },

    saveProjectWorkflow: async (projectId, view) => {
      const current = await workflowSettingsApi.groups(projectId);
      if (!current.ok) return fail(current.error?.message, current.error?.code);
      for (const key of WORKFLOW_ENTITIES) {
        const custom = TABS_OF_ENTITY[key].some(tab => view.custom[tab] === true);
        const wasCustom = !!current.value?.find(g => g.key === key)?.isCustom;
        if (custom) {
          const saved = await workflowSettingsApi.saveProject(projectId, key, (view.settings[key] ?? []).map(stepOf));
          if (!saved.ok) return fail(saved.error?.message, saved.error?.code);
        } else if (wasCustom) {
          const reset = await workflowSettingsApi.resetProject(projectId, key);
          if (!reset.ok) return fail(reset.error?.message, reset.error?.code);
        }
      }
      return { ok: true };
    },

    visibility,
    allowApprovedProgress,
    saveSwitches: async (nextVisibility, nextAllow) => {
      const saved = await governanceApi.saveSettings({
        visibility: {
          viewByOwner: nextVisibility.viewByOwner, viewByManagerOrResponsible: nextVisibility.viewByManagerOrResponsible,
          viewByApprovers: nextVisibility.viewByApprovers, viewByResources: nextVisibility.viewByResources, viewByOrgHeads: nextVisibility.viewByOrgHeads
        },
        allowConfirmedProgressOnRejection: nextAllow
      });
      if (!saved.ok) return fail(saved.error?.message, saved.error?.code);
      setVisibility({ ...ALL_ON, ...saved.value?.visibility });
      setAllowApprovedProgress(!!saved.value?.allowConfirmedProgressOnRejection);
      return { ok: true };
    },

    projectSettings,
    settingsOf: projectId => projectSettings.get(projectId) ?? { enabledTabs: undefined, contractPermissions: DEFAULT_ACCESS, invoicePermissions: DEFAULT_ACCESS },
    saveProjectSettings: async (projectId, settings) => {
      const saved = await governanceApi.saveProjectSettings(projectId, {
        enabledTabs: settings.enabledTabs ?? null,
        contractAccess: fromMatrix(settings.contractPermissions),
        invoiceAccess: fromMatrix(settings.invoicePermissions)
      });
      if (!saved.ok) return fail(saved.error?.message, saved.error?.code);
      await loadProjectSettings();
      return { ok: true };
    },

    delegations,
    delegate: async (type, itemId, projectId, delegateeId) => {
      const made = await delegationApi.create(BackendDelegatedItemType[type], itemId, projectId ?? null, delegateeId);
      if (!made.ok) return fail(made.error?.message, made.error?.code);
      await loadDelegations();
      return { ok: true };
    },
    endDelegation: async id => {
      const ended = await delegationApi.end(id);
      if (!ended.ok) return fail(ended.error?.message, ended.error?.code);
      await loadDelegations();
      return { ok: true, restoreToUserId: ended.value?.restoreToUserId };
    }
  }), [loading, inbox, inboxIds, refreshInbox, workflow, configured, visibility, allowApprovedProgress, projectSettings, delegations, loadProjectSettings, loadDelegations]);

  return React.createElement(GovernanceContext.Provider, { value }, children);
};

export const useGovernance = () => React.useContext(GovernanceContext);
export { emptySettings as emptyWorkflowSettings };
