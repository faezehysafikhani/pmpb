import type { Project } from '../../types';
import { BackendApprovalStatus } from './projects';
import {
  approvals, delayReasons, documents, risks, SubjectType, stakeholders, statusUpdates
} from './registers';
import type { BackendInstance } from './registers';
import {
  toUiDelayReason, toUiDocument, toUiRisk, toUiRiskSettings, toUiStakeholder, toUiStakeholderStrategies, toUiStatusUpdate
} from './registerMappers';
import type { People } from './registerMappers';

/** What the backend holds about one project's registers, in the shapes the project tabs use. */
export type ProjectRegisters = Pick<
  Project,
  'risks' | 'stakeholders' | 'statusUpdates' | 'delayReasons' | 'documents' | 'riskDefinitions' | 'riskMatrixColors' | 'stakeholderStrategies'
>;

export interface LoadedRegisters {
  byProject: Map<string, ProjectRegisters>;
  /** The Workflow instance that decides each item, by item id (to approve or reject it). */
  instanceByItem: Map<string, string>;
  /** The first thing that went wrong, if anything did (a register the user may not see simply comes back empty). */
  error: string | null;
}

const emptyRegisters = (): ProjectRegisters => ({ risks: [], stakeholders: [], statusUpdates: [], delayReasons: [], documents: [] });

/**
 * Reads every register of the given projects with a handful of batch calls (one per register, plus the approval histories and
 * the two per-project settings). A register that fails to load leaves that part empty and is reported in `error`.
 */
export async function loadRegisters(projectIds: string[], people: People): Promise<LoadedRegisters> {
  const byProject = new Map<string, ProjectRegisters>(projectIds.map(id => [id, emptyRegisters()]));
  const instanceByItem = new Map<string, string>();
  if (projectIds.length === 0) return { byProject, instanceByItem, error: null };

  let error: string | null = null;
  const note = (result: { ok: boolean; error?: { message: string } }) => {
    if (!result.ok && !error) error = result.error?.message ?? 'Loading failed.';
  };

  const [riskList, stakeholderList, statusList, delayList, documentList, riskSettings, stakeholderSettings] = await Promise.all([
    risks.forProjects(projectIds),
    stakeholders.forProjects(projectIds),
    statusUpdates.forProjects(projectIds),
    delayReasons.forProjects(projectIds),
    documents.forProjects(projectIds),
    risks.settings(projectIds),
    stakeholders.settings(projectIds)
  ]);
  [riskList, stakeholderList, statusList, delayList, documentList, riskSettings, stakeholderSettings].forEach(note);

  // Items that were never sent for approval have no history to fetch.
  const sent = <T extends { id: string; approvalStatus: number }>(items: T[] | undefined) =>
    (items ?? []).filter(i => i.approvalStatus !== BackendApprovalStatus.NotSubmitted).map(i => i.id);

  const lookup = async (subjectType: string, ids: string[]): Promise<Map<string, BackendInstance>> => {
    const found = new Map<string, BackendInstance>();
    if (ids.length === 0) return found;
    const result = await approvals.forSubjects(subjectType, ids);
    note(result);
    for (const instance of result.value ?? []) {
      found.set(instance.subjectId, instance);
      instanceByItem.set(instance.subjectId, instance.id);
    }
    return found;
  };

  const [riskFlow, stakeholderFlow, statusFlow, delayFlow, documentFlow] = await Promise.all([
    lookup(SubjectType.risk, sent(riskList.value)),
    lookup(SubjectType.stakeholder, sent(stakeholderList.value)),
    lookup(SubjectType.status, sent(statusList.value)),
    lookup(SubjectType.delay, sent(delayList.value)),
    lookup(SubjectType.document, sent(documentList.value))
  ]);

  const of = (projectId: string) => byProject.get(projectId) ?? emptyRegisters();
  for (const item of riskList.value ?? []) of(item.projectId).risks.push(toUiRisk(item, riskFlow.get(item.id), people));
  for (const item of stakeholderList.value ?? []) of(item.projectId).stakeholders!.push(toUiStakeholder(item, stakeholderFlow.get(item.id), people));
  for (const item of statusList.value ?? []) of(item.projectId).statusUpdates.push(toUiStatusUpdate(item, statusFlow.get(item.id), people));
  for (const item of delayList.value ?? []) of(item.projectId).delayReasons!.push(toUiDelayReason(item, delayFlow.get(item.id), people));
  for (const item of documentList.value ?? []) of(item.projectId).documents.push(toUiDocument(item, documentFlow.get(item.id), people));

  for (const settings of riskSettings.value ?? []) Object.assign(of(settings.projectId), toUiRiskSettings(settings));
  for (const settings of stakeholderSettings.value ?? []) of(settings.projectId).stakeholderStrategies = toUiStakeholderStrategies(settings);

  return { byProject, instanceByItem, error };
}
