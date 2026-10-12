






import React, { useState, useContext, useEffect, useMemo, useCallback, MouseEvent, ReactElement, Fragment, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { LocalizationContext } from '../context';
import { 
    User, Project, ProjectType, KanbanTask, Calendar, ProjectApprovalStatus,
    EnrichedProject, Strategy, AlignmentLevel, ProjectStrategyAlignment, KanbanStatus,
    UserRole, TranslationKey, ProgressUpdate, ActionItem, WorkStatus, ProjectActivity, ProjectRisk, ProjectStakeholder, ProjectStatusUpdate, ProjectDelayReason, ProjectDocument,
    PlannedProgressType, ScheduleSnapshot, VisibilitySettings, WorkflowEntityType, DEFAULT_DYNAMIC_WORKFLOW_SETTINGS, resolveWorkflowApproverId, DynamicWorkflowSettings,
    ProjectApprovalRecord, getEffectiveProjectWorkflowStages, isProjectTabCustomWorkflow, ProjectContract, ProjectInvoice
} from '../types';
import { useAuth } from '../directory/AuthContext';
import { getRuntimeUnitTree } from '../services/backend/runtimeDirectory';
import { projectErrorText } from '../services/backend/errors';
import { pickCalendar, getISODateString, getISODateTimeString, enrichProjectWithProgress, calculateScheduleTreeAndProgress, formatDate, toPersianDigits, isActionVisibleToUser, getUnitLevel1And2, exportDashboardToLandscapePdf } from '../utils';
import { 
    OrgChartModal,
    ProjectHistoryModal,
    ActionHistoryModal,
    RiskModal,
    StakeholderModal,
    StatusUpdateModal,
    DelayReasonModal,
    DocumentModal
} from '../components/Modals';
import { 
    ProjectTeamTab, ProjectRisksTab, ProjectStakeholdersTab, ProjectStatusTab, ProjectDelayReasonsTab, ProjectDocumentsTab,
    ProjectScheduleTab, ProjectKanbanTab, ProjectActionsTab, ProjectSettingsTab, ProjectSprintsTab, ProjectContractsTab, ProjectInvoicesTab
} from '../components/ProjectTabs';
import { ProjectCharterForm } from '../components/Forms';
import { 
    PerformanceIndicator, ProgressBar
} from '../components/Indicators';
import { 
    ProjectCountCard, PieDoughnutChart, HorizontalBarChart, GaugeChart, CostStatCard, SwitchableChartCard
} from '../components/Charts';
import { SCurveChartInline, AgileProgressChartInline } from '../components/DashboardCharts';

// --- CreateProjectPage ---
export const CreateProjectPage = ({ onNavigate }: { onNavigate: (page: string, context?: any) => void }): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    const projectTypes = useMemo(() => [
        { id: 'waterfall', name: t('waterfallProject'), icon: 'account_tree' },
        { id: 'agile', name: t('agileProject'), icon: 'sync_alt' },
    ], [t]);

    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('createNewProject'))
            ),
            React.createElement("div", { className: "form-section" },
                React.createElement("h3", null, t('chooseProjectType')),
                React.createElement("div", { className: "project-type-selector" },
                    projectTypes.map(type => (
                         React.createElement("a", {
                            href: "#",
                            key: type.id,
                            className: "project-type-option",
                            role: "button",
                            "aria-label": type.name,
                            onClick: (e: MouseEvent) => {
                                e.preventDefault();
                                onNavigate(`create_${type.id}_details`, { type: type.id as ProjectType });
                            }
                        } as React.HTMLAttributes<HTMLAnchorElement>,
                            React.createElement("span", { className: "material-symbols-outlined" }, type.icon),
                            React.createElement("span", null, type.name)
                        )
                    ))
                )
            )
        )
    );
};

