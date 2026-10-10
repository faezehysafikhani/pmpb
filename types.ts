

export interface Delegation {
  id: number;
  type: 'waterfall' | 'agile' | 'action';
  itemId: string | number; // activityId, taskId, or actionId
  projectId?: number;
  delegatorId: string;
  delegateeId: string;
  delegationDate: string; // ISO Date String
  isActive: boolean;
}

export interface ScheduleSnapshot {
  id: number;
  name: string;
  date: string; // ISO string for date and time
  schedule: ProjectActivity[];
  type: 'Baseline' | 'Progress Information';
  actualProgress?: number;
}

export type PlannedProgressType = 'continuous' | 'zero-hundred';

export type UserRole = 'Admin' | 'Project Manager' | 'Project Team';
export interface User {
  id: string;
  username: string;
  name?: string;
  password?: string;
  role: UserRole;
  isActive: boolean;
  owningUnit?: string; // واحد سازمانی (ساختار شکست سازمانی)
}

export interface OwningUnitTreeNode {
  id: string;
  name: string;
  parentId: string | null;
}

export interface VisibilitySettings {
  viewByOwner: boolean;               // مشاهده پروژه / اقدام توسط مالک مربوطه
  viewByManagerOrResponsible: boolean; // مشاهده پروژه / اقدام توسط مدیر پروژه یا مسئول مربوطه
  viewByApprovers: boolean;            // مشاهده پروژه / اقدام توسط هریک از تاییدکنندگان
  viewByResources: boolean;            // مشاهده پروژه توسط هریک از منابع
  viewByOrgHeads: boolean;             // مشاهده پروژه / اقدام توسط روسای سازمانی
  // دسترسی‌های سطح اپ برای قراردادها و صورتحساب‌ها:
  viewContractsAdmin?: boolean;
  viewContractsPM?: boolean;
  viewContractsTeam?: boolean;
  manageContractsAdmin?: boolean;
  manageContractsPM?: boolean;
  viewInvoicesAdmin?: boolean;
  viewInvoicesPM?: boolean;
  viewInvoicesTeam?: boolean;
  manageInvoicesAdmin?: boolean;
  manageInvoicesPM?: boolean;
}

export interface ContractAmendment {
  id: number;
  amendmentNumber: number; // شماره الحاقیه بصورت خودکار (۱، ۲، ...)
  startDate: string;       // تاریخ شروع الحاقیه
  endDate: string;         // تاریخ پایان الحاقیه
  amount: number;          // مبلغ الحاقیه
  description: string;     // شرح الحاقیه
}

export interface ProjectContract {
  id: number;
  contractNumber: string;  // شماره قرارداد
  title: string;           // عنوان قرارداد
  startDate: string;       // تاریخ شروع قرارداد
  endDate: string;         // تاریخ پایان قرارداد
  amount: number;          // مبلغ قرارداد
  contractorName: string;  // نام پیمانکار
  supervisorName: string;  // نام ناظر
  beneficiaryName: string; // نام بهره بردار
  description?: string;    // شرح / توضیحات قرارداد
  amendments?: ContractAmendment[]; // الحاقیه‌ها (مستر-دیتیل)
  submittedBy?: string;
}

export interface ProjectInvoice {
  id: number;
  invoiceNumber: string;   // شماره صورتحساب
  title: string;           // عنوان صورتحساب
  startDate: string;       // تاریخ شروع دوره صورتحساب
  endDate: string;         // تاریخ پایان دوره صورتحساب
  amount: number;          // مبلغ صورتحساب
  contractId?: number;     // شناسه قرارداد مربوطه
  contractTitle?: string;  // عنوان قرارداد مربوطه (کمبوباکس عنوان قرارداد بر اساس اطلاعات تب قرارداد)
  description?: string;    // شرح یا توضیحات صورتحساب
  submittedBy?: string;
}

export interface ProjectContractPermissions {
  viewByAdmin?: boolean;
  viewByPM?: boolean;
  viewByTeam?: boolean;
  manageByAdmin?: boolean;
  manageByPM?: boolean;
}

