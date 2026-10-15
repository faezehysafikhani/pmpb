import type {
  Project, ProjectApprovalRecord, ProjectDelayReason, ProjectDocument, ProjectRisk, ProjectStakeholder, ProjectStatusUpdate,
  RiskProbabilityImpactDefinitions, StakeholderStrategies, User, WorkStatus
} from '../../types';
import { DEFAULT_RISK_DEFINITIONS, DEFAULT_STAKEHOLDER_STRATEGIES } from '../../types';
import { BackendApprovalStatus } from './projects';
import {
  BackendDelayRootCause, BackendDocumentType, BackendInstanceStatus, BackendPower, BackendRiskResponse
} from './registers';
import type {
  BackendRiskResponseReport, BackendDelayReason, BackendDocument, BackendInstance, BackendRisk, BackendRiskSettings, BackendStakeholder,
  BackendStakeholderSettings, BackendStatusUpdate, RiskBody, StakeholderBody
} from './registers';

/**
 * Shape adapters only (no rule lives here): the backend's register records become the objects the project tabs already use.
 * Whether an item is approved, pending or rejected, who must decide next and the decision history all come from the backend
 * (the item's own approval status plus its Workflow instance).
 */
export interface People {
  /** The account name the screens show/choose people by, for a backend user id. */
  usernameOf: (userId: string | null | undefined) => string | undefined;
  /** "Name (username)" for the history records. */
  labelOf: (userId: string | null | undefined) => string;
  /** The backend user id for the account name a screen chose. */
  idOfUsername: (username: string | null | undefined) => string | null;
}

export function buildPeople(users: User[]): People {
  const byId = new Map(users.map(u => [String(u.id), u] as const));
  const byName = new Map(users.map(u => [u.username, u] as const));
  return {
    usernameOf: id => (id ? byId.get(id)?.username : undefined),
    labelOf: id => {
      const user = id ? byId.get(id) : undefined;
      return user ? (user.name ? `${user.name} (${user.username})` : user.username) : '-';
    },
    idOfUsername: name => (name ? String(byName.get(name)?.id ?? '') || null : null)
  };
}

const level = (value: string): 'Low' | 'Medium' | 'High' => (value === 'low' ? 'Low' : value === 'high' ? 'High' : 'Medium');
const levelWord = (value: string | undefined): string => (value ?? 'Medium').toLowerCase();
const day = (iso: string) => iso.slice(0, 10);

type Approval = Pick<ProjectRisk, 'isApproved' | 'isRejected' | 'currentStageIndex' | 'currentApproverId' | 'approvalHistory'>;

export function approvalOf(status: number, instance: BackendInstance | undefined, people: People): Approval {
  const history: ProjectApprovalRecord[] = (instance?.decisions ?? [])
    .slice()
    .sort((a, b) => a.stepOrder - b.stepOrder || a.decidedAtUtc.localeCompare(b.decidedAtUtc))
    .map(d => ({
      action: d.approved ? 'Approved' : 'Rejected',
      date: d.decidedAtUtc,
      comment: d.comment ?? undefined,
      actor: people.labelOf(d.decidedByUserId),
      stageTitle: `${d.stepOrder}`
    }));
  const inProgress = instance?.status === BackendInstanceStatus.InProgress;
  return {
    isApproved: status === BackendApprovalStatus.Approved,
    isRejected: status === BackendApprovalStatus.Rejected,
    currentStageIndex: instance ? Math.max(0, instance.currentStepOrder - 1) : 0,
    currentApproverId: inProgress ? instance?.currentApproverUserId ?? undefined : undefined,
    approvalHistory: history
  };
}

// ------------------------------------------------------------------------------------------------- risks

const UI_RESPONSE_STATUS: Record<number, WorkStatus> = {
  [BackendRiskResponse.Planning]: 'Planning',
  [BackendRiskResponse.InProgress]: 'In Progress',
  [BackendRiskResponse.OnHold]: 'On Hold',
  [BackendRiskResponse.Completed]: 'Completed'
};

export const backendResponseStatusOf = (status: string | undefined): number =>
  status === 'In Progress' ? BackendRiskResponse.InProgress
    : status === 'On Hold' ? BackendRiskResponse.OnHold
      : status === 'Completed' ? BackendRiskResponse.Completed
        : BackendRiskResponse.Planning;

