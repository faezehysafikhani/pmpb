

import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './directory/AuthContext';
import { DirectoryProvider, useDirectory } from './directory/DirectoryContext';
import { ProjectsProvider, useProjects } from './directory/ProjectsContext';
import { ActionsProvider, useActions } from './directory/ActionsContext';
import { StrategyProvider, useStrategy } from './directory/StrategyContext';
import { GovernanceProvider, useGovernance } from './directory/GovernanceContext';
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
    Delegation
} from './types';
import { enrichProjectWithProgress, pickCalendar, getISODateString, getISODateTimeString, calculateScheduleTreeAndProgress, toPersianDigits } from './utils';
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

    // Approval chains, who sees what, hand-overs of work and each project's own switches belong to the backend.
    const governance = useGovernance();
    const allowApprovedProgress = governance.allowApprovedProgress;
    const delegations = governance.delegations;

    // Progress reports on activities, status requests on agile tasks and on actions belong to the backend (with their approval).
    const progressUpdates = useMemo(
        () => [...projectsState.progressUpdates, ...actionsState.updates],
        [projectsState.progressUpdates, actionsState.updates]);

    // The work statuses are the backend's fixed set (it moves a project between them); they are not editable here.
    const projectStatuses: string[] = PROJECT_WORK_STATUSES;

    // The signed-in person as the directory shows them (with their unit), until the directory has loaded: just what the session says.
    const currentUser: User | null = useMemo(
        () => auth.session ? (users.find(u => u.id === auth.session!.user.id) ?? toUiUser(auth.session.user, new Map())) : null,
        [auth.session, users]
    );
    const [page, setPage] = useState('dashboard');
    const [pageContext, setPageContext] = useState<any>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [infoModal, setInfoModal] = useState<{title: string, message: string} | null>(null);
    const [approvalCommentModalState, setApprovalCommentModalState] = useState<{ type: 'project' | 'progress', id: string, status: 'Approved' | 'Rejected', initialComment?: string } | null>(null);

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

    // What is waiting for the signed-in user: the backend's workflow says whose turn it is (a substitute's included); an administrator also sees every pending item.
    const pendingApprovalsCount = useMemo(() => {
        if (!currentUser) return 0;
        const isAdmin = currentUser.role === 'Admin';
        const mine = (subjectId: string | undefined, pending: boolean) => pending && !!subjectId && (isAdmin || governance.waitingForMe(subjectId));
        const open = (item: { isApproved?: boolean; isRejected?: boolean }) => !item.isApproved && !item.isRejected;

        let count = progressUpdates.filter(up => mine(up.id, up.status === 'Pending Approval')).length;
        for (const p of projects) {
            if (mine(p.id, p.approvalStatus === 'Pending Approval')) count++;
            for (const r of p.risks || []) {
                if (mine(r.id, open(r))) count++;
                if (r.isApproved && mine(r.verificationReportId, r.verificationStatus === 'Pending Approval')) count++;
            }
            for (const item of [...(p.stakeholders || []), ...(p.statusUpdates || []), ...(p.delayReasons || []), ...(p.documents || [])]) {
                if (mine(item.id, open(item))) count++;
            }
            for (const c of p.contracts || []) {
                if (mine(c.id, !!c.isPending)) count++;
                for (const a of c.amendments || []) if (mine(a.id, !!a.isPending)) count++;
            }
            for (const i of p.invoices || []) if (mine(i.id, !!i.isPending)) count++;
        }
        return count;
    }, [progressUpdates, projects, currentUser, governance]);

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

    // The backend's visibility rules decide which actions come back (see ActionsContext).
    const visibleActionsForCurrentUser = actions;


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
    
    // Every approval - a project's, a progress report, a status request - is decided in the backend's workflow: it records the decision, moves to
    // the next step or finishes, and checks that the signed-in person is the one who may decide.
    const handleSaveApprovalComment = (comment: string, statusOverride?: 'Approved' | 'Rejected', options?: { approvedProgress?: number; isPartialRejection?: boolean }) => {
        if (!approvalCommentModalState) return;
        const { type, id, status: defaultStatus } = approvalCommentModalState;
        const status = statusOverride || defaultStatus;
        setApprovalCommentModalState(null);

        if (type === 'project') {
            projectsState.decide('project', id, id, status === 'Approved', comment).then(outcome => setInfoModal(outcome.ok
                ? { title: t('updateStatus'), message: t('projectApprovalReviewed') }
                : { title: t('error'), message: outcome.message || t('error') }));
            return;
        }

        const update = progressUpdates.find(up => up.id === id);
        if (!update) return;

        // Reports on activities and requests on agile tasks; a rejection that still carries a confirmed figure is applied by the backend as well.
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
            return;
        }

        // A request to change an action's status.
        if (update.actionId) {
            actionsState.decide(update.id, status === 'Approved', comment).then(outcome => setInfoModal(outcome.ok
                ? { title: t('updateStatus'), message: t('reviewComplete') }
                : { title: t('error'), message: outcome.message || t('error') }));
        }
    };;

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

    /** The assignee of an item belongs to its own area, so the screen that shows it sets it; the backend keeps the record of the hand-over. */
    const assignTo = async (type: 'waterfall' | 'agile' | 'action', itemId: string, projectId: string | undefined, userId: string) => {
        if (type === 'action') await reassignAction(itemId, userId);
        else await reassignItem(type, itemId, projectId, userId);
    };

    const handleDelegateTask = async (type: 'waterfall' | 'agile' | 'action', itemId: string | number, projectId: string | undefined, delegateeId: string) => {
        const made = await governance.delegate(type, String(itemId), projectId, delegateeId);
        if (!made.ok) {
            setInfoModal({ title: t('error'), message: made.message || t('error') });
            return;
        }
        await assignTo(type, String(itemId), projectId, delegateeId);
        setInfoModal({ title: t('delegate'), message: t('taskDelegatedSuccess') });
    };

    const handleDeactivateDelegation = async (delegationId: string) => {
        const delegation = delegations.find(d => d.id === delegationId);
        if (!delegation) return;
        // The backend ends this hand-over and everything handed on after it, and says who the item goes back to.
        const ended = await governance.endDelegation(delegationId);
        if (!ended.ok) {
            setInfoModal({ title: t('error'), message: ended.message || t('error') });
            return;
        }
        if (ended.restoreToUserId) await assignTo(delegation.type, delegation.itemId, delegation.projectId, ended.restoreToUserId);
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
                            <GovernanceProvider>
                                <ActionsProvider>
                                    <StrategyProvider>
                                        <AppContent />
                                    </StrategyProvider>
                                </ActionsProvider>
                            </GovernanceProvider>
                        </ProjectsProvider>
                    </DirectoryProvider>
                </AuthProvider>
            </ThemeProvider>
        </LocalizationProvider>
    );
};