export interface ProjectInvoicePermissions {
  viewByAdmin?: boolean;
  viewByPM?: boolean;
  viewByTeam?: boolean;
  manageByAdmin?: boolean;
  manageByPM?: boolean;
}

export type ProjectType = 'waterfall' | 'agile';

export interface ProjectRisk {
  id: number;
  description: string;
  probability: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High';
  responsePlan: string;
  assignedTo: string;
  submittedBy?: string;
  isApproved?: boolean;
  isRejected?: boolean;
  currentStageIndex?: number;
  currentApproverId?: string;
  approvalHistory?: ProjectApprovalRecord[];
  // Risk Response Execution & Verification Workflow fields:
  responseStatus?: WorkStatus;
  submittedResponseStatus?: WorkStatus;
  verificationStatus?: ProgressUpdateStatus | 'Unsubmitted';
  verificationStageIndex?: number;
  verificationApproverId?: string;
  verificationHistory?: ProjectApprovalRecord[];
  verificationComment?: string;
}

export interface RiskLevelThresholdDefinition {
  range: string;
  description: string;
}

export interface RiskProbabilityImpactDefinitions {
  probability: {
    high: RiskLevelThresholdDefinition;
    medium: RiskLevelThresholdDefinition;
    low: RiskLevelThresholdDefinition;
  };
  impact: {
    high: RiskLevelThresholdDefinition;
    medium: RiskLevelThresholdDefinition;
    low: RiskLevelThresholdDefinition;
  };
}

export const DEFAULT_RISK_DEFINITIONS: RiskProbabilityImpactDefinitions = {
  probability: {
    high: {
      range: 'بالای ۶۰٪',
      description: 'احتمال وقوع بسیار بالا در طول اجرای پروژه (احتمال رخداد بیش از ۶۰٪)'
    },
    medium: {
      range: 'بین ۳۰٪ تا ۶۰٪',
      description: 'احتمال وقوع متوسط و محتمل در طول اجرای پروژه (۳۰٪ الی ۶۰٪)'
    },
    low: {
      range: 'کمتر از ۳۰٪',
      description: 'احتمال وقوع کم و نامحتمل (کمتر از ۳۰٪)'
    }
  },
  impact: {
    high: {
      range: 'بالای ۶۰٪',
      description: 'اثر شدید و بحرانی بر زمان، هزینه، کیفیت یا اهداف اصلی پروژه'
    },
    medium: {
      range: 'بین ۳۰٪ تا ۶۰٪',
      description: 'اثر متوسط و قابل مدیریت بر برنامه زمان‌بندی یا بودجه پروژه'
    },
    low: {
      range: 'کمتر از ۳۰٪',
      description: 'اثر جزئی، ناچیز و قابل اغماض بر فعالیت‌ها یا هزینه‌ها'
    }
  }
};

export interface StakeholderStrategies {
  highPower_highInterest: string; // قدرت زیاد، علاقه زیاد -> مدیریت دقیق نیازمندیها
  highPower_lowInterest: string;  // قدرت زیاد، علاقه کم -> تامین نیازمندیها
  lowPower_highInterest: string;   // قدرت کم، علاقه زیاد -> مطلع نگه داشتن
  lowPower_lowInterest: string;    // قدرت کم، علاقه کم -> حداقل تلاش برای مدیریت نیازمندیها
}

export const DEFAULT_STAKEHOLDER_STRATEGIES: StakeholderStrategies = {
  highPower_highInterest: 'مدیریت دقیق نیازمندیها',
  highPower_lowInterest: 'تامین نیازمندیها',
  lowPower_highInterest: 'مطلع نگه داشتن',
  lowPower_lowInterest: 'حداقل تلاش برای مدیریت نیازمندیها'
};