/**
 * Where the work on a risk's response stands as the task and approval centres show it: the latest report of the response status with its
 * approval (waiting, verified or refused), its decision history and who must decide next. All of it is the backend's.
 */
export function toUiRiskVerification(
  report: BackendRiskResponseReport | undefined, instance: BackendInstance | undefined, people: People
): Pick<ProjectRisk, 'submittedResponseStatus' | 'verificationStatus' | 'verificationStageIndex' | 'verificationApproverId' | 'verificationHistory' | 'verificationComment' | 'verificationReportId'> {
  if (!report) return {};
  const approval = approvalOf(report.approvalStatus, instance, people);
  const last = approval.approvalHistory?.at(-1);
  return {
    verificationReportId: report.id,
    submittedResponseStatus: report.approvalStatus === BackendApprovalStatus.PendingApproval ? UI_RESPONSE_STATUS[report.submittedStatus] : undefined,
    verificationStatus: report.approvalStatus === BackendApprovalStatus.PendingApproval ? 'Pending Approval'
      : report.approvalStatus === BackendApprovalStatus.Approved ? 'Approved'
        : report.approvalStatus === BackendApprovalStatus.Rejected ? 'Rejected' : 'Unsubmitted',
    verificationStageIndex: approval.currentStageIndex,
    verificationApproverId: approval.currentApproverId,
    verificationComment: last?.comment,
    verificationHistory: [
      { action: 'Submitted', date: report.submittedAtUtc, actor: people.labelOf(report.submittedByUserId), comment: report.comment ?? undefined },
      ...(approval.approvalHistory ?? [])
    ]
  };
}

export function toUiRisk(risk: BackendRisk, instance: BackendInstance | undefined, people: People): ProjectRisk {
  return {
    id: risk.id,
    description: risk.description,
    probability: level(risk.probabilityLevel),
    impact: level(risk.impactLevel),
    responsePlan: risk.responsePlan ?? '',
    assignedTo: people.usernameOf(risk.riskOwnerUserId) ?? '',
    submittedBy: risk.createdByUserId ?? undefined,
    responseStatus: UI_RESPONSE_STATUS[risk.responseStatus] ?? 'Planning',
    ...approvalOf(risk.approvalStatus, instance, people)
  };
}

export const toRiskBody = (risk: Partial<ProjectRisk>, people: People): RiskBody => ({
  description: (risk.description ?? '').trim(),
  probabilityLevel: levelWord(risk.probability),
  impactLevel: levelWord(risk.impact),
  responsePlan: risk.responsePlan?.trim() || null,
  riskOwnerUserId: people.idOfUsername(risk.assignedTo)
});

/** The UI keys its matrix "Probability-Impact" with capitalised words. */
export function toUiRiskSettings(settings: BackendRiskSettings | undefined): {
  riskDefinitions?: RiskProbabilityImpactDefinitions;
  riskMatrixColors?: Record<string, 'red' | 'yellow' | 'green'>;
} {
  if (!settings) return {};
  const definitions: RiskProbabilityImpactDefinitions = JSON.parse(JSON.stringify(DEFAULT_RISK_DEFINITIONS));
  for (const d of settings.definitions) {
    const axis = definitions[d.axis as 'probability' | 'impact'];
    if (axis && (d.level === 'low' || d.level === 'medium' || d.level === 'high')) axis[d.level] = { range: d.range, description: d.description };
  }
  const colors: Record<string, 'red' | 'yellow' | 'green'> = {};
  for (const c of settings.matrixColors) {
    colors[`${level(c.probability)}-${level(c.impact)}`] = c.color as 'red' | 'yellow' | 'green';
  }
  // A project the backend has nothing for yet reads as undefined, so the screens use their own defaults.
  return {
    riskDefinitions: settings.definitions.length ? definitions : undefined,
    riskMatrixColors: Object.keys(colors).length ? colors : undefined
  };
}

export const toRiskDefinitionsBody = (definitions: RiskProbabilityImpactDefinitions): BackendRiskSettings['definitions'] =>
  (['probability', 'impact'] as const).flatMap(axis =>
    (['low', 'medium', 'high'] as const).map(l => ({ axis, level: l, range: definitions[axis][l].range, description: definitions[axis][l].description })));

