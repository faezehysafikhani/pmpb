import React, { useState, useContext, useEffect, useMemo, FormEvent, ChangeEvent, ReactElement, Fragment } from 'react';
import { LocalizationContext } from '../context';
import { 
    User, Project, ProjectActivity, KanbanTask, ProgressUpdate, EnrichedTask, KanbanStatus,
    UserRole, TranslationKey, ProgressUpdateStatus, TaskPriority, EnrichedKanbanTask,
    ActionItem, WorkStatus, Delegation, DynamicWorkflowSettings, DEFAULT_DYNAMIC_WORKFLOW_SETTINGS, resolveWorkflowApproverId,
    ProjectApprovalRecord, getEffectiveProjectWorkflowStages, WorkflowEntityType
} from '../types';
import { 
    UserEditModal, TaskSubmissionModal, ActivityHistoryModal, KanbanStatusUpdateModal, KanbanHistoryModal, ProjectHistoryModal,
    ActionStatusUpdateModal, ActionHistoryModal, ApprovalHistoryModal, DelegationModal, MyDelegationsModal, AiFeasibilityModal,
    ApprovalCommentModal, TabItemHistoryModal
} from '../components/Modals';
import { formatDate, toPersianDigits, getISODateString, getISODateTimeString } from '../utils';
import { useProjects } from '../directory/ProjectsContext';
import type { RegisterKind } from '../services/backend/registers';
import { ProgressBar } from '../components/Indicators';
import { OwningUnitTreeSelect } from '../components/Forms';
import type { EditUserForm, NewUserForm, Outcome } from '../directory/DirectoryContext';

// --- UserManagementPage ---
export const UserManagementPage = ({ users, onNavigate, owningUnits = [], onCreate, onUpdate, onSetActive, onDelete }: {
  users: User[],
  onNavigate: (page: string) => void,
  owningUnits?: string[],
  onCreate: (form: NewUserForm) => Promise<Outcome>,
  onUpdate: (id: string, form: EditUserForm) => Promise<Outcome>,
  onSetActive: (id: string, isActive: boolean) => Promise<Outcome>,
  onDelete: (id: string) => Promise<Outcome>
}): ReactElement => {
  const { t, language } = useContext(LocalizationContext);
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Project Team');
  const [userOwningUnit, setUserOwningUnit] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The units come from the organisation chart held by the backend.
  const availableUnits = owningUnits;

  const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!userOwningUnit) {
      setFormError(language === 'fa' ? 'انتخاب واحد سازمانی (ساختار شکست سازمانی) اجباری است.' : 'Selecting an Organizational Unit is required.');
      return;
    }
    setBusy(true);
    const outcome = await onCreate({ username, firstName, lastName, phoneNumber, password, role, unitPath: userOwningUnit });
    setBusy(false);
    if (!outcome.ok) {
      setFormError(outcome.message ?? 'ثبت کاربر انجام نشد.');
      return;
    }
    setUsername('');
    setFirstName('');
    setLastName('');
    setPhoneNumber('');
    setPassword('');
    setRole('Project Team');
    setUserOwningUnit('');
    setFormError(null);
    setIsAddModalOpen(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm(t('confirmUserDelete'))) {
      const outcome = await onDelete(userId);
      if (!outcome.ok) alert(outcome.message ?? 'حذف انجام نشد.');
    }
  };

  const handleToggleStatus = async (user: User) => {
    const outcome = await onSetActive(user.id, !user.isActive);
    if (!outcome.ok) alert(outcome.message ?? 'تغییر وضعیت انجام نشد.');
  };

  const handleEditUserClick = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (form: EditUserForm): Promise<Outcome> => {
    if (!editingUser) return { ok: false };
    const outcome = await onUpdate(editingUser.id, form);
    if (outcome.ok) {
      setIsEditModalOpen(false);
      setEditingUser(null);
    }
    return outcome;
  };
  
  const roleTranslations: Record<UserRole, TranslationKey> = {
      Admin: 'admin',
      'Project Manager': 'projectManagerRole',
      'Project Team': 'projectTeamRole'
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(user => {
      const roleName = (roleTranslations[user.role] && t(roleTranslations[user.role])) || user.role;
      const statusName = user.isActive ? t('active') : t('inactive');
      const unitName = user.owningUnit || '';
      return user.username.toLowerCase().includes(term) ||
             (user.name || '').toLowerCase().includes(term) ||
             roleName.toLowerCase().includes(term) ||
             statusName.toLowerCase().includes(term) ||
             unitName.toLowerCase().includes(term);
    });
  }, [users, searchTerm, t]);

  return (
    React.createElement(Fragment, null,
      React.createElement(UserEditModal, { 
        isOpen: isEditModalOpen,
        onClose: () => setIsEditModalOpen(false),
        onSave: handleUpdateUser,
        user: editingUser,
        owningUnits: availableUnits
      }),

      isAddModalOpen && React.createElement("div", { className: "modal-overlay", onClick: () => setIsAddModalOpen(false) },
        React.createElement("div", { className: "modal-content", onClick: (e: React.MouseEvent) => e.stopPropagation(), style: { maxWidth: '480px', width: '90%', overflow: 'visible' } },
          React.createElement("div", { className: "modal-header" },
            React.createElement("h3", null, language === 'fa' ? 'مورد جدید - تعریف کاربر' : t('createUser')),
            React.createElement("button", { onClick: () => setIsAddModalOpen(false), className: "modal-close-button" },
              React.createElement("span", { className: "material-symbols-outlined" }, "close")
            )
          ),
          React.createElement("form", { onSubmit: handleAddUser, style: { display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' } },
            formError && React.createElement("div", { className: "login-error-banner", role: "alert" }, React.createElement("span", null, formError)),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "modal-username" }, (language === 'fa' ? 'نام کاربری (کد ملی)' : 'Username (national code)') + '*'),
              React.createElement("input", { type: "text", id: "modal-username", inputMode: "numeric", value: username, onChange: (e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value), required: true })
            ),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "modal-firstname" }, (language === 'fa' ? 'نام' : 'First name') + '*'),
              React.createElement("input", { type: "text", id: "modal-firstname", value: firstName, onChange: (e: ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value), required: true })
            ),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "modal-lastname" }, (language === 'fa' ? 'نام خانوادگی' : 'Last name') + '*'),
              React.createElement("input", { type: "text", id: "modal-lastname", value: lastName, onChange: (e: ChangeEvent<HTMLInputElement>) => setLastName(e.target.value), required: true })
            ),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "modal-phone" }, (language === 'fa' ? 'شماره موبایل' : 'Mobile number') + '*'),
              React.createElement("input", { type: "tel", id: "modal-phone", inputMode: "tel", value: phoneNumber, onChange: (e: ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value), required: true })
            ),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "modal-password" }, t('password') + '*'),
              React.createElement("input", { type: "password", id: "modal-password", value: password, onChange: (e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value), required: true })
            ),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "modal-role" }, t('role')),
              React.createElement("select", { id: "modal-role", value: role, onChange: (e: ChangeEvent<HTMLSelectElement>) => setRole(e.target.value as UserRole) },
                React.createElement("option", { value: "Admin" }, t('admin')),
                React.createElement("option", { value: "Project Manager" }, t('projectManagerRole')),
                React.createElement("option", { value: "Project Team" }, t('projectTeamRole'))
              )
            ),
            React.createElement("div", { className: "form-group", style: { position: 'relative', zIndex: 20 } },
              React.createElement("label", { htmlFor: "modal-owning-unit" }, (language === 'fa' ? 'واحد سازمانی (ساختار شکست سازمانی)' : 'Organizational Unit') + '*'),
              React.createElement(OwningUnitTreeSelect, {
                id: "modal-owning-unit",
                value: userOwningUnit,
                onChange: (val: string) => setUserOwningUnit(val),
                owningUnits: availableUnits,
                placeholder: language === 'fa' ? 'انتخاب واحد سازمانی...' : 'Select Org Unit...'
              })
            ),
            React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' } },
              React.createElement("button", { type: "button", className: "cancel-btn", onClick: () => setIsAddModalOpen(false) }, language === 'fa' ? 'انصراف' : 'Cancel'),
              React.createElement("button", { type: "submit", className: "action-button", disabled: busy },
                React.createElement("span", { className: "material-symbols-outlined" }, "person_add"),
                t('addUser')
              )
            )
          )
        )
      ),

      React.createElement("div", { className: "content-container" },
        React.createElement("div", { className: "page-header" },
          React.createElement("h2", null, t('userManagement'))
        ),
        
        React.createElement("div", { className: "page-top-bar" },
          React.createElement("div", { className: "search-filter-box" },
            React.createElement("span", { className: "material-symbols-outlined" }, "search"),
            React.createElement("input", {
              type: "text",
              className: "search-filter-input",
              placeholder: language === 'fa' ? 'فیلتر و جستجوی کاربر (نام، نقش، واحد سازمانی، وضعیت)...' : 'Search users...',
              value: searchTerm,
              onChange: (e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)
            })
          ),
          React.createElement("button", {
            className: "action-button",
            onClick: () => setIsAddModalOpen(true),
            style: { display: 'flex', alignItems: 'center', gap: '0.4rem' }
          },
            React.createElement("span", { className: "material-symbols-outlined" }, "add"),
            language === 'fa' ? 'مورد جدید' : 'New Item'
          )
        ),

        React.createElement("div", { className: "list-section" },
          React.createElement("h3", null, t('existingUsers')),
          React.createElement("div", { className: "table-responsive" },
            React.createElement("table", { className: "users-table" },
              React.createElement("thead", null,
                React.createElement("tr", null,
                  React.createElement("th", null, t('username')),
                  React.createElement("th", null, t('role')),
                  React.createElement("th", null, language === 'fa' ? 'واحد سازمانی (ساختار شکست سازمانی)' : 'Organizational Unit'),
                  React.createElement("th", null, t('status')),
                  React.createElement("th", { className: "th-actions no-print" }, t('actions'))
                )
              ),
              React.createElement("tbody", null,
                filteredUsers.length === 0 ? (
                  React.createElement("tr", null,
                    React.createElement("td", { colSpan: 5, style: { textAlign: 'center', padding: '2rem' } }, language === 'fa' ? 'هیچ کاربری یافت نشد.' : 'No users found.')
                  )
                ) : (
                  filteredUsers.map((user, idx) => (
                    React.createElement("tr", { key: `user-${user.id}-${idx}`, className: !user.isActive ? 'inactive' : '' },
                      React.createElement("td", null, user.username),
                      React.createElement("td", null, t(roleTranslations[user.role])),
                      React.createElement("td", null, user.owningUnit || '-'),
                      React.createElement("td", null, user.isActive ? t('active') : t('inactive')),
                      React.createElement("td", { className: "action-cell no-print" },
                        React.createElement("button", { onClick: () => handleEditUserClick(user), className: "action-icon edit", "aria-label": t('editUser') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),
                        React.createElement("button", { onClick: () => handleToggleStatus(user), className: `action-icon ${user.isActive ? 'deactivate' : 'activate'}`, "aria-label": t('toggleUserStatus') } as React.HTMLAttributes<HTMLButtonElement>,
                          React.createElement("span", { className: "material-symbols-outlined" }, user.isActive ? 'toggle_off' : 'toggle_on')
                        ),
                        React.createElement("button", { onClick: () => handleDeleteUser(user.id), className: "action-icon delete", "aria-label": t('deleteUser') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                      )
                    )
                  ))
                )
              )
            )
          )
        )
      )
    )
  );
};