export interface ProjectStakeholder {
  id: number;
  name: string; // نام / عنوان ذینفع
  power: 'Low' | 'High'; // قدرت: کم / زیاد
  interest: 'Low' | 'High'; // علاقه: کم / زیاد
  strategy?: string; // استراتژی برخورد
  requirements?: string; // نیازمندی‌ها و الزامات فنی و ارتباطی
  submittedBy?: string;
  isApproved?: boolean;
  isRejected?: boolean;
  currentStageIndex?: number;
  currentApproverId?: string;
  approvalHistory?: ProjectApprovalRecord[];
}

export const getStakeholderStrategy = (
  power: 'Low' | 'High',
  interest: 'Low' | 'High',
  lang: string = 'fa',
  customStrategies?: StakeholderStrategies
): string => {
  const isFa = lang === 'fa';
  if (power === 'Low' && interest === 'Low') {
    return (customStrategies?.lowPower_lowInterest) || (isFa ? 'حداقل تلاش برای مدیریت نیازمندیها' : 'Minimum Effort (Monitor)');
  }
  if (power === 'High' && interest === 'Low') {
    return (customStrategies?.highPower_lowInterest) || (isFa ? 'تامین نیازمندیها' : 'Keep Satisfied');
  }
  if (power === 'Low' && interest === 'High') {
    return (customStrategies?.lowPower_highInterest) || (isFa ? 'مطلع نگه داشتن' : 'Keep Informed');
  }
  return (customStrategies?.highPower_highInterest) || (isFa ? 'مدیریت دقیق نیازمندیها' : 'Manage Closely');
};

export interface ProjectStatusUpdate {
  id: number;
  description: string;
  date: string; // YYYY-MM-DD
  submittedBy?: string;
  isApproved?: boolean;
  isRejected?: boolean;
  currentStageIndex?: number;
  currentApproverId?: string;
  approvalHistory?: ProjectApprovalRecord[];
}

export interface ProjectDocument {
  id: number;
  name: string;
  description: string;
  type: 'Letter' | 'Meeting Minutes' | 'Report' | 'Other';
  date?: string; // YYYY-MM-DD
  submittedBy?: string;
  isApproved?: boolean;
  isRejected?: boolean;
  aiSummary?: string;
  aiRelevance?: string;
  aiRelevanceReason?: string;
  currentStageIndex?: number;
  currentApproverId?: string;
  approvalHistory?: ProjectApprovalRecord[];
}

export interface ProjectActivity {
  id: string;
  name: string;
  duration: number; // in days
  prerequisiteId: string | null;
  prerequisiteType?: 'FS' | 'SS' | 'FF' | 'SF';
  lag?: number; // in days
  cost?: number;
  manHour?: number;
  importance?: 'Low' | 'Medium' | 'High';
  complexity?: 'Low' | 'Medium' | 'High';
  weight: number;
  assignedToId: string | null;
  actualProgress: number; // percentage 0-100
  parentId: string | null;
  approver1Id?: string | null;
  approver2Id?: string | null;
  approver3Id?: string | null;
  // Calculated fields
  wbsCode?: string;
  startDate?: Date;
  endDate?: Date;
  lateStartDate?: Date;
  lateEndDate?: Date;
  totalFloat?: number;
  freeFloat?: number;
  isCritical?: boolean;
  plannedProgress?: number;
  isParent?: boolean;
  children?: ProjectActivity[];
  level?: number;
  successors?: string[];
}

export type TaskPriority = 'Low' | 'Medium' | 'High';
export type KanbanStatus = 'To-Do' | 'Doing' | 'Done';
export type WorkStatus = 'Planning' | 'In Progress' | 'On Hold' | 'Completed';

export interface KanbanTask {
  id: number;
  description: string;
  dueDate: string;
  priority: TaskPriority;
  assignedToId: string | null;
  status: KanbanStatus;
  sprintNumber?: number;
  approver1Id?: string | null;
  approver2Id?: string | null;
  approver3Id?: string | null;
}

export interface SpecificHoliday {
  date: string; // YYYY-MM-DD
  reason: string;
}

export interface Calendar {
  id: string;
  name: string;
  isDefault?: boolean;
  workingDays: number[]; // 0 for Sunday, 6 for Saturday
  specificHolidays?: SpecificHoliday[];
  applyOfficialHolidays?: boolean;
  workHoursPerDay?: number;
}