export const toRiskColorsBody = (colors: Record<string, 'red' | 'yellow' | 'green'>): BackendRiskSettings['matrixColors'] =>
  (['Low', 'Medium', 'High'] as const).flatMap(probability =>
    (['Low', 'Medium', 'High'] as const).map(impact => ({
      probability: probability.toLowerCase(), impact: impact.toLowerCase(), color: colors[`${probability}-${impact}`] ?? 'red'
    })));

// ------------------------------------------------------------------------------------------------- stakeholders

export function toUiStakeholder(item: BackendStakeholder, instance: BackendInstance | undefined, people: People): ProjectStakeholder {
  return {
    id: item.id,
    name: item.name,
    power: item.power >= BackendPower.High ? 'High' : 'Low',
    interest: item.interest >= BackendPower.High ? 'High' : 'Low',
    strategy: item.strategy ?? undefined,
    requirements: item.requirements ?? undefined,
    submittedBy: item.createdByUserId ?? undefined,
    ...approvalOf(item.approvalStatus, instance, people)
  };
}

export const toStakeholderBody = (item: Partial<ProjectStakeholder>): StakeholderBody => ({
  name: (item.name ?? '').trim(),
  power: item.power === 'High' ? BackendPower.High : BackendPower.Low,
  interest: item.interest === 'High' ? BackendPower.High : BackendPower.Low,
  requirements: item.requirements?.trim() || null,
  // The screens never let anyone type a strategy: the backend words it from the quadrant (and the project's own wording).
  engagementStrategy: null
});

export function toUiStakeholderStrategies(settings: BackendStakeholderSettings | undefined): StakeholderStrategies | undefined {
  if (!settings) return undefined;
  return {
    highPower_highInterest: settings.manageClosely || DEFAULT_STAKEHOLDER_STRATEGIES.highPower_highInterest,
    highPower_lowInterest: settings.keepSatisfied || DEFAULT_STAKEHOLDER_STRATEGIES.highPower_lowInterest,
    lowPower_highInterest: settings.keepInformed || DEFAULT_STAKEHOLDER_STRATEGIES.lowPower_highInterest,
    lowPower_lowInterest: settings.monitor || DEFAULT_STAKEHOLDER_STRATEGIES.lowPower_lowInterest
  };
}

// ------------------------------------------------------------------------------------------------- status updates, delay reasons

export function toUiStatusUpdate(item: BackendStatusUpdate, instance: BackendInstance | undefined, people: People): ProjectStatusUpdate {
  return {
    id: item.id,
    description: item.statusDescription ?? '',
    date: day(item.registerDate),
    submittedBy: item.createdByUserId ?? undefined,
    ...approvalOf(item.approvalStatus, instance, people)
  };
}

export function toUiDelayReason(item: BackendDelayReason, instance: BackendInstance | undefined, people: People): ProjectDelayReason {
  return {
    id: item.id,
    description: item.description,
    date: day(item.registerDate),
    submittedBy: item.createdByUserId ?? undefined,
    ...approvalOf(item.approvalStatus, instance, people)
  };
}

export const OTHER_ROOT_CAUSE = BackendDelayRootCause.Other;

// ------------------------------------------------------------------------------------------------- documents

const UI_DOC_TYPE: Record<number, ProjectDocument['type']> = {
  [BackendDocumentType.Report]: 'Report',
  [BackendDocumentType.Letter]: 'Letter',
  [BackendDocumentType.MeetingMinutes]: 'Meeting Minutes',
  [BackendDocumentType.Other]: 'Other'
};

export const backendDocumentTypeOf = (type: ProjectDocument['type'] | undefined): number =>
  type === 'Report' ? BackendDocumentType.Report
    : type === 'Letter' ? BackendDocumentType.Letter
      : type === 'Meeting Minutes' ? BackendDocumentType.MeetingMinutes
        : BackendDocumentType.Other;

export function toUiDocument(item: BackendDocument, instance: BackendInstance | undefined, people: People): ProjectDocument {
  return {
    id: item.id,
    name: item.fileName,
    description: item.description,
    type: UI_DOC_TYPE[item.documentType] ?? 'Other',
    date: day(item.registerDate),
    fileName: item.fileName,
    sizeBytes: item.sizeBytes,
    submittedBy: item.createdByUserId ?? undefined,
    ...approvalOf(item.approvalStatus, instance, people)
  };
}
