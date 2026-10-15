

import React, { useState, useContext, useEffect, useMemo } from 'react';
import { initialDelegations } from './data';
import { AuthProvider, useAuth } from './directory/AuthContext';
import { DirectoryProvider, useDirectory } from './directory/DirectoryContext';
import { ProjectsProvider, useProjects, localPartsOf } from './directory/ProjectsContext';
import { ActionsProvider, useActions } from './directory/ActionsContext';
import { StrategyProvider, useStrategy } from './directory/StrategyContext';
import { projectErrorText } from './services/backend/errors';
import type { ProjectOutcome } from './directory/ProjectsContext';
import { toUiUser } from './services/backend/mappers';

import { 
    User, Project, ProjectType, ProjectRisk, ProjectStatusUpdate, ProjectDocument, 
    ProjectActivity, KanbanTask, Calendar, ProjectApprovalStatus, ProjectApprovalRecord, 
    EnrichedProject, ProgressUpdateStatus, ProgressUpdate, EnrichedTask, Strategy, 
    AlignmentLevel, ProjectStrategyAlignment, KnowledgeDocumentType, SpecificHoliday, TaskPriority, KanbanStatus,
    UserRole,
    ActionItem,
    WorkStatus,
    PROJECT_WORK_STATUSES,
    KnowledgeDocument,
    Delegation,
    VisibilitySettings,
    DynamicWorkflowSettings,
    DEFAULT_DYNAMIC_WORKFLOW_SETTINGS,
    resolveWorkflowApproverId,
    getEffectiveProjectWorkflowStages
} from './types';
import { enrichProjectWithProgress, pickCalendar, getISODateString, getISODateTimeString, calculateScheduleTreeAndProgress, isActionVisibleToUser, toPersianDigits } from './utils';
import { LocalizationProvider, LocalizationContext, ThemeProvider } from './context';
import { LoginPage, MainMenu, SettingsPage } from './pages/CorePages';
import { UserManagementPage, TaskCenterPage, ApprovalCenterPage } from './pages/UserAndTaskPages';
import { CalendarManagementPage, EditCalendarPage, StrategyManagementHubPage, DefineStrategiesPage, AlignmentMatrixPage, ColorFormatPage, KnowledgeManagementPage, ReferenceTablesPage } from './pages/AdvancedPages';
import { ActionDefinitionPage } from './pages/ActionPages';
import { 
    CreateProjectPage, ProjectDetailsPage, ProjectPortfolioPage, 
    DeleteProjectsPage, ProjectDashboardPage, ProjectSpecificDashboardPage,
    DashboardHubPage,
    ScheduleSnapshotPage,
    ActionDashboardPage
} from './pages/ProjectPages';
import { ReportsDashboardPage } from './pages/ReportsPages';
import { Header, Footer, Sidebar } from './components/Core';
import { ApprovalCommentModal, InfoModal } from './components/Modals';
import { AiChatbot } from './components/AiChatbot';