export type ProjectApprovalStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected';

export interface ProjectApprovalRecord {
  action: 'Submitted' | 'Approved' | 'Rejected';
  date: string;
  comment?: string;
  actor: string; // username
  stageTitle?: string;
}

export interface ProjectDelayReason {
  id: number;
  description: string;
  date: string; // YYYY-MM-DD
  submittedBy?: string;
  isApproved?: boolean;
  isRejected?: boolean;
  currentStageIndex?: number;
  currentApproverId?: string;
  approvalHistory?: ProjectApprovalRecord[];
}

export interface Project {
  id: number;
  type: ProjectType;
  approvalStatus: ProjectApprovalStatus;
  approvalComment?: string;
  submissionDate?: string; // YYYY-MM-DD
  approvalHistory?: ProjectApprovalRecord[];
  currentApprovalStageIndex?: number;
  // Charter
  name: string;
  code?: string;
  cost?: number;
  ownerId?: string | null;
  projectManagerId: string | null;
  startDate: string;
  endDate: string;
  status: WorkStatus;
  owningUnit: string;
  description: string;
  goal: string;
  requirements: string;
  constraintsAndAssumptions?: string;
  calendarId: string;
  // Tabs
  teamMemberIds: string[];
  risks: ProjectRisk[];
  stakeholders?: ProjectStakeholder[];
  statusUpdates: ProjectStatusUpdate[];
  delayReasons?: ProjectDelayReason[];
  documents: ProjectDocument[];
  schedule?: ProjectActivity[];
  kanbanTasks?: KanbanTask[];
  sprintCount?: number;
  weightingType?: 'manual' | 'time-based' | 'cost-based' | 'complexity-based' | 'combined';
  plannedProgressType?: PlannedProgressType;
  scheduleSnapshots?: ScheduleSnapshot[];
  timeWeightFactor?: number;
  costWeightFactor?: number;
  complexityWeightFactor?: number;
  enabledTabs?: string[];
  tabWorkflows?: Record<string, boolean>;
  customWorkflowSettings?: DynamicWorkflowSettings;
  riskDefinitions?: RiskProbabilityImpactDefinitions;
  riskMatrixColors?: Record<string, 'red' | 'yellow' | 'green'>;
  stakeholderStrategies?: StakeholderStrategies;
  approver1Id?: string | null;
  contracts?: ProjectContract[];
  invoices?: ProjectInvoice[];
  contractPermissions?: ProjectContractPermissions;
  invoicePermissions?: ProjectInvoicePermissions;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurringActionOccurrence {
  id: string;
  date: string;
  instanceIndex: number;
  label: string;
  durationHours?: number;
}

export interface ActionRecurrence {
  isRecurring?: boolean;
  enabled?: boolean;
  frequency: RecurrenceFrequency; // 'daily' | 'weekly' | 'monthly'
  interval: number; // هر X روز/هفته/ماه یک‌بار (پیش‌فرض ۱)
  durationHours?: number; // مدت زمان به ساعت برای هر بار اجرا
  daysOfWeek?: number[]; // [6, 0, 1, 2, 3, 4, 5] (۶: شنبه, ۰: یکشنبه, ۱: دوشنبه, ۲: سه‌شنبه, ۳: چهارشنبه, ۴: پنج‌شنبه, ۵: جمعه)
  dayOfMonth?: number; // روز در ماه (۱ تا ۳۱)
  monthsOfYear?: number[]; // ماه‌های انتخابی از سال (۱ تا ۱۲)
  allMonths?: boolean; // آیا همه ماه‌های سال فعال است
}

export interface ActionItem {
  id: number;
  title: string;
  description: string;
  ownerUserId?: string | null; // مالک اقدام (ایجادکننده)
  responsibleUserId: string | null;
  approver1Id: string | null;
  approver2Id?: string | null;
  approver3Id?: string | null;
  status: WorkStatus;
  calendarId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  owningUnit: string;
  projectId?: number;
  sourceType?: 'manual' | 'risk' | 'stakeholder';
  sourceRiskId?: number;
  sourceStakeholderId?: number;
  sourceInfo?: {
    type: 'risk' | 'stakeholder';
    projectName?: string;
    riskTitle?: string;
    riskPlan?: string;
    stakeholderName?: string;
    stakeholderStrategy?: string;
  };
  recurrence?: ActionRecurrence;
  recurringOccurrences?: RecurringActionOccurrence[];
  workflowType?: 'risks' | 'stakeholders' | 'actions' | 'general';
  isApproved?: boolean;
  isPending?: boolean;
  isRejected?: boolean;
  currentStageIndex?: number;
  currentApproverId?: string;
  approvalHistory?: ProjectApprovalRecord[];
}

export interface EnrichedProject extends Project {
    plannedProgress: number;
    actualProgress: number;
    performance: number;
    // For agile projects
    totalTasks?: number;
    todoTasks?: number;
    doingTasks?: number;
    doneTasks?: number;
}

export type ProgressUpdateStatus = 'Pending Approval' | 'Approved' | 'Rejected';

export interface ProgressUpdate {
    id: number;
    projectId?: number;
    activityId?: string;
    taskId?: number;
    actionId?: number;
    riskId?: number;
    submittedBy: string;
    submittedProgress?: number;
    approvedProgress?: number; // درصد پیشرفت تاییدی
    isPartialRejection?: boolean; // رد همراه با ثبت درصد پیشرفت تاییدی
    submittedStatus?: KanbanStatus | WorkStatus;
    currentStatus?: KanbanStatus | WorkStatus;
    submittedTask?: KanbanTask; // For new agile task approvals
    submittedCharter?: Partial<Project>; // For charter updates
    status: ProgressUpdateStatus;
    submissionDate: string; // YYYY-MM-DD
    reviewComment?: string;
    reviewDate?: string; // YYYY-MM-DD
    submissionComment?: string;
    documentName?: string;
    currentApproverId?: string;
    currentStageIndex?: number;
    stageTitle?: string;
    approvalHistory?: ProjectApprovalRecord[];
}

export type WorkflowEntityType = 
  | 'charter'
  | 'activity_progress'
  | 'risks'
  | 'stakeholders'
  | 'status_updates'
  | 'delay_reasons'
  | 'documents'
  | 'contracts'
  | 'invoices';

export interface WorkflowStage {
  id: string;
  stageNumber: number;
  stageTitle: string; // e.g. "تایید نهایی" or "بررسی اولیه"
  approverId: 'ROLE_PM' | 'ROLE_OWNER' | string; // 'ROLE_PM': مدیر پروژه/اقدام, 'ROLE_OWNER': مالک پروژه/اقدام, or userId
}

export type DynamicWorkflowSettings = Record<WorkflowEntityType, WorkflowStage[]>;

export const DEFAULT_DYNAMIC_WORKFLOW_SETTINGS: DynamicWorkflowSettings = {
  charter: [
    { id: 'charter_1', stageNumber: 1, stageTitle: 'تایید نهایی', approverId: 'ROLE_PM' }
  ],
  activity_progress: [
    { id: 'activity_progress_1', stageNumber: 1, stageTitle: 'تایید نهایی', approverId: 'ROLE_PM' }
  ],
  risks: [
    { id: 'risks_1', stageNumber: 1, stageTitle: 'تایید نهایی', approverId: 'ROLE_PM' }
  ],
  stakeholders: [
    { id: 'stakeholders_1', stageNumber: 1, stageTitle: 'تایید نهایی', approverId: 'ROLE_PM' }
  ],
  status_updates: [
    { id: 'status_updates_1', stageNumber: 1, stageTitle: 'تایید نهایی', approverId: 'ROLE_PM' }
  ],
  delay_reasons: [
    { id: 'delay_reasons_1', stageNumber: 1, stageTitle: 'تایید نهایی', approverId: 'ROLE_PM' }
  ],
  documents: [
    { id: 'documents_1', stageNumber: 1, stageTitle: 'تایید اولیه', approverId: 'ROLE_PM' },
    { id: 'documents_2', stageNumber: 2, stageTitle: 'تایید نهایی', approverId: 'ROLE_OWNER' }
  ],
  contracts: [
    { id: 'contracts_1', stageNumber: 1, stageTitle: 'تایید نهایی', approverId: 'ROLE_PM' }
  ],
  invoices: [
    { id: 'invoices_1', stageNumber: 1, stageTitle: 'تایید نهایی', approverId: 'ROLE_PM' }
  ]
};

export const resolveWorkflowApproverId = (
  approverId: 'ROLE_PM' | 'ROLE_OWNER' | string,
  project?: Project | null,
  action?: ActionItem | null,
  fallbackAdminId: string = '1'
): string => {
  if (approverId === 'ROLE_PM') {
    if (project?.projectManagerId) return project.projectManagerId;
    if (action?.responsibleUserId) return action.responsibleUserId;
    return fallbackAdminId;
  }
  if (approverId === 'ROLE_OWNER') {
    if (project?.ownerId) return project.ownerId;
    if (action?.ownerUserId) return action.ownerUserId;
    if (project?.projectManagerId) return project.projectManagerId;
    return fallbackAdminId;
  }
  return approverId || fallbackAdminId;
};

export const getEffectiveProjectWorkflowStages = (
  entityType: WorkflowEntityType,
  project?: Project | null,
  globalSettings?: DynamicWorkflowSettings
): WorkflowStage[] => {
  if (!project) {
    return globalSettings?.[entityType] || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS[entityType];
  }

  // Map entityType to tabKey in project.tabWorkflows
  const entityToTabMap: Record<WorkflowEntityType, string> = {
    charter: 'charter',
    activity_progress: 'schedule',
    risks: 'risks',
    stakeholders: 'stakeholders',
    status_updates: 'status',
    delay_reasons: 'delays',
    documents: 'docs',
    contracts: 'contracts',
    invoices: 'invoices'
  };

  const tabKey = entityToTabMap[entityType] || entityType;
  // If tabWorkflows[tabKey] is false, it means unique/custom workflow for this project is active
  const isGlobalStandardWorkflow = project.tabWorkflows ? project.tabWorkflows[tabKey] !== false : true;

  if (!isGlobalStandardWorkflow && project.customWorkflowSettings?.[entityType] && project.customWorkflowSettings[entityType].length > 0) {
    return project.customWorkflowSettings[entityType];
  }

  return globalSettings?.[entityType] || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS[entityType];
};

export const isProjectTabCustomWorkflow = (
  tabKeyOrEntity: string,
  project?: Project | null
): boolean => {
  if (!project || !project.tabWorkflows) return false;
  return project.tabWorkflows[tabKeyOrEntity] === false;
};

export interface EnrichedTask extends ProjectActivity {
    projectName: string;
    parentActivityName: string;
    approverName: string;
    submissionStatus: ProgressUpdateStatus | 'Unsubmitted';
    projectId: number;
    reviewComment?: string;
}

export interface EnrichedKanbanTask extends KanbanTask {
    projectName: string;
    projectId: number;
    approverName: string;
    submissionStatus: ProgressUpdateStatus | 'Unsubmitted';
    reviewComment?: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  weight: number;
  parentId: string | null;
  // Calculated fields
  children?: Strategy[];
  level?: number;
  isLeaf?: boolean;
}

export type AlignmentLevel = 'None' | 'Low' | 'Medium' | 'High';

export interface ProjectStrategyAlignment {
  projectId: number;
  strategyId: string; // Leaf strategy ID
  level: AlignmentLevel;
}

export type KnowledgeDocumentType = 'Book' | 'Pamphlet' | 'Software' | 'Other';

export interface KnowledgeDocument {
  id: number;
  name: string;
  description: string;
  type: KnowledgeDocumentType;
}


// From pages.ts (to avoid circular dependency with context)
export type { Language, TranslationKey } from './pages';