// --- ProjectDetailsPage ---
export const ProjectDetailsPage = ({ projectType, users, onNavigate, onSaveProject, onUpdateProject, onCheckProject, onPartialUpdate, existingProject, calendars, setInfoModal, progressUpdates, onAddKanbanStatusUpdate, actions, owningUnits, projectStatuses, fromPage, initialTab, isProjectWorkflowEnabled, currentUser, defaultProjectApproverId, dynamicWorkflowSettings, onSaveAction, projects = [] }: { 
    projectType: ProjectType;
    users: User[];
    onNavigate: (page: string, context?: any) => void; 
    onSaveProject: (project: Project, mode: 'draft' | 'sent') => void;
    onUpdateProject: (project: Project, mode: 'draft' | 'sent', stayOnPage?: boolean) => void;
    onCheckProject?: (project: Project) => Promise<{ ok: boolean; code?: string; message?: string }>;
    onPartialUpdate: (project: Project) => void;
    existingProject?: Project | null;
    calendars: Calendar[];
    setInfoModal: (modal: { title: string, message: string } | null) => void;
    progressUpdates: ProgressUpdate[];
    onAddKanbanStatusUpdate?: (projectId: string, taskId: number, newStatus: KanbanStatus, comment: string) => void;
    actions: ActionItem[];
    owningUnits: string[];
    projectStatuses: string[];
    fromPage?: string;
    initialTab?: string;
    isProjectWorkflowEnabled?: boolean;
    currentUser?: User | null;
    defaultProjectApproverId?: number | null;
    dynamicWorkflowSettings?: DynamicWorkflowSettings;
    onSaveAction?: (action: ActionItem) => void;
    projects?: Project[];
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isEditing = !!existingProject;
    const [activeTab, setActiveTab] = useState(initialTab || 'charter');
    const [projectData, setProjectData] = useState<Partial<Project>>(
      existingProject || {
        type: projectType,
        teamMemberIds: [],
        risks: [],
        statusUpdates: [],
        delayReasons: [],
        documents: [],
        schedule: [],
        kanbanTasks: [],
        sprintCount: 3,
        approvalHistory: [],
        approvalStatus: 'Draft',
        status: 'Planning',
        weightingType: 'manual',
        plannedProgressType: 'continuous',
        scheduleSnapshots: [],
        calendarId: (calendars.find(c => c.isDefault) || calendars[0])?.id,
        startDate: getISODateString(),
        endDate: getISODateString(),
        ownerId: currentUser?.id || 1,
        approver1Id: defaultProjectApproverId || users.find(u => u.role === 'Admin')?.id || 1,
        tabWorkflows: {
          charter: true,
          schedule: true,
          team: true,
          risks: true,
          stakeholders: true,
          status: true,
          delays: true,
          docs: true,
          actions: true
        }
      }
    );

    // Modal States
    const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
    const [editingRisk, setEditingRisk] = useState<ProjectRisk | Omit<ProjectRisk, 'id'> | null>(null);
    const [isStakeholderModalOpen, setIsStakeholderModalOpen] = useState(false);
    const [editingStakeholder, setEditingStakeholder] = useState<ProjectStakeholder | Omit<ProjectStakeholder, 'id'> | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [editingStatus, setEditingStatus] = useState<Partial<ProjectStatusUpdate> | null>(null);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
    const [editingDelay, setEditingDelay] = useState<Partial<ProjectDelayReason> | null>(null);
    const [isContractModalOpen, setIsContractModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<ProjectContract | null>(null);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<ProjectInvoice | null>(null);
    
    useEffect(() => {
        if (existingProject) {
            setProjectData(existingProject);
        }
    }, [existingProject]);
    
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const projectCalendar = useMemo(() => 
        pickCalendar(calendars, projectData.calendarId)!, 
        [calendars, projectData.calendarId]
    );

    const [isValidatingCharter, setIsValidatingCharter] = useState(false);

    const setProjectDataField = useCallback((field: keyof Project, value: any) => {
        setProjectData(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleSaveOrUpdateProject = async (e: MouseEvent<HTMLButtonElement>, action: 'save_draft' | 'send' | 'update') => {
        e.preventDefault();
        if (isValidatingCharter) return;

        // The backend decides whether this project is acceptable (required parts, dates, meaningful text, unique name); nothing is saved by the check.
        if (onCheckProject) {
            const checked = await onCheckProject(projectData as Project);
            if (!checked.ok) {
                setInfoModal({ title: t('error'), message: projectErrorText({ code: checked.code ?? '', message: checked.message ?? '' }, language, t('projectNameExists')) });
                setActiveTab('charter');
                return;
            }
        }

        // AI charter validation (unchanged)
        setIsValidatingCharter(true);
        try {
            const valRes = await fetch('/api/ai/validate-charter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: projectData.name,
                    goal: projectData.goal || (projectData as any).objective,
                    requirements: projectData.requirements,
                    constraintsAndAssumptions: projectData.constraintsAndAssumptions,
                    description: projectData.description,
                    startDate: projectData.startDate,
                    endDate: projectData.endDate
                })
            });
            const valData = await valRes.json();
            if (valData.success && valData.isValid === false && Array.isArray(valData.issues) && valData.issues.length > 0) {
                const issuesText = valData.issues.map((i: string) => `• ${i}`).join('\n');
                setInfoModal({
                    title: language === 'fa' ? 'خطا در صحت‌سنجی منشور پروژه' : 'Charter Validation Error',
                    message: (language === 'fa' ? 'اشکالات زیر در منشور پروژه یافت شد:\n\n' : 'The following issues were found in the project charter:\n\n') + issuesText
                });
                setActiveTab('charter');
                setIsValidatingCharter(false);
                return;
            }
        } catch (err) {
            console.warn("AI Charter validation call skipped or failed:", err);
        } finally {
            setIsValidatingCharter(false);
        }

        if (projectData.id && projectData.type === 'waterfall' && (projectData.weightingType || 'manual') === 'manual' && projectData.schedule && projectData.schedule.length > 0) {
            const { rootNode } = calculateScheduleTreeAndProgress(projectData as Project, projectCalendar, 'manual');
            const totalWeight = Math.round(rootNode?.weight || 0);

            if (totalWeight !== 100) {
                setInfoModal({ title: t('error'), message: t('scheduleWeightError', { weight: totalWeight }) });
                setActiveTab('schedule');
                return;
            }
        }
        
        const mode = (action === 'send') ? 'sent' : 'draft';
        const defaultAdmin = users.find(u => u.role === 'Admin');
        const selectedApprover = projectData.approver1Id || defaultProjectApproverId || defaultAdmin?.id || 1;
        
        if (!isEditing) { // Creating new
            const baseProject = { id: '', ...projectData, approver1Id: selectedApprover };
            if (action === 'save_draft') {
                const draftProject = { ...baseProject, approvalStatus: 'Draft' } as Project;
                onSaveProject(draftProject, 'draft');
            } else { // send
                const status = isProjectWorkflowEnabled !== false ? 'Pending Approval' : 'Approved';
                const projectToSend = { ...baseProject, approvalStatus: status, submissionDate: getISODateTimeString() } as Project;
                onSaveProject(projectToSend, 'sent');
            }
        } else { // Editing existing
            const finalProjectData = { ...projectData, approver1Id: selectedApprover } as Project;
            if (action === 'send') { // Sending a draft for approval
                const status = isProjectWorkflowEnabled !== false ? 'Pending Approval' : 'Approved';
                const projectToSend = { ...finalProjectData, approvalStatus: status as any, submissionDate: getISODateTimeString() };
                onUpdateProject(projectToSend, 'sent');
            } else { // 'save_draft' or 'update' for an existing project.
                const shouldStayOnPage = action === 'update' && (activeTab === 'schedule' || activeTab === 'team' || activeTab === 'charter');
                onUpdateProject(finalProjectData, 'draft', shouldStayOnPage);
                // Add a success modal for explicit update actions
                if (action === 'update') {
                    setInfoModal({ 
                        title: t('updateProject'), 
                        message: language === 'fa' 
                            ? 'اطلاعات و وظایف پروژه با موفقیت ذخیره و بروزرسانی گردید.' 
                            : t('projectTasksSent') 
                    });
                }
            }
        }
    };
    
    // --- Modal Handlers ---

    const getWorkflowApprovalFields = (tabId: string) => {
        const workflowKey = (tabId === 'status' ? 'status_updates' : tabId === 'delays' ? 'delay_reasons' : tabId === 'docs' ? 'documents' : tabId === 'charter' ? 'charter' : tabId === 'schedule' ? 'activity_progress' : tabId) as keyof DynamicWorkflowSettings;
        const stages = getEffectiveProjectWorkflowStages(workflowKey, projectData as Project, dynamicWorkflowSettings);

        let initialApproverId: string | undefined = undefined;
        if (stages && stages.length > 0 && stages[0]) {
            initialApproverId = resolveWorkflowApproverId(stages[0].approverId, projectData as Project);
        } else {
            initialApproverId = projectData.projectManagerId;
        }

        const isCustom = isProjectTabCustomWorkflow(tabId, projectData as Project);
        const submitterActor = currentUser ? (currentUser.name ? `${currentUser.name} (${currentUser.username})` : currentUser.username) : 'کاربر';
        const initialRecord: ProjectApprovalRecord = {
            action: 'Submitted',
            date: getISODateTimeString(),
            actor: submitterActor,
            stageTitle: language === 'fa' ? 'ارسال اولیه' : 'Initial Submission',
            comment: language === 'fa' 
                ? (isCustom ? 'ارسال جهت بررسی در گردش کار منحصربفرد پروژه' : 'ارسال جهت بررسی در گردش کار سیستم') 
                : (isCustom ? 'Submitted for project unique workflow' : 'Submitted for review')
        };

        return {
            isApproved: false,
            isRejected: false,
            submittedBy: currentUser?.id,
            currentStageIndex: 0,
            currentApproverId: initialApproverId,
            approvalHistory: [initialRecord]
        };
    };

    const handleTabItemApproval = (
        tabKey: 'risks' | 'stakeholders' | 'statusUpdates' | 'delayReasons' | 'documents',
        workflowKey: 'risks' | 'stakeholders' | 'status_updates' | 'delay_reasons' | 'documents',
        itemId: number,
        actionType: 'Approved' | 'Rejected',
        comment?: string
    ) => {
        const items = (projectData[tabKey] || []) as any[];
        const stages = getEffectiveProjectWorkflowStages(workflowKey, projectData as Project, dynamicWorkflowSettings);
        const actorName = currentUser ? (currentUser.name ? `${currentUser.name} (${currentUser.username})` : currentUser.username) : 'کاربر';

        const updatedItems = items.map(item => {
            if (item.id !== itemId) return item;

            const currentStageIdx = item.currentStageIndex ?? 0;
            const currentStage = stages ? stages[currentStageIdx] : undefined;
            const stageTitle = currentStage ? currentStage.stageTitle : (language === 'fa' ? `مرحله ${toPersianDigits(currentStageIdx + 1)}` : `Stage ${currentStageIdx + 1}`);

            const baseHistory = item.approvalHistory && item.approvalHistory.length > 0
                ? item.approvalHistory
                : [{
                    action: 'Submitted' as const,
                    date: item.date || getISODateTimeString(),
                    actor: (() => {
                        const u = users.find(usr => String(usr.id) === String(item.submittedBy));
                        return u ? (u.name ? `${u.name} (${u.username})` : u.username) : 'کاربر';
                    })(),
                    stageTitle: language === 'fa' ? 'ارسال اولیه' : 'Initial Submission',
                    comment: language === 'fa' ? 'ارسال اولیه' : 'Initial Submission'
                }];

            if (actionType === 'Rejected') {
                const rec: ProjectApprovalRecord = {
                    action: 'Rejected',
                    date: getISODateTimeString(),
                    actor: actorName,
                    stageTitle,
                    comment: comment || (language === 'fa' ? 'عدم تایید' : 'Rejected')
                };
                return {
                    ...item,
                    isApproved: false,
                    isRejected: true,
                    approvalHistory: [...baseHistory, rec]
                };
            } else {
                const hasNextStage = !!(stages && currentStageIdx < stages.length - 1);
                const isFinal = !hasNextStage;

                const rec: ProjectApprovalRecord = {
                    action: 'Approved',
                    date: getISODateTimeString(),
                    actor: actorName,
                    stageTitle,
                    comment: comment || (isFinal ? (language === 'fa' ? 'تایید نهایی شد' : 'Final Approved') : (language === 'fa' ? `تایید مرحله ${toPersianDigits(currentStageIdx + 1)}` : `Approved Stage ${currentStageIdx + 1}`))
                };

                const newHistory = [...baseHistory, rec];

                if (hasNextStage && stages) {
                    const nextIdx = currentStageIdx + 1;
                    const nextStage = stages[nextIdx];
                    const nextApproverId = nextStage ? resolveWorkflowApproverId(nextStage.approverId, projectData as Project) : projectData.projectManagerId;

                    return {
                        ...item,
                        currentStageIndex: nextIdx,
                        currentApproverId: nextApproverId,
                        isApproved: false,
                        isRejected: false,
                        approvalHistory: newHistory
                    };
                }

                return {
                    ...item,
                    isApproved: true,
                    isRejected: false,
                    approvalHistory: newHistory
                };
            }
        });

        const updatedProject = { ...projectData, [tabKey]: updatedItems } as Project;
        setProjectData(updatedProject);
        onPartialUpdate(updatedProject);
    };

    // Risks
    const handleSaveRisk = (riskData: ProjectRisk | Omit<ProjectRisk, 'id'>) => {
        const currentRisks = projectData.risks || [];
        let newRisks;
        const approvalFields = getWorkflowApprovalFields('risks');

        if ('id' in riskData) { // Editing
            newRisks = currentRisks.map(r => r.id === riskData.id ? { ...r, ...riskData, isApproved: r.isApproved ? true : approvalFields.isApproved, isRejected: r.isApproved ? false : approvalFields.isRejected } as ProjectRisk : r);
        } else { // Adding
            newRisks = [...currentRisks, { ...riskData, id: Date.now(), ...approvalFields } as ProjectRisk];
        }
        const updatedProject = { ...projectData, risks: newRisks } as Project;
        setProjectData(updatedProject);
        onPartialUpdate(updatedProject);
        setIsRiskModalOpen(false);
        setEditingRisk(null);
    };
    const handleEditRisk = (risk: ProjectRisk) => {
        setEditingRisk(risk);
        setIsRiskModalOpen(true);
    };
    const handleDeleteRisk = (riskId: number) => {
        if (window.confirm(t('confirmRiskDelete'))) {
            const newRisks = (projectData.risks || []).filter(r => r.id !== riskId);
            const updatedProject = { ...projectData, risks: newRisks } as Project;
            setProjectData(updatedProject);
            onPartialUpdate(updatedProject);
        }
    };
    const handleApproveRisk = (riskId: number, comment?: string) => {
        handleTabItemApproval('risks', 'risks', riskId, 'Approved', comment);
    };
    const handleRejectRisk = (riskId: number, comment?: string) => {
        handleTabItemApproval('risks', 'risks', riskId, 'Rejected', comment);
    };

    // Stakeholders
    const handleSaveStakeholder = (stakeholderData: ProjectStakeholder | Omit<ProjectStakeholder, 'id'>) => {
        const currentStakeholders = projectData.stakeholders || [];
        let newStakeholders;
        const approvalFields = getWorkflowApprovalFields('stakeholders');

        if ('id' in stakeholderData) { // Editing
            newStakeholders = currentStakeholders.map(s => s.id === stakeholderData.id ? { ...s, ...stakeholderData, isApproved: s.isApproved ? true : approvalFields.isApproved, isRejected: s.isApproved ? false : approvalFields.isRejected } as ProjectStakeholder : s);
        } else { // Adding
            newStakeholders = [...currentStakeholders, { ...stakeholderData, id: Date.now(), ...approvalFields } as ProjectStakeholder];
        }
        const updatedProject = { ...projectData, stakeholders: newStakeholders } as Project;
        setProjectData(updatedProject);
        onPartialUpdate(updatedProject);
        setIsStakeholderModalOpen(false);
        setEditingStakeholder(null);
    };
    const handleEditStakeholder = (stakeholder: ProjectStakeholder) => {
        setEditingStakeholder(stakeholder);
        setIsStakeholderModalOpen(true);
    };
    const handleDeleteStakeholder = (stakeholderId: number) => {
        if (window.confirm(language === 'fa' ? 'آیا از حذف این ذینفع اطمینان دارید؟' : 'Are you sure you want to delete this stakeholder?')) {
            const newStakeholders = (projectData.stakeholders || []).filter(s => s.id !== stakeholderId);
            const updatedProject = { ...projectData, stakeholders: newStakeholders } as Project;
            setProjectData(updatedProject);
            onPartialUpdate(updatedProject);
        }
    };
    const handleApproveStakeholder = (stakeholderId: number, comment?: string) => {
        handleTabItemApproval('stakeholders', 'stakeholders', stakeholderId, 'Approved', comment);
    };
    const handleRejectStakeholder = (stakeholderId: number, comment?: string) => {
        handleTabItemApproval('stakeholders', 'stakeholders', stakeholderId, 'Rejected', comment);
    };
    
    // Status Updates
    const handleSaveStatus = (description: string) => {
        if (!description.trim()) return;
        const currentStatusUpdates = projectData.statusUpdates || [];
        let newStatusUpdates;
        const approvalFields = getWorkflowApprovalFields('status');

        if (editingStatus && editingStatus.id) {
            newStatusUpdates = currentStatusUpdates.map(u => u.id === editingStatus.id ? { ...u, description, isApproved: u.isApproved ? true : approvalFields.isApproved, isRejected: u.isApproved ? false : approvalFields.isRejected } : u);
        } else {
            const newUpdate: ProjectStatusUpdate = { id: Date.now(), description, date: getISODateTimeString(), ...approvalFields };
            newStatusUpdates = [...currentStatusUpdates, newUpdate];
        }
        const updatedProject = { ...projectData, statusUpdates: newStatusUpdates } as Project;
        setProjectData(updatedProject);
        onPartialUpdate(updatedProject);
        setIsStatusModalOpen(false);
        setEditingStatus(null);
    };
    const handleEditStatus = (update: ProjectStatusUpdate) => {
        setEditingStatus(update);
        setIsStatusModalOpen(true);
    };
    const handleDeleteStatus = (id: number) => {
        if (window.confirm(t('confirmStatusDelete'))) {
            const newStatusUpdates = (projectData.statusUpdates || []).filter(u => u.id !== id);
            const updatedProject = { ...projectData, statusUpdates: newStatusUpdates } as Project;
            setProjectData(updatedProject);
            onPartialUpdate(updatedProject);
        }
    };
    const handleApproveStatus = (id: number, comment?: string) => {
        handleTabItemApproval('statusUpdates', 'status_updates', id, 'Approved', comment);
    };
    const handleRejectStatus = (id: number, comment?: string) => {
        handleTabItemApproval('statusUpdates', 'status_updates', id, 'Rejected', comment);
    };

    // Delay Reasons
    const handleSaveDelay = (description: string) => {
        if (!description.trim()) return;
        const currentDelayReasons = projectData.delayReasons || [];
        let newDelayReasons;
        const approvalFields = getWorkflowApprovalFields('delays');

        if (editingDelay && editingDelay.id) {
            newDelayReasons = currentDelayReasons.map(d => d.id === editingDelay.id ? { ...d, description, isApproved: d.isApproved ? true : approvalFields.isApproved, isRejected: d.isApproved ? false : approvalFields.isRejected } : d);
        } else {
            const newDelay: ProjectDelayReason = { id: Date.now(), description, date: getISODateTimeString(), ...approvalFields };
            newDelayReasons = [...currentDelayReasons, newDelay];
        }
        const updatedProject = { ...projectData, delayReasons: newDelayReasons } as Project;
        setProjectData(updatedProject);
        onPartialUpdate(updatedProject);
        setIsDelayModalOpen(false);
        setEditingDelay(null);
    };
    const handleEditDelay = (reason: ProjectDelayReason) => {
        setEditingDelay(reason);
        setIsDelayModalOpen(true);
    };
    const handleDeleteDelay = (id: number) => {
        const confirmMsg = language === 'fa' ? 'آیا از حذف این علت تاخیر اطمینان دارید؟' : 'Are you sure you want to delete this delay reason?';
        if (window.confirm(confirmMsg)) {
            const newDelayReasons = (projectData.delayReasons || []).filter(d => d.id !== id);
            const updatedProject = { ...projectData, delayReasons: newDelayReasons } as Project;
            setProjectData(updatedProject);
            onPartialUpdate(updatedProject);
        }
    };
    const handleApproveDelay = (id: number, comment?: string) => {
        handleTabItemApproval('delayReasons', 'delay_reasons', id, 'Approved', comment);
    };
    const handleRejectDelay = (id: number, comment?: string) => {
        handleTabItemApproval('delayReasons', 'delay_reasons', id, 'Rejected', comment);
    };

    // Documents
    const handleSaveDocument = (doc: Omit<ProjectDocument, 'id'>) => {
        const approvalFields = getWorkflowApprovalFields('docs');
        const newDoc: ProjectDocument = { ...doc, id: Date.now(), date: doc.date || getISODateTimeString(), ...approvalFields };
        const newDocuments = [...(projectData.documents || []), newDoc];
        const updatedProject = { ...projectData, documents: newDocuments } as Project;
        setProjectData(updatedProject);
        onPartialUpdate(updatedProject);
        setIsDocModalOpen(false);
    };
    const handleEditDocument = (doc: ProjectDocument) => {
        alert(t('editNotImplemented'));
    };
    const handleDeleteDocument = (id: number) => {
        if (window.confirm(t('confirmDocDelete'))) {
            const newDocuments = (projectData.documents || []).filter(d => d.id !== id);
            const updatedProject = { ...projectData, documents: newDocuments } as Project;
            setProjectData(updatedProject);
            onPartialUpdate(updatedProject);
        }
    };
    const handleApproveDocument = (id: number, comment?: string) => {
        handleTabItemApproval('documents', 'documents', id, 'Approved', comment);
    };
    const handleRejectDocument = (id: number, comment?: string) => {
        handleTabItemApproval('documents', 'documents', id, 'Rejected', comment);
    };

    const handleSaveSettings = (settings: Partial<Project>) => {
        const updatedProject = {
            ...projectData,
            ...settings
        } as Project;
        setProjectData(updatedProject);
        onPartialUpdate(updatedProject);
        setInfoModal({ title: t('updateProject'), message: t('projectUpdatedSuccess') });
    };

    const handleSaveTeam = (ids: number[]) => {
        setProjectData(prev => ({ ...prev, teamMemberIds: ids }));
    };

    // Schedule Snapshots
    const handleSaveSnapshot = (name: string, type: 'Baseline' | 'Progress Information') => {
        if (!name.trim()) {
            setInfoModal({ title: t('error'), message: t('snapshotNameRequired') });
            return;
        }
        let currentActualProgress: number | undefined = undefined;
        if (type === 'Progress Information') {
            const { rootNode } = calculateScheduleTreeAndProgress(
                projectData as Project,
                projectCalendar,
                projectData.weightingType,
                projectData.plannedProgressType
            );
            currentActualProgress = Math.round((rootNode?.actualProgress ?? projectData.actualProgress ?? 0) * 10) / 10;
        }
        const newSnapshot: ScheduleSnapshot = {
            id: Date.now(),
            name,
            date: new Date().toISOString(),
            schedule: projectData.schedule || [],
            type: type,
            actualProgress: currentActualProgress,
        };
        const updatedSnapshots = [...(projectData.scheduleSnapshots || []), newSnapshot];
        setProjectDataField('scheduleSnapshots', updatedSnapshots);
        
        const updatedProject = { ...projectData, scheduleSnapshots: updatedSnapshots } as Project;
        onPartialUpdate(updatedProject);
    };

    const handleDeleteSnapshot = (id: number) => {
        if (window.confirm(t('confirmSnapshotDelete'))) {
            const updatedSnapshots = (projectData.scheduleSnapshots || []).filter(s => s.id !== id);
            setProjectDataField('scheduleSnapshots', updatedSnapshots);
            const updatedProject = { ...projectData, scheduleSnapshots: updatedSnapshots } as Project;
            onPartialUpdate(updatedProject);
        }
    };

    const projectTypeTranslations: Record<ProjectType, TranslationKey> = {
        'waterfall': 'waterfallProject',
        'agile': 'agileProject'
    };

    const projectTabs = useMemo(() => {
        const enabledTabs = projectData.enabledTabs || ['charter', 'schedule', 'team', 'risks', 'stakeholders', 'status', 'delays', 'docs', 'actions'];
        const tabs: { id: string, name: string }[] = [];
        
        const allTabs = [
            { id: 'charter', name: t('projectCharter') },
            { id: 'schedule', name: t('projectSchedule') },
            { id: 'team', name: t('projectTeam') },
            { id: 'risks', name: t('projectRisks') },
            { id: 'stakeholders', name: language === 'fa' ? 'ذینفعان پروژه' : 'Project Stakeholders' },
            { id: 'status', name: t('projectStatus') },
            { id: 'delays', name: language === 'fa' ? 'دلایل تاخیر' : 'Reasons for Delay' },
            { id: 'docs', name: t('projectDocuments') },
            { id: 'actions', name: t('relatedActions') },
            { id: 'contracts', name: language === 'fa' ? 'اطلاعات قرارداد' : 'Contract Information' },
            { id: 'invoices', name: language === 'fa' ? 'صورتحساب‌ها' : 'Invoices' },
        ];
        
        allTabs.forEach(tab => {
            if (enabledTabs.includes(tab.id)) {
                tabs.push(tab);
            }
        });

        if (projectType === 'waterfall') {
            tabs.push({ id: 'settings', name: t('projectSettings') });
        } else { // agile
            tabs.push({ id: 'sprints', name: t('sprints') });
        }
        return tabs;
    }, [t, projectType, projectData.enabledTabs, language]);
        
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    const isPMOrOwnerOrAdmin = !!(currentUser && (
        currentUser.role === 'Admin' ||
        String(projectData.projectManagerId) === String(currentUser.id) ||
        String(projectData.ownerId || 1) === String(currentUser.id)
    ));

    const renderActiveTabContent = () => {
        const isPMOrAdmin = isPMOrOwnerOrAdmin;
        
        const getFilteredTabItems = <T extends { isApproved?: boolean; submittedBy?: string; currentApproverId?: string; currentStageIndex?: number }>(items: T[], tabId: string): T[] => {
            return items.filter(item => {
                if (item.isApproved) return true;
                const isSubmitter = currentUser && item.submittedBy === currentUser.id;
                const isAdmin = currentUser?.role === 'Admin';
                const isPM = currentUser && String(projectData.projectManagerId) === String(currentUser.id);
                const isOwner = currentUser && String(projectData.ownerId || 1) === String(currentUser.id);

                const entityKey = (tabId === 'status' ? 'status_updates' : tabId === 'delays' ? 'delay_reasons' : tabId === 'docs' ? 'documents' : tabId) as WorkflowEntityType;
                const stages = getEffectiveProjectWorkflowStages(entityKey, projectData as Project, dynamicWorkflowSettings);
                const currentStageIdx = item.currentStageIndex ?? 0;
                const stage = stages?.[currentStageIdx] || stages?.[0];
                const resolvedApproverId = item.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, projectData as Project) : projectData.projectManagerId);

                const isApprover = currentUser && String(resolvedApproverId) === String(currentUser.id);

                return isSubmitter || isAdmin || isPM || isOwner || isApprover;
            });
        };

        switch (activeTab) {
            case 'charter':
                return React.createElement(ProjectCharterForm, { projectData: projectData, setProjectData: setProjectData, users: users, calendars: calendars, owningUnits: owningUnits, projectStatuses: projectStatuses, currentUser: currentUser, isReadOnly: !isPMOrOwnerOrAdmin, isProjectWorkflowEnabled: isProjectWorkflowEnabled, isEditing: isEditing });
            case 'team':
                return React.createElement(ProjectTeamTab, { 
                    allUsers: users, 
                    teamMemberIds: projectData.teamMemberIds || [], 
                    onSaveTeam: handleSaveTeam,
                    isReadOnly: !isPMOrOwnerOrAdmin
                });
            case 'risks':
                return React.createElement(ProjectRisksTab, { 
                    risks: getFilteredTabItems(projectData.risks || [], 'risks'), 
                    users: users,
                    project: projectData as Project,
                    onUpdateRisks: (newRisks: ProjectRisk[]) => {
                        const updatedProject = { ...projectData, risks: newRisks } as Project;
                        setProjectData(updatedProject);
                        onPartialUpdate(updatedProject);
                    },
                    onUpdateRiskDefinitions: (newDefs) => {
                        const updatedProject = { ...projectData, riskDefinitions: newDefs } as Project;
                        setProjectData(updatedProject);
                        onPartialUpdate(updatedProject);
                    },
                    onEdit: handleEditRisk, 
                    onDelete: handleDeleteRisk,
                    isPMOrAdmin: isPMOrOwnerOrAdmin,
                    onApprove: handleApproveRisk,
                    onReject: handleRejectRisk,
                    currentUserId: currentUser?.id,
                    requiresWorkflow: projectData.tabWorkflows ? projectData.tabWorkflows.risks !== false : true,
                    dynamicWorkflowSettings: dynamicWorkflowSettings,
                    onSaveAction: onSaveAction,
                    calendars: calendars,
                    projects: projects && projects.length > 0 ? projects : (projectData.id ? [projectData as Project] : []),
                    owningUnits: owningUnits,
                    currentUser: currentUser || undefined
                });
            case 'stakeholders':
                return React.createElement(ProjectStakeholdersTab, { 
                    stakeholders: getFilteredTabItems(projectData.stakeholders || [], 'stakeholders'), 
                    users: users,
                    project: projectData as Project,
                    onUpdateStakeholders: (newStakeholders: ProjectStakeholder[]) => {
                        const updatedProject = { ...projectData, stakeholders: newStakeholders } as Project;
                        setProjectData(updatedProject);
                        onPartialUpdate(updatedProject);
                    },
                    onUpdateStakeholderStrategies: (newStrategies) => {
                        const updatedProject = { ...projectData, stakeholderStrategies: newStrategies } as Project;
                        setProjectData(updatedProject);
                        onPartialUpdate(updatedProject);
                    },
                    onEdit: handleEditStakeholder, 
                    onDelete: handleDeleteStakeholder,
                    isPMOrAdmin: isPMOrOwnerOrAdmin,
                    onApprove: handleApproveStakeholder,
                    onReject: handleRejectStakeholder,
                    currentUserId: currentUser?.id,
                    requiresWorkflow: projectData.tabWorkflows ? projectData.tabWorkflows.stakeholders !== false : true,
                    dynamicWorkflowSettings: dynamicWorkflowSettings,
                    onSaveAction: onSaveAction,
                    calendars: calendars,
                    projects: projects && projects.length > 0 ? projects : (projectData.id ? [projectData as Project] : []),
                    owningUnits: owningUnits,
                    currentUser: currentUser || undefined
                });
            case 'status':
                return React.createElement(ProjectStatusTab, { 
                    statusUpdates: getFilteredTabItems(projectData.statusUpdates || [], 'status'), 
                    users: users,
                    project: projectData as Project,
                    onEdit: handleEditStatus, 
                    onDelete: handleDeleteStatus,
                    isPMOrAdmin: isPMOrOwnerOrAdmin,
                    onApprove: handleApproveStatus,
                    onReject: handleRejectStatus,
                    currentUserId: currentUser?.id,
                    requiresWorkflow: projectData.tabWorkflows ? projectData.tabWorkflows.status !== false : true,
                    dynamicWorkflowSettings: dynamicWorkflowSettings
                });
            case 'delays':
                return React.createElement(ProjectDelayReasonsTab, { 
                    delayReasons: getFilteredTabItems(projectData.delayReasons || [], 'delays'), 
                    users: users,
                    project: projectData as Project,
                    onEdit: handleEditDelay, 
                    onDelete: handleDeleteDelay,
                    isPMOrAdmin: isPMOrOwnerOrAdmin,
                    onApprove: handleApproveDelay,
                    onReject: handleRejectDelay,
                    currentUserId: currentUser?.id,
                    requiresWorkflow: projectData.tabWorkflows ? projectData.tabWorkflows.delays !== false : true,
                    dynamicWorkflowSettings: dynamicWorkflowSettings
                });
            case 'docs':
                return React.createElement(ProjectDocumentsTab, { 
                    documents: getFilteredTabItems(projectData.documents || [], 'docs'), 
                    users: users,
                    project: projectData as Project,
                    onUpdateDocuments: (newDocs: ProjectDocument[]) => {
                        const updatedProject = { ...projectData, documents: newDocs } as Project;
                        setProjectData(updatedProject);
                        onPartialUpdate(updatedProject);
                    },
                    onEdit: handleEditDocument, 
                    onDelete: handleDeleteDocument,
                    isPMOrAdmin: isPMOrOwnerOrAdmin,
                    onApprove: handleApproveDocument,
                    onReject: handleRejectDocument,
                    currentUserId: currentUser?.id,
                    requiresWorkflow: projectData.tabWorkflows ? projectData.tabWorkflows.docs !== false : true,
                    dynamicWorkflowSettings: dynamicWorkflowSettings
                });
             case 'schedule':
                if (projectData.id) {
                    if (projectData.type === 'agile') {
                        return React.createElement(ProjectKanbanTab, { 
                            project: projectData as Project,
                            users: users,
                            onUpdateTasks: (tasks) => setProjectDataField('kanbanTasks', tasks),
                            progressUpdates: progressUpdates,
                            onAddKanbanStatusUpdate: onAddKanbanStatusUpdate,
                            isReadOnly: !isPMOrOwnerOrAdmin,
                            dynamicWorkflowSettings: dynamicWorkflowSettings
                        });
                    } else if (projectData.type === 'waterfall') {
                         return React.createElement(ProjectScheduleTab, { 
                            project: projectData as Project, 
                            users: users,
                            calendars: calendars,
                            onUpdateSchedule: (newSchedule) => setProjectDataField('schedule', newSchedule),
                            isReadOnly: !isPMOrOwnerOrAdmin,
                            currentUser: currentUser,
                            dynamicWorkflowSettings: dynamicWorkflowSettings
                        });
                    }
                }
                break; // Fall through for placeholder
            case 'sprints':
                if (projectData.id && projectData.type === 'agile') {
                    return React.createElement(ProjectSprintsTab, {
                        project: projectData as Project,
                        users: users,
                        progressUpdates: progressUpdates,
                    });
                }
                break;
            case 'settings':
                 if (projectData.type === 'waterfall') {
                     const { rootNode } = calculateScheduleTreeAndProgress(projectData as Project, projectCalendar, projectData.weightingType, projectData.plannedProgressType);
                     const processedSchedule = rootNode ? [rootNode] : (projectData.schedule || []);
                     return React.createElement(ProjectSettingsTab, {
                        project: projectData as Project,
                        calendar: projectCalendar,
                        activities: processedSchedule,
                        onSaveSettings: handleSaveSettings,
                        scheduleSnapshots: projectData.scheduleSnapshots || [],
                        onSaveSnapshot: handleSaveSnapshot,
                        onDeleteSnapshot: handleDeleteSnapshot,
                        onViewSnapshot: (snapshot) => onNavigate('view_snapshot', { snapshot, calendar: projectCalendar, project: projectData as Project }),
                        currentUser: currentUser,
                        users: users,
                        dynamicWorkflowSettings: dynamicWorkflowSettings,
                        isReadOnly: !isPMOrOwnerOrAdmin
                    });
                 }
                 break; // Fall through for placeholder
            case 'actions':
                return React.createElement(ProjectActionsTab, {
                    projectId: projectData.id!,
                    actions: actions,
                    users: users,
                    onNavigate: onNavigate
                });
            case 'contracts':
                return React.createElement(ProjectContractsTab, {
                    contracts: projectData.contracts || [],
                    project: projectData as Project,
                    onUpdateContracts: (newContracts: ProjectContract[]) => {
                        const updatedProject = { ...projectData, contracts: newContracts } as Project;
                        setProjectData(updatedProject);
                        onPartialUpdate(updatedProject);
                    },
                    isReadOnly: !isPMOrOwnerOrAdmin,
                    currentUser: currentUser,
                    isModalOpen: isContractModalOpen,
                    onCloseModal: () => {
                        setIsContractModalOpen(false);
                        setEditingContract(null);
                    },
                    onOpenAddModal: () => {
                        setEditingContract(null);
                        setIsContractModalOpen(true);
                    },
                    editingContract: editingContract,
                    onEditContract: (c: ProjectContract | null) => {
                        setEditingContract(c);
                        setIsContractModalOpen(true);
                    }
                });
            case 'invoices':
                return React.createElement(ProjectInvoicesTab, {
                    invoices: projectData.invoices || [],
                    contracts: projectData.contracts || [],
                    project: projectData as Project,
                    onUpdateInvoices: (newInvoices: ProjectInvoice[]) => {
                        const updatedProject = { ...projectData, invoices: newInvoices } as Project;
                        setProjectData(updatedProject);
                        onPartialUpdate(updatedProject);
                    },
                    isReadOnly: !isPMOrOwnerOrAdmin,
                    currentUser: currentUser,
                    isModalOpen: isInvoiceModalOpen,
                    onCloseModal: () => {
                        setIsInvoiceModalOpen(false);
                        setEditingInvoice(null);
                    },
                    onOpenAddModal: () => {
                        setEditingInvoice(null);
                        setIsInvoiceModalOpen(true);
                    },
                    editingInvoice: editingInvoice,
                    onEditInvoice: (inv: ProjectInvoice | null) => {
                        setEditingInvoice(inv);
                        setIsInvoiceModalOpen(true);
                    }
                });
            default:
                const currentTab = projectTabs.find(t => t.id === activeTab);
                return React.createElement("div", { className: "placeholder-content" }, t('sectionUnderConstruction', { section: currentTab?.name || activeTab }));
        }
    };

    const backTarget = fromPage || (isEditing ? 'portfolio' : 'create_project');

    const renderProjectActions = () => {
        if (isEditing && projectData.approvalStatus === 'Approved') {
            return React.createElement(Fragment, null,
                /* Contextual "Add" buttons first */
                projectData.id && activeTab === 'risks' && (
                    React.createElement("button", { onClick: () => { setEditingRisk(null); setIsRiskModalOpen(true); }, className: "action-button", title: t('addNewRisk'), "aria-label": t('addNewRisk') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'stakeholders' && (
                    React.createElement("button", { onClick: () => { setEditingStakeholder(null); setIsStakeholderModalOpen(true); }, className: "action-button", title: language === 'fa' ? 'افزودن ذینفع جدید' : 'Add New Stakeholder', "aria-label": language === 'fa' ? 'افزودن ذینفع جدید' : 'Add New Stakeholder' } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'contracts' && isPMOrOwnerOrAdmin && (
                    React.createElement("button", { onClick: () => { setEditingContract(null); setIsContractModalOpen(true); }, className: "action-button", title: language === 'fa' ? 'ثبت قرارداد جدید' : 'New Contract', "aria-label": language === 'fa' ? 'ثبت قرارداد جدید' : 'New Contract' } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'invoices' && isPMOrOwnerOrAdmin && (
                    React.createElement("button", { onClick: () => { setEditingInvoice(null); setIsInvoiceModalOpen(true); }, className: "action-button", title: language === 'fa' ? 'ثبت صورتحساب جدید' : 'New Invoice', "aria-label": language === 'fa' ? 'ثبت صورتحساب جدید' : 'New Invoice' } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'status' && (
                    React.createElement("button", { onClick: () => { setEditingStatus(null); setIsStatusModalOpen(true); }, className: "action-button", title: t('addStatus'), "aria-label": t('addStatus') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'docs' && (
                    React.createElement("button", { onClick: () => setIsDocModalOpen(true), className: "action-button", title: t('addDocument'), "aria-label": t('addDocument') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'delays' && (
                    React.createElement("button", { onClick: () => { setEditingDelay(null); setIsDelayModalOpen(true); }, className: "action-button", title: language === 'fa' ? 'افزودن علت تاخیر' : 'Add Delay Reason', "aria-label": language === 'fa' ? 'افزودن علت تاخیر' : 'Add Delay Reason' } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'actions' && isPMOrOwnerOrAdmin && (
                    React.createElement("button", { onClick: () => onNavigate('define_action', { relatedProject: projectData, fromProject: projectData.id }), className: "action-button", title: t('addRelatedAction'), "aria-label": t('addRelatedAction') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                /* Main "Update" button last */
                isPMOrOwnerOrAdmin && (activeTab === 'charter' || activeTab === 'schedule' || activeTab === 'team') && React.createElement("button", { onClick: (e) => handleSaveOrUpdateProject(e, 'update'), className: "save-btn", title: t('updateProject'), "aria-label": t('updateProject') } as React.HTMLAttributes<HTMLButtonElement>,
                    React.createElement("span", { className: "material-symbols-outlined" }, "save")
                ),
                React.createElement("button", { 
                    className: "action-button no-print", 
                    onClick: () => exportDashboardToLandscapePdf(`${projectData.name || 'Project'}_${activeTab}`), 
                    title: language === 'fa' ? 'خروجی PDF' : 'Export to PDF', 
                    style: { padding: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', border: 'none', color: '#fff', borderRadius: '8px' } 
                }, 
                    React.createElement("span", { className: "material-symbols-outlined", style: { color: '#fff' } }, "picture_as_pdf")
                )
            );
        } else {
            return React.createElement(Fragment, null,
                /* Main buttons first for draft/new projects */
                isPMOrOwnerOrAdmin && React.createElement("button", { onClick: (e) => handleSaveOrUpdateProject(e, isEditing ? 'update' : 'save_draft'), className: "save-btn", title: isEditing ? t('updateProject') : t('saveInformation'), "aria-label": isEditing ? t('updateProject') : t('saveInformation') } as React.HTMLAttributes<HTMLButtonElement>,
                    React.createElement("span", { className: "material-symbols-outlined" }, "save")
                ),
                isPMOrOwnerOrAdmin && projectData.approvalStatus !== 'Pending Approval' && React.createElement("button", { onClick: (e) => handleSaveOrUpdateProject(e, 'send'), className: "action-button send-approval-btn", disabled: isValidatingCharter, title: isValidatingCharter ? (language === 'fa' ? 'در حال صحه‌سنجی هوشمند...' : 'Validating Charter...') : t('sendForApproval'), "aria-label": isValidatingCharter ? (language === 'fa' ? 'در حال صحه‌سنجی هوشمند...' : 'Validating Charter...') : t('sendForApproval') } as React.HTMLAttributes<HTMLButtonElement>,
                     React.createElement("span", { className: `material-symbols-outlined ${isValidatingCharter ? 'spin' : ''}` }, isValidatingCharter ? "sync" : "send")
                ),
                React.createElement("button", { 
                    className: "action-button no-print", 
                    onClick: () => exportDashboardToLandscapePdf(`${projectData.name || 'Project'}_${activeTab}`), 
                    title: language === 'fa' ? 'خروجی PDF' : 'Export to PDF', 
                    style: { padding: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', border: 'none', color: '#fff', borderRadius: '8px' } 
                }, 
                    React.createElement("span", { className: "material-symbols-outlined", style: { color: '#fff' } }, "picture_as_pdf")
                ),
                /* Contextual "Add" buttons after main actions */
                projectData.id && activeTab === 'risks' && (
                    React.createElement("button", { onClick: () => { setEditingRisk(null); setIsRiskModalOpen(true); }, className: "action-button", title: t('addNewRisk'), "aria-label": t('addNewRisk') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'stakeholders' && (
                    React.createElement("button", { onClick: () => { setEditingStakeholder(null); setIsStakeholderModalOpen(true); }, className: "action-button", title: language === 'fa' ? 'افزودن ذینفع جدید' : 'Add New Stakeholder', "aria-label": language === 'fa' ? 'افزودن ذینفع جدید' : 'Add New Stakeholder' } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'contracts' && isPMOrOwnerOrAdmin && (
                    React.createElement("button", { onClick: () => { setEditingContract(null); setIsContractModalOpen(true); }, className: "action-button", title: language === 'fa' ? 'ثبت قرارداد جدید' : 'New Contract', "aria-label": language === 'fa' ? 'ثبت قرارداد جدید' : 'New Contract' } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'invoices' && isPMOrOwnerOrAdmin && (
                    React.createElement("button", { onClick: () => { setEditingInvoice(null); setIsInvoiceModalOpen(true); }, className: "action-button", title: language === 'fa' ? 'ثبت صورتحساب جدید' : 'New Invoice', "aria-label": language === 'fa' ? 'ثبت صورتحساب جدید' : 'New Invoice' } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'status' && (
                    React.createElement("button", { onClick: () => { setEditingStatus(null); setIsStatusModalOpen(true); }, className: "action-button", title: t('addStatus'), "aria-label": t('addStatus') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'docs' && (
                    React.createElement("button", { onClick: () => setIsDocModalOpen(true), className: "action-button", title: t('addDocument'), "aria-label": t('addDocument') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'delays' && (
                    React.createElement("button", { onClick: () => { setEditingDelay(null); setIsDelayModalOpen(true); }, className: "action-button", title: language === 'fa' ? 'افزودن علت تاخیر' : 'Add Delay Reason', "aria-label": language === 'fa' ? 'افزودن علت تاخیر' : 'Add Delay Reason' } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                ),
                projectData.id && activeTab === 'actions' && isPMOrOwnerOrAdmin && (
                    React.createElement("button", { onClick: () => onNavigate('define_action', { relatedProject: projectData, fromProject: projectData.id }), className: "action-button", title: t('addRelatedAction'), "aria-label": t('addRelatedAction') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add")
                    )
                )
            );
        }
    };

    return (
        React.createElement("div", { className: "content-container" },
            isRiskModalOpen && React.createElement(RiskModal, {
                isOpen: isRiskModalOpen,
                onClose: () => setIsRiskModalOpen(false),
                onSave: handleSaveRisk,
                risk: editingRisk,
                users: users,
                isEditing: !!(editingRisk && 'id' in editingRisk)
            }),
            isStakeholderModalOpen && React.createElement(StakeholderModal, {
                isOpen: isStakeholderModalOpen,
                onClose: () => setIsStakeholderModalOpen(false),
                onSave: handleSaveStakeholder,
                stakeholder: editingStakeholder,
                isEditing: !!(editingStakeholder && 'id' in editingStakeholder)
            }),
            isStatusModalOpen && React.createElement(StatusUpdateModal, {
                isOpen: isStatusModalOpen,
                onClose: () => { setIsStatusModalOpen(false); setEditingStatus(null); },
                onSave: handleSaveStatus,
                statusUpdate: editingStatus
            }),
            isDocModalOpen && React.createElement(DocumentModal, {
                isOpen: isDocModalOpen,
                onClose: () => setIsDocModalOpen(false),
                onSave: handleSaveDocument,
                project: projectData as Project
            }),
            isDelayModalOpen && React.createElement(DelayReasonModal, {
                isOpen: isDelayModalOpen,
                onClose: () => { setIsDelayModalOpen(false); setEditingDelay(null); },
                onSave: handleSaveDelay,
                delayReason: editingDelay
            }),
            React.createElement("div", { className: "page-header", style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' } },
                React.createElement("h2", { style: { margin: 0 } }, isEditing 
                    ? (projectData.name || (language === 'fa' ? `ویرایش ${t(projectTypeTranslations[projectType])}` : `${t('edit')} ${t(projectTypeTranslations[projectType])}`))
                    : (language === 'fa' ? `${t(projectTypeTranslations[projectType])} جدید` : `${t('newProject')} ${t(projectTypeTranslations[projectType])}`)
                ),
                React.createElement("div", { className: "page-header-actions", style: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' } },
                    renderProjectActions(),
                    React.createElement("button", { onClick: () => onNavigate(backTarget), className: "back-button", title: isEditing ? t('backToPortfolio') : t('backToProjectTypes'), "aria-label": isEditing ? t('backToPortfolio') : t('backToProjectTypes') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, backIcon)
                    )
                )
            ),
            React.createElement("nav", { className: "tabs-nav" },
                projectTabs.map(tab => {
                    const isCharter = tab.id === 'charter';
                    let isDisabled = !isCharter && !projectData.id;
                    let disabledTitle = isDisabled ? t('charterSaveFirst') : '';

                    if (tab.id === 'schedule' && projectData.type === 'agile' && projectData.approvalStatus !== 'Approved') {
                        isDisabled = true;
                        disabledTitle = t('projectMustBeApproved');
                    }
                    
                    return React.createElement("button", {
                        key: tab.id,
                        className: `tab-item ${activeTab === tab.id ? 'active' : ''}`,
                        onClick: () => setActiveTab(tab.id),
                        role: "tab",
                        "aria-selected": activeTab === tab.id,
                        disabled: isDisabled,
                        title: disabledTitle
                    } as React.HTMLAttributes<HTMLButtonElement>, tab.name);
                })
            ),
            React.createElement("div", { className: "tab-content" },
                renderActiveTabContent()
            )
        )
    );
};

// --- ProjectPortfolioPage ---
export const ProjectPortfolioPage = ({ projects, actions, users, currentUser, onNavigate, progressUpdates, owningUnits, visibilitySettings, onDeleteProject, onDeleteAction }: { 
    projects: Project[], 
    actions: ActionItem[],
    users: User[], 
    currentUser: User, 
    onNavigate: (page: string, context?: any) => void,
    progressUpdates: ProgressUpdate[],
    owningUnits: string[],
    visibilitySettings?: VisibilitySettings,
    onDeleteProject?: (id: string) => void,
    onDeleteAction?: (id: number) => void
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isGroupingOpen, setIsGroupingOpen] = useState(false);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const [filterText, setFilterText] = useState('');
    const [unitFilter, setUnitFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'waterfall' | 'agile' | 'action'>('all');
    const [groupByLevel1, setGroupByLevel1] = useState('unit');
    const [groupByLevel2, setGroupByLevel2] = useState('status');
    const [historyModalProject, setHistoryModalProject] = useState<Project | null>(null);
    const [actionHistoryModalId, setActionHistoryModalId] = useState<number | null>(null);
    
    const auth = useAuth();
    const defaultSettings: VisibilitySettings = {
        viewByOwner: true,
        viewByManagerOrResponsible: true,
        viewByApprovers: true,
        viewByResources: true,
        viewByOrgHeads: true,
    };
    const activeVisibilitySettings = visibilitySettings || defaultSettings;

    const unitNodes = useMemo(() => getRuntimeUnitTree(), []);

    const workStatusTranslations: Record<WorkStatus, TranslationKey> = {
        'Planning': 'planning', 'In Progress': 'inProgress', 'On Hold': 'onHold', 'Completed': 'completed'
    };

    const handleEditProjectClick = (project: Project) => {
        const page = `create_${project.type}_details`;
        onNavigate(page, { project: project, type: project.type });
    };

    const handleDeleteProjectClick = (project: Project) => {
        if (!onDeleteProject) return;
        const confirmMsg = language === 'fa' 
            ? `آیا از حذف پروژه "${project.name}" اطمینان دارید؟` 
            : `Are you sure you want to delete project "${project.name}"?`;
        if (window.confirm(confirmMsg)) {
            onDeleteProject(project.id);
        }
    };

    const handleDeleteActionClick = (action: ActionItem) => {
        if (!onDeleteAction) return;
        const confirmMsg = language === 'fa' 
            ? `آیا از حذف اقدام "${action.title}" اطمینان دارید؟` 
            : `Are you sure you want to delete action "${action.title}"?`;
        if (window.confirm(confirmMsg)) {
            onDeleteAction(action.id);
        }
    };

    const canEditProject = (project: Project) => {
        if (!currentUser) return false;
        if (currentUser.role === 'Admin') return true;
        if (String(project.projectManagerId) === String(currentUser.id)) return true;
        if (String(project.ownerId || 1) === String(currentUser.id)) return true;
        if (project.teamMemberIds && project.teamMemberIds.map(String).includes(String(currentUser.id))) return true;
        return false;
    };

    const canDeleteProject = (project: Project) => {
        if (!currentUser) return false;
        // Deleting for good is its own permission on the backend; the screen only hides the button when it is missing.
        if (!auth.can('Projects.Remove')) return false;
        if (currentUser.role === 'Admin') return true;
        if (String(project.projectManagerId) === String(currentUser.id)) return true;
        if (String(project.ownerId || 1) === String(currentUser.id)) return true;
        return false;
    };
    
    const canEditAction = (action: ActionItem) => {
        return currentUser.role === 'Admin' || currentUser.role === 'Project Manager';
    };

    const canDeleteAction = (action: ActionItem) => {
        return currentUser.role === 'Admin' || currentUser.role === 'Project Manager';
    };

    const unitFilterOptions = useMemo(() => Array.from(new Set(owningUnits.map(u => getUnitLevel1And2(u)).filter(Boolean))), [owningUnits]);

    // Filtered items
    const filteredProjects = useMemo(() => {
        const lowerCaseFilter = filterText.toLowerCase();
        // `projects` are already only the ones the backend lets this user see.
        return projects
            .filter(p => {
                const nameMatch = filterText ? (p.name.toLowerCase().includes(lowerCaseFilter) || (p.code && p.code.toLowerCase().includes(lowerCaseFilter))) : true;
                const unitMatch = unitFilter ? getUnitLevel1And2(p.owningUnit) === unitFilter : true;
                const statusMatch = statusFilter ? p.status === statusFilter : true;
                const typeMatch = typeFilter === 'all' ? true : (typeFilter === 'waterfall' ? p.type === 'waterfall' : typeFilter === 'agile' ? p.type === 'agile' : false);
                return nameMatch && unitMatch && statusMatch && typeMatch;
            });
    }, [projects, filterText, unitFilter, statusFilter, typeFilter]);

    const filteredActions = useMemo(() => {
        const lowerCaseFilter = filterText.toLowerCase();
        return actions
            .filter(a => isActionVisibleToUser(a, currentUser, activeVisibilitySettings, users, unitNodes))
            .filter(a => {
                const nameMatch = filterText ? a.title.toLowerCase().includes(lowerCaseFilter) : true;
                const unitMatch = unitFilter ? getUnitLevel1And2(a.owningUnit) === unitFilter : true;
                const statusMatch = statusFilter ? a.status === statusFilter : true;
                const typeMatch = typeFilter === 'all' ? true : (typeFilter === 'action');
                return nameMatch && unitMatch && statusMatch && typeMatch;
            });
    }, [actions, currentUser, activeVisibilitySettings, users, unitNodes, filterText, unitFilter, statusFilter, typeFilter]);

    type WrappedPortfolioItem = { isProject: boolean; project?: Project; action?: ActionItem; id: string };

    // Dynamic 2-Level Grouping Computation
    const groupedData = useMemo(() => {
        const allItems: WrappedPortfolioItem[] = [
            ...filteredProjects.map(p => ({ isProject: true, project: p, id: `p-${p.id}` })),
            ...filteredActions.map(a => ({ isProject: false, action: a, id: `a-${a.id}` }))
        ];

        const getGroupKeyAndLabel = (item: WrappedPortfolioItem, dimension: string): { key: string; label: string } => {
            if (dimension === 'none') {
                return { key: 'all', label: language === 'fa' ? 'همه موارد' : 'All Items' };
            }
            if (dimension === 'type') {
                if (item.isProject) {
                    const isAgile = item.project!.type === 'agile';
                    return {
                        key: item.project!.type,
                        label: isAgile ? (language === 'fa' ? 'پروژه چابک' : 'Agile Project') : (language === 'fa' ? 'پروژه آبشاری' : 'Waterfall Project')
                    };
                } else {
                    return { key: 'action', label: language === 'fa' ? 'اقدام' : 'Action' };
                }
            }
            if (dimension === 'unit') {
                const u = item.isProject ? item.project!.owningUnit : item.action!.owningUnit;
                const val = getUnitLevel1And2(u) || (language === 'fa' ? 'تعیین نشده' : 'Unassigned');
                return { key: val, label: t('unitKey', { unit: val }) };
            }
            if (dimension === 'status') {
                const s = item.isProject ? item.project!.status : item.action!.status;
                const val = s || 'Uncategorized';
                const translated = workStatusTranslations[s as WorkStatus] ? t(workStatusTranslations[s as WorkStatus]) : s;
                return { key: val, label: translated };
            }
            if (dimension === 'manager') {
                if (item.isProject) {
                    const pm = users.find(u => u.id === item.project!.projectManagerId);
                    const name = pm ? (pm.username || pm.name) : (language === 'fa' ? 'تعیین نشده' : 'Unassigned');
                    return { key: `pm-${item.project!.projectManagerId}`, label: name };
                } else {
                    const resp = users.find(u => u.id === item.action!.responsibleUserId);
                    const name = resp ? (resp.username || resp.name) : (language === 'fa' ? 'تعیین نشده' : 'Unassigned');
                    return { key: `resp-${item.action!.responsibleUserId}`, label: name };
                }
            }
            return { key: 'all', label: language === 'fa' ? 'همه موارد' : 'All Items' };
        };

        const level1Map: Record<string, { label: string; level2Map: Record<string, { label: string; items: WrappedPortfolioItem[] }> }> = {};

        allItems.forEach(item => {
            const l1 = getGroupKeyAndLabel(item, groupByLevel1);
            const l2 = getGroupKeyAndLabel(item, groupByLevel2);

            if (!level1Map[l1.key]) {
                level1Map[l1.key] = { label: l1.label, level2Map: {} };
            }
            if (!level1Map[l1.key].level2Map[l2.key]) {
                level1Map[l1.key].level2Map[l2.key] = { label: l2.label, items: [] };
            }

            level1Map[l1.key].level2Map[l2.key].items.push(item);
        });

        return Object.entries(level1Map).map(([l1Key, l1Val]) => {
            const subgroups = Object.entries(l1Val.level2Map).map(([l2Key, l2Val]) => ({
                key: l2Key,
                label: l2Val.label,
                items: l2Val.items,
                count: l2Val.items.length
            }));

            const totalCount = subgroups.reduce((sum, sg) => sum + sg.count, 0);

            return {
                key: l1Key,
                label: l1Val.label,
                subgroups,
                totalCount
            };
        });
    }, [filteredProjects, filteredActions, groupByLevel1, groupByLevel2, users, language, t]);

    const isGroupOpen = (key: string) => openGroups[key] !== false;

    const toggleGroup = (key: string) => {
        setOpenGroups(prev => ({ ...prev, [key]: !isGroupOpen(key) }));
    };

    const handleExpandAll = () => {
        setOpenGroups({});
    };

    const handleCollapseAll = () => {
        const collapsed: Record<string, boolean> = {};
        groupedData.forEach(l1 => {
            collapsed[`l1-${l1.key}`] = false;
            l1.subgroups.forEach(l2 => {
                collapsed[`l1-${l1.key}-l2-${l2.key}`] = false;
            });
        });
        setOpenGroups(collapsed);
    };

    const totalCount = filteredProjects.length + filteredActions.length;
    const fmtNum = (num: number) => language === 'fa' ? toPersianDigits(num) : String(num);

    const renderApprovalBadge = (approvalStatus?: string) => {
        let label = language === 'fa' ? 'منتظر تایید' : 'Pending Approval';
        let bg = 'var(--status-planning-bg, #fff3cd)';
        let color = 'var(--status-planning-text, #664d03)';
        let border = 'rgba(255,193,7,0.4)';

        if (approvalStatus === 'Approved') {
            label = language === 'fa' ? 'تایید' : 'Approved';
            bg = 'var(--status-in-progress-bg, #d1e7dd)';
            color = 'var(--status-in-progress-text, #0f5132)';
            border = 'rgba(25,135,84,0.4)';
        } else if (approvalStatus === 'Rejected') {
            label = language === 'fa' ? 'رد' : 'Rejected';
            bg = '#f8d7da';
            color = '#842029';
            border = 'rgba(220,53,69,0.4)';
        }

        return React.createElement("span", {
            style: {
                backgroundColor: bg,
                color: color,
                border: `1px solid ${border}`,
                padding: '0.2rem 0.55rem',
                borderRadius: '12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'inline-block',
                whiteSpace: 'nowrap'
            }
        }, label);
    };

    const renderUnifiedTable = (itemList: WrappedPortfolioItem[]) => (
        React.createElement("div", { className: "table-responsive" },
            React.createElement("table", { className: "users-table" },
                React.createElement("thead", null, React.createElement("tr", null,
                    React.createElement("th", null, language === 'fa' ? 'عنوان' : 'Title'),
                    React.createElement("th", null, t('startDate')),
                    React.createElement("th", null, t('endDate')),
                    React.createElement("th", null, t('status')),
                    React.createElement("th", null, language === 'fa' ? 'وضعیت تایید' : 'Approval Status'),
                    React.createElement("th", null, t('actions'))
                )),
                React.createElement("tbody", null,
                    itemList.map(item => {
                        if (item.isProject && item.project) {
                            const p = item.project;
                            const isAgile = p.type === 'agile';
                            return React.createElement("tr", { key: `p-${p.id}` },
                                React.createElement("td", null,
                                    React.createElement("div", { style: { display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' } },
                                        p.code && React.createElement("span", { style: { fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: 'var(--border-color)', color: 'var(--text-color)' } }, p.code),
                                        React.createElement("span", { style: { fontWeight: 500 } }, p.name),
                                        React.createElement("span", { className: `project-type-badge ${isAgile ? 'type-agile' : 'type-waterfall'}` },
                                            isAgile ? (language === 'fa' ? 'چابک' : 'Agile') : (language === 'fa' ? 'آبشاری' : 'Waterfall')
                                        )
                                    )
                                ),
                                React.createElement("td", null, formatDate(p.startDate, language)),
                                React.createElement("td", null, formatDate(p.endDate, language)),
                                React.createElement("td", null, React.createElement("span", { className: `project-status-badge status-${p.status.toLowerCase().replace(/ /g, '-')}` }, t(workStatusTranslations[p.status]))),
                                React.createElement("td", null, renderApprovalBadge(p.approvalStatus)),
                                React.createElement("td", { className: "action-cell" },
                                    canEditProject(p) && React.createElement("button", { onClick: () => handleEditProjectClick(p), className: "action-icon edit", "aria-label": t('edit'), title: t('edit') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),
                                    canDeleteProject(p) && React.createElement("button", { onClick: () => handleDeleteProjectClick(p), className: "action-icon delete", "aria-label": t('delete'), title: t('delete') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "delete")),
                                    React.createElement("button", { onClick: () => setHistoryModalProject(p), className: "action-icon history", "aria-label": t('history'), title: t('history') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                    React.createElement("button", { onClick: () => onNavigate('project_dashboard_details', { project: p, from: 'portfolio' }), className: "action-icon view", "aria-label": t('viewDashboard'), title: t('viewDashboard') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "dashboard"))
                                )
                            );
                        } else if (!item.isProject && item.action) {
                            const action = item.action;
                            return React.createElement("tr", { key: `a-${action.id}` },
                                React.createElement("td", null,
                                    React.createElement("div", { style: { display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' } },
                                        React.createElement("span", { style: { fontWeight: 500 } }, action.title),
                                        React.createElement("span", { className: "project-type-badge type-action" },
                                            language === 'fa' ? 'اقدام' : 'Action'
                                        )
                                    )
                                ),
                                React.createElement("td", null, formatDate(action.startDate, language)),
                                React.createElement("td", null, formatDate(action.endDate, language)),
                                React.createElement("td", null, React.createElement("span", { className: `project-status-badge status-${action.status.toLowerCase().replace(/ /g, '-')}` }, t(workStatusTranslations[action.status]))),
                                React.createElement("td", null, renderApprovalBadge('Approved')),
                                React.createElement("td", { className: "action-cell" },
                                    canEditAction(action) && React.createElement("button", { onClick: () => onNavigate('define_action', { action }), className: "action-icon edit", "aria-label": t('edit'), title: t('edit') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),
                                    canDeleteAction(action) && React.createElement("button", { onClick: () => handleDeleteActionClick(action), className: "action-icon delete", "aria-label": t('delete'), title: t('delete') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "delete")),
                                    React.createElement("button", { onClick: () => setActionHistoryModalId(action.id), className: "action-icon history", "aria-label": t('history'), title: t('history') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "history"))
                                )
                            );
                        }
                        return null;
                    })
                )
            )
        )
    );

    return (
        React.createElement("div", { className: "content-container" },
            historyModalProject && React.createElement(ProjectHistoryModal, { project: historyModalProject, onClose: () => setHistoryModalProject(null) }),
            actionHistoryModalId && React.createElement(ActionHistoryModal, {
                actionId: actionHistoryModalId,
                users,
                progressUpdates,
                actions,
                onClose: () => setActionHistoryModalId(null)
            }),
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('projectPortfolio')),
                React.createElement("div", { className: "page-header-actions" },
                    React.createElement("button", {
                        type: "button",
                        className: `filter-toggle-btn ${isFilterOpen ? 'active' : ''}`,
                        onClick: () => setIsFilterOpen(!isFilterOpen)
                    },
                        React.createElement("span", { className: "material-symbols-outlined" }, "filter_alt"),
                        React.createElement("span", null, language === 'fa' ? 'فیلترها' : 'Filters'),
                        React.createElement("span", { className: "material-symbols-outlined expand-arrow" }, isFilterOpen ? "expand_less" : "expand_more")
                    ),
                    React.createElement("button", {
                        type: "button",
                        className: `grouping-toggle-btn ${isGroupingOpen ? 'active' : ''}`,
                        onClick: () => setIsGroupingOpen(!isGroupingOpen)
                    },
                        React.createElement("span", { className: "material-symbols-outlined" }, "schema"),
                        React.createElement("span", null, language === 'fa' ? 'گروه‌بندی' : 'Grouping'),
                        React.createElement("span", { className: "material-symbols-outlined expand-arrow" }, isGroupingOpen ? "expand_less" : "expand_more")
                    ),
                    React.createElement("button", { onClick: handleExpandAll, className: "action-icon", title: t('expandAll') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "unfold_more")
                    ),
                    React.createElement("button", { onClick: handleCollapseAll, className: "action-icon", title: t('collapseAll') } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "unfold_less")
                    ),
                    React.createElement("button", { 
                        className: "action-button no-print", 
                        onClick: () => exportDashboardToLandscapePdf('Project_Portfolio'), 
                        title: language === 'fa' ? 'خروجی PDF سبد پروژه‌ها' : 'Export Portfolio to PDF', 
                        style: { padding: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', border: 'none', color: '#fff', borderRadius: '8px' } 
                    }, 
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: '#fff' } }, "picture_as_pdf")
                    )
                )
            ),
            
            // FILTERS PANEL
            isFilterOpen && React.createElement("div", { className: "dashboard-filters portfolio-filters", style: { padding: '1rem', backgroundColor: 'var(--secondary-color)', marginBottom: '1rem', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '1rem' } },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "nameFilter" }, t('filterByProjectName')),
                    React.createElement("input", {
                        type: "text",
                        id: "nameFilter",
                        placeholder: t('filterPlaceholder'),
                        value: filterText,
                        onChange: e => setFilterText(e.target.value)
                    })
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "portfolioTypeFilter" }, language === 'fa' ? 'نوع پروژه / اقدام' : 'Project/Action Type'),
                    React.createElement("select", {
                        id: "portfolioTypeFilter",
                        value: typeFilter,
                        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value as any)
                    },
                        React.createElement("option", { value: "all" }, language === 'fa' ? 'همه انواع (آبشاری، چابک، اقدام)' : 'All Types'),
                        React.createElement("option", { value: "waterfall" }, language === 'fa' ? 'آبشاری' : 'Waterfall'),
                        React.createElement("option", { value: "agile" }, language === 'fa' ? 'چابک' : 'Agile'),
                        React.createElement("option", { value: "action" }, language === 'fa' ? 'اقدام' : 'Action')
                    )
                ),
                React.createElement("div", { className: "form-group unit-filter-group" },
                    React.createElement("label", { htmlFor: "unitFilter" }, t('owningUnit')),
                    React.createElement("select", { id: "unitFilter", value: unitFilter, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setUnitFilter(e.target.value) },
                        React.createElement("option", { value: "" }, t('allUnits')),
                        ...unitFilterOptions.map(unit => React.createElement("option", { key: unit, value: unit }, unit))
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "portfolioStatusFilter" }, t('status')),
                    React.createElement("select", { id: "portfolioStatusFilter", value: statusFilter, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value) },
                        React.createElement("option", { value: "" }, language === 'fa' ? 'همه وضعیت‌ها' : 'All Statuses'),
                        React.createElement("option", { value: "Planning" }, t('planning')),
                        React.createElement("option", { value: "In Progress" }, t('inProgress')),
                        React.createElement("option", { value: "On Hold" }, t('onHold')),
                        React.createElement("option", { value: "Completed" }, t('completed'))
                    )
                )
            ),

            // GROUPING PANEL
            isGroupingOpen && React.createElement("div", { className: "dashboard-filters portfolio-filters", style: { padding: '1rem', backgroundColor: 'var(--secondary-color)', marginBottom: '1rem', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '1rem' } },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "groupByLevel1" }, language === 'fa' ? 'گروه‌بندی سطح ۱' : 'Grouping Level 1'),
                    React.createElement("select", { id: "groupByLevel1", value: groupByLevel1, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setGroupByLevel1(e.target.value) },
                        React.createElement("option", { value: "unit" }, language === 'fa' ? 'واحد مالک' : 'Owning Unit'),
                        React.createElement("option", { value: "status" }, language === 'fa' ? 'وضعیت' : 'Status'),
                        React.createElement("option", { value: "type" }, language === 'fa' ? 'نوع (آبشاری / چابک / اقدام)' : 'Type'),
                        React.createElement("option", { value: "manager" }, language === 'fa' ? 'مدیر / مسئول' : 'Manager / Responsible'),
                        React.createElement("option", { value: "none" }, language === 'fa' ? 'هیچ (بدون گروه‌بندی)' : 'None')
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "groupByLevel2" }, language === 'fa' ? 'گروه‌بندی سطح ۲' : 'Grouping Level 2'),
                    React.createElement("select", { id: "groupByLevel2", value: groupByLevel2, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setGroupByLevel2(e.target.value) },
                        React.createElement("option", { value: "status" }, language === 'fa' ? 'وضعیت' : 'Status'),
                        React.createElement("option", { value: "unit" }, language === 'fa' ? 'واحد مالک' : 'Owning Unit'),
                        React.createElement("option", { value: "type" }, language === 'fa' ? 'نوع (آبشاری / چابک / اقدام)' : 'Type'),
                        React.createElement("option", { value: "manager" }, language === 'fa' ? 'مدیر / مسئول' : 'Manager / Responsible'),
                        React.createElement("option", { value: "none" }, language === 'fa' ? 'هیچ (بدون گروه‌بندی)' : 'None')
                    )
                )
            ),

            totalCount === 0 ? (
                React.createElement("div", { className: "placeholder-content" }, t('noProjectsAssigned'))
            ) : (
                React.createElement("div", { className: "portfolio-container" },
                    groupedData.map(l1Group => {
                        const l1Key = `l1-${l1Group.key}`;
                        const isL1Open = isGroupOpen(l1Key);

                        // If Level 1 grouping is 'none', render subgroups directly
                        if (groupByLevel1 === 'none') {
                            return l1Group.subgroups.map(l2Group => {
                                const l2Key = `l2-${l2Group.key}`;
                                const isL2Open = isGroupOpen(l2Key);

                                if (groupByLevel2 === 'none') {
                                    return React.createElement("div", { key: l2Key, className: "portfolio-group" },
                                        l2Group.items.length > 0 && renderUnifiedTable(l2Group.items)
                                    );
                                }

                                return React.createElement("div", { key: l2Key, className: "portfolio-group" },
                                    React.createElement("h3", { className: "group-header", onClick: () => toggleGroup(l2Key) },
                                        React.createElement("span", null, l2Group.label),
                                        React.createElement("span", { className: "portfolio-count-badge" }, fmtNum(l2Group.count)),
                                        React.createElement("span", { className: "material-symbols-outlined expand-arrow" }, isL2Open ? 'expand_less' : 'expand_more')
                                    ),
                                    isL2Open && React.createElement("div", { className: "group-content" },
                                        l2Group.items.length > 0 && renderUnifiedTable(l2Group.items)
                                    )
                                );
                            });
                        }

                        // Normal Level 1 Group
                        return React.createElement("div", { key: l1Key, className: "portfolio-group" },
                            React.createElement("h3", { className: "group-header", onClick: () => toggleGroup(l1Key) },
                                React.createElement("span", null, l1Group.label),
                                React.createElement("span", { className: "portfolio-count-badge" }, fmtNum(l1Group.totalCount)),
                                React.createElement("span", { className: "material-symbols-outlined expand-arrow" }, isL1Open ? 'expand_less' : 'expand_more')
                            ),
                            isL1Open && React.createElement("div", { className: "group-content" },
                                groupByLevel2 === 'none' ? (
                                    // Render content directly under L1 if L2 is 'none'
                                    l1Group.subgroups.map(sub => (
                                        React.createElement("div", { key: sub.key },
                                            sub.items.length > 0 && renderUnifiedTable(sub.items)
                                        )
                                    ))
                                ) : (
                                    // Level 2 Subgroups
                                    l1Group.subgroups.map(l2Group => {
                                        const l2Key = `${l1Key}-l2-${l2Group.key}`;
                                        const isL2Open = isGroupOpen(l2Key);

                                        return React.createElement("div", { key: l2Key, className: "portfolio-subgroup" },
                                            React.createElement("h4", { className: "subgroup-header", onClick: () => toggleGroup(l2Key) },
                                                React.createElement("span", null, l2Group.label),
                                                React.createElement("span", { className: "portfolio-count-badge subgroup" }, fmtNum(l2Group.count)),
                                                React.createElement("span", { className: "material-symbols-outlined expand-arrow" }, isL2Open ? 'expand_less' : 'expand_more')
                                            ),
                                            isL2Open && React.createElement("div", { className: "group-content" },
                                                l2Group.items.length > 0 && renderUnifiedTable(l2Group.items)
                                            )
                                        );
                                    })
                                )
                            )
                        );
                    })
                )
            )
        )
    );
};

// --- DeleteProjectsPage ---
export const DeleteProjectsPage = ({ projects, onDeleteProject, onNavigate }: { projects: Project[], onDeleteProject: (id: string) => void, onNavigate: (page: string) => void }): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';
    
    const handleDeleteClick = (projectId: string) => {
        if (window.confirm(t('confirmProjectDelete'))) {
            onDeleteProject(projectId);
        }
    };

    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('deleteProjects'))
            ),
            React.createElement("div", { className: "table-responsive" },
              React.createElement("table", { className: "users-table" },
                  React.createElement("thead", null,
                      React.createElement("tr", null, React.createElement("th", null, t('projectName')), React.createElement("th", null, t('docType')), React.createElement("th", null, t('actions')))
                  ),
                  React.createElement("tbody", null,
                      projects.length > 0 
                        ? projects.map(project => (
                          React.createElement("tr", { key: project.id },
                              React.createElement("td", null, project.name),
                              React.createElement("td", null, project.type),
                              React.createElement("td", { className: "action-cell" },
                                  React.createElement("button", { onClick: () => handleDeleteClick(project.id), className: "action-icon delete", "aria-label": t('delete') } as React.HTMLAttributes<HTMLButtonElement>,
                                      React.createElement("span", { className: "material-symbols-outlined" }, "delete")
                                  )
                              )
                          )
                      ))
                      : React.createElement("tr", null, React.createElement("td", { colSpan: 3 }, t('noProjectsToDelete')))
                  )
              )
            )
        )
    );
};

export const DashboardHubPage = ({ onNavigate, projects, users, calendars, initialModal }: { 
    onNavigate: (page: string, context?: any) => void, 
    projects: Project[],
    users: User[],
    calendars: Calendar[],
    initialModal?: string,
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [isOrgModalOpen, setOrgModalOpen] = useState(initialModal === 'org');
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    const options = useMemo(() => [
        { name: t('overallDashboard'), icon: 'analytics', page: 'dashboard' },
        { name: t('overallActionDashboard'), icon: 'assessment', page: 'action_dashboard' },
        { name: t('organizationalDistributionProjects'), icon: 'corporate_fare', page: 'org_distribution' },
    ], [t]);

    const handleItemClick = (e: React.MouseEvent, page: string) => {
        e.preventDefault();
        if (page === 'org_distribution') {
            setOrgModalOpen(true);
        } else {
            onNavigate(page);
        }
    };

    return (
        React.createElement("div", { className: "content-container" },
            React.createElement(AnimatePresence, null,
                isOrgModalOpen && React.createElement(OrgChartModal, {
                    isOpen: isOrgModalOpen,
                    onClose: () => setOrgModalOpen(false),
                    projects: projects,
                    calendars: calendars,
                    onNavigate: onNavigate
                })
            ),
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('dashboardHubTitle'))
            ),
            React.createElement("div", { className: "strategy-hub-grid" },
                options.map((opt) => (
                    React.createElement("a", {
                        href: "#",
                        className: "settings-item",
                        key: opt.page,
                        role: "button",
                        "aria-label": opt.name,
                        onClick: (e) => handleItemClick(e, opt.page)
                    } as React.HTMLAttributes<HTMLAnchorElement>,
                        React.createElement("span", { className: "material-symbols-outlined", "aria-hidden": "true" }, opt.icon),
                        React.createElement("span", { className: "settings-text" }, opt.name)
                    )
                ))
            )
        )
    );
};

export const ProjectDashboardPage = ({ projects, actions = [], users, calendars, onNavigate, owningUnits, projectStatuses }: { 
    projects: Project[], 
    actions?: ActionItem[],
    users: User[], 
    calendars: Calendar[], 
    onNavigate: (page: string, context?: any) => void,
    owningUnits: string[],
    projectStatuses: string[]
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'project' | 'action'>('all');
    const [filteredWaterfallProjects, setFilteredWaterfallProjects] = useState<EnrichedProject[]>([]);
    const [filteredAgileProjects, setFilteredAgileProjects] = useState<EnrichedProject[]>([]);

    const [nameFilter, setNameFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [unitFilter, setUnitFilter] = useState('');
    const [pmFilter, setPmFilter] = useState('');

    const [groupBy, setGroupBy] = useState<'none' | 'owningUnit' | 'status' | 'projectManager' | 'type'>('owningUnit');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const AnimatedNumberCell = ({ value }: { value: number }): ReactElement => {
        const cellRef = useRef<HTMLTableCellElement>(null);

        useEffect(() => {
            const node = cellRef.current;
            if (!node) return;
            const controls = animate(0, value || 0, {
                duration: 1,
                ease: "easeOut",
                onUpdate: (latest) => {
                    if (node) {
                        const rounded = Math.round(latest);
                        node.textContent = language === 'fa' ? toPersianDigits(rounded) : rounded.toString();
                    }
                }
            });
            return () => controls.stop();
        }, [value, language]);

        return React.createElement("td", { ref: cellRef }, language === 'fa' ? toPersianDigits(0) : 0);
    };

    const unitFilterOptions = useMemo(() => Array.from(new Set(owningUnits.map(u => getUnitLevel1And2(u)).filter(Boolean))), [owningUnits]);

    const enrichedProjects = useMemo(() => {
        return projects
          .filter(p => p.approvalStatus === 'Approved')
          .map(p => enrichProjectWithProgress(p, calendars));
    }, [projects, calendars]);
    
    useEffect(() => {
        const filtered = enrichedProjects.filter(p => {
            const nameMatch = nameFilter ? p.name.toLowerCase().includes(nameFilter.toLowerCase()) : true;
            const statusMatch = statusFilter ? p.status === statusFilter : true;
            const unitMatch = unitFilter ? getUnitLevel1And2(p.owningUnit) === unitFilter : true;
            const pmMatch = pmFilter ? String(p.projectManagerId) === String(pmFilter) : true;
            return nameMatch && statusMatch && unitMatch && pmMatch;
        });
        
        setFilteredWaterfallProjects(filtered.filter(p => p.type === 'waterfall'));
        setFilteredAgileProjects(filtered.filter(p => p.type === 'agile'));

    }, [nameFilter, statusFilter, unitFilter, pmFilter, enrichedProjects]);

    const filteredActions = useMemo(() => {
        return actions.filter(a => {
            const titleMatch = nameFilter ? a.title.toLowerCase().includes(nameFilter.toLowerCase()) : true;
            const statusMatch = statusFilter ? a.status === statusFilter : true;
            const unitMatch = unitFilter ? getUnitLevel1And2(a.owningUnit) === unitFilter : true;
            const pmMatch = pmFilter ? a.responsibleUserId === pmFilter : true;
            return titleMatch && statusMatch && unitMatch && pmMatch;
        });
    }, [actions, nameFilter, statusFilter, unitFilter, pmFilter]);

    const allProjectManagers = useMemo(() => users.filter(u => u.role === 'Project Manager' || u.role === 'Admin'), [users]);
    
    const statusTranslations: Record<string, TranslationKey> = {
        'Planning': 'planning',
        'In Progress': 'inProgress',
        'On Hold': 'onHold',
        'Completed': 'completed'
    };

    const projectTypeChartData = useMemo(() => [
        { name: t('waterfallProjects'), value: filteredWaterfallProjects.length, color: 'var(--info-color)' },
        { name: t('agileProjects'), value: filteredAgileProjects.length, color: 'var(--success-color)' }
    ], [t, filteredWaterfallProjects, filteredAgileProjects]);

    const allFilteredProjects = useMemo(() => {
        return [...filteredWaterfallProjects, ...filteredAgileProjects];
    }, [filteredWaterfallProjects, filteredAgileProjects]);

    const totalProjectCount = useMemo(() => allFilteredProjects.length, [allFilteredProjects]);
    const totalActionsCount = useMemo(() => filteredActions.length, [filteredActions]);
    
    const inProgressProjectsCount = useMemo(() => {
        return allFilteredProjects.filter(p => p.status === 'In Progress').length;
    }, [allFilteredProjects]);

    const inProgressActionsCount = useMemo(() => {
        return filteredActions.filter(a => a.status === 'In Progress').length;
    }, [filteredActions]);

    const totalCost = useMemo(() => {
        return allFilteredProjects.reduce((sum, p) => sum + (p.cost || 0), 0);
    }, [allFilteredProjects]);

    const unitPieChartData = useMemo(() => {
        if (allFilteredProjects.length === 0) return [];
        const counts = allFilteredProjects.reduce((acc, p) => {
            const u = getUnitLevel1And2(p.owningUnit) || (language === 'fa' ? 'بدون واحد' : 'Unassigned');
            acc[u] = (acc[u] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1', '#E11D48', '#84CC16', '#A855F7'];
    
        return (Object.entries(counts) as [string, number][])
            .map(([label, value], index) => ({
                name: label,
                value,
                color: colors[index % colors.length]
            }))
            .sort((a, b) => Number(b.value) - Number(a.value));
    }, [allFilteredProjects, language]);

    const statusDoughnutChartData = useMemo(() => {
        if (allFilteredProjects.length === 0) return [];
    
        const statusColorMap: Record<string, string> = {
            'Planning': '#F59E0B',
            'In Progress': '#2563EB',
            'On Hold': '#9333EA',
            'Completed': '#10B981'
        };
    
        const counts = allFilteredProjects.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    
        return Object.entries(counts).map(([status, value]) => ({
            name: t(statusTranslations[status as WorkStatus] || status as any),
            value,
            color: statusColorMap[status as WorkStatus] || 'var(--inactive-color)'
        }));
    
    }, [allFilteredProjects, t]);

    const pmChartData = useMemo(() => {
        if (allFilteredProjects.length === 0) return [];
        const counts = allFilteredProjects.reduce((acc, p) => {
            const pm = users.find(u => u.id === p.projectManagerId);
            const key = pm?.username || (language === 'fa' ? 'تعیین نشده' : 'Unassigned');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const colors = ['#6366F1', '#10B981', '#EC4899', '#F59E0B', '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6', '#3B82F6', '#E11D48', '#84CC16', '#A855F7'];

        return (Object.entries(counts) as [string, number][])
            .map(([label, value], index) => ({
                name: label,
                value,
                color: colors[index % colors.length]
            }))
            .sort((a, b) => Number(b.value) - Number(a.value));
    }, [allFilteredProjects, users, language]);

    const groupedProjects = useMemo(() => {
        if (groupBy === 'none') return [];
        const map = new Map<string, EnrichedProject[]>();
        allFilteredProjects.forEach(p => {
            let key = '';
            if (groupBy === 'owningUnit') key = getUnitLevel1And2(p.owningUnit) || (language === 'fa' ? 'بدون واحد' : 'Unassigned');
            else if (groupBy === 'status') key = t(statusTranslations[p.status as WorkStatus] || (p.status as any));
            else if (groupBy === 'projectManager') {
                const pm = users.find(u => u.id === p.projectManagerId);
                key = pm?.username || (language === 'fa' ? 'تعیین نشده' : 'Unassigned');
            }
            else if (groupBy === 'type') key = p.type === 'waterfall' ? t('waterfallProjects') : t('agileProjects');

            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(p);
        });

        return Array.from(map.entries()).map(([groupTitle, items]) => {
            const grpCost = items.reduce((sum, item) => sum + (item.cost || 0), 0);
            const avgActualProgress = Math.round(
                items.reduce((sum, item) => sum + (item.actualProgress || 0), 0) / (items.length || 1)
            );
            return { groupTitle, items, totalCost: grpCost, avgActualProgress };
        });
    }, [allFilteredProjects, groupBy, users, t, language]);

    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('projectAndActionDashboard')),
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                    React.createElement("button", {
                        type: "button",
                        className: "action-button no-print",
                        onClick: () => exportDashboardToLandscapePdf(language === 'fa' ? 'داشبورد پروژه‌ها و اقدامات' : 'Projects and Actions Dashboard'),
                        title: language === 'fa' ? 'دریافت خروجی PDF (یک صفحه عرضی)' : 'Export Dashboard PDF (Landscape)',
                        style: { padding: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', border: 'none', color: '#fff', borderRadius: '8px' }
                    },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: '#fff' } }, "picture_as_pdf")
                    ),
                    React.createElement("button", {
                        type: "button",
                        className: `filter-toggle-btn ${isFilterOpen ? 'active' : ''}`,
                        onClick: () => setIsFilterOpen(!isFilterOpen)
                    },
                        React.createElement("span", { className: "material-symbols-outlined" }, "tune"),
                        React.createElement("span", null, language === 'fa' ? 'فیلترها' : 'Filters'),
                        React.createElement("span", { className: "material-symbols-outlined expand-arrow" }, isFilterOpen ? "expand_less" : "expand_more")
                    )
                )
            ),
            
            isFilterOpen && React.createElement("div", { className: "dashboard-filters" },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "nameFilter" }, language === 'fa' ? 'نام / عنوان' : 'Name / Title'),
                    React.createElement("input", { type: "text", id: "nameFilter", value: nameFilter, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNameFilter(e.target.value), placeholder: language === 'fa' ? 'جستجو پروژه یا اقدام...' : 'Search projects or actions...' })
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "itemTypeFilter" }, language === 'fa' ? 'فیلتر نوع' : 'Type Filter'),
                    React.createElement("select", { id: "itemTypeFilter", value: itemTypeFilter, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setItemTypeFilter(e.target.value as any) },
                        React.createElement("option", { value: "all" }, language === 'fa' ? 'همه (پروژه و اقدام)' : 'All (Projects & Actions)'),
                        React.createElement("option", { value: "project" }, language === 'fa' ? 'پروژه' : 'Projects'),
                        React.createElement("option", { value: "action" }, language === 'fa' ? 'اقدام' : 'Actions')
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "statusFilter" }, t('status')),
                    React.createElement("select", { id: "statusFilter", value: statusFilter, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value) },
                        React.createElement("option", { value: "" }, t('allStatuses')),
                        ...projectStatuses.map(statusKey => (
                             React.createElement("option", { key: statusKey, value: statusKey }, t(statusTranslations[statusKey as WorkStatus] || (statusKey as any)))
                        ))
                    )
                ),
                React.createElement("div", { className: "form-group unit-filter-group" },
                    React.createElement("label", { htmlFor: "unitFilter" }, t('owningUnit')),
                    React.createElement("select", { id: "unitFilter", value: unitFilter, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setUnitFilter(e.target.value) },
                        React.createElement("option", { value: "" }, t('allUnits')),
                        ...unitFilterOptions.map(unit => React.createElement("option", { key: unit, value: unit }, unit))
                    )
                )
            ),
            
            React.createElement("div", { className: "dashboard-stats-grid" },
                React.createElement("div", { className: "stat-card-stack" },
                    (itemTypeFilter === 'all' || itemTypeFilter === 'project') && React.createElement("div", { className: "chart-card" },
                        React.createElement(ProjectCountCard, { count: totalProjectCount, title: t('projectsCount') })
                    ),
                    (itemTypeFilter === 'all' || itemTypeFilter === 'action') && React.createElement("div", { className: "chart-card" },
                        React.createElement(ProjectCountCard, { count: totalActionsCount, title: t('totalActions') })
                    ),
                    (itemTypeFilter === 'all' || itemTypeFilter === 'project') && React.createElement("div", { className: "chart-card" },
                        React.createElement(ProjectCountCard, { count: inProgressProjectsCount, title: t('inProgressProjects') })
                    ),
                    (itemTypeFilter === 'all' || itemTypeFilter === 'action') && React.createElement("div", { className: "chart-card" },
                        React.createElement(ProjectCountCard, { count: inProgressActionsCount, title: t('inProgressActions') })
                    )
                )
            ),

            React.createElement("div", { className: "dashboard-charts-row" },
                (itemTypeFilter === 'all' || itemTypeFilter === 'project') && React.createElement(SwitchableChartCard, { title: t('projectsByStatus'), data: statusDoughnutChartData }),
                React.createElement(SwitchableChartCard, { title: t('projectsByOwningUnit'), data: unitPieChartData, defaultChartType: 'bar' }),
                (itemTypeFilter === 'all' || itemTypeFilter === 'project') && React.createElement(SwitchableChartCard, { title: language === 'fa' ? 'پروژه‌ها بر اساس مدیر پروژه' : t('projectManager'), data: pmChartData, defaultChartType: 'pie', pieType: 'pie' })
            ),

            // PROJECTS SECTION
            (itemTypeFilter === 'all' || itemTypeFilter === 'project') && React.createElement(Fragment, null,
                // Waterfall projects table
                React.createElement("div", { className: "form-section", style: { marginTop: '1.5rem' } },
                    React.createElement("h3", null, t('waterfallProjects')),
                    React.createElement("div", { className: "table-responsive" },
                        React.createElement("table", { className: "users-table dashboard-table" },
                            React.createElement("thead", null,
                                React.createElement("tr", null,
                                    React.createElement("th", { style: { width: '45px', textAlign: 'center' } }, language === 'fa' ? 'ردیف' : '#'),
                                    React.createElement("th", null, t('projectNameColumn')),
                                    React.createElement("th", null, t('startDate')),
                                    React.createElement("th", null, t('endDate')),
                                    React.createElement("th", null, t('status')),
                                    React.createElement("th", { style: { width: '12%' } }, t('plannedPercent')),
                                    React.createElement("th", { style: { width: '12%' } }, t('actualPercent')),
                                    React.createElement("th", null, t('performancePercentage')),
                                    React.createElement("th", { className: "th-actions no-print" }, t('actions'))
                                )
                            ),
                            React.createElement("tbody", null,
                                filteredWaterfallProjects.length > 0 
                                    ? filteredWaterfallProjects.map((p, idx) => (
                                        React.createElement("tr", { key: p.id },
                                            React.createElement("td", { style: { textAlign: 'center' } }, language === 'fa' ? toPersianDigits(idx + 1) : (idx + 1)),
                                            React.createElement("td", null, p.name),
                                            React.createElement("td", null, formatDate(p.startDate, language)),
                                            React.createElement("td", null, formatDate(p.endDate, language)),
                                            React.createElement("td", null, React.createElement("span", { className: `project-status-badge status-${p.status.toLowerCase().replace(/ /g, '-')}` }, t(statusTranslations[p.status as WorkStatus] || (p.status as any)))),
                                            React.createElement("td", null, React.createElement(ProgressBar, { value: p.plannedProgress, type: 'planned' })),
                                            React.createElement("td", null, React.createElement(ProgressBar, { value: p.actualProgress, type: 'actual' })),
                                            React.createElement("td", null, React.createElement(PerformanceIndicator, { performance: p.performance })),
                                            React.createElement("td", { className: "action-cell no-print" },
                                                React.createElement("button", { onClick: () => onNavigate('project_dashboard_details', { project: p, from: 'dashboard' }), className: "action-icon view", "aria-label": t('viewDashboard') } as React.HTMLAttributes<HTMLButtonElement>,
                                                    React.createElement("span", { className: "material-symbols-outlined" }, "dashboard")
                                                )
                                            )
                                        )
                                    ))
                                    : React.createElement("tr", null, React.createElement("td", { colSpan: 8, style: { textAlign: 'center' } }, t('noProjectsToDisplay')))
                            )
                        )
                    )
                ),

                // Agile projects table
                React.createElement("div", { className: "form-section" },
                    React.createElement("h3", null, t('agileProjects')),
                    React.createElement("div", { className: "table-responsive" },
                        React.createElement("table", { className: "users-table dashboard-table" },
                            React.createElement("thead", null,
                                React.createElement("tr", null,
                                    React.createElement("th", { style: { width: '45px', textAlign: 'center' } }, language === 'fa' ? 'ردیف' : '#'),
                                    React.createElement("th", null, t('projectNameColumn')),
                                    React.createElement("th", null, t('startDate')),
                                    React.createElement("th", null, t('endDate')),
                                    React.createElement("th", null, t('status')),
                                    React.createElement("th", null, t('totalActivities')),
                                    React.createElement("th", null, t('todoCount')),
                                    React.createElement("th", null, t('doingCount')),
                                    React.createElement("th", null, t('doneCount')),
                                    React.createElement("th", { className: "th-actions no-print" }, t('actions'))
                                )
                            ),
                            React.createElement("tbody", null,
                                filteredAgileProjects.length > 0 
                                    ? filteredAgileProjects.map((p, idx) => (
                                        React.createElement("tr", { key: p.id },
                                            React.createElement("td", { style: { textAlign: 'center' } }, language === 'fa' ? toPersianDigits(idx + 1) : (idx + 1)),
                                            React.createElement("td", null, p.name),
                                            React.createElement("td", null, formatDate(p.startDate, language)),
                                            React.createElement("td", null, formatDate(p.endDate, language)),
                                            React.createElement("td", null, React.createElement("span", { className: `project-status-badge status-${p.status.toLowerCase().replace(/ /g, '-')}` }, t(statusTranslations[p.status as WorkStatus] || (p.status as any)))),
                                            React.createElement(AnimatedNumberCell, { value: p.totalTasks || 0 }),
                                            React.createElement(AnimatedNumberCell, { value: p.todoTasks || 0 }),
                                            React.createElement(AnimatedNumberCell, { value: p.doingTasks || 0 }),
                                            React.createElement(AnimatedNumberCell, { value: p.doneTasks || 0 }),
                                            React.createElement("td", { className: "action-cell no-print" },
                                                React.createElement("button", { onClick: () => onNavigate('project_dashboard_details', { project: p, from: 'dashboard' }), className: "action-icon view", "aria-label": t('viewDashboard') } as React.HTMLAttributes<HTMLButtonElement>,
                                                    React.createElement("span", { className: "material-symbols-outlined" }, "dashboard")
                                                )
                                            )
                                        )
                                    ))
                                    : React.createElement("tr", null, React.createElement("td", { colSpan: 9, style: { textAlign: 'center' } }, t('noProjectsToDisplay')))
                            )
                        )
                    )
                )
            ),

            // ACTIONS SECTION
            (itemTypeFilter === 'all' || itemTypeFilter === 'action') && React.createElement("div", { className: "form-section", style: { marginTop: '2rem' } },
                React.createElement("h3", null, t('actionsGroup')),
                React.createElement("div", { className: "table-responsive" },
                    React.createElement("table", { className: "users-table dashboard-table" },
                        React.createElement("thead", null, React.createElement("tr", null,
                            React.createElement("th", { style: { width: '45px', textAlign: 'center' } }, language === 'fa' ? 'ردیف' : '#'),
                            React.createElement("th", null, t('actionTitleColumn')),
                            React.createElement("th", null, t('responsiblePerson')),
                            React.createElement("th", null, t('owningUnit')),
                            React.createElement("th", null, t('startDate')),
                            React.createElement("th", null, t('endDate')),
                            React.createElement("th", null, t('status')),
                            React.createElement("th", { className: "th-actions no-print" }, t('actions'))
                        )),
                        React.createElement("tbody", null,
                            filteredActions.length > 0 ? (
                                filteredActions.map((action, idx) => {
                                    const responsibleUser = users.find(u => u.id === action.responsibleUserId);
                                    return React.createElement("tr", { key: action.id },
                                        React.createElement("td", { style: { textAlign: 'center' } }, language === 'fa' ? toPersianDigits(idx + 1) : (idx + 1)),
                                        React.createElement("td", null, action.title),
                                        React.createElement("td", null, responsibleUser?.username || 'N/A'),
                                        React.createElement("td", null, action.owningUnit),
                                        React.createElement("td", null, formatDate(action.startDate, language)),
                                        React.createElement("td", null, formatDate(action.endDate, language)),
                                        React.createElement("td", null, React.createElement("span", { className: `project-status-badge status-${action.status.toLowerCase().replace(/ /g, '-')}` }, t(statusTranslations[action.status as WorkStatus] || (action.status as any)))),
                                        React.createElement("td", { className: "action-cell no-print" },
                                            React.createElement("button", { onClick: () => onNavigate('define_action', { action, from: 'dashboard' }), className: "action-icon edit", "aria-label": t('edit') }, React.createElement("span", { className: "material-symbols-outlined" }, "edit"))
                                        )
                                    );
                                })
                            ) : (
                                React.createElement("tr", null, React.createElement("td", { colSpan: 8, style: { textAlign: 'center' } }, t('noActionsAssigned')))
                            )
                        )
                    )
                )
            )
        )
    );
};

export const ProjectSpecificDashboardPage = ({ users, calendars, onNavigate, progressUpdates, actions, pageContext, currentUser }: { 
    users: User[], 
    calendars: Calendar[], 
    onNavigate: (page: string, context?: any) => void,
    progressUpdates: ProgressUpdate[],
    actions: ActionItem[],
    pageContext: { project: Project, from: string },
    currentUser?: User | null
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const { project, from } = pageContext;
    const relatedActions = useMemo(() => actions.filter(a => a.projectId === project.id), [actions, project.id]);

    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    const enrichedProject = useMemo(() => {
        return enrichProjectWithProgress(project, calendars);
    }, [project, calendars]);

    const getFilteredDashboardItems = <T extends { isApproved?: boolean; submittedBy?: number }>(items: T[], tabId: string): T[] => {
        const requiresWorkflow = !!enrichedProject.tabWorkflows?.[tabId];
        if (!requiresWorkflow) return items;
        
        return items.filter(item => item.isApproved === true);
    };

    const projectManager = useMemo(() => {
        return users.find(u => u.id === project.projectManagerId);
    }, [users, project.projectManagerId]);

    const workStatusTranslations: Record<WorkStatus, TranslationKey> = {
        'Planning': 'planning', 'In Progress': 'inProgress', 'On Hold': 'onHold', 'Completed': 'completed'
    };
    
    const projectTypeTranslations: Record<ProjectType, TranslationKey> = {
        'waterfall': 'waterfallProject',
        'agile': 'agileProject'
    };

    const { rootNode } = useMemo(() => {
        if (project.type === 'waterfall') {
            const projectCalendar = pickCalendar(calendars, project.calendarId)!;
            return calculateScheduleTreeAndProgress(project, projectCalendar, project.weightingType, project.plannedProgressType);
        }
        return { rootNode: null };
    }, [project, calendars]);

    const handleBack = () => {
        if (from === 'chatbot' || from === 'dashboard_hub' || !from) {
            onNavigate('dashboard', { project });
        } else {
            onNavigate(from, { project });
        }
    };

    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, `${t('projectSpecificDashboard')}: ${project.name}`),
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                    React.createElement("button", {
                        type: "button",
                        className: "action-button no-print",
                        onClick: () => exportDashboardToLandscapePdf(`${language === 'fa' ? 'داشبورد پروژه' : 'Project Dashboard'} - ${project.name}`),
                        title: language === 'fa' ? 'دریافت خروجی PDF (یک صفحه عرضی)' : 'Export Dashboard PDF (Landscape)',
                        style: { padding: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', border: 'none', color: '#fff', borderRadius: '8px' }
                    },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: '#fff' } }, "picture_as_pdf")
                    ),
                    React.createElement("button", { onClick: handleBack, className: "back-button" } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, backIcon),
                        t('back')
                    )
                )
            ),
            // Charter Summary
            React.createElement("div", { className: "form-section" },
                React.createElement("h3", null, t('projectCharterSummary')),
                React.createElement("div", { className: "charter-summary-table" },
                    React.createElement("div", { className: "summary-item" }, React.createElement("strong", null, t('projectName')), React.createElement("span", null, enrichedProject.name)),
                    React.createElement("div", { className: "summary-item" }, React.createElement("strong", null, t('projectType')), React.createElement("span", null, t(projectTypeTranslations[enrichedProject.type]))),
                    React.createElement("div", { className: "summary-item" }, React.createElement("strong", null, t('projectManager')), React.createElement("span", null, projectManager?.username || 'N/A')),
                    React.createElement("div", { className: "summary-item" }, React.createElement("strong", null, t('owningUnit')), React.createElement("span", null, enrichedProject.owningUnit)),
                    React.createElement("div", { className: "summary-item" }, React.createElement("strong", null, t('startDate')), React.createElement("span", null, formatDate(enrichedProject.startDate, language))),
                    React.createElement("div", { className: "summary-item" }, React.createElement("strong", null, t('endDate')), React.createElement("span", null, formatDate(enrichedProject.endDate, language))),
                    React.createElement("div", { className: "summary-item summary-item-status" }, 
                        React.createElement("strong", null, t('status')), 
                        React.createElement("span", { className: `project-status-badge dashboard-status-badge status-${enrichedProject.status.toLowerCase().replace(/ /g, '-')}` }, t(workStatusTranslations[enrichedProject.status]))
                    ),
                    React.createElement("div", { className: "summary-item" }, React.createElement("strong", null, t('cost')), React.createElement("span", null, `${language === 'fa' ? toPersianDigits(new Intl.NumberFormat().format(enrichedProject.cost || 0)) : new Intl.NumberFormat().format(enrichedProject.cost || 0)} ${t('rial')}`))
                )
            ),
            // Progress and Performance Gauges (Waterfall only)
            enrichedProject.type === 'waterfall' && React.createElement("div", { className: "dashboard-stats-grid", style: { gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' } },
                React.createElement("div", { className: "chart-card" }, React.createElement("h4", null, t('plannedPercent')), React.createElement(GaugeChart, { value: enrichedProject.plannedProgress, label: "" })),
                React.createElement("div", { className: "chart-card" }, React.createElement("h4", null, t('actualPercent')), React.createElement(GaugeChart, { value: enrichedProject.actualProgress, label: "" })),
                React.createElement("div", { className: "chart-card" }, React.createElement("h4", null, t('performancePercentage')), React.createElement(GaugeChart, { value: enrichedProject.performance, label: "" })),
            ),
            // Details based on project type
            enrichedProject.type === 'waterfall' && rootNode && (
                React.createElement("div", { className: "form-section" },
                    React.createElement("h3", null, t('topLevelActivities')),
                    React.createElement("div", { className: "table-responsive" },
                        React.createElement("table", { className: "users-table" },
                            React.createElement("thead", null, React.createElement("tr", null,
                                React.createElement("th", { style: { width: '45px', textAlign: 'center' } }, language === 'fa' ? 'ردیف' : '#'),
                                React.createElement("th", null, t('activityName')),
                                React.createElement("th", null, t('startDate')),
                                React.createElement("th", null, t('endDate')),
                                React.createElement("th", null, t('weight')),
                                React.createElement("th", { style: { width: '12.5%' } }, t('plannedPercent')),
                                React.createElement("th", { style: { width: '12.5%' } }, t('actualPercent'))
                            )),
                            React.createElement("tbody", null,
                                rootNode.children?.map((activity, idx) => (
                                    React.createElement("tr", { key: activity.id },
                                        React.createElement("td", { style: { textAlign: 'center' } }, language === 'fa' ? toPersianDigits(idx + 1) : (idx + 1)),
                                        React.createElement("td", null, activity.name),
                                        React.createElement("td", null, formatDate(activity.startDate, language)),
                                        React.createElement("td", null, formatDate(activity.endDate, language)),
                                        React.createElement("td", null, language === 'fa' ? toPersianDigits(Math.round(activity.weight || 0)) : Math.round(activity.weight || 0)),
                                        React.createElement("td", null, `${language === 'fa' ? toPersianDigits(Math.round(activity.plannedProgress || 0)) : Math.round(activity.plannedProgress || 0)}%`),
                                        React.createElement("td", null, `${language === 'fa' ? toPersianDigits(Math.round(activity.actualProgress || 0)) : Math.round(activity.actualProgress || 0)}%`)
                                    )
                                ))
                            )
                        )
                    )
                )
            ),
            enrichedProject.type === 'agile' && (
                React.createElement("div", { className: "dashboard-stats-grid", style: { gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' } },
                    React.createElement(ProjectCountCard, { count: enrichedProject.totalTasks || 0, title: t('totalActivities') }),
                    React.createElement(ProjectCountCard, { count: enrichedProject.todoTasks || 0, title: t('todoCount') }),
                    React.createElement(ProjectCountCard, { count: enrichedProject.doingTasks || 0, title: t('doingCount') }),
                    React.createElement(ProjectCountCard, { count: enrichedProject.doneTasks || 0, title: t('doneCount') })
                )
            ),
            // Project Team
            enrichedProject.teamMemberIds && enrichedProject.teamMemberIds.length > 0 && (
                React.createElement("div", { className: "form-section" },
                    React.createElement("h3", null, t('projectTeam')),
                    React.createElement(ProjectTeamTab, { allUsers: users, teamMemberIds: enrichedProject.teamMemberIds, onSaveTeam: () => {}, isReadOnly: true })
                )
            ),
            // Project Risks
            (() => {
                const filteredRisks = getFilteredDashboardItems(enrichedProject.risks || [], 'risks');
                return filteredRisks.length > 0 && (
                    React.createElement("div", { className: "form-section" },
                        React.createElement("h3", null, t('projectRisks')),
                        React.createElement(ProjectRisksTab, { risks: filteredRisks, users: users, onEdit: () => {}, onDelete: () => {}, isReadOnly: true, hideApprovalStatus: true })
                    )
                );
            })(),
            // Project Stakeholders
            (() => {
                const filteredStakeholders = getFilteredDashboardItems(enrichedProject.stakeholders || [], 'stakeholders');
                return filteredStakeholders.length > 0 && (
                    React.createElement("div", { className: "form-section" },
                        React.createElement("h3", null, t('projectStakeholders')),
                        React.createElement(ProjectStakeholdersTab, { 
                            stakeholders: filteredStakeholders, 
                            users: users, 
                            onEdit: () => {}, 
                            onDelete: () => {}, 
                            isReadOnly: true, 
                            hideApprovalStatus: true 
                        })
                    )
                );
            })(),
            // Project Status
            (() => {
                const filteredStatus = getFilteredDashboardItems(enrichedProject.statusUpdates || [], 'status');
                return filteredStatus.length > 0 && (
                    React.createElement("div", { className: "form-section" },
                        React.createElement("h3", null, t('projectStatus')),
                        React.createElement(ProjectStatusTab, { statusUpdates: filteredStatus, users: users, onEdit: () => {}, onDelete: () => {}, isReadOnly: true, hideApprovalStatus: true })
                    )
                );
            })(),
            // Project Delay Reasons
            (() => {
                const filteredDelays = getFilteredDashboardItems(enrichedProject.delayReasons || [], 'delays');
                return filteredDelays.length > 0 && (
                    React.createElement("div", { className: "form-section" },
                        React.createElement("h3", null, language === 'fa' ? 'دلایل تاخیر' : 'Reasons for Delay'),
                        React.createElement(ProjectDelayReasonsTab, { delayReasons: filteredDelays, users: users, onEdit: () => {}, onDelete: () => {}, isReadOnly: true, hideApprovalStatus: true })
                    )
                );
            })(),
            // Project Documents
            (() => {
                const filteredDocs = getFilteredDashboardItems(enrichedProject.documents || [], 'docs');
                return filteredDocs.length > 0 && (
                    React.createElement("div", { className: "form-section" },
                        React.createElement("h3", null, t('projectDocuments')),
                        React.createElement(ProjectDocumentsTab, { documents: filteredDocs, users: users, onEdit: () => {}, onDelete: () => {}, isReadOnly: true, hideApprovalStatus: true })
                    )
                );
            })(),
            // Related Actions
            relatedActions.length > 0 && (
                React.createElement("div", { className: "form-section" },
                    React.createElement("h3", null, t('relatedActions')),
                    React.createElement(ProjectActionsTab, { projectId: project.id, actions: actions, users: users, onNavigate: onNavigate, isReadOnly: true })
                )
            ),
            // S-Curve Chart (Waterfall)
            project.type === 'waterfall' && (
                React.createElement(SCurveChartInline, { 
                    project: project, 
                    activities: project.schedule || [], 
                    calendar: pickCalendar(calendars, project.calendarId)! 
                })
            ),
            // Burn-up/down Chart (Agile)
            project.type === 'agile' && (
                React.createElement(AgileProgressChartInline, { 
                    project: project, 
                    progressUpdates: progressUpdates 
                })
            )
        )
    );
};

export const ScheduleSnapshotPage = ({ pageContext, onNavigate, users }: {
    pageContext: { snapshot: ScheduleSnapshot, calendar: Calendar, project: Project },
    onNavigate: (page: string, context?: any) => void,
    users: User[]
}) => {
    const { t, language } = useContext(LocalizationContext);
    const { snapshot, calendar, project } = pageContext;
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    const processedSchedule = useMemo(() => {
        const projectForCalc = { ...project, schedule: snapshot.schedule };
        const { rootNode } = calculateScheduleTreeAndProgress(projectForCalc, calendar, project.weightingType, project.plannedProgressType);
        return rootNode ? [rootNode] : [];
    }, [snapshot, calendar, project]);
    
    const renderTaskRows = (tasks: ProjectActivity[], level: number): ReactElement[] => {
        return tasks.flatMap(task => {
            const rows: ReactElement[] = [React.createElement("tr", { key: task.id, className: `task-row ${task.isParent ? 'parent-task summary-row' : 'child-task'}` },
                React.createElement("td", { style: { paddingInlineStart: `${level * 20 + 10}px` } },
                    React.createElement("div", { className: "task-name-cell" },
                        task.id === 'project-root' ? React.createElement("strong", null, task.name) : React.createElement("span", null, task.name)
                    )
                ),
                React.createElement("td", null, language === 'fa' ? toPersianDigits(task.duration || 0) : (task.duration || 0)),
                React.createElement("td", null, task.startDate ? formatDate(task.startDate, language) : ''),
                React.createElement("td", null, task.endDate ? formatDate(task.endDate, language) : ''),
                React.createElement("td", null, language === 'fa' ? toPersianDigits(Math.round(task.weight || 0)) : Math.round(task.weight || 0)),
                React.createElement("td", null, users.find(u => u.id === task.assignedToId)?.username || '-'),
                React.createElement("td", null,
                    task.id === 'project-root' ?
                        React.createElement(ProgressBar, { value: task.plannedProgress || 0, type: 'planned' }) :
                        `${language === 'fa' ? toPersianDigits(Math.round(task.plannedProgress || 0)) : Math.round(task.plannedProgress || 0)}%`
                ),
                React.createElement("td", null,
                    task.id === 'project-root' ?
                        React.createElement(ProgressBar, { value: task.actualProgress || 0, type: 'actual' }) :
                        `${language === 'fa' ? toPersianDigits(Math.round(task.actualProgress || 0)) : Math.round(task.actualProgress || 0)}%`
                )
            )];
            if(task.children) {
                rows.push(...renderTaskRows(task.children, level + 1));
            }
            return rows;
        });
    };
    
    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, `${t('viewScheduleSnapshot')}: ${snapshot.name}`),
                React.createElement("button", { onClick: () => onNavigate('create_waterfall_details', { project, type: 'waterfall' }), className: "back-button" } as React.HTMLAttributes<HTMLButtonElement>,
                    React.createElement("span", { className: "material-symbols-outlined" }, backIcon),
                    t('back')
                )
            ),
            React.createElement("div", { className: "schedule-table-container" },
                React.createElement("table", { className: "schedule-table" },
                    React.createElement("thead", null, React.createElement("tr", null,
                        React.createElement("th", { className: "th-name" }, t('activityName')),
                        React.createElement("th", { className: "th-short" }, t('durationDays')),
                        React.createElement("th", { className: "th-date" }, t('startDate')),
                        React.createElement("th", { className: "th-date" }, t('endDate')),
                        React.createElement("th", { className: "th-weight" }, t('weight')),
                        React.createElement("th", { className: "th-assign" }, t('assignedTo')),
                        React.createElement("th", { className: "th-progress" }, t('plannedPercent')),
                        React.createElement("th", { className: "th-progress" }, t('actualPercent')),
                    )),
                    React.createElement("tbody", null,
                        processedSchedule.length > 0 && renderTaskRows(processedSchedule, 0)
                    )
                )
            )
        )
    );
};

export const ActionDashboardPage = ({ actions, users, onNavigate, owningUnits, projectStatuses }: {
    actions: ActionItem[];
    users: User[];
    onNavigate: (page: string, context?: any) => void;
    owningUnits: string[];
    projectStatuses: string[];
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [nameFilter, setNameFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [unitFilter, setUnitFilter] = useState('');
    const [responsibleUserFilter, setResponsibleUserFilter] = useState('');

    const [groupBy, setGroupBy] = useState<'none' | 'owningUnit' | 'status' | 'responsible'>('owningUnit');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    const unitFilterOptions = useMemo(() => Array.from(new Set(owningUnits.map(u => getUnitLevel1And2(u)).filter(Boolean))), [owningUnits]);

    const responsibleUsers = useMemo(() => {
        const userIds = new Set(actions.map(a => a.responsibleUserId));
        return users.filter(u => userIds.has(u.id));
    }, [actions, users]);

    const filteredActions = useMemo(() => {
        return actions.filter(a => {
            const nameMatch = nameFilter ? a.title.toLowerCase().includes(nameFilter.toLowerCase()) : true;
            const statusMatch = statusFilter ? a.status === statusFilter : true;
            const unitMatch = unitFilter ? getUnitLevel1And2(a.owningUnit) === unitFilter : true;
            const responsibleMatch = responsibleUserFilter ? a.responsibleUserId === responsibleUserFilter : true;
            return nameMatch && statusMatch && unitMatch && responsibleMatch;
        });
    }, [nameFilter, statusFilter, unitFilter, responsibleUserFilter, actions]);

    const totalActionsCount = filteredActions.length;
    const inProgressActionsCount = filteredActions.filter(a => a.status === 'In Progress').length;
    const planningActionsCount = filteredActions.filter(a => a.status === 'Planning').length;

    const statusTranslations: Record<string, TranslationKey> = {
        'Planning': 'planning', 'In Progress': 'inProgress', 'On Hold': 'onHold', 'Completed': 'completed'
    };
    
    const statusChartData = useMemo(() => {
        const statusColorMap: Record<string, string> = { 
            'Planning': '#F59E0B', 
            'In Progress': '#2563EB', 
            'On Hold': '#9333EA', 
            'Completed': '#10B981' 
        };
        const counts = filteredActions.reduce((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(counts).map(([status, value]) => ({ name: t(statusTranslations[status] || status as any), value, color: statusColorMap[status] || 'var(--inactive-color)' }));
    }, [filteredActions, t]);

    const responsibleChartData = useMemo(() => {
        const counts = filteredActions.reduce((acc, a) => {
            const userId = a.responsibleUserId || 0;
            acc[userId] = (acc[userId] || 0) + 1;
            return acc;
        }, {} as Record<number, number>);
        const colors = ['#6366F1', '#10B981', '#EC4899', '#F59E0B', '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6', '#3B82F6', '#E11D48', '#84CC16', '#A855F7'];
        return Object.entries(counts).map(([userId, value], index) => {
            const user = users.find(u => u.id === userId);
            return { name: user?.username || t('unassigned'), value, color: colors[index % colors.length] };
        });
    }, [filteredActions, users, t]);
    
    const unitChartData = useMemo(() => {
        const counts = filteredActions.reduce((acc, a) => {
            const u = getUnitLevel1And2(a.owningUnit) || (language === 'fa' ? 'بدون واحد' : 'Unassigned');
            acc[u] = (acc[u] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1', '#E11D48', '#84CC16', '#A855F7'];
        return Object.entries(counts).map(([label, value], index) => ({
            name: label,
            value,
            color: colors[index % colors.length]
        }));
    }, [filteredActions, language]);

    const groupedActions = useMemo(() => {
        if (groupBy === 'none') return [];
        const map = new Map<string, ActionItem[]>();
        filteredActions.forEach(a => {
            let key = '';
            if (groupBy === 'owningUnit') key = getUnitLevel1And2(a.owningUnit) || (language === 'fa' ? 'بدون واحد' : 'Unassigned');
            else if (groupBy === 'status') key = t(statusTranslations[a.status as WorkStatus] || (a.status as any));
            else if (groupBy === 'responsible') {
                const u = users.find(usr => usr.id === a.responsibleUserId);
                key = u?.username || (language === 'fa' ? 'تعیین نشده' : 'Unassigned');
            }

            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(a);
        });

        return Array.from(map.entries()).map(([groupTitle, items]) => {
            const inProgressCount = items.filter(i => i.status === 'In Progress').length;
            const completedCount = items.filter(i => i.status === 'Completed').length;
            return { groupTitle, items, inProgressCount, completedCount };
        });
    }, [filteredActions, groupBy, users, t, language]);

    return React.createElement("div", { className: "content-container" },
        React.createElement("div", { className: "page-header" },
            React.createElement("h2", null, t('overallActionDashboard')),
            React.createElement("button", {
                type: "button",
                className: `filter-toggle-btn ${isFilterOpen ? 'active' : ''}`,
                onClick: () => setIsFilterOpen(!isFilterOpen)
            },
                React.createElement("span", { className: "material-symbols-outlined" }, "tune"),
                React.createElement("span", null, language === 'fa' ? 'فیلترها' : 'Filters'),
                React.createElement("span", { className: "material-symbols-outlined expand-arrow" }, isFilterOpen ? "expand_less" : "expand_more")
            )
        ),
        isFilterOpen && React.createElement("div", { className: "dashboard-filters" },
            React.createElement("div", { className: "form-group" },
                React.createElement("label", { htmlFor: "actionNameFilter" }, t('filterByActionName')),
                React.createElement("input", { type: "text", id: "actionNameFilter", value: nameFilter, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNameFilter(e.target.value), placeholder: t('filterByActionName') })
            ),
            React.createElement("div", { className: "form-group" },
                React.createElement("label", { htmlFor: "actionStatusFilter" }, t('status')),
                React.createElement("select", { id: "actionStatusFilter", value: statusFilter, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value) },
                    React.createElement("option", { value: "" }, t('allStatuses')),
                    Object.keys(statusTranslations).map(statusKey => React.createElement("option", { key: statusKey, value: statusKey }, t(statusTranslations[statusKey as WorkStatus])))
                )
            ),
            React.createElement("div", { className: "form-group unit-filter-group" },
                React.createElement("label", { htmlFor: "actionUnitFilter" }, t('owningUnit')),
                React.createElement("select", { id: "actionUnitFilter", value: unitFilter, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setUnitFilter(e.target.value) },
                    React.createElement("option", { value: "" }, t('allUnits')),
                    unitFilterOptions.map(unit => React.createElement("option", { key: unit, value: unit }, unit))
                )
            )
        ),
        React.createElement("div", { className: "dashboard-stats-grid", style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
            React.createElement("div", { className: "chart-card" },
                React.createElement(ProjectCountCard, { count: totalActionsCount, title: t('totalActions') })
            ),
            React.createElement("div", { className: "chart-card" },
                React.createElement(ProjectCountCard, { count: inProgressActionsCount, title: t('inProgressActions') })
            ),
            React.createElement("div", { className: "chart-card" },
                React.createElement(ProjectCountCard, { count: planningActionsCount, title: t('planningActions') })
            )
        ),
        React.createElement("div", { className: "dashboard-stats-grid" },
            React.createElement(SwitchableChartCard, { title: t('actionsByStatus'), data: statusChartData }),
            React.createElement(SwitchableChartCard, { title: t('actionsByResponsible'), data: responsibleChartData }),
            React.createElement(SwitchableChartCard, { title: t('actionsByOwningUnit'), data: unitChartData })
        ),

        // Grouping Toolbar for Actions
        React.createElement("div", { className: "grouping-toolbar" },
            React.createElement("div", { className: "grouping-control" },
                React.createElement("label", null,
                    React.createElement("span", { className: "material-symbols-outlined" }, "schema"),
                    language === 'fa' ? 'گروه‌بندی سبد اقدامات بر اساس:' : 'Group Actions By:'
                ),
                React.createElement("select", { value: groupBy, onChange: (e) => setGroupBy(e.target.value as any) },
                    React.createElement("option", { value: "owningUnit" }, t('owningUnit')),
                    React.createElement("option", { value: "status" }, t('status')),
                    React.createElement("option", { value: "responsible" }, t('responsiblePerson')),
                    React.createElement("option", { value: "none" }, language === 'fa' ? 'بدون گروه‌بندی (جدول ساده)' : 'Flat Table View')
                )
            ),
            React.createElement("div", { className: "group-pill highlight" },
                React.createElement("span", { className: "material-symbols-outlined" }, "checklist"),
                `${filteredActions.length} ${t('totalActions')}`
            )
        ),

        // Render Grouped Accordion Cards for Actions
        groupBy !== 'none' ? (
            React.createElement("div", { className: "grouped-actions-container" },
                groupedActions.map(grp => (
                    React.createElement("div", {
                        key: grp.groupTitle,
                        className: `group-accordion-card ${expandedGroups[grp.groupTitle] === true ? 'open' : ''}`
                    },
                        React.createElement("div", {
                            className: "group-header",
                            onClick: () => setExpandedGroups(prev => ({ ...prev, [grp.groupTitle]: !prev[grp.groupTitle] }))
                        },
                            React.createElement("div", { className: "group-title-area" },
                                React.createElement("div", { className: "group-icon-badge" },
                                    React.createElement("span", { className: "material-symbols-outlined" },
                                        groupBy === 'owningUnit' ? "domain" :
                                        groupBy === 'status' ? "task_alt" : "person"
                                    )
                                ),
                                React.createElement("div", null,
                                    React.createElement("div", { className: "group-title-text" }, grp.groupTitle),
                                    React.createElement("div", { className: "group-stats-pills" },
                                        React.createElement("span", { className: "group-pill" }, `${grp.items.length} ${t('totalActions')}`),
                                        React.createElement("span", { className: "group-pill highlight" }, `${grp.inProgressCount} ${t('inProgress')}`),
                                        React.createElement("span", { className: "group-pill cost" }, `${grp.completedCount} ${t('completed')}`)
                                    )
                                )
                            ),
                            React.createElement("div", { className: "group-toggle-icon" },
                                React.createElement("span", { className: "material-symbols-outlined" }, "expand_more")
                            )
                        ),

                        expandedGroups[grp.groupTitle] === true && React.createElement("div", { className: "group-content" },
                            React.createElement("div", { className: "table-responsive" },
                                React.createElement("table", { className: "users-table dashboard-table" },
                                    React.createElement("thead", null, React.createElement("tr", null,
                                        React.createElement("th", null, t('actionTitleColumn')),
                                        React.createElement("th", null, t('responsiblePerson')),
                                        React.createElement("th", null, t('owningUnit')),
                                        React.createElement("th", null, t('startDate')),
                                        React.createElement("th", null, t('endDate')),
                                        React.createElement("th", null, t('status')),
                                        React.createElement("th", { className: "th-actions no-print" }, t('actions'))
                                    )),
                                    React.createElement("tbody", null,
                                        grp.items.map(action => {
                                            const responsibleUser = users.find(u => u.id === action.responsibleUserId);
                                            return React.createElement("tr", { key: action.id },
                                                React.createElement("td", null, action.title),
                                                React.createElement("td", null, responsibleUser?.username || 'N/A'),
                                                React.createElement("td", null, action.owningUnit),
                                                React.createElement("td", null, formatDate(action.startDate, language)),
                                                React.createElement("td", null, formatDate(action.endDate, language)),
                                                React.createElement("td", null, React.createElement("span", { className: `project-status-badge status-${action.status.toLowerCase().replace(/ /g, '-')}` }, t(statusTranslations[action.status as WorkStatus] || (action.status as any)))),
                                                React.createElement("td", { className: "action-cell no-print" },
                                                    React.createElement("button", { onClick: () => onNavigate('define_action', { action, from: 'action_dashboard' }), className: "action-icon edit", "aria-label": t('edit') }, React.createElement("span", { className: "material-symbols-outlined" }, "edit"))
                                                )
                                            );
                                        })
                                    )
                                )
                            )
                        )
                    )
                ))
            )
        ) : (
            React.createElement("div", { className: "form-section" },
                React.createElement("h3", null, t('actionsGroup')),
                React.createElement("div", { className: "table-responsive" },
                    React.createElement("table", { className: "users-table dashboard-table" },
                        React.createElement("thead", null, React.createElement("tr", null,
                            React.createElement("th", null, t('actionTitleColumn')),
                            React.createElement("th", null, t('responsiblePerson')),
                            React.createElement("th", null, t('owningUnit')),
                            React.createElement("th", null, t('startDate')),
                            React.createElement("th", null, t('endDate')),
                            React.createElement("th", null, t('status')),
                            React.createElement("th", { className: "th-actions no-print" }, t('actions'))
                        )),
                        React.createElement("tbody", null,
                            filteredActions.length > 0 ? (
                                filteredActions.map(action => {
                                    const responsibleUser = users.find(u => u.id === action.responsibleUserId);
                                    return React.createElement("tr", { key: action.id },
                                        React.createElement("td", null, action.title),
                                        React.createElement("td", null, responsibleUser?.username || 'N/A'),
                                        React.createElement("td", null, action.owningUnit),
                                        React.createElement("td", null, formatDate(action.startDate, language)),
                                        React.createElement("td", null, formatDate(action.endDate, language)),
                                        React.createElement("td", null, React.createElement("span", { className: `project-status-badge status-${action.status.toLowerCase().replace(/ /g, '-')}` }, t(statusTranslations[action.status as WorkStatus] || (action.status as any)))),
                                        React.createElement("td", { className: "action-cell no-print" },
                                            React.createElement("button", { onClick: () => onNavigate('define_action', { action, from: 'action_dashboard' }), className: "action-icon edit", "aria-label": t('edit') }, React.createElement("span", { className: "material-symbols-outlined" }, "edit"))
                                        )
                                    )
                                })
                            ) : (
                                React.createElement("tr", null, React.createElement("td", { colSpan: 7, style: { textAlign: 'center' } }, t('noActionsAssigned')))
                            )
                        )
                    )
                )
            )
        )
    );
};