// --- TaskCenterPage ---
export const TaskCenterPage = ({ projects, actions, users, currentUser, progressUpdates, onAddProgressUpdate, onAddKanbanStatusUpdate, onAddActionStatusUpdate, onUpdateRiskResponseStatus, onNavigate, allProcessedActivities, delegations, onDelegateTask, onDeactivateDelegation, dynamicWorkflowSettings = DEFAULT_DYNAMIC_WORKFLOW_SETTINGS }: { 
    projects: Project[], 
    actions: ActionItem[],
    users: User[], 
    currentUser: User, 
    progressUpdates: ProgressUpdate[], 
    calendars: any[],
    onAddProgressUpdate: (projectId: string, activityId: string, progress: number, submissionComment: string, documentName?: string) => void,
    onAddKanbanStatusUpdate: (projectId: string, taskId: number, newStatus: KanbanStatus, comment: string) => void,
    onAddActionStatusUpdate: (actionId: number, newStatus: WorkStatus, currentStatus: WorkStatus, comment: string) => void,
    onUpdateRiskResponseStatus?: (projectId: string, riskId: string, newStatus: WorkStatus, comment: string) => void,
    onNavigate: (page: string) => void,
    allProcessedActivities: Map<string, ProjectActivity>,
    delegations: Delegation[],
    onDelegateTask: (type: 'waterfall' | 'agile' | 'action', itemId: string | number, projectId: string | undefined, delegateeId: string) => void,
    onDeactivateDelegation: (delegationId: number) => void,
    dynamicWorkflowSettings?: DynamicWorkflowSettings
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    
    // Grouping & Filtering States
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isGroupingOpen, setIsGroupingOpen] = useState(false);
    const [groupByLevel1, setGroupByLevel1] = useState<string>('type'); // Default Level 1 = Type (Waterfall, Agile, Action)
    const [groupByLevel2, setGroupByLevel2] = useState<string>('project'); // Default Level 2 = Project Name
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const [filterText, setFilterText] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [projectFilter, setProjectFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    
    // Waterfall state
    const [progressValues, setProgressValues] = useState<Record<string, number>>({});
    const [submissionModalTask, setSubmissionModalTask] = useState<EnrichedTask | null>(null);
    const [historyModalInfo, setHistoryModalInfo] = useState<{type: 'activity', id: string, projectId: string} | null>(null);

    // Agile state
    const [statusUpdateModalTask, setStatusUpdateModalTask] = useState<EnrichedKanbanTask | null>(null);
    const [kanbanHistoryModalInfo, setKanbanHistoryModalInfo] = useState<{ taskId: number, projectId: string } | null>(null);
    
    // Action state
    const [actionStatusUpdateModal, setActionStatusUpdateModal] = useState<ActionItem | null>(null);
    const [actionHistoryModalId, setActionHistoryModalId] = useState<number | null>(null);
    const [riskHistoryModalInfo, setRiskHistoryModalInfo] = useState<{ title: string; typeLabel: string; history?: any[]; submittedBy?: number; isApproved?: boolean; isRejected?: boolean } | null>(null);
    
    // Delegation state
    const [delegationModalTask, setDelegationModalTask] = useState<{type: 'waterfall' | 'agile' | 'action', item: EnrichedTask | EnrichedKanbanTask | ActionItem} | null>(null);
    const [isMyDelegationsModalOpen, setIsMyDelegationsModalOpen] = useState<boolean>(false);

    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    const myWaterfallTasks = useMemo(() => {
        const tasks: EnrichedTask[] = [];
        projects
        .filter(p => p.approvalStatus === 'Approved' && p.type === 'waterfall')
        .forEach(p => {
            if (p.schedule) {
                const activityMap = new Map(p.schedule.map(a => [a.id, a]));
                p.schedule.forEach(a => {
                    const processedActivity = allProcessedActivities.get(a.id);
                    if (a.assignedToId === currentUser.id && !processedActivity?.isParent) {
                        const effectiveApproverId = a.approver1Id ?? p.projectManagerId ?? users.find(u => u.role === 'Admin')?.id ?? 1;
                        const approver = users.find(u => String(u.id) === String(effectiveApproverId));
                        const parent = a.parentId ? activityMap.get(a.parentId) : null;
                        const existingUpdate = progressUpdates.find(up => up.projectId === p.id && up.activityId === a.id && up.status === 'Pending Approval');
                        
                        tasks.push({
                            ...(processedActivity || a),
                            projectName: p.name,
                            projectId: p.id,
                            parentActivityName: parent?.name || '-',
                            approverName: approver?.username || 'N/A',
                            submissionStatus: existingUpdate ? existingUpdate.status : 'Unsubmitted',
                            reviewComment: existingUpdate?.reviewComment,
                        });
                    }
                });
            }
        });
        return tasks.reduce((acc, task) => {
            const key = task.projectId;
            if (!acc[key]) acc[key] = { name: task.projectName, tasks: [] };
            acc[key].tasks.push(task);
            return acc;
        }, {} as Record<number, { name: string, tasks: EnrichedTask[] }>);
    }, [projects, currentUser.id, users, progressUpdates, allProcessedActivities]);

     const myAgileTasks = useMemo(() => {
        const tasks: EnrichedKanbanTask[] = [];
        projects
            .filter(p => p.approvalStatus === 'Approved' && p.type === 'agile')
            .forEach(p => {
                if (p.kanbanTasks) {
                    p.kanbanTasks.forEach(task => {
                        if (task.assignedToId === currentUser.id) {
                            const existingUpdate = progressUpdates.find(up => up.projectId === p.id && up.taskId === task.id && up.status === 'Pending Approval');
                            const effectiveApproverId = task.approver1Id ?? p.projectManagerId ?? users.find(u => u.role === 'Admin')?.id ?? 1;
                            const approver = users.find(u => String(u.id) === String(effectiveApproverId));
                            tasks.push({
                                ...task,
                                projectName: p.name,
                                projectId: p.id,
                                approverName: approver?.username || 'N/A',
                                submissionStatus: existingUpdate ? existingUpdate.status : 'Unsubmitted',
                                reviewComment: existingUpdate?.reviewComment,
                            });
                        }
                    });
                }
            });
        return tasks.reduce((acc, task) => {
            const key = task.projectId;
            if (!acc[key]) acc[key] = { name: task.projectName, tasks: [] };
            acc[key].tasks.push(task);
            return acc;
        }, {} as Record<number, { name: string, tasks: EnrichedKanbanTask[] }>);
    }, [projects, currentUser.id, progressUpdates, users]);

    const myActions = useMemo(() => {
        return actions
          .filter(a => a.responsibleUserId === currentUser.id)
          .map(action => {
              const isPending = progressUpdates.some(up => up.actionId === action.id && up.status === 'Pending Approval');
              return { ...action, isPending };
          });
    }, [actions, currentUser.id, progressUpdates]);

    // Approved risk response plans assigned to current user
    const myRiskResponseActions = useMemo(() => {
        if (!currentUser) return [];
        const list: {
            risk: any;
            project: Project;
            isPending: boolean;
        }[] = [];

        projects.forEach(p => {
            (p.risks || []).forEach(r => {
                if (r.isApproved && !(r as any).isRejected && r.responsePlan) {
                    const isAssigned = r.assignedTo && (
                        r.assignedTo.trim().toLowerCase() === (currentUser.username || '').trim().toLowerCase() ||
                        r.assignedTo.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase() ||
                        String(r.assignedTo) === String(currentUser.id)
                    );
                    if (isAssigned) {
                        const isPending = r.verificationStatus === 'Pending Approval';
                        list.push({
                            risk: r,
                            project: p,
                            isPending
                        });
                    }
                }
            });
        });

        return list;
    }, [projects, currentUser]);

    // Normalize all task types into a unified TaskCenterItem
    type TaskCenterItem = {
        id: string;
        originalType: 'waterfall' | 'agile' | 'action' | 'risk_response';
        title: string;
        projectName: string;
        projectId?: string;
        startDate?: string;
        endDate?: string;
        approverName: string;
        status: string;
        priority: string;
        rawItem: any;
    };

    const allNormalizedTasks = useMemo(() => {
        const list: TaskCenterItem[] = [];

        // Waterfall
        Object.values(myWaterfallTasks).forEach(({ name: pName, tasks }) => {
            tasks.forEach(t => {
                list.push({
                    id: `wf-${t.id}`,
                    originalType: 'waterfall',
                    title: t.name,
                    projectName: pName,
                    projectId: t.projectId,
                    startDate: t.startDate,
                    endDate: t.endDate,
                    approverName: t.approverName || 'N/A',
                    status: t.submissionStatus,
                    priority: 'Medium',
                    rawItem: t
                });
            });
        });

        // Agile
        Object.values(myAgileTasks).forEach(({ name: pName, tasks }) => {
            tasks.forEach(t => {
                list.push({
                    id: `ag-${t.id}`,
                    originalType: 'agile',
                    title: t.description,
                    projectName: pName,
                    projectId: t.projectId,
                    endDate: t.dueDate,
                    approverName: t.approverName || 'N/A',
                    status: t.submissionStatus === 'Unsubmitted' ? t.status : t.submissionStatus,
                    priority: t.priority || 'Medium',
                    rawItem: t
                });
            });
        });

        // Actions
        myActions.forEach(a => {
            const effectiveApproverId = a.approver1Id ?? a.responsibleUserId ?? (a.projectId ? projects.find(p => p.id === a.projectId)?.projectManagerId : null) ?? users.find(u => u.role === 'Admin')?.id ?? 1;
            const approver = users.find(u => String(u.id) === String(effectiveApproverId));
            const projName = a.projectId ? (projects.find(p => p.id === a.projectId)?.name || (language === 'fa' ? 'سایر' : 'Other')) : (language === 'fa' ? 'عمومی / اقدامات' : 'General / Actions');
            
            list.push({
                id: `act-${a.id}`,
                originalType: 'action',
                title: a.title,
                projectName: projName,
                projectId: a.projectId,
                startDate: a.startDate,
                endDate: a.endDate,
                approverName: approver?.username || 'N/A',
                status: a.isPending ? 'Pending Approval' : a.status,
                priority: 'Medium',
                rawItem: a
            });
        });

        // Risk Response Actions (برنامه پاسخ ریسک)
        myRiskResponseActions.forEach(({ risk: r, project: p, isPending }) => {
            const stages = getEffectiveProjectWorkflowStages('risks', p, dynamicWorkflowSettings);
            const currentStageIdx = r.verificationStageIndex ?? 0;
            const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
            const effectiveApproverId = r.verificationApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);
            const approver = users.find(u => String(u.id) === String(effectiveApproverId));

            list.push({
                id: `risk-resp-${p.id}-${r.id}`,
                originalType: 'risk_response',
                title: `${language === 'fa' ? 'پاسخ ریسک: ' : 'Risk Response: '}${r.responsePlan} (${language === 'fa' ? 'ریسک: ' : 'Risk: '}${r.description})`,
                projectName: p.name,
                projectId: p.id,
                startDate: p.startDate,
                endDate: p.endDate,
                approverName: approver ? (approver.name ? `${approver.name} (${approver.username})` : approver.username) : (stage?.stageTitle || 'N/A'),
                status: isPending ? 'Pending Approval' : (r.responseStatus || 'Planning'),
                priority: r.impact === 'High' ? 'High' : (r.impact === 'Low' ? 'Low' : 'Medium'),
                rawItem: { ...r, isRiskResponse: true, projectId: p.id, riskId: r.id, isPending, title: `${language === 'fa' ? 'پاسخ ریسک: ' : 'Risk Response: '}${r.responsePlan}`, status: r.responseStatus || 'Planning' }
            });
        });

        return list;
    }, [myWaterfallTasks, myAgileTasks, myActions, myRiskResponseActions, projects, users, language, dynamicWorkflowSettings]);

    const availableProjects = useMemo(() => {
        const set = new Set<string>();
        allNormalizedTasks.forEach(t => {
            if (t.projectName) set.add(t.projectName);
        });
        return Array.from(set);
    }, [allNormalizedTasks]);

    // Filter tasks
    const filteredTasks = useMemo(() => {
        return allNormalizedTasks.filter(item => {
            if (filterText) {
                const search = filterText.toLowerCase();
                const matchTitle = item.title.toLowerCase().includes(search);
                const matchProject = item.projectName.toLowerCase().includes(search);
                if (!matchTitle && !matchProject) return false;
            }

            if (typeFilter !== 'all') {
                if (typeFilter === 'waterfall' && item.originalType !== 'waterfall') return false;
                if (typeFilter === 'agile' && item.originalType !== 'agile') return false;
                if (typeFilter === 'action' && item.originalType !== 'action') return false;
            }

            if (projectFilter !== 'all' && item.projectName !== projectFilter) {
                return false;
            }

            return true;
        });
    }, [allNormalizedTasks, filterText, typeFilter, projectFilter]);

    // Helper to extract key and label based on group level criteria
    const getGroupKeyAndLabel = (item: TaskCenterItem, criterion: string) => {
        switch (criterion) {
            case 'type':
                if (item.originalType === 'waterfall') return { key: 'waterfall', label: language === 'fa' ? 'آبشاری' : 'Waterfall' };
                if (item.originalType === 'agile') return { key: 'agile', label: language === 'fa' ? 'چابک' : 'Agile' };
                return { key: 'action', label: language === 'fa' ? 'اقدام' : 'Action' };
            case 'project':
                return { key: item.projectName || 'other', label: item.projectName || (language === 'fa' ? 'سایر' : 'Other') };
            case 'status':
                return { key: item.status || 'other', label: item.status || 'N/A' };
            case 'priority':
                return { key: item.priority || 'medium', label: item.priority || 'Medium' };
            default:
                return { key: 'all', label: language === 'fa' ? 'همه موارد' : 'All Items' };
        }
    };

    // 2-Level Grouped Data computation
    const groupedData = useMemo(() => {
        if (groupByLevel1 === 'none') {
            return [{
                key: 'all',
                label: language === 'fa' ? 'همه وظایف' : 'All Tasks',
                totalCount: filteredTasks.length,
                subgroups: [{
                    key: 'all',
                    label: '',
                    count: filteredTasks.length,
                    items: filteredTasks
                }]
            }];
        }

        const l1Map = new Map<string, { label: string; items: TaskCenterItem[] }>();

        filteredTasks.forEach(item => {
            const { key: l1Key, label: l1Label } = getGroupKeyAndLabel(item, groupByLevel1);
            if (!l1Map.has(l1Key)) {
                l1Map.set(l1Key, { label: l1Label, items: [] });
            }
            l1Map.get(l1Key)!.items.push(item);
        });

        const result: {
            key: string;
            label: string;
            totalCount: number;
            subgroups: { key: string; label: string; count: number; items: TaskCenterItem[] }[];
        }[] = [];

        l1Map.forEach(({ label: l1Label, items: l1Items }, l1Key) => {
            if (groupByLevel2 === 'none' || groupByLevel2 === groupByLevel1) {
                result.push({
                    key: l1Key,
                    label: l1Label,
                    totalCount: l1Items.length,
                    subgroups: [{
                        key: 'all',
                        label: '',
                        count: l1Items.length,
                        items: l1Items
                    }]
                });
            } else {
                const l2Map = new Map<string, { label: string; items: TaskCenterItem[] }>();
                l1Items.forEach(item => {
                    const { key: l2Key, label: l2Label } = getGroupKeyAndLabel(item, groupByLevel2);
                    if (!l2Map.has(l2Key)) {
                        l2Map.set(l2Key, { label: l2Label, items: [] });
                    }
                    l2Map.get(l2Key)!.items.push(item);
                });

                const subgroups: { key: string; label: string; count: number; items: TaskCenterItem[] }[] = [];
                l2Map.forEach(({ label: l2Label, items: l2Items }, l2Key) => {
                    subgroups.push({
                        key: l2Key,
                        label: l2Label,
                        count: l2Items.length,
                        items: l2Items
                    });
                });

                result.push({
                    key: l1Key,
                    label: l1Label,
                    totalCount: l1Items.length,
                    subgroups
                });
            }
        });

        return result;
    }, [filteredTasks, groupByLevel1, groupByLevel2, language]);

    // Group open/close management
    const toggleGroup = (groupKey: string) => {
        setOpenGroups(prev => ({
            ...prev,
            [groupKey]: prev[groupKey] === undefined ? false : !prev[groupKey]
        }));
    };

    const isGroupOpen = (groupKey: string) => {
        return openGroups[groupKey] !== false; // Open by default
    };

    const handleExpandAll = () => {
        const nextState: Record<string, boolean> = {};
        groupedData.forEach(l1 => {
            const l1Key = `l1-${l1.key}`;
            nextState[l1Key] = true;
            l1.subgroups.forEach(sg => {
                const l2Key = `${l1Key}-l2-${sg.key}`;
                nextState[l2Key] = true;
            });
        });
        setOpenGroups(nextState);
    };

    const handleCollapseAll = () => {
        const nextState: Record<string, boolean> = {};
        groupedData.forEach(l1 => {
            const l1Key = `l1-${l1.key}`;
            nextState[l1Key] = false;
            l1.subgroups.forEach(sg => {
                const l2Key = `${l1Key}-l2-${sg.key}`;
                nextState[l2Key] = false;
            });
        });
        setOpenGroups(nextState);
    };

    useEffect(() => {
        const initialProgress: Record<string, number> = {};
        Object.values(myWaterfallTasks).forEach(({ tasks }) => {
            tasks.forEach(task => {
                initialProgress[task.id] = task.actualProgress;
            });
        });
        setProgressValues(initialProgress);
    }, [myWaterfallTasks]);
    
    const handleProgressChange = (activityId: string, value: string) => {
        const numericValue = parseInt(value, 10);
        if(!isNaN(numericValue) && numericValue >= 0 && numericValue <= 100) {
            setProgressValues(prev => ({ ...prev, [activityId]: numericValue }));
        } else if (value === '') {
            setProgressValues(prev => ({ ...prev, [activityId]: 0 }));
        }
    };
    
    const handleSubmitClick = (task: EnrichedTask) => {
        const pending = progressUpdates.find(up => up.projectId === task.projectId && up.activityId === task.id && up.status === 'Pending Approval');
        if(pending) {
            alert(t('updateAlreadyPending'));
            return;
        }
        setSubmissionModalTask(task);
    };

    const handleSaveSubmission = (submissionComment: string, documentName?: string) => {
        if (submissionModalTask) {
            onAddProgressUpdate(
                submissionModalTask.projectId, 
                submissionModalTask.id, 
                progressValues[submissionModalTask.id] || 0,
                submissionComment,
                documentName
            );
            setSubmissionModalTask(null);
        }
    };

    const handleAgileStatusChangeClick = (task: EnrichedKanbanTask) => {
        const pending = progressUpdates.find(up => up.projectId === task.projectId && up.taskId === task.id && up.status === 'Pending Approval');
        if (pending) {
            alert(t('updateAlreadyPending'));
            return;
        }
        setStatusUpdateModalTask(task);
    };
    
    const handleSaveAgileStatus = (taskId: number, newStatus: KanbanStatus, comment: string) => {
        if (statusUpdateModalTask) {
            onAddKanbanStatusUpdate(statusUpdateModalTask.projectId, taskId, newStatus, comment);
            setStatusUpdateModalTask(null);
        }
    };

    const handleSaveActionStatus = (actionId: number, newStatus: WorkStatus, currentStatus: WorkStatus, comment: string) => {
        if (actionStatusUpdateModal && (actionStatusUpdateModal as any).isRiskResponse) {
            if (onUpdateRiskResponseStatus) {
                onUpdateRiskResponseStatus((actionStatusUpdateModal as any).projectId, (actionStatusUpdateModal as any).riskId, newStatus, comment);
            }
            setActionStatusUpdateModal(null);
            return;
        }
        onAddActionStatusUpdate(actionId, newStatus, currentStatus, comment);
        setActionStatusUpdateModal(null);
    };
    
    const statusTranslations: Record<ProgressUpdateStatus | 'Unsubmitted', TranslationKey> = {
        'Unsubmitted': 'unsubmitted',
        'Pending Approval': 'pendingApproval',
        'Approved': 'approved',
        'Rejected': 'rejected'
    };
    
    const statusClasses: Record<ProgressUpdateStatus | 'Unsubmitted', string> = {
        'Unsubmitted': 'status-unsubmitted',
        'Pending Approval': 'status-pending',
        'Approved': 'status-approved',
        'Rejected': 'status-rejected'
    };
    
    const kanbanStatusTranslations: Record<KanbanStatus, TranslationKey> = {
        'To-Do': 'toDo', 'Doing': 'doing', 'Done': 'done'
    };
    
    const workStatusTranslations: Record<WorkStatus, TranslationKey> = { 
        'Planning': 'planning', 
        'In Progress': 'inProgress', 
        'On Hold': 'onHold', 
        'Completed': 'completed' 
    };

    const taskPriorityTranslations: Record<TaskPriority, TranslationKey> = {
        'Low': 'low', 'Medium': 'medium', 'High': 'high'
    };

    const renderSubgroupTable = (items: TaskCenterItem[]) => {
        return React.createElement("div", { className: "table-responsive" },
            React.createElement("table", { className: "tab-table" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, t('activityDescription')),
                        React.createElement("th", null, language === 'fa' ? 'نوع / بخش' : 'Type / Tab'),
                        React.createElement("th", null, language === 'fa' ? 'پروژه' : 'Project'),
                        React.createElement("th", null, t('startDate')),
                        React.createElement("th", null, t('endDate')),
                        React.createElement("th", null, t('approver')),
                        React.createElement("th", null, t('status')),
                        React.createElement("th", null, t('actions'))
                    )
                ),
                React.createElement("tbody", null,
                    items.map(item => {
                        const isDelegatee = delegations.some(d => d.isActive && d.type === item.originalType && String(d.itemId) === String(item.rawItem.id) && d.delegateeId === currentUser.id);
                        
                        let typeLabel = '';
                        if (item.originalType === 'waterfall') typeLabel = language === 'fa' ? 'آبشاری' : 'Waterfall';
                        else if (item.originalType === 'agile') typeLabel = language === 'fa' ? 'چابک' : 'Agile';
                        else if (item.originalType === 'risk_response') typeLabel = language === 'fa' ? 'پاسخ ریسک' : 'Risk Response';
                        else typeLabel = language === 'fa' ? 'اقدام' : 'Action';

                        return React.createElement("tr", { key: item.id },
                            React.createElement("td", null, item.title),
                            React.createElement("td", null, React.createElement("span", { className: `badge ${item.originalType === 'risk_response' ? 'badge-warning' : 'badge-info'}`, style: { fontSize: '0.8rem', padding: '0.2rem 0.5rem' } }, typeLabel)),
                            React.createElement("td", null, item.projectName),
                            React.createElement("td", null, item.startDate ? formatDate(item.startDate, language) : '-'),
                            React.createElement("td", null, item.endDate ? formatDate(item.endDate, language) : '-'),
                            React.createElement("td", null, item.approverName),
                            React.createElement("td", null,
                                item.originalType === 'waterfall' ? (
                                    React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.25rem' } },
                                        React.createElement("div", { className: "progress-input-wrapper" },
                                            React.createElement("input", {
                                                type: "number",
                                                min: "0",
                                                max: "100",
                                                value: progressValues[item.rawItem.id] || 0,
                                                onChange: (e) => handleProgressChange(item.rawItem.id, e.target.value),
                                                disabled: item.rawItem.submissionStatus === 'Pending Approval'
                                            }),
                                            React.createElement("span", null, "%")
                                        ),
                                        React.createElement("span", { className: `status-badge ${statusClasses[item.rawItem.submissionStatus as ProgressUpdateStatus | 'Unsubmitted'] || 'status-unsubmitted'}` },
                                            t(statusTranslations[item.rawItem.submissionStatus as ProgressUpdateStatus | 'Unsubmitted'] || 'unsubmitted')
                                        )
                                    )
                                ) : item.originalType === 'agile' ? (
                                    React.createElement("div", { className: "status-cell" },
                                        React.createElement("span", { className: `status-badge ${statusClasses[item.rawItem.submissionStatus as ProgressUpdateStatus | 'Unsubmitted'] || 'status-unsubmitted'}` },
                                            item.rawItem.submissionStatus === 'Unsubmitted' ? t(kanbanStatusTranslations[item.rawItem.status as KanbanStatus] || 'toDo') : t(statusTranslations[item.rawItem.submissionStatus as ProgressUpdateStatus | 'Unsubmitted'] || 'unsubmitted')
                                        )
                                    )
                                ) : item.originalType === 'risk_response' ? (
                                    React.createElement("span", { className: `status-badge ${item.rawItem.isPending ? 'status-pending' : (item.rawItem.status === 'Completed' ? 'status-approved' : 'status-unsubmitted')}` },
                                        item.rawItem.isPending ? (language === 'fa' ? 'در انتظار صحه گذاری' : 'Pending Verification') : t(workStatusTranslations[item.rawItem.status as WorkStatus] || 'planning')
                                    )
                                ) : (
                                    React.createElement("span", { className: `status-badge ${item.rawItem.isPending ? 'status-pending' : 'status-approved'}` },
                                        item.rawItem.isPending ? t('pendingApproval') : t(workStatusTranslations[item.rawItem.status as WorkStatus] || 'planning')
                                    )
                                )
                            ),
                            React.createElement("td", { className: "action-cell" },
                                // History button
                                React.createElement("button", {
                                    onClick: () => {
                                        if (item.originalType === 'waterfall') setHistoryModalInfo({ type: 'activity', id: item.rawItem.id, projectId: item.rawItem.projectId });
                                        else if (item.originalType === 'agile') setKanbanHistoryModalInfo({ taskId: item.rawItem.id, projectId: item.rawItem.projectId });
                                        else if (item.originalType === 'risk_response') {
                                            setRiskHistoryModalInfo({
                                                title: item.title,
                                                typeLabel: language === 'fa' ? 'صحه گذاری اقدام پاسخ ریسک' : 'Risk Response Verification',
                                                history: item.rawItem.verificationHistory || item.rawItem.approvalHistory,
                                                submittedBy: item.rawItem.submittedBy,
                                                isApproved: item.rawItem.verificationStatus === 'Approved',
                                                isRejected: item.rawItem.verificationStatus === 'Rejected'
                                            });
                                        }
                                        else setActionHistoryModalId(item.rawItem.id);
                                    },
                                    className: "action-icon history",
                                    title: t('history')
                                } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "history")),

                                // Delegate button (for non-risk items)
                                item.originalType !== 'risk_response' && React.createElement("button", {
                                    onClick: () => setDelegationModalTask({ type: item.originalType as any, item: item.rawItem }),
                                    className: "action-icon",
                                    title: t('delegate'),
                                    disabled: isDelegatee
                                } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "assignment_ind")),

                                // Action execution button
                                item.originalType === 'waterfall' ? (
                                    React.createElement("button", {
                                        onClick: () => handleSubmitClick(item.rawItem),
                                        className: "submit-progress-btn",
                                        disabled: item.rawItem.submissionStatus === 'Pending Approval'
                                    } as React.HTMLAttributes<HTMLButtonElement>, t('submitForApproval'))
                                ) : item.originalType === 'agile' ? (
                                    React.createElement("button", {
                                        onClick: () => handleAgileStatusChangeClick(item.rawItem),
                                        className: "action-button",
                                        disabled: item.rawItem.submissionStatus === 'Pending Approval' || item.rawItem.status === 'Done'
                                    } as React.HTMLAttributes<HTMLButtonElement>, t('changeStatusAction'))
                                ) : item.originalType === 'risk_response' ? (
                                    React.createElement("button", {
                                        onClick: () => setActionStatusUpdateModal({
                                            id: item.rawItem.id,
                                            title: item.title,
                                            status: item.rawItem.status || 'Planning',
                                            responsibleUserId: currentUser.id,
                                            projectId: item.projectId,
                                            isRiskResponse: true,
                                            riskId: item.rawItem.riskId
                                        } as any),
                                        className: "action-button",
                                        style: { background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#fff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' },
                                        disabled: item.rawItem.isPending || item.rawItem.status === 'Completed'
                                    } as React.HTMLAttributes<HTMLButtonElement>, language === 'fa' ? 'ثبت وضعیت و ارسال به صحه‌گذاری' : 'Update & Submit for Verification')
                                ) : (
                                    React.createElement("button", {
                                        onClick: () => setActionStatusUpdateModal(item.rawItem),
                                        className: "action-button",
                                        disabled: item.rawItem.isPending || item.rawItem.status === 'Completed'
                                    } as React.HTMLAttributes<HTMLButtonElement>, t('changeStatusAction'))
                                )
                            )
                        );
                    })
                )
            )
        );
    };

    const noWaterfallTasks = Object.keys(myWaterfallTasks).length === 0;
    const noAgileTasks = Object.keys(myAgileTasks).length === 0;
    const noActions = myActions.length === 0;
    
    return (
        React.createElement("div", { className: "content-container" },
            submissionModalTask && (
                React.createElement(TaskSubmissionModal, {
                    task: submissionModalTask,
                    progress: progressValues[submissionModalTask.id] || 0,
                    onSave: handleSaveSubmission,
                    onClose: () => setSubmissionModalTask(null)
                })
            ),
            historyModalInfo?.type === 'activity' && (
                React.createElement(ActivityHistoryModal, { 
                    activityId: historyModalInfo.id,
                    projectId: historyModalInfo.projectId,
                    users: users,
                    progressUpdates: progressUpdates,
                    onClose: () => setHistoryModalInfo(null)
                })
            ),
            statusUpdateModalTask && (
                React.createElement(KanbanStatusUpdateModal, {
                    isOpen: !!statusUpdateModalTask,
                    onClose: () => setStatusUpdateModalTask(null),
                    task: statusUpdateModalTask,
                    onSubmit: handleSaveAgileStatus,
                })
            ),
            kanbanHistoryModalInfo && (
                React.createElement(KanbanHistoryModal, {
                    taskId: kanbanHistoryModalInfo.taskId,
                    projectId: kanbanHistoryModalInfo.projectId,
                    users: users,
                    progressUpdates: progressUpdates,
                    projects: projects,
                    onClose: () => setKanbanHistoryModalInfo(null)
                })
            ),
            actionStatusUpdateModal && (
                React.createElement(ActionStatusUpdateModal, {
                    isOpen: !!actionStatusUpdateModal,
                    onClose: () => setActionStatusUpdateModal(null),
                    action: actionStatusUpdateModal,
                    onSubmit: handleSaveActionStatus,
                })
            ),
            actionHistoryModalId && (
                React.createElement(ActionHistoryModal, {
                    actionId: actionHistoryModalId,
                    users,
                    progressUpdates,
                    actions,
                    onClose: () => setActionHistoryModalId(null)
                })
            ),
            riskHistoryModalInfo && (
                React.createElement(TabItemHistoryModal, {
                    isOpen: !!riskHistoryModalInfo,
                    onClose: () => setRiskHistoryModalInfo(null),
                    item: riskHistoryModalInfo,
                    users: users
                })
            ),
            delegationModalTask && (
                React.createElement(DelegationModal, {
                    isOpen: !!delegationModalTask,
                    onClose: () => setDelegationModalTask(null),
                    taskName: delegationModalTask.type === 'action' 
                        ? (delegationModalTask.item as ActionItem).title 
                        : delegationModalTask.type === 'waterfall' 
                            ? (delegationModalTask.item as EnrichedTask).name 
                            : (delegationModalTask.item as EnrichedKanbanTask).description,
                    users: users,
                    currentUserId: currentUser.id,
                    onSave: (delegateeId: string) => {
                        const { type, item } = delegationModalTask;
                        onDelegateTask(type, item.id, item.projectId, delegateeId);
                        setDelegationModalTask(null);
                    }
                })
            ),
            isMyDelegationsModalOpen && (
                React.createElement(MyDelegationsModal, {
                    isOpen: isMyDelegationsModalOpen,
                    onClose: () => setIsMyDelegationsModalOpen(false),
                    delegations: delegations.filter(d => d.delegatorId === currentUser.id && d.isActive),
                    projects: projects,
                    actions: actions,
                    users: users,
                    onDeactivate: onDeactivateDelegation
                })
            ),
            // PAGE HEADER WITH TOOLBAR
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('myTasks')),
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
                    React.createElement("button", { onClick: () => setIsMyDelegationsModalOpen(true), className: "action-button" } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "assignment_ind"),
                        t('myDelegations')
                    )
                )
            ),

            // FILTERS PANEL
            isFilterOpen && React.createElement("div", { className: "dashboard-filters portfolio-filters", style: { padding: '1rem', backgroundColor: 'var(--secondary-color)', marginBottom: '1rem', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '1rem' } },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "taskSearchFilter" }, language === 'fa' ? 'جستجوی عنوان / شرح' : 'Search Title / Description'),
                    React.createElement("input", {
                        type: "text",
                        id: "taskSearchFilter",
                        placeholder: t('filterPlaceholder'),
                        value: filterText,
                        onChange: e => setFilterText(e.target.value)
                    })
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "taskTypeFilter" }, language === 'fa' ? 'نوع وظیفه' : 'Task Type'),
                    React.createElement("select", {
                        id: "taskTypeFilter",
                        value: typeFilter,
                        onChange: e => setTypeFilter(e.target.value)
                    },
                        React.createElement("option", { value: "all" }, language === 'fa' ? 'همه انواع (آبشاری، چابک، اقدام)' : 'All Types'),
                        React.createElement("option", { value: "waterfall" }, language === 'fa' ? 'آبشاری' : 'Waterfall'),
                        React.createElement("option", { value: "agile" }, language === 'fa' ? 'چابک' : 'Agile'),
                        React.createElement("option", { value: "action" }, language === 'fa' ? 'اقدام' : 'Action')
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "taskProjectFilter" }, language === 'fa' ? 'پروژه' : 'Project'),
                    React.createElement("select", {
                        id: "taskProjectFilter",
                        value: projectFilter,
                        onChange: e => setProjectFilter(e.target.value)
                    },
                        React.createElement("option", { value: "all" }, language === 'fa' ? 'همه پروژه‌ها' : 'All Projects'),
                        availableProjects.map(pName => (
                            React.createElement("option", { key: pName, value: pName }, pName)
                        ))
                    )
                )
            ),

            // GROUPING PANEL
            isGroupingOpen && React.createElement("div", { className: "dashboard-filters portfolio-grouping-controls", style: { padding: '1rem', backgroundColor: 'var(--secondary-color)', marginBottom: '1rem', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '1rem', border: '1px solid var(--border-color)' } },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "taskGroupByLevel1" }, language === 'fa' ? 'گروه‌بندی سطح ۱' : 'Grouping Level 1'),
                    React.createElement("select", {
                        id: "taskGroupByLevel1",
                        value: groupByLevel1,
                        onChange: e => setGroupByLevel1(e.target.value)
                    },
                        React.createElement("option", { value: "type" }, language === 'fa' ? 'نوع (آبشاری، چابک، اقدام)' : 'Type (Waterfall, Agile, Action)'),
                        React.createElement("option", { value: "project" }, language === 'fa' ? 'نام پروژه' : 'Project Name'),
                        React.createElement("option", { value: "status" }, language === 'fa' ? 'وضعیت' : 'Status'),
                        React.createElement("option", { value: "priority" }, language === 'fa' ? 'اولویت' : 'Priority'),
                        React.createElement("option", { value: "none" }, language === 'fa' ? 'بدون گروه‌بندی' : 'No Grouping')
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "taskGroupByLevel2" }, language === 'fa' ? 'گروه‌بندی سطح ۲' : 'Grouping Level 2'),
                    React.createElement("select", {
                        id: "taskGroupByLevel2",
                        value: groupByLevel2,
                        onChange: e => setGroupByLevel2(e.target.value)
                    },
                        React.createElement("option", { value: "project" }, language === 'fa' ? 'نام پروژه' : 'Project Name'),
                        React.createElement("option", { value: "type" }, language === 'fa' ? 'نوع (آبشاری، چابک، اقدام)' : 'Type (Waterfall, Agile, Action)'),
                        React.createElement("option", { value: "status" }, language === 'fa' ? 'وضعیت' : 'Status'),
                        React.createElement("option", { value: "priority" }, language === 'fa' ? 'اولویت' : 'Priority'),
                        React.createElement("option", { value: "none" }, language === 'fa' ? 'بدون گروه‌بندی' : 'No Grouping')
                    )
                )
            ),

            filteredTasks.length === 0 ? (
                React.createElement("div", { className: "placeholder-content" }, t('noTasksAssigned'))
            ) : (
                React.createElement("div", { className: "task-center-container" },
                    groupedData.map(l1Group => {
                        const l1Key = `l1-${l1Group.key}`;
                        const isL1Open = isGroupOpen(l1Key);

                        return React.createElement("div", { key: l1Key, className: "project-group", style: { marginBottom: '1.5rem' } },
                            React.createElement("h3", {
                                className: "project-group-header",
                                onClick: () => toggleGroup(l1Key),
                                style: { cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', backgroundColor: 'var(--primary-color)', color: '#ffffff', borderRadius: '8px' }
                            } as React.HTMLAttributes<HTMLHeadingElement>,
                                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                                    React.createElement("span", { className: "material-symbols-outlined" }, isL1Open ? 'expand_less' : 'expand_more'),
                                    React.createElement("span", { style: { fontWeight: 600, fontSize: '1.05rem' } }, l1Group.label)
                                ),
                                React.createElement("span", { style: { backgroundColor: 'rgba(255,255,255,0.25)', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem' } },
                                    language === 'fa' ? `${toPersianDigits(l1Group.totalCount)} مورد` : `${l1Group.totalCount} items`
                                )
                            ),
                            isL1Open && React.createElement("div", { style: { padding: '0.75rem 0' } },
                                l1Group.subgroups.map(subgroup => {
                                    const l2Key = `${l1Key}-l2-${subgroup.key}`;
                                    const isL2Open = isGroupOpen(l2Key);

                                    return React.createElement("div", { key: l2Key, className: "project-sub-group", style: { marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' } },
                                        groupByLevel2 !== 'none' && React.createElement("div", {
                                            onClick: () => toggleGroup(l2Key),
                                            style: { cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.85rem', backgroundColor: 'var(--secondary-color)', borderBottom: isL2Open ? '1px solid var(--border-color)' : 'none' }
                                        },
                                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.4rem' } },
                                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.1rem' } }, isL2Open ? 'expand_less' : 'expand_more'),
                                                React.createElement("h4", { style: { margin: 0, fontSize: '0.95rem', fontWeight: 600 } }, subgroup.label)
                                            ),
                                            React.createElement("span", { style: { fontSize: '0.8rem', color: 'var(--text-muted)' } },
                                                language === 'fa' ? `${toPersianDigits(subgroup.count)} مورد` : `${subgroup.count} items`
                                            )
                                        ),
                                        (groupByLevel2 === 'none' || isL2Open) && renderSubgroupTable(subgroup.items)
                                    );
                                })
                            )
                        );
                    })
                )
            )
        )
    );
};

// --- ApprovalCenterPage ---
export const ApprovalCenterPage = ({ progressUpdates, projects, actions, users, currentUser, setApprovalCommentModalState, onNavigate, allProcessedActivities, setProjects, dynamicWorkflowSettings }: { 
    progressUpdates: ProgressUpdate[],
    projects: Project[],
    actions: ActionItem[],
    users: User[],
    currentUser: User,
    setApprovalCommentModalState: (review: any) => void,
    onNavigate: (page: string, context?: any) => void,
    allProcessedActivities: Map<string, ProjectActivity>,
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
    dynamicWorkflowSettings?: DynamicWorkflowSettings
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';
    const [historyModalInfo, setHistoryModalInfo] = useState<{ type: 'activity' | 'project' | 'kanban' | 'action', id: number | string, projectId?: string, project?: Project, taskId?: number, actionId?: number } | null>(null);
    const [isApprovalHistoryModalOpen, setIsApprovalHistoryModalOpen] = useState(false);
    const [feasibilityProject, setFeasibilityProject] = useState<Project | null>(null);

    const [pendingTabItemReview, setPendingTabItemReview] = useState<{
        projectId: string;
        tabId: string;
        itemId: number;
        status: 'Approved' | 'Rejected';
        title: string;
        typeLabel: string;
    } | null>(null);

    const [pendingTabItemHistory, setPendingTabItemHistory] = useState<{
        title: string;
        typeLabel: string;
        history?: any[];
        submittedBy?: number;
        isApproved?: boolean;
        isRejected?: boolean;
    } | null>(null);

    // Grouping & Filtering States for Approval Center
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isGroupingOpen, setIsGroupingOpen] = useState(false);
    const [groupByLevel1, setGroupByLevel1] = useState<string>('project'); // Default Level 1 = Project Name
    const [groupByLevel2, setGroupByLevel2] = useState<string>('tab'); // Default Level 2 = Type (Tab)
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const [filterText, setFilterText] = useState<string>('');
    const [projectFilter, setProjectFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [submitterFilter, setSubmitterFilter] = useState<string>('all');


    const handleViewProject = (project: Project) => {
        const page = `create_${project.type}_details`;
        onNavigate(page, { project: project, type: project.type, from: 'approval_center' });
    };
    
    const pendingTabItems = useMemo(() => {
        const list: {
            projectId: string;
            projectName: string;
            tabId: 'risks' | 'status' | 'delays' | 'docs' | 'stakeholders';
            tabLabel: string;
            itemId: string;
            description: string;
            submitterName: string;
        }[] = [];

        projects.forEach(p => {
            // Risks
            (p.risks || []).forEach(r => {
                if (!r.isApproved && !r.isRejected) {
                    const stages = getEffectiveProjectWorkflowStages('risks', p, dynamicWorkflowSettings);
                    const currentStageIdx = r.currentStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = r.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);

                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        const submitter = users.find(u => u.id === r.submittedBy);
                        list.push({
                            projectId: p.id,
                            projectName: p.name,
                            tabId: 'risks',
                            tabLabel: language === 'fa' ? 'ریسک‌ها' : 'Risks',
                            itemId: r.id,
                            description: r.description,
                            submitterName: submitter?.username || 'N/A'
                        });
                    }
                }

                // Risk verification workflow (صحه گذاری اقدام پاسخ ریسک)
                if (r.isApproved && r.verificationStatus === 'Pending Approval') {
                    const stages = getEffectiveProjectWorkflowStages('risks', p, dynamicWorkflowSettings);
                    const currentStageIdx = r.verificationStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = r.verificationApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);

                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        const submitter = users.find(u => u.username === r.assignedTo || u.name === r.assignedTo || String(u.id) === String(r.assignedTo));
                        list.push({
                            projectId: p.id,
                            projectName: p.name,
                            tabId: 'risk_verification' as any,
                            tabLabel: language === 'fa' ? 'صحه گذاری پاسخ ریسک' : 'Risk Response Verification',
                            itemId: r.id,
                            description: `${language === 'fa' ? 'صحه گذاری اقدام: ' : 'Verify Action: '}${r.responsePlan} (${language === 'fa' ? 'وضعیت ثبت شده: ' : 'Status: '}${r.submittedResponseStatus || r.responseStatus})`,
                            submitterName: submitter?.username || r.assignedTo || 'N/A'
                        });
                    }
                }
            });

            // Stakeholders
            (p.stakeholders || []).forEach(sh => {
                if (!sh.isApproved && !sh.isRejected) {
                    const stages = getEffectiveProjectWorkflowStages('stakeholders', p, dynamicWorkflowSettings);
                    const currentStageIdx = sh.currentStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = sh.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);

                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        const submitter = users.find(u => u.id === sh.submittedBy);
                        list.push({
                            projectId: p.id,
                            projectName: p.name,
                            tabId: 'stakeholders',
                            tabLabel: language === 'fa' ? 'ذینفعان' : 'Stakeholders',
                            itemId: sh.id,
                            description: sh.name,
                            submitterName: submitter?.username || 'N/A'
                        });
                    }
                }
            });

            // Status Updates
            (p.statusUpdates || []).forEach(s => {
                if (!s.isApproved && !s.isRejected) {
                    const stages = getEffectiveProjectWorkflowStages('status_updates', p, dynamicWorkflowSettings);
                    const currentStageIdx = s.currentStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = s.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);

                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        const submitter = users.find(u => u.id === s.submittedBy);
                        list.push({
                            projectId: p.id,
                            projectName: p.name,
                            tabId: 'status',
                            tabLabel: language === 'fa' ? 'آخرین وضعیت' : 'Status Updates',
                            itemId: s.id,
                            description: s.description,
                            submitterName: submitter?.username || 'N/A'
                        });
                    }
                }
            });

            // Delay Reasons
            (p.delayReasons || []).forEach(d => {
                if (!d.isApproved && !d.isRejected) {
                    const stages = getEffectiveProjectWorkflowStages('delay_reasons', p, dynamicWorkflowSettings);
                    const currentStageIdx = d.currentStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = d.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);

                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        const submitter = users.find(u => u.id === d.submittedBy);
                        list.push({
                            projectId: p.id,
                            projectName: p.name,
                            tabId: 'delays',
                            tabLabel: language === 'fa' ? 'دلایل تاخیر' : 'Delay Reasons',
                            itemId: d.id,
                            description: d.description,
                            submitterName: submitter?.username || 'N/A'
                        });
                    }
                }
            });

            // Documents
            (p.documents || []).forEach(doc => {
                if (!doc.isApproved && !doc.isRejected) {
                    const stages = getEffectiveProjectWorkflowStages('documents', p, dynamicWorkflowSettings);
                    const currentStageIdx = doc.currentStageIndex ?? 0;
                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                    const targetApproverId = doc.currentApproverId ?? (stage ? resolveWorkflowApproverId(stage.approverId, p) : p.projectManagerId);

                    if (String(targetApproverId) === String(currentUser.id) || currentUser.role === 'Admin') {
                        const submitter = users.find(u => u.id === doc.submittedBy);
                        list.push({
                            projectId: p.id,
                            projectName: p.name,
                            tabId: 'docs',
                            tabLabel: language === 'fa' ? 'مستندات' : 'Documents',
                            itemId: doc.id,
                            description: doc.name + (doc.description ? ` (${doc.description})` : ''),
                            submitterName: submitter?.username || 'N/A'
                        });
                    }
                }
            });
        });

        return list;
    }, [projects, users, currentUser, language, dynamicWorkflowSettings]);

    // The approval of a register item is the backend's workflow: it records the decision, moves to the next step or finishes, and checks
    // that the signed-in user is the one who may decide. The one exception is the risk-response verification round (below), which is
    // connected in a later phase.
    const registers = useProjects();
    const registerKindOfTab: Record<string, RegisterKind> = { risks: 'risk', stakeholders: 'stakeholder', status: 'status', delays: 'delay', docs: 'document' };

    const verifyRisk = (projectId: string, itemId: string, approve: boolean, comment?: string) => {
        const actorName = currentUser.name ? `${currentUser.name} (${currentUser.username})` : currentUser.username || 'User';
        let finalStatus: WorkStatus | null = null;
        setProjects(prev => prev.map(p => {
            if (p.id !== projectId) return p;
            const stages = getEffectiveProjectWorkflowStages('risks', p, dynamicWorkflowSettings);
            return {
                ...p,
                risks: (p.risks || []).map(r => {
                    if (r.id !== itemId) return r;
                    const currentStageIdx = r.verificationStageIndex ?? 0;
                    const currentStage = stages ? stages[currentStageIdx] : undefined;
                    const stageTitle = currentStage ? currentStage.stageTitle : (language === 'fa' ? `مرحله ${toPersianDigits(currentStageIdx + 1)}` : `Stage ${currentStageIdx + 1}`);
                    const baseHistory = r.verificationHistory && r.verificationHistory.length > 0
                        ? r.verificationHistory
                        : [{
                            action: 'Submitted' as const,
                            date: getISODateTimeString(),
                            actor: r.assignedTo || 'مسئول ریسک',
                            stageTitle: language === 'fa' ? 'ثبت وضعیت اقدام' : 'Submit Response Status',
                            comment: language === 'fa' ? 'ثبت وضعیت اقدام پاسخ ریسک' : 'Submit Response Status'
                        }];

                    if (!approve) {
                        const rec: ProjectApprovalRecord = {
                            action: 'Rejected', date: getISODateTimeString(), actor: actorName, stageTitle,
                            comment: comment || (language === 'fa' ? 'عدم تایید صحه گذاری' : 'Verification Rejected')
                        };
                        return { ...r, verificationStatus: 'Rejected', verificationHistory: [...baseHistory, rec] };
                    }

                    const hasNextStage = !!(stages && currentStageIdx < stages.length - 1);
                    const rec: ProjectApprovalRecord = {
                        action: 'Approved', date: getISODateTimeString(), actor: actorName, stageTitle,
                        comment: comment || (!hasNextStage ? (language === 'fa' ? 'تایید نهایی صحه گذاری شد' : 'Final Verification Approved') : (language === 'fa' ? `تایید مرحله ${toPersianDigits(currentStageIdx + 1)}` : `Approved Stage ${currentStageIdx + 1}`))
                    };
                    const updatedHistory = [...baseHistory, rec];
                    if (hasNextStage && stages) {
                        const nextIdx = currentStageIdx + 1;
                        const nextStage = stages[nextIdx];
                        const nextApproverId = nextStage ? resolveWorkflowApproverId(nextStage.approverId, p) : p.projectManagerId;
                        return { ...r, verificationStageIndex: nextIdx, verificationApproverId: nextApproverId, verificationStatus: 'Pending Approval', verificationHistory: updatedHistory };
                    }
                    finalStatus = r.submittedResponseStatus || r.responseStatus || 'Completed';
                    return { ...r, responseStatus: finalStatus, verificationStatus: 'Approved', verificationHistory: updatedHistory };
                })
            };
        }));
        // Once the verification is complete the new response status is the risk's state on the backend.
        if (finalStatus) void registers.setRiskResponseStatus(projectId, itemId, finalStatus);
    };

    const decideTabItem = async (projectId: string, tabId: string, itemId: string, approve: boolean, comment?: string) => {
        const kind = registerKindOfTab[tabId];
        if (kind) {
            const outcome = await registers.decide(kind, projectId, itemId, approve, comment);
            if (!outcome.ok) window.alert(outcome.message || (language === 'fa' ? 'انجام نشد.' : 'The decision could not be recorded.'));
            return;
        }
        if (tabId === 'risk_verification') verifyRisk(projectId, itemId, approve, comment);
    };

    const handleApproveTabItem = (projectId: string, tabId: string, itemId: string, comment?: string) =>
        void decideTabItem(projectId, tabId, itemId, true, comment);

    const handleRejectTabItem = (projectId: string, tabId: string, itemId: string, comment?: string) =>
        void decideTabItem(projectId, tabId, itemId, false, comment);

    const pendingActivityApprovals = useMemo(() => {
        return progressUpdates
            .filter(up => up.status === 'Pending Approval' && up.activityId && String(up.currentApproverId) === String(currentUser.id))
            .map(up => {
                const project = projects.find(p => p.id === up.projectId);
                if (!project) {
                    return null;
                }
                const activity = allProcessedActivities.get(up.activityId!);
                const submitter = users.find(u => u.id === up.submittedBy);
                const processedActivity = allProcessedActivities.get(up.activityId!);
                return { 
                    ...up, 
                    projectName: project?.name, 
                    activityName: activity?.name, 
                    submitterName: submitter?.username,
                    startDate: processedActivity?.startDate,
                    endDate: processedActivity?.endDate,
                    plannedProgress: processedActivity?.plannedProgress || 0
                };
            })
            .filter((up): up is NonNullable<typeof up> => up !== null);
    }, [progressUpdates, projects, users, allProcessedActivities, currentUser]);

    const pendingKanbanApprovals = useMemo(() => {
        return progressUpdates
            .filter(up => up.status === 'Pending Approval' && up.taskId && up.submittedStatus && String(up.currentApproverId) === String(currentUser.id))
            .map(up => {
                const project = projects.find(p => p.id === up.projectId);
                 if (!project) {
                    return null;
                }
                const submitter = users.find(u => u.id === up.submittedBy);
                const task = project.kanbanTasks?.find(t => t.id === up.taskId);
                if (!submitter || !task) return null;
                
                return {
                    ...up,
                    projectName: project.name,
                    taskDescription: task.description,
                    submitterName: submitter.username,
                };
            })
            .filter((up): up is NonNullable<typeof up> => up !== null);
    }, [progressUpdates, projects, users, currentUser]);
    
    const pendingProjectApprovals = useMemo(() => {
        return projects
            .filter(p => p.approvalStatus === 'Pending Approval')
            .filter(p => {
                if (p.approver1Id) {
                    return String(p.approver1Id) === String(currentUser.id);
                }
                return currentUser.role === 'Admin';
            })
            .map(p => {
                const submitter = users.find(u => u.id === p.projectManagerId || u.id === p.ownerId);
                return {
                    ...p,
                    submitterName: submitter?.username || 'N/A',
                };
            });
    }, [projects, currentUser, users]);

    const pendingActionStatusApprovals = useMemo(() => {
        return progressUpdates
            .filter(up => up.status === 'Pending Approval' && up.actionId && String(up.currentApproverId) === String(currentUser.id))
            .map(up => {
                const action = actions.find(a => a.id === up.actionId);
                if (!action) {
                    return null;
                }
                const submitter = users.find(u => u.id === up.submittedBy);
                return { ...up, action, submitterName: submitter?.username };
            })
            .filter((up): up is NonNullable<typeof up> => up !== null);
    }, [progressUpdates, actions, users, currentUser]);

    const pendingCharterApprovals = useMemo(() => {
        return progressUpdates
            .filter(up => up.status === 'Pending Approval' && up.submittedCharter && String(up.currentApproverId) === String(currentUser.id))
            .map(up => {
                const project = projects.find(p => p.id === up.projectId);
                const submitter = users.find(u => u.id === up.submittedBy);
                return {
                    ...up,
                    projectName: project?.name || 'N/A',
                    submitterName: submitter?.username || 'N/A'
                };
            });
    }, [progressUpdates, projects, users, currentUser]);

    const hasPendingProjects = pendingProjectApprovals.length > 0;
    const hasPendingActivities = pendingActivityApprovals.length > 0;
    const hasPendingKanbanApprovals = pendingKanbanApprovals.length > 0;
    const hasPendingActionStatusApprovals = pendingActionStatusApprovals.length > 0;
    const hasPendingCharterApprovals = pendingCharterApprovals.length > 0;
    const hasPendingTabItems = pendingTabItems.length > 0;
    const isProjectApprover = currentUser.role === 'Admin' || pendingProjectApprovals.length > 0;
    const kanbanStatusTranslations: Record<KanbanStatus, TranslationKey> = { 'To-Do': 'toDo', 'Doing': 'doing', 'Done': 'done' };
    const workStatusTranslations: Record<WorkStatus, TranslationKey> = { 'Planning': 'planning', 'In Progress': 'inProgress', 'On Hold': 'onHold', 'Completed': 'completed' };

    // Unified Approval Item Type
    type ApprovalCenterItem = {
        id: string;
        approvalType: 'project' | 'charter' | 'waterfall' | 'agile' | 'action' | 'risks' | 'stakeholders' | 'status' | 'delays' | 'docs';
        typeLabel: string;
        projectName: string;
        projectId?: string;
        description: string;
        submitterName: string;
        rawItem: any;
    };

    const allApprovalItems = useMemo(() => {
        const list: ApprovalCenterItem[] = [];

        // 1. Project / Feasibility
        pendingProjectApprovals.forEach(p => {
            list.push({
                id: `proj-${p.id}`,
                approvalType: 'project',
                typeLabel: language === 'fa' ? 'پروژه / توجیه‌پذیری' : 'Project / Feasibility',
                projectName: p.name,
                projectId: p.id,
                description: p.description || p.name,
                submitterName: p.submitterName,
                rawItem: p
            });
        });

        // 2. Charter Changes
        pendingCharterApprovals.forEach(c => {
            list.push({
                id: `charter-${c.id}`,
                approvalType: 'charter',
                typeLabel: language === 'fa' ? 'تغییر منشور' : 'Charter Change',
                projectName: c.projectName,
                projectId: c.projectId,
                description: c.submissionComment || (language === 'fa' ? 'اصلاح منشور پروژه' : 'Charter Revision'),
                submitterName: c.submitterName,
                rawItem: c
            });
        });

        // 3. Waterfall Schedule Updates
        pendingActivityApprovals.forEach(act => {
            list.push({
                id: `act-${act.id}`,
                approvalType: 'waterfall',
                typeLabel: language === 'fa' ? 'زمانبندی آبشاری' : 'Waterfall Schedule',
                projectName: act.projectName || 'N/A',
                projectId: act.projectId,
                description: act.activityName || 'N/A',
                submitterName: act.submitterName || 'N/A',
                rawItem: act
            });
        });

        // 4. Agile Kanban Task Updates
        pendingKanbanApprovals.forEach(kan => {
            list.push({
                id: `kan-${kan.id}`,
                approvalType: 'agile',
                typeLabel: language === 'fa' ? 'زمانبندی چابک' : 'Agile Kanban',
                projectName: kan.projectName,
                projectId: kan.projectId,
                description: kan.taskDescription,
                submitterName: kan.submitterName,
                rawItem: kan
            });
        });

        // 5. Action Items
        pendingActionStatusApprovals.forEach(act => {
            const proj = act.action.projectId ? projects.find(p => p.id === act.action.projectId) : null;
            list.push({
                id: `action-${act.id}`,
                approvalType: 'action',
                typeLabel: language === 'fa' ? 'اقدامات' : 'Actions',
                projectName: proj ? proj.name : (language === 'fa' ? 'عمومی' : 'General'),
                projectId: act.action.projectId,
                description: act.action.title,
                submitterName: act.submitterName || 'N/A',
                rawItem: act
            });
        });

        // 6. Project Tab Items (Risks, Stakeholders, Status Updates, Delay Reasons, Documents)
        pendingTabItems.forEach(tabItem => {
            list.push({
                id: `tab-${tabItem.tabId}-${tabItem.itemId}`,
                approvalType: tabItem.tabId as any,
                typeLabel: tabItem.tabLabel,
                projectName: tabItem.projectName,
                projectId: tabItem.projectId,
                description: tabItem.description,
                submitterName: tabItem.submitterName,
                rawItem: tabItem
            });
        });

        return list;
    }, [pendingProjectApprovals, pendingCharterApprovals, pendingActivityApprovals, pendingKanbanApprovals, pendingActionStatusApprovals, pendingTabItems, projects, language]);

    const availableProjects = useMemo(() => {
        const set = new Set<string>();
        allApprovalItems.forEach(item => {
            if (item.projectName) set.add(item.projectName);
        });
        return Array.from(set);
    }, [allApprovalItems]);

    const availableSubmitters = useMemo(() => {
        const set = new Set<string>();
        allApprovalItems.forEach(item => {
            if (item.submitterName) set.add(item.submitterName);
        });
        return Array.from(set);
    }, [allApprovalItems]);

    const availableTypes = useMemo(() => {
        const set = new Set<string>();
        allApprovalItems.forEach(item => {
            if (item.typeLabel) set.add(item.typeLabel);
        });
        return Array.from(set);
    }, [allApprovalItems]);

    // Filter Items
    const filteredApprovalItems = useMemo(() => {
        return allApprovalItems.filter(item => {
            if (filterText) {
                const search = filterText.toLowerCase();
                const matchDesc = item.description.toLowerCase().includes(search);
                const matchProj = item.projectName.toLowerCase().includes(search);
                const matchSub = item.submitterName.toLowerCase().includes(search);
                if (!matchDesc && !matchProj && !matchSub) return false;
            }

            if (projectFilter !== 'all' && item.projectName !== projectFilter) {
                return false;
            }

            if (typeFilter !== 'all' && item.typeLabel !== typeFilter) {
                return false;
            }

            if (submitterFilter !== 'all' && item.submitterName !== submitterFilter) {
                return false;
            }

            return true;
        });
    }, [allApprovalItems, filterText, projectFilter, typeFilter, submitterFilter]);

    // Grouping helper
    const getGroupKeyAndLabel = (item: ApprovalCenterItem, criterion: string) => {
        switch (criterion) {
            case 'project':
                return { key: item.projectName || 'other', label: item.projectName || (language === 'fa' ? 'سایر' : 'Other') };
            case 'tab':
            case 'type':
                return { key: item.approvalType, label: item.typeLabel };
            case 'submitter':
                return { key: item.submitterName || 'unknown', label: item.submitterName || (language === 'fa' ? 'نامشخص' : 'Unknown') };
            default:
                return { key: 'all', label: language === 'fa' ? 'همه موارد' : 'All Items' };
        }
    };

    // 2-Level Grouped Approval Data computation
    const groupedApprovalData = useMemo(() => {
        if (groupByLevel1 === 'none') {
            return [{
                key: 'all',
                label: language === 'fa' ? 'همه موارد در انتظار تایید' : 'All Pending Approvals',
                totalCount: filteredApprovalItems.length,
                subgroups: [{
                    key: 'all',
                    label: '',
                    count: filteredApprovalItems.length,
                    items: filteredApprovalItems
                }]
            }];
        }

        const l1Map = new Map<string, { label: string; items: ApprovalCenterItem[] }>();

        filteredApprovalItems.forEach(item => {
            const { key: l1Key, label: l1Label } = getGroupKeyAndLabel(item, groupByLevel1);
            if (!l1Map.has(l1Key)) {
                l1Map.set(l1Key, { label: l1Label, items: [] });
            }
            l1Map.get(l1Key)!.items.push(item);
        });

        const result: {
            key: string;
            label: string;
            totalCount: number;
            subgroups: { key: string; label: string; count: number; items: ApprovalCenterItem[] }[];
        }[] = [];

        l1Map.forEach(({ label: l1Label, items: l1Items }, l1Key) => {
            if (groupByLevel2 === 'none' || groupByLevel2 === groupByLevel1) {
                result.push({
                    key: l1Key,
                    label: l1Label,
                    totalCount: l1Items.length,
                    subgroups: [{
                        key: 'all',
                        label: '',
                        count: l1Items.length,
                        items: l1Items
                    }]
                });
            } else {
                const l2Map = new Map<string, { label: string; items: ApprovalCenterItem[] }>();
                l1Items.forEach(item => {
                    const { key: l2Key, label: l2Label } = getGroupKeyAndLabel(item, groupByLevel2);
                    if (!l2Map.has(l2Key)) {
                        l2Map.set(l2Key, { label: l2Label, items: [] });
                    }
                    l2Map.get(l2Key)!.items.push(item);
                });

                const subgroups: { key: string; label: string; count: number; items: ApprovalCenterItem[] }[] = [];
                l2Map.forEach(({ label: l2Label, items: l2Items }, l2Key) => {
                    subgroups.push({
                        key: l2Key,
                        label: l2Label,
                        count: l2Items.length,
                        items: l2Items
                    });
                });

                result.push({
                    key: l1Key,
                    label: l1Label,
                    totalCount: l1Items.length,
                    subgroups
                });
            }
        });

        return result;
    }, [filteredApprovalItems, groupByLevel1, groupByLevel2, language]);

    // Group toggle helpers
    const toggleGroup = (groupKey: string) => {
        setOpenGroups(prev => ({
            ...prev,
            [groupKey]: prev[groupKey] === undefined ? false : !prev[groupKey]
        }));
    };

    const isGroupOpen = (groupKey: string) => {
        return openGroups[groupKey] !== false; // Open by default
    };

    const handleExpandAll = () => {
        const nextState: Record<string, boolean> = {};
        groupedApprovalData.forEach(l1 => {
            const l1Key = `l1-${l1.key}`;
            nextState[l1Key] = true;
            l1.subgroups.forEach(sg => {
                const l2Key = `${l1Key}-l2-${sg.key}`;
                nextState[l2Key] = true;
            });
        });
        setOpenGroups(nextState);
    };

    const handleCollapseAll = () => {
        const nextState: Record<string, boolean> = {};
        groupedApprovalData.forEach(l1 => {
            const l1Key = `l1-${l1.key}`;
            nextState[l1Key] = false;
            l1.subgroups.forEach(sg => {
                const l2Key = `${l1Key}-l2-${sg.key}`;
                nextState[l2Key] = false;
            });
        });
        setOpenGroups(nextState);
    };


    const renderApprovalSubgroupTable = (items: ApprovalCenterItem[]) => {
        return React.createElement("div", { className: "table-responsive" },
            React.createElement("table", { className: "users-table" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, t('projectNameColumn')),
                        React.createElement("th", null, language === 'fa' ? 'بخش / نوع' : 'Type / Tab'),
                        React.createElement("th", null, t('submitter')),
                        React.createElement("th", null, language === 'fa' ? 'شرح / عنوان' : 'Description / Title'),
                        React.createElement("th", null, t('actions'))
                    )
                ),
                React.createElement("tbody", null,
                    items.map(item => {
                        return React.createElement("tr", { key: item.id },
                            React.createElement("td", null, item.projectName),
                            React.createElement("td", null, React.createElement("span", { className: "badge badge-info", style: { fontSize: '0.8rem', padding: '0.2rem 0.5rem' } }, item.typeLabel)),
                            React.createElement("td", null, item.submitterName),
                            React.createElement("td", { style: { whiteSpace: 'pre-wrap' } }, item.description),
                            React.createElement("td", { className: "action-cell" },
                                item.approvalType === 'project' ? (
                                    React.createElement(Fragment, null,
                                        React.createElement("button", { onClick: () => handleViewProject(item.rawItem), className: "action-icon view", title: t('viewProject') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "visibility")),
                                        React.createElement("button", { onClick: () => setHistoryModalInfo({ type: 'project', id: item.rawItem.id, project: item.rawItem }), className: "action-icon history", title: t('history') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                        React.createElement("button", {
                                            onClick: () => setFeasibilityProject(item.rawItem),
                                            className: "action-button",
                                            style: { background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff', border: 'none', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }
                                        } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.05rem' } }, "fact_check"), language === 'fa' ? 'امکان‌سنجی و تایید/رد' : 'Feasibility & Approval')
                                    )
                                ) : item.approvalType === 'charter' ? (
                                    (() => {
                                        const proj = projects.find(p => p.id === item.rawItem.projectId);
                                        return proj ? React.createElement("button", {
                                            onClick: () => setFeasibilityProject(item.rawItem.submittedCharter ? { ...proj, ...item.rawItem.submittedCharter } : proj),
                                            className: "action-button",
                                            style: { background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff', border: 'none', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }
                                        } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.05rem' } }, "fact_check"), language === 'fa' ? 'امکان‌سنجی و تایید/رد' : 'Feasibility & Approval') : null;
                                    })()
                                ) : item.approvalType === 'waterfall' ? (
                                    React.createElement(Fragment, null,
                                        React.createElement("button", { onClick: () => setHistoryModalInfo({ type: 'activity', id: item.rawItem.activityId!, projectId: item.rawItem.projectId }), className: "action-icon history", title: t('history') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                        React.createElement("button", { onClick: () => setApprovalCommentModalState({ type: 'progress', id: item.rawItem.id, status: 'Approved' }), className: "approve-btn" } as React.HTMLAttributes<HTMLButtonElement>, t('approve')),
                                        React.createElement("button", { onClick: () => setApprovalCommentModalState({ type: 'progress', id: item.rawItem.id, status: 'Rejected' }), className: "reject-btn" } as React.HTMLAttributes<HTMLButtonElement>, t('reject'))
                                    )
                                ) : item.approvalType === 'agile' ? (
                                    React.createElement(Fragment, null,
                                        React.createElement("button", { onClick: () => setHistoryModalInfo({ type: 'kanban', id: item.rawItem.id, taskId: item.rawItem.taskId, projectId: item.rawItem.projectId }), className: "action-icon history", title: t('history') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                        React.createElement("button", { onClick: () => setApprovalCommentModalState({ type: 'progress', id: item.rawItem.id, status: 'Approved' }), className: "approve-btn" } as React.HTMLAttributes<HTMLButtonElement>, t('approve')),
                                        React.createElement("button", { onClick: () => setApprovalCommentModalState({ type: 'progress', id: item.rawItem.id, status: 'Rejected' }), className: "reject-btn" } as React.HTMLAttributes<HTMLButtonElement>, t('reject'))
                                    )
                                ) : item.approvalType === 'action' ? (
                                    React.createElement(Fragment, null,
                                        React.createElement("button", { onClick: () => setHistoryModalInfo({ type: 'action', id: item.rawItem.id, actionId: item.rawItem.actionId }), className: "action-icon history", title: t('history') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                        React.createElement("button", { onClick: () => setApprovalCommentModalState({ type: 'progress', id: item.rawItem.id, status: 'Approved' }), className: "approve-btn" } as React.HTMLAttributes<HTMLButtonElement>, t('approve')),
                                        React.createElement("button", { onClick: () => setApprovalCommentModalState({ type: 'progress', id: item.rawItem.id, status: 'Rejected' }), className: "reject-btn" } as React.HTMLAttributes<HTMLButtonElement>, t('reject'))
                                    )
                                ) : (
                                    React.createElement(Fragment, null,
                                        React.createElement("button", {
                                            onClick: () => {
                                                const p = projects.find(proj => proj.id === item.rawItem.projectId);
                                                let rawObj: any;
                                                if (p) {
                                                    if (item.rawItem.tabId === 'risks' || item.rawItem.tabId === 'risk_verification') rawObj = (p.risks || []).find(r => r.id === item.rawItem.itemId);
                                                    else if (item.rawItem.tabId === 'stakeholders') rawObj = (p.stakeholders || []).find(s => s.id === item.rawItem.itemId);
                                                    else if (item.rawItem.tabId === 'status') rawObj = (p.statusUpdates || []).find(s => s.id === item.rawItem.itemId);
                                                    else if (item.rawItem.tabId === 'delays') rawObj = (p.delayReasons || []).find(d => d.id === item.rawItem.itemId);
                                                    else if (item.rawItem.tabId === 'docs') rawObj = (p.documents || []).find(d => d.id === item.rawItem.itemId);
                                                }
                                                setPendingTabItemHistory({
                                                    title: item.description,
                                                    typeLabel: item.typeLabel,
                                                    history: item.rawItem.tabId === 'risk_verification' ? (rawObj?.verificationHistory || rawObj?.approvalHistory) : rawObj?.approvalHistory,
                                                    submittedBy: rawObj?.submittedBy,
                                                    isApproved: item.rawItem.tabId === 'risk_verification' ? (rawObj?.verificationStatus === 'Approved') : rawObj?.isApproved,
                                                    isRejected: item.rawItem.tabId === 'risk_verification' ? (rawObj?.verificationStatus === 'Rejected') : rawObj?.isRejected
                                                });
                                            },
                                            className: "action-icon history",
                                            title: t('history')
                                        } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                        React.createElement("button", {
                                            onClick: () => setPendingTabItemReview({
                                                projectId: item.rawItem.projectId,
                                                tabId: item.rawItem.tabId,
                                                itemId: item.rawItem.itemId,
                                                status: 'Approved',
                                                title: item.description,
                                                typeLabel: item.typeLabel
                                            }),
                                            className: "approve-btn"
                                        } as React.HTMLAttributes<HTMLButtonElement>, t('approve')),
                                        React.createElement("button", {
                                            onClick: () => setPendingTabItemReview({
                                                projectId: item.rawItem.projectId,
                                                tabId: item.rawItem.tabId,
                                                itemId: item.rawItem.itemId,
                                                status: 'Rejected',
                                                title: item.description,
                                                typeLabel: item.typeLabel
                                            }),
                                            className: "reject-btn"
                                        } as React.HTMLAttributes<HTMLButtonElement>, t('reject'))
                                    )
                                )
                            )
                        );
                    })
                )
            )
        );
    };

    return (
        React.createElement("div", { className: "content-container" },
            historyModalInfo?.type === 'activity' && historyModalInfo.projectId && (
                React.createElement(ActivityHistoryModal, { 
                    activityId: historyModalInfo.id as string,
                    projectId: historyModalInfo.projectId,
                    users: users,
                    progressUpdates: progressUpdates,
                    onClose: () => setHistoryModalInfo(null)
                })
            ),
            historyModalInfo?.type === 'project' && historyModalInfo.project && (
                React.createElement(ProjectHistoryModal, { 
                    project: historyModalInfo.project,
                    onClose: () => setHistoryModalInfo(null)
                })
            ),
             historyModalInfo?.type === 'kanban' && historyModalInfo.taskId && historyModalInfo.projectId && (
                React.createElement(KanbanHistoryModal, {
                    taskId: historyModalInfo.taskId as number,
                    projectId: historyModalInfo.projectId,
                    users,
                    progressUpdates,
                    projects,
                    onClose: () => setHistoryModalInfo(null)
                })
            ),
            historyModalInfo?.type === 'action' && historyModalInfo.actionId && (
                React.createElement(ActionHistoryModal, {
                    actionId: historyModalInfo.actionId as number,
                    users,
                    progressUpdates,
                    actions,
                    onClose: () => setHistoryModalInfo(null)
                })
            ),
            pendingTabItemHistory && (
                React.createElement(TabItemHistoryModal, {
                    itemTitle: pendingTabItemHistory.title,
                    itemTypeLabel: pendingTabItemHistory.typeLabel,
                    approvalHistory: pendingTabItemHistory.history,
                    submittedBy: pendingTabItemHistory.submittedBy,
                    isApproved: pendingTabItemHistory.isApproved,
                    isRejected: pendingTabItemHistory.isRejected,
                    users: users,
                    onClose: () => setPendingTabItemHistory(null)
                })
            ),
            pendingTabItemReview && (
                React.createElement(ApprovalCommentModal, {
                    title: `${language === 'fa' ? 'ثبت نظر و علت' : 'Review & Reason'} (${pendingTabItemReview.status === 'Approved' ? (language === 'fa' ? 'تایید' : 'Approve') : (language === 'fa' ? 'عدم تایید' : 'Reject')}) - ${pendingTabItemReview.typeLabel}`,
                    initialComment: '',
                    status: pendingTabItemReview.status,
                    onSave: (comment, overrideStatus) => {
                        const finalStatus = overrideStatus || pendingTabItemReview.status;
                        if (finalStatus === 'Approved') {
                            handleApproveTabItem(pendingTabItemReview.projectId, pendingTabItemReview.tabId, pendingTabItemReview.itemId, comment);
                        } else {
                            handleRejectTabItem(pendingTabItemReview.projectId, pendingTabItemReview.tabId, pendingTabItemReview.itemId, comment);
                        }
                        setPendingTabItemReview(null);
                    },
                    onClose: () => setPendingTabItemReview(null)
                })
            ),
            isApprovalHistoryModalOpen && (
                React.createElement(ApprovalHistoryModal, {
                    progressUpdates: progressUpdates,
                    projects: projects,
                    actions: actions,
                    users: users,
                    allProcessedActivities: allProcessedActivities,
                    onClose: () => setIsApprovalHistoryModalOpen(false)
                })
            ),
            feasibilityProject && (
                React.createElement(AiFeasibilityModal, {
                    project: feasibilityProject,
                    onTransferToComment: (comment: string, isJustified: boolean) => {
                        const pendingCharterUpdate = progressUpdates.find(up => up.projectId === feasibilityProject.id && up.submittedCharter && up.status === 'Pending Approval');
                        if (pendingCharterUpdate) {
                            setApprovalCommentModalState({
                                type: 'progress',
                                id: pendingCharterUpdate.id,
                                status: isJustified ? 'Approved' : 'Rejected',
                                initialComment: comment
                            });
                        } else {
                            setApprovalCommentModalState({
                                type: 'project',
                                id: feasibilityProject.id,
                                status: isJustified ? 'Approved' : 'Rejected',
                                initialComment: comment
                            });
                        }
                        setFeasibilityProject(null);
                    },
                    onClose: () => setFeasibilityProject(null)
                })
            ),

            // PAGE HEADER WITH TOOLBAR
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('approvalCenter')),
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
                    React.createElement("button", { onClick: () => setIsApprovalHistoryModalOpen(true), className: "action-button" } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "history"),
                        t('history')
                    )
                )
            ),

            // FILTERS PANEL
            isFilterOpen && React.createElement("div", { className: "dashboard-filters portfolio-filters", style: { padding: '1rem', backgroundColor: 'var(--secondary-color)', marginBottom: '1rem', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '1rem' } },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "apprSearchFilter" }, language === 'fa' ? 'جستجوی عنوان / شرح' : 'Search Title / Description'),
                    React.createElement("input", {
                        type: "text",
                        id: "apprSearchFilter",
                        placeholder: t('filterPlaceholder'),
                        value: filterText,
                        onChange: e => setFilterText(e.target.value)
                    })
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "apprProjectFilter" }, language === 'fa' ? 'پروژه' : 'Project'),
                    React.createElement("select", {
                        id: "apprProjectFilter",
                        value: projectFilter,
                        onChange: e => setProjectFilter(e.target.value)
                    },
                        React.createElement("option", { value: "all" }, language === 'fa' ? 'همه پروژه‌ها' : 'All Projects'),
                        availableProjects.map(pName => (
                            React.createElement("option", { key: pName, value: pName }, pName)
                        ))
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "apprTypeFilter" }, language === 'fa' ? 'نوع / بخش' : 'Type / Section'),
                    React.createElement("select", {
                        id: "apprTypeFilter",
                        value: typeFilter,
                        onChange: e => setTypeFilter(e.target.value)
                    },
                        React.createElement("option", { value: "all" }, language === 'fa' ? 'همه بخش‌ها' : 'All Sections'),
                        availableTypes.map(tLabel => (
                            React.createElement("option", { key: tLabel, value: tLabel }, tLabel)
                        ))
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "apprSubmitterFilter" }, language === 'fa' ? 'ارسال‌کننده' : 'Submitter'),
                    React.createElement("select", {
                        id: "apprSubmitterFilter",
                        value: submitterFilter,
                        onChange: e => setSubmitterFilter(e.target.value)
                    },
                        React.createElement("option", { value: "all" }, language === 'fa' ? 'همه ارسال‌کنندگان' : 'All Submitters'),
                        availableSubmitters.map(sName => (
                            React.createElement("option", { key: sName, value: sName }, sName)
                        ))
                    )
                )
            ),

            // GROUPING PANEL
            isGroupingOpen && React.createElement("div", { className: "dashboard-filters portfolio-grouping-controls", style: { padding: '1rem', backgroundColor: 'var(--secondary-color)', marginBottom: '1rem', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '1rem', border: '1px solid var(--border-color)' } },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "apprGroupByLevel1" }, language === 'fa' ? 'گروه‌بندی سطح ۱' : 'Grouping Level 1'),
                    React.createElement("select", {
                        id: "apprGroupByLevel1",
                        value: groupByLevel1,
                        onChange: e => setGroupByLevel1(e.target.value)
                    },
                        React.createElement("option", { value: "project" }, language === 'fa' ? 'نام پروژه' : 'Project Name'),
                        React.createElement("option", { value: "tab" }, language === 'fa' ? 'نوع / بخش' : 'Type / Tab Section'),
                        React.createElement("option", { value: "submitter" }, language === 'fa' ? 'ارسال‌کننده' : 'Submitter'),
                        React.createElement("option", { value: "none" }, language === 'fa' ? 'بدون گروه‌بندی' : 'No Grouping')
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "apprGroupByLevel2" }, language === 'fa' ? 'گروه‌بندی سطح ۲' : 'Grouping Level 2'),
                    React.createElement("select", {
                        id: "apprGroupByLevel2",
                        value: groupByLevel2,
                        onChange: e => setGroupByLevel2(e.target.value)
                    },
                        React.createElement("option", { value: "tab" }, language === 'fa' ? 'نوع / بخش' : 'Type / Tab Section'),
                        React.createElement("option", { value: "project" }, language === 'fa' ? 'نام پروژه' : 'Project Name'),
                        React.createElement("option", { value: "submitter" }, language === 'fa' ? 'ارسال‌کننده' : 'Submitter'),
                        React.createElement("option", { value: "none" }, language === 'fa' ? 'بدون گروه‌بندی' : 'No Grouping')
                    )
                )
            ),

            filteredApprovalItems.length === 0 ? (
                React.createElement("div", { className: "placeholder-content" }, t('noApprovals'))
            ) : (
                React.createElement("div", { className: "approval-center-container" },
                    groupedApprovalData.map(l1Group => {
                        const l1Key = `l1-${l1Group.key}`;
                        const isL1Open = isGroupOpen(l1Key);

                        return React.createElement("div", { key: l1Key, className: "project-group", style: { marginBottom: '1.5rem' } },
                            React.createElement("h3", {
                                className: "project-group-header",
                                onClick: () => toggleGroup(l1Key),
                                style: { cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', backgroundColor: 'var(--primary-color)', color: '#ffffff', borderRadius: '8px' }
                            } as React.HTMLAttributes<HTMLHeadingElement>,
                                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                                    React.createElement("span", { className: "material-symbols-outlined" }, isL1Open ? 'expand_less' : 'expand_more'),
                                    React.createElement("span", { style: { fontWeight: 600, fontSize: '1.05rem' } }, l1Group.label)
                                ),
                                React.createElement("span", { style: { backgroundColor: 'rgba(255,255,255,0.25)', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem' } },
                                    language === 'fa' ? `${toPersianDigits(l1Group.totalCount)} مورد` : `${l1Group.totalCount} items`
                                )
                            ),
                            isL1Open && React.createElement("div", { style: { padding: '0.75rem 0' } },
                                l1Group.subgroups.map(subgroup => {
                                    const l2Key = `${l1Key}-l2-${subgroup.key}`;
                                    const isL2Open = isGroupOpen(l2Key);

                                    return React.createElement("div", { key: l2Key, className: "project-sub-group", style: { marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' } },
                                        groupByLevel2 !== 'none' && React.createElement("div", {
                                            onClick: () => toggleGroup(l2Key),
                                            style: { cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.85rem', backgroundColor: 'var(--secondary-color)', borderBottom: isL2Open ? '1px solid var(--border-color)' : 'none' }
                                        },
                                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.4rem' } },
                                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.1rem' } }, isL2Open ? 'expand_less' : 'expand_more'),
                                                React.createElement("h4", { style: { margin: 0, fontSize: '0.95rem', fontWeight: 600 } }, subgroup.label)
                                            ),
                                            React.createElement("span", { style: { fontSize: '0.8rem', color: 'var(--text-muted)' } },
                                                language === 'fa' ? `${toPersianDigits(subgroup.count)} مورد` : `${subgroup.count} items`
                                            )
                                        ),
                                        (groupByLevel2 === 'none' || isL2Open) && renderApprovalSubgroupTable(subgroup.items)
                                    );
                                })
                            )
                        );
                    })
                )
            )
        )
    );
};