const AppContent = () => {
    const { t, language } = useContext(LocalizationContext);

    // --- STATE MANAGEMENT ---
    // People, work calendars and the organisation chart belong to the backend: this screen only reads them and asks for changes.
    const auth = useAuth();
    const directory = useDirectory();
    const users = directory.users;
    const calendars = directory.calendars;
    const owningUnits = directory.unitPaths;
    const unitNodes = directory.unitNodes;

    // Projects belong to the backend too (charter, people, unit, calendar, dates, status, team, approval state).
    // The parts of a project that are not connected yet (risks, schedule, documents ...) ride along inside it via setProjects.
    const projectsState = useProjects();
    const projects = projectsState.projects;
    const setProjects = projectsState.setProjects;

    // Actions and the requests to change their status belong to the backend (with their approval).
    const actionsState = useActions();
    const actions = actionsState.actions;

    // Strategies, the project-strategy alignment and the knowledge library belong to the backend.
    const strategyState = useStrategy();
    const strategies = strategyState.strategies;
    const alignments = strategyState.alignments;
    const knowledgeDocuments = strategyState.knowledgeDocuments;

    // Progress reports on activities and status requests on agile tasks belong to the backend (with their approval); the ones that are not
    // connected yet (action status, risk response, charter changes) are still kept in this browser.
    const [localProgressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>(() => {
        try {
            const saved = localStorage.getItem('pms_progress_updates');
            const kept: ProgressUpdate[] = saved ? JSON.parse(saved) : [];
            return kept.filter(up => !up.activityId && !up.taskId && !up.actionId).map(up => ({ ...up, id: String(up.id) }));
        } catch (e) {
            console.error("Failed to parse progress updates from localStorage", e);
            localStorage.removeItem('pms_progress_updates');
            return [];
        }
    });
    const progressUpdates = useMemo(
        () => [...projectsState.progressUpdates, ...actionsState.updates, ...localProgressUpdates],
        [projectsState.progressUpdates, actionsState.updates, localProgressUpdates]);

    
    // The work statuses are the backend's fixed set (it moves a project between them); they are not editable here.
    const projectStatuses: string[] = PROJECT_WORK_STATUSES;
    
    const [delegations, setDelegations] = useState<Delegation[]>(() => {
        try {
            const saved = localStorage.getItem('pms_delegations');
            return saved ? JSON.parse(saved) : initialDelegations;
        } catch (e) {
            console.error("Failed to parse delegations from localStorage", e);
            localStorage.removeItem('pms_delegations');
            return initialDelegations;
        }
    });

    const [visibilitySettings, setVisibilitySettings] = useState<VisibilitySettings>(() => {
        try {
            const saved = localStorage.getItem('pms_visibility_settings');
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return {
            viewByOwner: true,
            viewByManagerOrResponsible: true,
            viewByApprovers: true,
            viewByResources: true,
            viewByOrgHeads: true,
        };
    });

    const [isProjectWorkflowEnabled, setIsProjectWorkflowEnabled] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('pms_project_workflow_enabled');
            return saved !== 'false';
        } catch (e) {
            return true;
        }
    });

    const [allowApprovedProgress, setAllowApprovedProgress] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('pms_allow_approved_progress');
            return saved === 'true';
        } catch (e) {
            return false;
        }
    });

    useEffect(() => {
        localStorage.setItem('pms_allow_approved_progress', String(allowApprovedProgress));
    }, [allowApprovedProgress]);

    const [dynamicWorkflowSettings, setDynamicWorkflowSettings] = useState<DynamicWorkflowSettings>(() => {
        try {
            const saved = localStorage.getItem('pms_dynamic_workflow_settings');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {}
        return DEFAULT_DYNAMIC_WORKFLOW_SETTINGS;
    });

    useEffect(() => {
        try {
            localStorage.setItem('pms_dynamic_workflow_settings', JSON.stringify(dynamicWorkflowSettings));
        } catch (e) {}
    }, [dynamicWorkflowSettings]);

    const [defaultProjectApproverId, setDefaultProjectApproverId] = useState<string | null>(() => {
        try {
            const saved = localStorage.getItem('pms_default_project_approver_id');
            if (saved) return saved;
        } catch (e) {}
        return null;
    });

    // The signed-in person as the directory shows them (with their unit), until the directory has loaded: just what the session says.
    const currentUser: User | null = useMemo(
        () => auth.session ? (users.find(u => u.id === auth.session!.user.id) ?? toUiUser(auth.session.user, new Map())) : null,
        [auth.session, users]
    );
    const [page, setPage] = useState('dashboard');
    const [pageContext, setPageContext] = useState<any>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [infoModal, setInfoModal] = useState<{title: string, message: string} | null>(null);
    const [approvalCommentModalState, setApprovalCommentModalState] = useState<{ type: 'project' | 'progress', id: number, status: 'Approved' | 'Rejected', initialComment?: string } | null>(null);

    // --- DATA PERSISTENCE ---
    useEffect(() => { localStorage.setItem('pms_progress_updates', JSON.stringify(localProgressUpdates)); }, [localProgressUpdates]);
    useEffect(() => { localStorage.setItem('pms_delegations', JSON.stringify(delegations)); }, [delegations]);
    useEffect(() => { localStorage.setItem('pms_visibility_settings', JSON.stringify(visibilitySettings)); }, [visibilitySettings]);
    useEffect(() => { localStorage.setItem('pms_project_workflow_enabled', String(isProjectWorkflowEnabled)); }, [isProjectWorkflowEnabled]);
    useEffect(() => {
        if (defaultProjectApproverId) {
            localStorage.setItem('pms_default_project_approver_id', String(defaultProjectApproverId));
        }
    }, [defaultProjectApproverId]);
    


    // --- NOTIFICATION COUNTS ---
    const allProcessedActivities = useMemo(() => {
        const activityMap = new Map<string, ProjectActivity>();
        projects.forEach(p => {
            if (p.schedule && p.schedule.length > 0) {
                const projectCalendar = pickCalendar(calendars, p.calendarId);
                if (!projectCalendar) return; // the calendars have not been loaded yet
                const { rootNode } = calculateScheduleTreeAndProgress(p, projectCalendar);

                const flattenActivities = (node: ProjectActivity) => {
                    if (node.id !== 'project-root') {
                       activityMap.set(node.id, node);
                    }
                    if (node.children) {
                        node.children.forEach(flattenActivities);
                    }
                };
                if(rootNode) flattenActivities(rootNode);
            }
        });
        return activityMap;
    }, [projects, calendars]);

    const overdueProjectsCount = useMemo(() => {
        if (!currentUser) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const visibleProjects = projects.filter(p => {
            if (p.approvalStatus !== 'Approved') return false;
            if (currentUser.role === 'Admin') return true;
            if (currentUser.role === 'Project Manager') return p.projectManagerId === currentUser.id;
            if (currentUser.role === 'Project Team') return p.teamMemberIds.includes(currentUser.id);
            return false;
        });

        return visibleProjects.filter(p => {
            const endDate = new Date(p.endDate);
            return endDate < today && p.status !== 'Completed';
        }).length;
    }, [projects, currentUser]);

    const pendingApprovalsCount = useMemo(() => {
        if (!currentUser) return 0;
    
        const itemsForCurrentUser = progressUpdates.filter(up => 
            up.status === 'Pending Approval' && up.currentApproverId === currentUser.id
        ).length;
    
        const projectApprovals = projects.filter(p => 
            p.approvalStatus === 'Pending Approval' && 
            (p.approver1Id ? String(p.approver1Id) === String(currentUser.id) : currentUser.role === 'Admin')
        ).length;

        let pendingTabItemsCount = 0;
        projects.forEach(p => {
            (p.risks || []).forEach(r => {
                if (!r.isApproved && !r.isRejected) {
                    const stages = getEffectiveProjectWorkflowStages('risks', p, dynamicWorkflowSettings);
                    const currentStageIdx = r.currentStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = r.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);
                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        pendingTabItemsCount++;
                    }
                }
                if (r.isApproved && r.verificationStatus === 'Pending Approval') {
                    const stages = getEffectiveProjectWorkflowStages('risks', p, dynamicWorkflowSettings);
                    const currentStageIdx = r.verificationStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = r.verificationApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);
                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        pendingTabItemsCount++;
                    }
                }
            });

            (p.stakeholders || []).forEach(sh => {
                if (!sh.isApproved && !sh.isRejected) {
                    const stages = getEffectiveProjectWorkflowStages('stakeholders', p, dynamicWorkflowSettings);
                    const currentStageIdx = sh.currentStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = sh.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);
                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        pendingTabItemsCount++;
                    }
                }
            });

            (p.statusUpdates || []).forEach(s => {
                if (!s.isApproved && !s.isRejected) {
                    const stages = getEffectiveProjectWorkflowStages('status_updates', p, dynamicWorkflowSettings);
                    const currentStageIdx = s.currentStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = s.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);
                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        pendingTabItemsCount++;
                    }
                }
            });

            (p.delayReasons || []).forEach(d => {
                if (!d.isApproved && !d.isRejected) {
                    const stages = getEffectiveProjectWorkflowStages('delay_reasons', p, dynamicWorkflowSettings);
                    const currentStageIdx = d.currentStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = d.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);
                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        pendingTabItemsCount++;
                    }
                }
            });

            (p.documents || []).forEach(doc => {
                if (!doc.isApproved && !doc.isRejected) {
                    const stages = getEffectiveProjectWorkflowStages('documents', p, dynamicWorkflowSettings);
                    const currentStageIdx = doc.currentStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = doc.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);
                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        pendingTabItemsCount++;
                    }
                }
            });
        });
    
        return itemsForCurrentUser + projectApprovals + pendingTabItemsCount;
    }, [progressUpdates, projects, currentUser, dynamicWorkflowSettings]);

    const taskCenterNotificationCount = useMemo(() => {
        if (!currentUser) return 0;
    
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const notifiedTaskIds = new Set<string>();
    
        // Waterfall tasks
        projects
            .filter(p => p.approvalStatus === 'Approved' && p.type === 'waterfall' && p.schedule)
            .forEach(p => {
                p.schedule!.forEach(activity => {
                    if (activity.assignedToId !== currentUser.id) return;
                    
                    const processedActivity = allProcessedActivities.get(activity.id);
                    if (!processedActivity || processedActivity.isParent) return;
    
                    const hasPendingUpdate = progressUpdates.some(up =>
                        up.activityId === activity.id &&
                        up.projectId === p.id &&
                        up.status === 'Pending Approval'
                    );
                    if (hasPendingUpdate) return;
                    
                    const isNew = (processedActivity.actualProgress || 0) === 0;
                    const isOverdue = processedActivity.endDate && new Date(processedActivity.endDate) < today && (processedActivity.actualProgress || 0) < 100;
    
                    if (isNew || isOverdue) {
                        notifiedTaskIds.add(`w-${activity.id}`);
                    }
                });
            });
    
        // Agile tasks
        projects
            .filter(p => p.approvalStatus === 'Approved' && p.type === 'agile' && p.kanbanTasks)
            .forEach(p => {
                p.kanbanTasks!.forEach(task => {
                    if (task.assignedToId !== currentUser.id) return;
                    
                    const hasPendingUpdate = progressUpdates.some(up =>
                        up.taskId === task.id &&
                        up.projectId === p.id &&
                        up.status === 'Pending Approval'
                    );
                    if (hasPendingUpdate) return;
                    
                    const isNew = task.status === 'To-Do';
                    const isOverdue = task.dueDate && new Date(task.dueDate) < today && task.status !== 'Done';
                    
                    if (isNew || isOverdue) {
                        notifiedTaskIds.add(`a-${task.id}`);
                    }
                });
            });
    
        // Actions
        actions.forEach(action => {
            if (action.responsibleUserId !== currentUser.id) return;
            
            const hasPendingUpdate = progressUpdates.some(up =>
                up.actionId === action.id &&
                up.status === 'Pending Approval'
            );
            if (hasPendingUpdate) return;
            
            const isNew = action.status === 'Planning';
            const isOverdue = action.endDate && new Date(action.endDate) < today && action.status !== 'Completed';
            
            if (isNew || isOverdue) {
                notifiedTaskIds.add(`act-${action.id}`);
            }
        });
    
        return notifiedTaskIds.size;
    }, [projects, actions, currentUser, progressUpdates, allProcessedActivities]);

    // The backend only sends the projects this user may see, so there is nothing to filter here.
    const visibleProjectsForCurrentUser = projects;

    const visibleActionsForCurrentUser = useMemo(() => {
        if (!currentUser) return [];
        return actions.filter(a => isActionVisibleToUser(a, currentUser, visibilitySettings, users, unitNodes));
    }, [actions, currentUser, visibilitySettings, users, unitNodes]);


    // --- NAVIGATION ---
    const handleNavigate = (targetPage: string, context: any = null) => {
        setPage(targetPage);
        setPageContext(context);
    };

    // --- AUTHENTICATION ---
    const handleLogin = async (username: string, password: string, captchaAnswer?: string): Promise<void> => {
        const outcome = await auth.signIn(username, password, captchaAnswer);
        if (outcome.ok) {
            setLoginError(null);
            setPage('dashboard');
        } else {
            setLoginError(outcome.message ?? t('loginErrorInvalid'));
        }
    };

    const handleLogout = (): void => {
        void auth.signOut();
        setPage('login');
    };

    // --- PROJECT & TASK HANDLERS ---
    /** The backend's error code wins over its (English) text where the screens have their own wording. */
    const projectFailureMessage = (outcome: ProjectOutcome): string =>
        projectErrorText({ code: outcome.code ?? '', message: outcome.message || t('error') }, language, t('projectNameExists'));

    const handleSaveProject = async (project: Project, mode: 'draft' | 'sent') => {
        const outcome = await projectsState.saveProject(project, mode === 'sent');
        if (!outcome.ok) {
            setInfoModal({ title: t('error'), message: projectFailureMessage(outcome) });
            if (outcome.project) handleNavigate('portfolio');
            return;
        }

        if (mode === 'draft') {
            setInfoModal({ title: t('saveProject'), message: t('projectSavedAsDraft') });
        } else if (outcome.project?.approvalStatus === 'Approved') {
            setInfoModal({
                title: t('saveProject'),
                message: language === 'fa'
                    ? 'پروژه با موفقیت ایجاد و فعال گردید.'
                    : 'Project has been successfully created and activated.'
            });
        } else {
            setInfoModal({ title: t('sendForApproval'), message: t('projectSubmittedForApproval') });
        }
        handleNavigate('portfolio');
    };

    const handleUpdateProject = async (project: Project, mode: 'draft' | 'sent', stayOnPage?: boolean) => {
        const outcome = await projectsState.updateProject(project, mode === 'sent');
        if (!outcome.ok) {
            setInfoModal({ title: t('error'), message: projectFailureMessage(outcome) });
            return;
        }

        if (mode === 'sent') {
            setInfoModal(outcome.project?.approvalStatus === 'Approved'
                ? { title: t('updateProject'), message: language === 'fa' ? 'پروژه با موفقیت فعال گردید.' : 'Project has been successfully activated.' }
                : { title: t('sendForApproval'), message: t('projectSubmittedForApproval') });
        } else {
            setInfoModal({ title: t('updateProject'), message: t('projectUpdatedSuccess') });
        }

        if (!stayOnPage) {
            handleNavigate('portfolio');
        }
    };

    // A screen hands back its whole copy of the project; only the parts the backend does not hold are taken from it (the rest would be stale).
    const handlePartialUpdateProject = (updatedProject: Project) => {
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? { ...p, ...localPartsOf(updatedProject) } : p));
    };

    /** The AI assistant hands back a whole project: its other parts stay as they were, what it added to the registers is saved on the backend. */
    const handleAssistantProjectUpdate = (updatedProject: Project) => {
        const before = projects.find(p => p.id === updatedProject.id);
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? { ...updatedProject, risks: p.risks, stakeholders: p.stakeholders, statusUpdates: p.statusUpdates, delayReasons: p.delayReasons, documents: p.documents, schedule: p.schedule, kanbanTasks: p.kanbanTasks } : p));
        if (!before) return;
        // New activities / tasks the assistant added are created on the backend (which then calculates the schedule); the lists shown come back from it.
        const reportFailure = (outcome: { ok: boolean; message?: string }) => {
            if (!outcome.ok) setInfoModal({ title: t('error'), message: outcome.message || t('error') });
        };
        const knownActivities = new Set((before.schedule ?? []).map(a => a.id));
        const newActivities = (updatedProject.schedule ?? []).filter(a => !knownActivities.has(a.id));
        if (updatedProject.type === 'waterfall' && newActivities.length) {
            void projectsState.saveActivities(before.id, newActivities, false).then(reportFailure);
        }
        const knownTasks = new Set((before.kanbanTasks ?? []).map(k => k.id));
        const newTasks = (updatedProject.kanbanTasks ?? []).filter(k => !knownTasks.has(k.id));
        if (updatedProject.type === 'agile' && newTasks.length) {
            void projectsState.saveKanbanTasks(before.id, newTasks, false).then(reportFailure);
        }
        const shown = enrichProjectWithProgress(updatedProject, calendars);
        void projectsState.syncRegisters(before.id, before, updatedProject, { planned: shown.plannedProgress, actual: shown.actualProgress }).then(outcome => {
            if (!outcome.ok) setInfoModal({ title: t('error'), message: outcome.message || t('error') });
        });
    };

    const handleDeleteProject = async (projectId: string) => {
        const outcome = await projectsState.deleteProject(projectId);
        if (!outcome.ok) {
            setInfoModal({ title: t('error'), message: outcome.message || t('error') });
        }
    };

    const handleDeleteAction = async (actionId: string) => {
        const outcome = await actionsState.deleteAction(actionId);
        if (!outcome.ok) setInfoModal({ title: t('error'), message: actionFailureMessage(outcome) });
    };

    /** The backend's words for an action it refused (for example an end date that is not after the start). */
    const actionFailureMessage = (outcome: { message?: string; code?: string }) =>
        outcome.code === 'action.end_not_after_start'
            ? (language === 'fa' ? 'تاریخ پایان اقدام باید بعد از تاریخ شروع آن باشد.' : 'The action must end after it starts.')
            : outcome.message || t('error');

    /** An action the AI assistant drafted: the calendar and unit it picked are replaced by ones that exist when they do not. */
    const handleAssistantAddAction = (drafted: ActionItem) => {
        const calendar = calendars.find(c => c.id === drafted.calendarId) ?? calendars.find(c => c.isDefault) ?? calendars[0];
        const unit = directory.unitIdByPath.has(drafted.owningUnit) ? drafted.owningUnit : directory.unitPaths[0] ?? drafted.owningUnit;
        void handleSaveAction({ ...drafted, id: '', calendarId: calendar?.id ?? drafted.calendarId, owningUnit: unit });
    };

    const handleSaveAction = async (actionToSave: ActionItem, context?: any) => {
        const isNew = !actionToSave.id;
        const outcome = await actionsState.saveAction(actionToSave);
        if (!outcome.ok) {
            setInfoModal({ title: t('error'), message: actionFailureMessage(outcome) });
            return;
        }

        setInfoModal(isNew
            ? { title: t('actionSaved'), message: t('actionSavedAndAssigned') }
            : { title: t('actionSaved'), message: t('actionSaved') });

        if (context?.fromProject) {
            const projectToReturnTo = projects.find(p => p.id === context.fromProject);
            if (projectToReturnTo) {
                const page = `create_${projectToReturnTo.type}_details`;
                handleNavigate(page, { 
                    project: projectToReturnTo, 
                    type: projectToReturnTo.type, 
                    initialTab: 'actions' 
                });
                return;
            }
        }
        
        if (context?.noNavigate) {
            return;
        }

        handleNavigate('main');
    };

    /** A team member reports how far an activity has got; the backend sends it for approval (or confirms it at once when nothing is configured). */
    const handleAddProgressUpdate = async (projectId: string, activityId: string, progress: number, submissionComment: string, documentName?: string) => {
        const outcome = await projectsState.submitActivityProgress(projectId, activityId, progress, submissionComment, documentName);
        setInfoModal(outcome.ok
            ? { title: t('submitForApproval'), message: t('progressUpdated') }
            : { title: t('error'), message: outcome.message || t('error') });
    };

    /** Asks for an agile task to move to another column; the backend sends the request for approval (or moves it at once when nothing is configured). */
    const handleAddKanbanStatusUpdate = async (projectId: string, taskId: string, newStatus: KanbanStatus, comment: string) => {
        const outcome = await projectsState.requestTaskStatus(projectId, taskId, newStatus, comment);
        setInfoModal(outcome.ok
            ? { title: t('submitForApproval'), message: t('progressUpdated') }
            : { title: t('error'), message: outcome.message || t('error') });
    };

    /** Asks for an action to take another status; the backend sends the request for approval (or applies it at once when nothing is configured). */
    const handleAddActionStatusUpdate = async (actionId: string, newStatus: WorkStatus, _currentStatus: WorkStatus, comment: string) => {
        const outcome = await actionsState.requestStatus(actionId, newStatus, comment);
        setInfoModal(outcome.ok
            ? { title: t('submitForApproval'), message: t('progressUpdated') }
            : { title: t('error'), message: outcome.message || t('error') });
    };

    /** The person responsible for a risk's response reports where the work stands; the backend sends it for verification (or applies it at once). */
    const handleUpdateRiskResponseStatus = async (projectId: string, riskId: string, status: string, comment?: string) => {
        const outcome = await projectsState.submitRiskResponse(projectId, riskId, status as WorkStatus, comment ?? '');
        setInfoModal(outcome.ok
            ? {
                title: language === 'fa' ? 'ثبت اقدام پاسخ ریسک' : 'Risk Response Action',
                message: language === 'fa' ? 'وضعیت اقدام با موفقیت ارسال شد.' : 'Response action status submitted successfully.'
            }
            : { title: t('error'), message: outcome.message || t('error') });
    };
    
    const handleSaveApprovalComment = (comment: string, statusOverride?: 'Approved' | 'Rejected', options?: { approvedProgress?: number; isPartialRejection?: boolean }) => {
        if (!approvalCommentModalState) return;
        const { type, id, status: defaultStatus } = approvalCommentModalState;
        const status = statusOverride || defaultStatus;
        const currentActorName = currentUser ? (currentUser.name ? `${currentUser.name} (${currentUser.username})` : currentUser.username) : 'کاربر';
    
        if (type === 'project') {
            setProjects(prev => prev.map(p => {
                if (p.id === id) {
                    const stages = dynamicWorkflowSettings?.charter || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS.charter;
                    const currentStageIdx = p.currentApprovalStageIndex ?? 0;
                    const currentStage = stages ? stages[currentStageIdx] : undefined;
                    const stageTitle = currentStage ? currentStage.stageTitle : (language === 'fa' ? `مرحله ${toPersianDigits(currentStageIdx + 1)}` : `Stage ${currentStageIdx + 1}`);

                    const newHistory: ProjectApprovalRecord = {
                        action: status,
                        date: getISODateTimeString(),
                        actor: currentActorName,
                        stageTitle: stageTitle,
                        comment
                    };
                    return {
                        ...p,
                        approvalStatus: status,
                        approvalComment: comment,
                        approvalHistory: [...(p.approvalHistory || []), newHistory]
                    };
                }
                return p;
            }));
            setInfoModal({ title: t('updateStatus'), message: t('projectApprovalReviewed') });
        } else if (type === 'progress') {
            const update = progressUpdates.find(up => up.id === id);
            if (!update) return;

            // Reports on activities and requests on agile tasks are decided in the backend's approval workflow; the stages, the next approver and
            // the checks on who may decide are its own. A rejection that still carries a confirmed figure is applied by the backend as well.
            if (update.activityId || update.taskId) {
                const partial = status === 'Rejected' && !!options?.isPartialRejection && options.approvedProgress !== undefined;
                projectsState.decideUpdate(
                    update.projectId!, update.id, status === 'Approved', comment,
                    update.activityId && partial ? options!.approvedProgress : undefined,
                    update.taskId && partial ? (options!.approvedProgress === 100 ? 'Done' : 'Doing') : undefined
                ).then(outcome => setInfoModal(outcome.ok
                    ? { title: t('updateStatus'), message: partial && update.activityId
                        ? (language === 'fa'
                            ? `پیشرفت اعلامی رد شد اما درصد پیشرفت تاییدی (${toPersianDigits(options!.approvedProgress!)}٪) ثبت گردید و ملاک تمام محاسبات قرار گرفت.`
                            : `Submitted progress was rejected, but confirmed progress (${options!.approvedProgress}%) was saved and used for calculations.`)
                        : t('reviewComplete') }
                    : { title: t('error'), message: outcome.message || t('error') }));
                setApprovalCommentModalState(null);
                return;
            }

            // A request to change an action's status is decided in the backend's approval workflow, like the ones above.
            if (update.actionId) {
                actionsState.decide(update.id, status === 'Approved', comment).then(outcome => setInfoModal(outcome.ok
                    ? { title: t('updateStatus'), message: t('reviewComplete') }
                    : { title: t('error'), message: outcome.message || t('error') }));
                setApprovalCommentModalState(null);
                return;
            }

            const isCharter = !!update.submittedCharter;
            const stages = isCharter
                ? (dynamicWorkflowSettings?.charter || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS.charter)
                : (dynamicWorkflowSettings?.activity_progress || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS.activity_progress);

            const currentStageIdx = update.currentStageIndex ?? 0;
            const currentStage = stages ? stages[currentStageIdx] : undefined;
            const stageTitle = currentStage ? currentStage.stageTitle : (language === 'fa' ? `مرحله ${toPersianDigits(currentStageIdx + 1)}` : `Stage ${currentStageIdx + 1}`);

            const initialSubmitter = users.find(u => String(u.id) === String(update.submittedBy));
            const initialSubmitterName = initialSubmitter ? (initialSubmitter.name ? `${initialSubmitter.name} (${initialSubmitter.username})` : initialSubmitter.username) : 'کاربر';

            const baseHistory = update.approvalHistory && update.approvalHistory.length > 0
                ? update.approvalHistory
                : [{
                    action: 'Submitted' as const,
                    date: update.submissionDate || getISODateTimeString(),
                    actor: initialSubmitterName,
                    stageTitle: language === 'fa' ? 'ارسال اولیه' : 'Initial Submission',
                    comment: update.submissionComment || ''
                }];

            const currentRecord: ProjectApprovalRecord = {
                action: status,
                date: getISODateTimeString(),
                actor: currentActorName,
                stageTitle: stageTitle,
                comment: comment || (status === 'Approved' ? (language === 'fa' ? 'تایید شد' : 'Approved') : (language === 'fa' ? 'عدم تایید' : 'Rejected'))
            };

            const newApprovalHistory = [...baseHistory, currentRecord];
    
            if (status === 'Rejected') {
                const isPartial = !!(options?.isPartialRejection && options?.approvedProgress !== undefined);
                const approvedVal = isPartial ? options!.approvedProgress : undefined;

                setProgressUpdates(prev => prev.map(up => 
                    up.id === id ? { 
                        ...up, 
                        status: 'Rejected', 
                        isPartialRejection: isPartial,
                        approvedProgress: approvedVal,
                        reviewComment: comment, 
                        reviewDate: getISODateTimeString(),
                        approvalHistory: newApprovalHistory
                    } : up
                ));

                // If partial rejection with confirmed progress, update task actualProgress so it becomes basis for calculations
                if (isPartial && options?.approvedProgress !== undefined) {
                    if (update.activityId) {
                        setProjects(prev => prev.map(p => {
                            if (p.id === update.projectId) {
                                return {
                                    ...p,
                                    schedule: p.schedule?.map(act => act.id === update.activityId ? { ...act, actualProgress: options.approvedProgress! } : act)
                                };
                            }
                            return p;
                        }));
                    } else if (update.taskId) {
                        setProjects(prev => prev.map(p => {
                            if (p.id === update.projectId) {
                                return {
                                    ...p,
                                    kanbanTasks: p.kanbanTasks?.map(t => t.id === update.taskId ? { ...t, status: options.approvedProgress === 100 ? 'Done' : 'Doing' } : t)
                                };
                            }
                            return p;
                        }));
                    }
                    setInfoModal({ 
                        title: t('updateStatus'), 
                        message: language === 'fa' 
                            ? `پیشرفت اعلامی رد شد اما درصد پیشرفت تاییدی (${toPersianDigits(options.approvedProgress)}٪) ثبت گردید و ملاک تمام محاسبات قرار گرفت.` 
                            : `Submitted progress was rejected, but confirmed progress (${options.approvedProgress}%) was saved and used for calculations.`
                    });
                } else {
                    setInfoModal({ title: t('updateStatus'), message: t('reviewComplete') });
                }
            } else if (status === 'Approved') {
                const project = projects.find(p => p.id === update.projectId);
                const hasNextStage = !!(stages && currentStageIdx < stages.length - 1);

                if (hasNextStage && stages) {
                    const nextStageIdx = currentStageIdx + 1;
                    const nextStage = stages[nextStageIdx];
                    const nextApproverId = nextStage ? resolveWorkflowApproverId(nextStage.approverId, project) : (project?.projectManagerId ?? 1);

                    setProgressUpdates(prev => prev.map(up =>
                        up.id === id ? { 
                            ...up, 
                            currentStageIndex: nextStageIdx,
                            currentApproverId: nextApproverId, 
                            approvedProgress: update.submittedProgress, 
                            reviewComment: comment, 
                            reviewDate: getISODateTimeString(),
                            approvalHistory: newApprovalHistory
                        } : up
                    ));
                    setInfoModal({ 
                        title: t('updateStatus'), 
                        message: language === 'fa' 
                            ? `مرحله تایید فعلی با موفقیت ثبت شد و برای مرحله بعدی (${nextStage.stageTitle}) ارسال گردید.`
                            : `Current stage approved and routed to next stage: ${nextStage.stageTitle}` 
                    });
                    setApprovalCommentModalState(null);
                    return;
                }

                // Final Approval reached!
                if (update.submittedCharter) {
                    setProgressUpdates(prev => prev.map(up => 
                        up.id === id ? {
                            ...up,
                            status: 'Approved',
                            approvedProgress: 100,
                            reviewComment: comment,
                            reviewDate: getISODateTimeString(),
                            approvalHistory: newApprovalHistory
                        } : up
                    ));
                    setProjects(prev => prev.map(p => {
                        if (p.id === update.projectId) {
                            return {
                                ...p,
                                ...update.submittedCharter
                            };
                        }
                        return p;
                    }));
                    setInfoModal({ title: t('updateStatus'), message: t('reviewComplete') });
                    setApprovalCommentModalState(null);
                    return;
                }

                // Regular progress final approval
                setProgressUpdates(prev => prev.map(up =>
                    up.id === id ? {
                        ...up,
                        status: 'Approved',
                        approvedProgress: update.submittedProgress,
                        reviewComment: comment,
                        reviewDate: getISODateTimeString(),
                        approvalHistory: newApprovalHistory
                    } : up
                ));

                if (update.activityId) {
                     setProjects(prev => prev.map(p => {
                        if (p.id === update.projectId) {
                            return {
                                ...p,
                                schedule: p.schedule?.map(act => act.id === update.activityId ? { ...act, actualProgress: update.submittedProgress! } : act)
                            };
                        }
                        return p;
                    }));
                } else if (update.taskId) {
                    setProjects(prev => prev.map(p => {
                        if (p.id === update.projectId) {
                            return {
                                ...p,
                                kanbanTasks: p.kanbanTasks?.map(t => t.id === update.taskId ? { ...t, status: update.submittedStatus as KanbanStatus } : t)
                            };
                        }
                        return p;
                    }));
                }
                setInfoModal({ title: t('updateStatus'), message: t('reviewComplete') });
            }
        }
        setApprovalCommentModalState(null);
    };

    // --- CALENDAR & ADVANCED HANDLERS ---
    const handleSaveCalendar = (calendar: Calendar) => directory.saveCalendar(calendar);

    const handleDeleteCalendar = (id: string) => directory.deleteCalendar(id);
    
    /** The backend refuses a strategy tree whose top-level weights do not add up to 100 (and says so). */
    const handleSaveStrategies = async (strategiesToSave: Strategy[]) => {
        const outcome = await strategyState.saveStrategies(strategiesToSave);
        if (!outcome.ok) {
            setInfoModal({
                title: t('error'),
                message: outcome.code === 'strategy.weights_not_100' ? t('weightError') : outcome.message || t('error')
            });
        }
        return outcome;
    };

    const handleSaveAlignments = async (alignmentsToSave: ProjectStrategyAlignment[], projectIds: string[]) => {
        const outcome = await strategyState.saveAlignments(alignmentsToSave, projectIds);
        if (!outcome.ok) setInfoModal({ title: t('error'), message: outcome.message || t('error') });
        return outcome;
    };

    const handleSaveKnowledgeDoc = async (file: File, description: string, type: KnowledgeDocumentType) => {
        const outcome = await strategyState.uploadKnowledge(file, description, type);
        if (!outcome.ok) setInfoModal({ title: t('error'), message: outcome.message || t('error') });
        return outcome;
    };

    const handleDeleteKnowledgeDoc = async (id: string) => {
        const outcome = await strategyState.deleteKnowledge(id);
        if (!outcome.ok) setInfoModal({ title: t('error'), message: outcome.message || t('error') });
    };

    const handleDownloadKnowledgeDoc = async (doc: KnowledgeDocument) => {
        const outcome = await strategyState.downloadKnowledge(doc);
        if (!outcome.ok) setInfoModal({ title: t('error'), message: outcome.message || t('error') });
    };
    
    /** Hands an activity / agile task to another person: the responsible is a field of the item on the backend. */
    const reassignItem = async (type: 'waterfall' | 'agile', itemId: string, projectId: string | undefined, userId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;
        const outcome = type === 'waterfall'
            ? await (async () => {
                const activity = project.schedule?.find(a => a.id === itemId);
                return activity ? projectsState.updateActivity(project.id, { ...activity, assignedToId: userId }) : { ok: true };
            })()
            : await (async () => {
                const task = project.kanbanTasks?.find(k => k.id === itemId);
                return task ? projectsState.saveKanbanTask(project.id, { ...task, assignedToId: userId }) : { ok: true };
            })();
        if (!outcome.ok) setInfoModal({ title: t('error'), message: outcome.message || t('error') });
    };

    /** Hands an action to another person: the responsible is a field of the action on the backend. */
    const reassignAction = async (actionId: string, userId: string) => {
        const action = actions.find(a => a.id === actionId);
        if (!action) return;
        const outcome = await actionsState.saveAction({ ...action, responsibleUserId: userId });
        if (!outcome.ok) setInfoModal({ title: t('error'), message: outcome.message || t('error') });
    };

    const handleDelegateTask = (type: 'waterfall' | 'agile' | 'action', itemId: string | number, projectId: string | undefined, delegateeId: string) => {
        // 1. Reassign the task
        if (type === 'action') {
            void reassignAction(itemId as string, delegateeId);
        } else {
            void reassignItem(type, itemId as string, projectId, delegateeId);
        }
    
        // 2. Create a new delegation record
        setDelegations(prev => {
            const newDelegation: Delegation = {
                id: Date.now(),
                type,
                itemId,
                projectId,
                delegatorId: currentUser!.id,
                delegateeId,
                delegationDate: getISODateString(),
                isActive: true,
            };
            return [...prev, newDelegation];
        });
        setInfoModal({ title: t('delegate'), message: t('taskDelegatedSuccess') });
    };

    const handleDeactivateDelegation = (delegationId: number) => {
        const delegationToDeactivate = delegations.find(d => d.id === delegationId);
        if (!delegationToDeactivate) return;
    
        const { type, itemId, projectId, delegatorId, delegateeId } = delegationToDeactivate;
    
        // 1. Reassign task back to the delegator of this specific link
        if (type === 'action') {
            void reassignAction(itemId as string, delegatorId);
        } else {
            void reassignItem(type, itemId as string, projectId, delegatorId);
        }
    
        // 2. Deactivate the entire subsequent chain of delegations
        setDelegations(prev => {
            const activeDelegationsForTask = prev.filter(d => 
                d.projectId === projectId && 
                d.itemId === itemId && 
                d.isActive
            );
            
            const idsToDeactivate = new Set<number>([delegationId]);
            const queue: number[] = [delegateeId]; // Start with the person this task was delegated to
    
            while (queue.length > 0) {
                const currentDelegatorId = queue.shift();
                const nextDelegation = activeDelegationsForTask.find(d => d.delegatorId === currentDelegatorId);
                if (nextDelegation) {
                    idsToDeactivate.add(nextDelegation.id);
                    queue.push(nextDelegation.delegateeId);
                }
            }
            
            return prev.map(d => idsToDeactivate.has(d.id) ? { ...d, isActive: false } : d);
        });
    
        setInfoModal({ title: t('deactivate'), message: t('delegationDeactivatedSuccess') });
    };

    // --- RENDER LOGIC ---
    const renderPage = () => {
        if (auth.restoring) {
            return <div className="content-container" style={{ textAlign: 'center', padding: '3rem' }}>...</div>;
        }
        if (!currentUser) {
            return <LoginPage onLogin={handleLogin} error={loginError} captcha={auth.captcha} onRefreshCaptcha={() => void auth.refreshCaptcha()} />;
        }
        switch (page) {
            case 'main':
                return <MainMenu 
                            onNavigate={handleNavigate} 
                            currentUser={currentUser} 
                            overdueProjectsCount={overdueProjectsCount}
                            pendingApprovalsCount={pendingApprovalsCount}
                            taskCenterNotificationCount={taskCenterNotificationCount}
                        />;
            case 'users':
                return <UserManagementPage users={users} onNavigate={handleNavigate} owningUnits={owningUnits} onCreate={directory.createUser} onUpdate={directory.updateUser} onSetActive={directory.setUserActive} onDelete={directory.deleteUser} />;
            case 'settings':
                return (
                    <SettingsPage 
                        onNavigate={handleNavigate} 
                        currentUser={currentUser} 
                        users={users}
                        isProjectWorkflowEnabled={isProjectWorkflowEnabled}
                        setIsProjectWorkflowEnabled={setIsProjectWorkflowEnabled}
                        allowApprovedProgress={allowApprovedProgress}
                        setAllowApprovedProgress={setAllowApprovedProgress}
                        defaultProjectApproverId={defaultProjectApproverId}
                        setDefaultProjectApproverId={setDefaultProjectApproverId}
                        visibilitySettings={visibilitySettings}
                        setVisibilitySettings={setVisibilitySettings}
                        dynamicWorkflowSettings={dynamicWorkflowSettings}
                        setDynamicWorkflowSettings={setDynamicWorkflowSettings}
                    />
                );
            case 'create_project':
                return <CreateProjectPage onNavigate={handleNavigate} />;
            case 'create_waterfall_details':
            case 'create_agile_details':
                return <ProjectDetailsPage 
                            projectType={pageContext.type} 
                            users={users} 
                            currentUser={currentUser}
                            onNavigate={handleNavigate}
                            onSaveProject={handleSaveProject}
                            onUpdateProject={handleUpdateProject}
                            onCheckProject={projectsState.checkProject}
                            onPartialUpdate={handlePartialUpdateProject}
                            existingProject={pageContext.project}
                            fromPage={pageContext.from}
                            initialTab={pageContext.initialTab}
                            calendars={calendars}
                            setInfoModal={setInfoModal}
                            progressUpdates={progressUpdates}
                            onAddKanbanStatusUpdate={handleAddKanbanStatusUpdate}
                            actions={actions}
                            owningUnits={owningUnits}
                            projectStatuses={projectStatuses}
                            isProjectWorkflowEnabled={isProjectWorkflowEnabled}
                            defaultProjectApproverId={defaultProjectApproverId}
                            dynamicWorkflowSettings={dynamicWorkflowSettings}
                            onSaveAction={handleSaveAction}
                            projects={projects}
                        />;
            case 'portfolio':
                return <ProjectPortfolioPage 
                            projects={projects} 
                            actions={actions}
                            users={users} 
                            currentUser={currentUser} 
                            onNavigate={handleNavigate} 
                            progressUpdates={progressUpdates}
                            owningUnits={owningUnits}
                            visibilitySettings={visibilitySettings}
                            onDeleteProject={handleDeleteProject}
                            onDeleteAction={handleDeleteAction}
                        />;
            case 'delete_projects':
                return <DeleteProjectsPage projects={projects} onDeleteProject={handleDeleteProject} onNavigate={handleNavigate} />;
            case 'task_center':
                return <TaskCenterPage 
                            projects={projects}
                            actions={actions}
                            users={users} 
                            currentUser={currentUser} 
                            progressUpdates={progressUpdates}
                            calendars={calendars}
                            onAddProgressUpdate={handleAddProgressUpdate}
                            onAddKanbanStatusUpdate={handleAddKanbanStatusUpdate}
                            onAddActionStatusUpdate={handleAddActionStatusUpdate}
                            onUpdateRiskResponseStatus={handleUpdateRiskResponseStatus}
                            onNavigate={handleNavigate}
                            allProcessedActivities={allProcessedActivities}
                            delegations={delegations}
                            onDelegateTask={handleDelegateTask}
                            onDeactivateDelegation={handleDeactivateDelegation}
                            dynamicWorkflowSettings={dynamicWorkflowSettings}
                        />;
            case 'approval_center':
                return <ApprovalCenterPage 
                            progressUpdates={progressUpdates} 
                            projects={projects} 
                            actions={actions}
                            users={users} 
                            currentUser={currentUser} 
                            setApprovalCommentModalState={setApprovalCommentModalState} 
                            onNavigate={handleNavigate}
                            allProcessedActivities={allProcessedActivities}
                            setProjects={setProjects}
                            dynamicWorkflowSettings={dynamicWorkflowSettings}
                        />;
            case 'calendar_management':
                return <CalendarManagementPage calendars={calendars} onNavigate={handleNavigate} onDelete={handleDeleteCalendar} />;
            case 'edit_calendar':
                return <EditCalendarPage onNavigate={handleNavigate} onSave={handleSaveCalendar} existingCalendar={pageContext?.calendar} />;
            case 'strategy_management':
                return <StrategyManagementHubPage onNavigate={handleNavigate} />;
            case 'define_strategies':
                return <DefineStrategiesPage strategies={strategies} onSaveStrategies={handleSaveStrategies} onNavigate={handleNavigate} setInfoModal={setInfoModal} />;
            case 'alignment_matrix':
                return <AlignmentMatrixPage projects={projects} strategies={strategies} alignments={alignments} percentages={strategyState.alignmentPercentages} onSaveAlignments={handleSaveAlignments} onNavigate={handleNavigate} />;
            case 'color_format':
                return <ColorFormatPage onNavigate={handleNavigate} />;
            case 'reference_tables':
                return <ReferenceTablesPage projectStatuses={projectStatuses} onNavigate={handleNavigate} />;
            case 'dashboard_hub':
            case 'dashboard':
            case 'action_dashboard':
                return <ProjectDashboardPage projects={visibleProjectsForCurrentUser} actions={visibleActionsForCurrentUser} users={users} calendars={calendars} onNavigate={handleNavigate} owningUnits={owningUnits} projectStatuses={projectStatuses} />;
            case 'reports_dashboard':
                return <ReportsDashboardPage 
                            projects={visibleProjectsForCurrentUser} 
                            actions={visibleActionsForCurrentUser} 
                            users={users} 
                            calendars={calendars} 
                            onNavigate={handleNavigate} 
                            owningUnits={owningUnits} 
                            projectStatuses={projectStatuses} 
                        />;
            case 'project_dashboard_details':
                return <ProjectSpecificDashboardPage users={users} calendars={calendars} onNavigate={handleNavigate} progressUpdates={progressUpdates} actions={actions} pageContext={pageContext} currentUser={currentUser} />;
            case 'knowledge_management':
                return <KnowledgeManagementPage onNavigate={handleNavigate} knowledgeDocuments={knowledgeDocuments} onSave={handleSaveKnowledgeDoc} onDelete={handleDeleteKnowledgeDoc} onDownload={handleDownloadKnowledgeDoc} />;
            case 'define_action':
                return <ActionDefinitionPage onNavigate={handleNavigate} onSaveAction={handleSaveAction} users={users} calendars={calendars} projects={projects} existingAction={pageContext?.action} pageContext={pageContext} setInfoModal={setInfoModal} owningUnits={owningUnits} currentUser={currentUser} />;
            case 'view_snapshot':
                return <ScheduleSnapshotPage 
                            pageContext={pageContext} 
                            onNavigate={handleNavigate} 
                            users={users}
                        />;
            default:
                return <div>Page not found</div>;
        }
    };

    return (
        <div className={`app-container ${language}`}>
            {currentUser && <Header user={currentUser} onLogout={handleLogout} />}
            <div className="app-body">
                {currentUser && (
                    <Sidebar 
                        currentPage={page}
                        onNavigate={handleNavigate}
                        currentUser={currentUser}
                        overdueProjectsCount={overdueProjectsCount}
                        pendingApprovalsCount={pendingApprovalsCount}
                        taskCenterNotificationCount={taskCenterNotificationCount}
                    />
                )}
                <main className="main-content">
                    {renderPage()}
                </main>
            </div>
            <Footer />
            {currentUser && (
                <AiChatbot 
                    projects={projects}
                    actions={actions}
                    users={users}
                    owningUnits={owningUnits}
                    projectStatuses={projectStatuses}
                    onAddProject={(newProj) => handleSaveProject(newProj, 'sent')}
                    onUpdateProject={handleAssistantProjectUpdate}
                    onAddAction={handleAssistantAddAction}
                    onNavigate={handleNavigate}
                    currentUser={currentUser}
                />
            )}
            {infoModal && <InfoModal title={infoModal.title} message={infoModal.message} onClose={() => setInfoModal(null)} />}
            {approvalCommentModalState && (
                <ApprovalCommentModal 
                    title={t('registerMessage')}
                    initialComment={approvalCommentModalState.initialComment}
                    submittedProgress={progressUpdates.find(u => u.id === approvalCommentModalState.id)?.submittedProgress}
                    allowApprovedProgress={allowApprovedProgress}
                    status={approvalCommentModalState.status}
                    onSave={handleSaveApprovalComment}
                    onClose={() => setApprovalCommentModalState(null)}
                />
            )}
        </div>
    );
};

export const App = () => {
    return (
        <LocalizationProvider>
            <ThemeProvider>
                <AuthProvider>
                    <DirectoryProvider>
                        <ProjectsProvider>
                            <ActionsProvider>
                                <StrategyProvider>
                                    <AppContent />
                                </StrategyProvider>
                            </ActionsProvider>
                        </ProjectsProvider>
                    </DirectoryProvider>
                </AuthProvider>
            </ThemeProvider>
        </LocalizationProvider>
    );
};