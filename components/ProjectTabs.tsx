import React, { useState, useMemo, useEffect, useContext, useCallback, ChangeEvent, FormEvent, ReactElement, Fragment, useRef } from 'react';
import { LocalizationContext, ThemeContext } from '../context';
import { 
    User, Project, ProjectRisk, ProjectStakeholder, getStakeholderStrategy, ProjectStatusUpdate, ProjectDelayReason, ProjectDocument, ProjectActivity, KanbanTask, 
    ProgressUpdate, TranslationKey, KanbanStatus, ActionItem, WorkStatus, PlannedProgressType, ScheduleSnapshot, TaskPriority,
    DynamicWorkflowSettings, DEFAULT_DYNAMIC_WORKFLOW_SETTINGS, resolveWorkflowApproverId, WorkflowEntityType,
    getEffectiveProjectWorkflowStages, isProjectTabCustomWorkflow,
    RiskProbabilityImpactDefinitions, RiskLevelThresholdDefinition, DEFAULT_RISK_DEFINITIONS,
    StakeholderStrategies, DEFAULT_STAKEHOLDER_STRATEGIES,
    Calendar, ProjectApprovalRecord, ProjectContractPermissions, ProjectInvoicePermissions,
    ProjectContract, ProjectInvoice
} from '../types';
import { pickCalendar, getISODateString, calculateScheduleTreeAndProgress, formatDate, toPersianDigits, exportDashboardToLandscapePdf } from '../utils';
import { ActivityDetailsModal, GanttChartModal, WBSModal, ProgressChartModal, KanbanTaskModal, KanbanHistoryModal, TabItemHistoryModal, ApprovalCommentModal, ActionModal, AgileProgressChartModal } from './Modals';
import { ProgressBar } from './Indicators';
import { AiWbsModal } from './AiWbsModal';
import { AiRiskModal } from './AiRiskModal';
import { AiStakeholderModal } from './AiStakeholderModal';
import { MsProjectImportModal } from './MsProjectImportModal';
import { MsProjectExportModal } from './MsProjectExportModal';
import { DynamicWorkflowSettingsEditor } from './DynamicWorkflowSettingsEditor';
export { ProjectContractsTab, ProjectInvoicesTab, ContractModal, InvoiceModal } from './ProjectContractInvoicesTabs';
export { ProjectSettingsTab } from './ProjectSettingsTab';


export const ProjectActionsTab = ({ projectId, actions, users, onNavigate, isReadOnly = false }: {
    projectId: number;
    actions: ActionItem[];
    users: User[];
    onNavigate: (page: string, context: any) => void;
    isReadOnly?: boolean;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);

    const relatedActions = useMemo(() =>
        actions.filter(a => a.projectId === projectId)
    , [actions, projectId]);

    const workStatusTranslations: Record<WorkStatus, TranslationKey> = { 'Planning': 'planning', 'In Progress': 'inProgress', 'On Hold': 'onHold', 'Completed': 'completed' };

    return React.createElement("div", null,
        !isReadOnly && React.createElement("h4", null, t('relatedActions')),
        relatedActions.length === 0
            ? React.createElement("p", { style:{ marginTop: '1rem' } }, t('noActionsAssigned'))
            : React.createElement("div", { className: "table-responsive" },
                React.createElement("table", { className: "users-table" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, language === 'fa' ? 'ردیف' : '#'),
                            React.createElement("th", null, t('actionTitleColumn')),
                            React.createElement("th", null, t('responsiblePerson')),
                            React.createElement("th", null, t('status')),
                            React.createElement("th", null, t('endDate')),
                            !isReadOnly && React.createElement("th", null, t('actions'))
                        )
                    ),
                    React.createElement("tbody", null,
                        relatedActions.map((action, index) => {
                            const responsibleUser = users.find(u => u.id === action.responsibleUserId);
                            return React.createElement("tr", { key: action.id },
                                React.createElement("td", null, language === 'fa' ? toPersianDigits(index + 1) : index + 1),
                                React.createElement("td", null, action.title),
                                React.createElement("td", null, responsibleUser?.username || 'N/A'),
                                React.createElement("td", null, t(workStatusTranslations[action.status])),
                                React.createElement("td", null, formatDate(action.endDate, language)),
                                !isReadOnly && React.createElement("td", { className: "action-cell" },
                                    React.createElement("button", {
                                        onClick: () => onNavigate('define_action', { action }),
                                        className: "action-icon edit",
                                        "aria-label": t('edit')
                                    }, React.createElement("span", { className: "material-symbols-outlined" }, "edit"))
                                )
                            )
                        })
                    )
                )
            )
    );
};

export const ProjectTeamTab = ({ allUsers, teamMemberIds, onSaveTeam, isReadOnly = false }: { 
    allUsers: User[], 
    teamMemberIds: number[], 
    onSaveTeam: (ids: number[]) => void, 
    isReadOnly?: boolean 
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [localTeamIds, setLocalTeamIds] = useState(teamMemberIds);

    useEffect(() => {
        setLocalTeamIds(teamMemberIds);
    }, [teamMemberIds]);

    const teamMembers = useMemo(() => allUsers.filter(u => localTeamIds.includes(u.id)), [allUsers, localTeamIds]);
    const availableUsers = useMemo(() => allUsers.filter(u => !localTeamIds.includes(u.id) && u.isActive), [allUsers, localTeamIds]);

    const addUserToTeam = (userId: number) => {
        if (!localTeamIds.includes(userId)) {
            const next = [...localTeamIds, userId];
            setLocalTeamIds(next);
            onSaveTeam(next);
        }
    };

    const removeUserFromTeam = (userId: number) => {
        const next = localTeamIds.filter(id => id !== userId);
        setLocalTeamIds(next);
        onSaveTeam(next);
    };

    if (isReadOnly) {
        return React.createElement("div", { className: "table-responsive" },
            React.createElement("table", { className: "users-table" },
                React.createElement("thead", null, React.createElement("tr", null,
                    React.createElement("th", null, language === 'fa' ? 'ردیف' : '#'),
                    React.createElement("th", null, t('username')),
                    React.createElement("th", null, t('role'))
                )),
                React.createElement("tbody", null,
                    teamMembers.length > 0
                        ? teamMembers.map((user, index) => (
                            React.createElement("tr", { key: user.id },
                                React.createElement("td", null, language === 'fa' ? toPersianDigits(index + 1) : index + 1),
                                React.createElement("td", null, user.username),
                                React.createElement("td", null, t(user.role === 'Admin' ? 'admin' : user.role === 'Project Manager' ? 'projectManagerRole' : 'projectTeamRole'))
                            )
                        ))
                        : React.createElement("tr", null, React.createElement("td", { colSpan: 3, style: { textAlign: 'center' } }, t('noTeamMembers')))
                )
            )
        );
    }

    return (
        React.createElement(Fragment, null,
            React.createElement("div", { className: "tab-section-header", style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' } },
                React.createElement("h4", { style: { margin: 0 } }, language === 'fa' ? 'مدیریت و تخصیص اعضای تیم پروژه' : t('projectTeam'))
            ),
            React.createElement("div", { className: "team-management-grid" },
                React.createElement("div", { className: "team-list-container" },
                    React.createElement("h4", null, t('availableUsers')),
                    React.createElement("ul", { className: "team-list" },
                        availableUsers.map(user => (
                            React.createElement("li", { key: user.id },
                                React.createElement("span", null, `${user.username} (${t(user.role === 'Admin' ? 'admin' : user.role === 'Project Manager' ? 'projectManagerRole' : 'projectTeamRole')})`),
                                React.createElement("button", { onClick: () => addUserToTeam(user.id), className: "add-team-member-btn", "aria-label": t('addUserToTeam', { user: user.username }) },
                                    React.createElement("span", { className: "material-symbols-outlined" }, "add_circle")
                                )
                            )
                        ))
                    )
                ),
                React.createElement("div", { className: "team-list-container" },
                    React.createElement("h4", null, t('projectTeamMembers')),
                    React.createElement("ul", { className: "team-list" },
                        teamMembers.length > 0
                            ? teamMembers.map(user => (
                                React.createElement("li", { key: user.id },
                                    React.createElement("span", null, `${user.username} (${t(user.role === 'Admin' ? 'admin' : user.role === 'Project Manager' ? 'projectManagerRole' : 'projectTeamRole')})`),
                                    React.createElement("button", { onClick: () => removeUserFromTeam(user.id), className: "action-icon remove-team-member-btn", "aria-label": t('removeUserFromTeam', { user: user.username }) },
                                        React.createElement("span", { className: "material-symbols-outlined" }, "remove_circle")
                                    )
                                )
                            ))
                            : React.createElement("li", { className: "empty-list-item" }, t('noTeamMembers'))
                    )
                )
            )
        )
    );
};

export const RiskLevelBadge = ({ level, isFa }: { level: string; isFa: boolean }) => {
    const norm = String(level || 'Medium').toLowerCase();
    
    let config = {
        bg: '#fef3c7',
        color: '#b45309',
        border: '#fde68a',
        icon: 'drag_handle',
        labelFa: 'متوسط',
        labelEn: 'Medium'
    };

    if (norm === 'high' || norm.includes('زیاد') || norm.includes('بالا')) {
        config = {
            bg: '#fee2e2',
            color: '#b91c1c',
            border: '#fca5a5',
            icon: 'warning',
            labelFa: 'بالا',
            labelEn: 'High'
        };
    } else if (norm === 'low' || norm.includes('کم') || norm.includes('پایین')) {
        config = {
            bg: '#dcfce7',
            color: '#15803d',
            border: '#86efac',
            icon: 'arrow_downward',
            labelFa: 'پایین',
            labelEn: 'Low'
        };
    }

    return (
        React.createElement("span", {
            className: "risk-level-badge risk-tag",
            style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 700,
                backgroundColor: config.bg,
                color: config.color,
                border: `1px solid ${config.border}`,
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }
        },
            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.95rem', lineHeight: 1 } }, config.icon),
            React.createElement("span", null, isFa ? config.labelFa : config.labelEn)
        )
    );
};

export type RiskCellColor = 'red' | 'yellow' | 'green';

export const INITIAL_RISK_MATRIX_COLORS: Record<string, RiskCellColor> = {
    'Low-Low': 'green',
    'Low-Medium': 'green',
    'Medium-Low': 'green',
    'Low-High': 'yellow',
    'Medium-Medium': 'yellow',
    'High-Low': 'yellow',
    'Medium-High': 'red',
    'High-Medium': 'red',
    'High-High': 'red'
};

export const normalizeRiskLevel = (val?: string): 'Low' | 'Medium' | 'High' => {
    if (!val) return 'Medium';
    const s = String(val).toLowerCase().trim();
    if (s.includes('high') || s.includes('زیاد') || s.includes('بالا')) return 'High';
    if (s.includes('low') || s.includes('کم') || s.includes('پایین')) return 'Low';
    return 'Medium';
};

export const RiskProbabilityImpactMatrix = ({
    risks = [],
    language,
    cellColors,
    onCellClick,
    onResetAllToRed,
    selectedFilter,
    onSelectFilter,
    matrixClickMode = 'color',
    onSetMatrixClickMode
}: {
    risks: ProjectRisk[];
    language: string;
    cellColors: Record<string, RiskCellColor>;
    onCellClick: (prob: 'Low' | 'Medium' | 'High', impact: 'Low' | 'Medium' | 'High') => void;
    onResetAllToRed: () => void;
    selectedFilter?: { probability: 'Low' | 'Medium' | 'High'; impact: 'Low' | 'Medium' | 'High' } | null;
    onSelectFilter?: (filter: { probability: 'Low' | 'Medium' | 'High'; impact: 'Low' | 'Medium' | 'High' } | null) => void;
    matrixClickMode?: 'color' | 'filter';
    onSetMatrixClickMode?: (mode: 'color' | 'filter') => void;
}): ReactElement => {
    const isFa = language === 'fa';

    const probList: ('Low' | 'Medium' | 'High')[] = ['Low', 'Medium', 'High'];
    const impactList: ('High' | 'Medium' | 'Low')[] = ['High', 'Medium', 'Low'];

    const probLabels: Record<'Low' | 'Medium' | 'High', string> = {
        Low: isFa ? 'کم' : 'Low',
        Medium: isFa ? 'متوسط' : 'Medium',
        High: isFa ? 'زیاد' : 'High'
    };

    const impactLabels: Record<'High' | 'Medium' | 'Low', string> = {
        High: isFa ? 'زیاد' : 'High',
        Medium: isFa ? 'متوسط' : 'Medium',
        Low: isFa ? 'کم' : 'Low'
    };

    return React.createElement("div", { className: "risk-matrix-card" },
        React.createElement("div", { className: "risk-matrix-header" },
            React.createElement("h5", { className: "risk-matrix-title" },
                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.25rem', color: '#2563eb' } }, "grid_view"),
                React.createElement("span", null, isFa ? 'ماتریس احتمال و اثر ریسک' : 'Risk Probability & Impact Matrix')
            ),
            React.createElement("button", {
                type: "button",
                className: "risk-matrix-reset-btn",
                onClick: onResetAllToRed,
                title: isFa ? 'بازنشانی به رنگ‌های پیش‌فرض' : 'Reset to default colors'
            },
                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "restart_alt"),
                React.createElement("span", null, isFa ? 'پیش‌فرض' : 'Default')
            )
        ),
        // Mode Switch
        React.createElement("div", {
            style: {
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--card-bg-color, #f8fafc)',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                flexWrap: 'wrap',
                gap: '0.5rem',
                fontSize: '0.8rem'
            }
        },
            React.createElement("div", { className: "risk-def-switch-tabs" },
                React.createElement("button", {
                    type: "button",
                    className: `risk-def-tab-btn ${matrixClickMode === 'color' ? 'active' : ''}`,
                    onClick: () => {
                        onSetMatrixClickMode?.('color');
                        onSelectFilter?.(null);
                    }
                },
                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "palette"),
                    React.createElement("span", null, isFa ? 'تغییر رنگ سلول' : 'Change Color')
                ),
                React.createElement("button", {
                    type: "button",
                    className: `risk-def-tab-btn ${matrixClickMode === 'filter' ? 'active' : ''}`,
                    onClick: () => onSetMatrixClickMode?.('filter')
                },
                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "filter_alt"),
                    React.createElement("span", null, isFa ? 'فیلتر گرید ریسک' : 'Filter Grid')
                )
            )
        ),
        React.createElement("div", { className: "risk-matrix-grid-wrapper" },
            /* Vertical Axis (Impact / اثر) */
            React.createElement("div", { className: "risk-matrix-y-axis" },
                React.createElement("span", { className: "risk-matrix-axis-title-v" },
                    isFa ? 'اثر (Impact) ↑' : 'Impact (اثر) ↑'
                )
            ),
            React.createElement("div", { className: "risk-matrix-table-container" },
                React.createElement("table", { className: "risk-matrix-grid" },
                    React.createElement("tbody", null,
                        /* 3 rows for Impact (High, Medium, Low) */
                        impactList.map(impact => React.createElement("tr", { key: impact },
                            React.createElement("th", { className: "row-label" }, impactLabels[impact]),
                            probList.map(prob => {
                                const key = `${prob}-${impact}`;
                                const color = cellColors[key] || 'red';

                                const matchingRisks = risks.filter(r =>
                                    normalizeRiskLevel(r.probability) === prob &&
                                    normalizeRiskLevel(r.impact) === impact
                                );
                                const count = matchingRisks.length;
                                const isFilterActive = matrixClickMode === 'filter' && selectedFilter && selectedFilter.probability === prob && selectedFilter.impact === impact;

                                const tooltip = matrixClickMode === 'color'
                                    ? (isFa
                                        ? `احتمال: ${probLabels[prob]} | اثر: ${impactLabels[impact]} | تعداد ریسک‌ها: ${toPersianDigits(count)} مورد (کلیک برای تغییر رنگ به ${color === 'red' ? 'زرد' : color === 'yellow' ? 'سبز' : 'قرمز'})`
                                        : `Probability: ${probLabels[prob]} | Impact: ${impactLabels[impact]} | Risks: ${count} (Click to change color)`)
                                    : (isFa
                                        ? `احتمال: ${probLabels[prob]} | اثر: ${impactLabels[impact]} | تعداد ریسک‌ها: ${toPersianDigits(count)} مورد (کلیک برای ${isFilterActive ? 'لغو فیلتر' : 'فیلتر گرید'})`
                                        : `Probability: ${probLabels[prob]} | Impact: ${impactLabels[impact]} | Risks: ${count} (Click to filter)`);

                                return React.createElement("td", {
                                    key: key,
                                    className: `risk-matrix-cell cell-color-${color} ${isFilterActive ? 'cell-selected' : ''}`,
                                    onClick: () => {
                                        if (matrixClickMode === 'color') {
                                            onCellClick(prob, impact);
                                        } else {
                                            if (isFilterActive) {
                                                onSelectFilter?.(null);
                                            } else {
                                                onSelectFilter?.({ probability: prob, impact: impact });
                                            }
                                        }
                                    },
                                    title: tooltip
                                },
                                    React.createElement("div", { className: "risk-matrix-cell-content" },
                                        /* Blue circle displaying the count of corresponding risks */
                                        React.createElement("div", { className: "risk-matrix-count-circle" },
                                            isFa ? toPersianDigits(count) : count
                                        )
                                    )
                                );
                            })
                        )),
                        /* Probability Labels Row at the BOTTOM of the matrix */
                        React.createElement("tr", { className: "risk-matrix-prob-label-row" },
                            React.createElement("th", { className: "corner-empty-cell" }),
                            probList.map(prob => React.createElement("th", { key: prob, className: "prob-col-label" }, probLabels[prob]))
                        )
                    )
                ),
                /* Horizontal Axis Title (Probability / احتمال) at the very bottom */
                React.createElement("div", { className: "risk-matrix-axis-title-h" },
                    isFa ? '← احتمال (Probability) →' : '← Probability (احتمال) →'
                )
            )
        ),
        /* Matrix Legend */
        React.createElement("div", { className: "risk-matrix-legend" },
            React.createElement("div", { className: "risk-matrix-legend-item" },
                React.createElement("span", { className: "risk-matrix-legend-dot dot-blue" }),
                React.createElement("span", null, isFa ? 'تعداد ریسک در سلول' : 'Risk Count')
            ),
            React.createElement("div", { className: "risk-matrix-legend-item" },
                React.createElement("span", { className: "risk-matrix-legend-dot dot-red" }),
                React.createElement("span", null, isFa ? 'قرمز' : 'Red')
            ),
            React.createElement("div", { className: "risk-matrix-legend-item" },
                React.createElement("span", { className: "risk-matrix-legend-dot dot-yellow" }),
                React.createElement("span", null, isFa ? 'زرد' : 'Yellow')
            ),
            React.createElement("div", { className: "risk-matrix-legend-item" },
                React.createElement("span", { className: "risk-matrix-legend-dot dot-green" }),
                React.createElement("span", null, isFa ? 'سبز' : 'Green')
            )
        )
    );
};

export const RiskDefinitionsCard = ({
    definitions,
    onSaveDefinitions,
    language,
    isReadOnly = false
}: {
    definitions?: RiskProbabilityImpactDefinitions;
    onSaveDefinitions?: (defs: RiskProbabilityImpactDefinitions) => void;
    language: string;
    isReadOnly?: boolean;
}): ReactElement => {
    const isFa = language === 'fa';
    const [activeType, setActiveType] = useState<'probability' | 'impact'>('probability');
    const [isEditing, setIsEditing] = useState(false);
    const [localDefs, setLocalDefs] = useState<RiskProbabilityImpactDefinitions>(definitions || DEFAULT_RISK_DEFINITIONS);

    useEffect(() => {
        if (definitions) {
            setLocalDefs(definitions);
        }
    }, [definitions]);

    const currentTypeDefs = localDefs[activeType] || DEFAULT_RISK_DEFINITIONS[activeType];

    const handleThresholdChange = (level: 'high' | 'medium' | 'low', field: keyof RiskLevelThresholdDefinition, value: string) => {
        setLocalDefs(prev => ({
            ...prev,
            [activeType]: {
                ...prev[activeType],
                [level]: {
                    ...prev[activeType][level],
                    [field]: value
                }
            }
        }));
    };

    const handleSave = () => {
        onSaveDefinitions?.(localDefs);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setLocalDefs(definitions || DEFAULT_RISK_DEFINITIONS);
        setIsEditing(false);
    };

    const handleResetDefaults = () => {
        if (window.confirm(isFa ? 'آیا مایل به بازنشانی مقادیر به پیش‌فرض (بالای ۶۰٪، ۳۰-۶۰٪، کمتر از ۳۰٪) هستید؟' : 'Reset definitions to defaults?')) {
            setLocalDefs(DEFAULT_RISK_DEFINITIONS);
            onSaveDefinitions?.(DEFAULT_RISK_DEFINITIONS);
            setIsEditing(false);
        }
    };

    const levels: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];

    const getLevelBadge = (lvl: 'high' | 'medium' | 'low') => {
        const labels: Record<'high' | 'medium' | 'low', { fa: string; en: string; cls: string }> = {
            high: { fa: 'زیاد (High)', en: 'High', cls: 'badge-high' },
            medium: { fa: 'متوسط (Medium)', en: 'Medium', cls: 'badge-medium' },
            low: { fa: 'کم (Low)', en: 'Low', cls: 'badge-low' }
        };
        const item = labels[lvl];
        return React.createElement("span", { className: `risk-def-level-badge ${item.cls}` }, isFa ? item.fa : item.en);
    };

    return React.createElement("div", { className: "risk-definitions-card" },
        React.createElement("div", { className: "risk-def-header" },
            React.createElement("h5", { className: "risk-def-title" },
                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.25rem', color: '#0284c7' } }, "tune"),
                React.createElement("span", null, isFa ? 'جدول تعاریف احتمال و اثر' : 'Probability & Impact Definitions')
            ),
            React.createElement("div", { className: "risk-def-actions" },
                React.createElement("div", { className: "risk-def-switch-tabs" },
                    React.createElement("button", {
                        type: "button",
                        className: `risk-def-tab-btn ${activeType === 'probability' ? 'active' : ''}`,
                        onClick: () => setActiveType('probability')
                    },
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "percent"),
                        React.createElement("span", null, isFa ? 'احتمال (Probability)' : 'Probability')
                    ),
                    React.createElement("button", {
                        type: "button",
                        className: `risk-def-tab-btn ${activeType === 'impact' ? 'active' : ''}`,
                        onClick: () => setActiveType('impact')
                    },
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "bolt"),
                        React.createElement("span", null, isFa ? 'اثر (Impact)' : 'Impact')
                    )
                ),
                !isReadOnly && onSaveDefinitions && (
                    isEditing ? React.createElement(Fragment, null,
                        React.createElement("button", { type: "button", className: "risk-def-btn primary", onClick: handleSave },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "save"),
                            React.createElement("span", null, isFa ? 'ذخیره' : 'Save')
                        ),
                        React.createElement("button", { type: "button", className: "risk-def-btn secondary", onClick: handleCancel },
                            React.createElement("span", null, isFa ? 'انصراف' : 'Cancel')
                        )
                    ) : React.createElement(Fragment, null,
                        React.createElement("button", { type: "button", className: "risk-def-btn secondary", onClick: () => setIsEditing(true) },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "edit"),
                            React.createElement("span", null, isFa ? 'ویرایش تعاریف' : 'Edit')
                        ),
                        React.createElement("button", { type: "button", className: "risk-def-btn reset", onClick: handleResetDefaults, title: isFa ? 'بازنشانی به مقادیر پیش‌فرض' : 'Reset to defaults' },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "restart_alt")
                        )
                    )
                )
            )
        ),
        React.createElement("div", { style: { overflowX: 'auto' } },
            React.createElement("table", { className: "risk-def-table" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", { style: { width: '130px' } }, isFa ? 'سطح' : 'Level'),
                        React.createElement("th", { style: { width: '140px' } }, isFa ? 'بازه درصد / مقدار' : 'Range / Value'),
                        React.createElement("th", null, isFa ? 'شرح و معیار ارزیابی' : 'Description & Criteria')
                    )
                ),
                React.createElement("tbody", null,
                    levels.map(lvl => {
                        const item = currentTypeDefs[lvl];
                        return React.createElement("tr", { key: lvl },
                            React.createElement("td", null, getLevelBadge(lvl)),
                            React.createElement("td", null,
                                isEditing ? React.createElement("input", {
                                    type: "text",
                                    className: "risk-def-input",
                                    value: item.range || '',
                                    placeholder: lvl === 'high' ? (isFa ? 'مثلاً > ۶۰٪' : '> 60%') : lvl === 'medium' ? (isFa ? 'مثلاً ۳۰٪ تا ۶۰٪' : '30% - 60%') : (isFa ? 'مثلاً < ۳۰٪' : '< 30%'),
                                    onChange: (e: ChangeEvent<HTMLInputElement>) => handleThresholdChange(lvl, 'range', e.target.value)
                                }) : React.createElement("span", { className: "risk-def-range-text" }, isFa ? toPersianDigits(item.range) : item.range)
                            ),
                            React.createElement("td", null,
                                isEditing ? React.createElement("input", {
                                    type: "text",
                                    className: "risk-def-input",
                                    value: item.description || '',
                                    placeholder: isFa ? 'شرح معیار...' : 'Description...',
                                    onChange: (e: ChangeEvent<HTMLInputElement>) => handleThresholdChange(lvl, 'description', e.target.value)
                                }) : React.createElement("span", { style: { color: 'var(--text-color, #334155)', lineHeight: 1.4 } }, item.description || '-')
                            )
                        );
                    })
                )
            )
        )
    );
};

export const ProjectRisksTab = ({ 
    risks, 
    users = [], 
    onEdit, 
    onDelete, 
    isReadOnly = false, 
    isPMOrAdmin = false, 
    onApprove, 
    onReject, 
    currentUserId, 
    requiresWorkflow, 
    hideApprovalStatus = false, 
    project, 
    onUpdateRisks, 
    onUpdateRiskDefinitions, 
    dynamicWorkflowSettings,
    onSaveAction,
    calendars = [],
    projects = [],
    owningUnits = [],
    currentUser
}: { 
    risks: ProjectRisk[], 
    users?: User[],
    onEdit: (risk: ProjectRisk) => void,
    onDelete: (id: number) => void,
    isReadOnly?: boolean,
    isPMOrAdmin?: boolean,
    onApprove?: (id: number, comment?: string) => void,
    onReject?: (id: number, comment?: string) => void,
    currentUserId?: string,
    requiresWorkflow?: boolean,
    hideApprovalStatus?: boolean,
    project?: Project,
    onUpdateRisks?: (newRisks: ProjectRisk[]) => void,
    onUpdateRiskDefinitions?: (definitions: RiskProbabilityImpactDefinitions) => void,
    dynamicWorkflowSettings?: DynamicWorkflowSettings,
    onSaveAction?: (action: ActionItem) => void,
    calendars?: Calendar[],
    projects?: Project[],
    owningUnits?: string[],
    currentUser?: User | null
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [historyModalInfo, setHistoryModalInfo] = useState<{ title: string; typeLabel: string; history?: any[]; submittedBy?: number; isApproved?: boolean; isRejected?: boolean } | null>(null);
    const [commentModalState, setCommentModalState] = useState<{ id: number; status: 'Approved' | 'Rejected'; title: string } | null>(null);
    const [convertActionItem, setConvertActionItem] = useState<Partial<ActionItem> | null>(null);
    
    // Matrix cell colors state (Default: updated risk matrix colors)
    const [cellColors, setCellColors] = useState<Record<string, RiskCellColor>>(project?.riskMatrixColors || INITIAL_RISK_MATRIX_COLORS);
    const [selectedFilter, setSelectedFilter] = useState<{ probability: 'Low' | 'Medium' | 'High'; impact: 'Low' | 'Medium' | 'High' } | null>(null);
    const [matrixClickMode, setMatrixClickMode] = useState<'color' | 'filter'>('color');
    const [isMatrixSectionExpanded, setIsMatrixSectionExpanded] = useState(false);

    const probLabels: Record<'Low' | 'Medium' | 'High', string> = {
        Low: isFa ? 'کم' : 'Low',
        Medium: isFa ? 'متوسط' : 'Medium',
        High: isFa ? 'زیاد' : 'High'
    };

    const impactLabels: Record<'High' | 'Medium' | 'Low', string> = {
        High: isFa ? 'زیاد' : 'High',
        Medium: isFa ? 'متوسط' : 'Medium',
        Low: isFa ? 'کم' : 'Low'
    };

    const handleConvertToRiskAction = (risk: ProjectRisk) => {
        const isRiskWorkflowEnabled = requiresWorkflow !== false;
        const stages = getEffectiveProjectWorkflowStages('risks', project, dynamicWorkflowSettings);
        const firstStage = stages?.[0];
        const initialApproverId = firstStage && project ? resolveWorkflowApproverId(firstStage.approverId, project) : (project?.projectManagerId || undefined);

        const assignedUser = users?.find(u => u.username === risk.assignedTo || u.name === risk.assignedTo);
        const assignedUserId = assignedUser ? assignedUser.id : (currentUser?.id || project?.projectManagerId || null);

        const submitterActor = currentUser ? (currentUser.name ? `${currentUser.name} (${currentUser.username})` : currentUser.username) : 'کاربر';
        const initialApprovalRecord: ProjectApprovalRecord = isRiskWorkflowEnabled ? {
            action: 'Submitted',
            date: new Date().toISOString(),
            actor: submitterActor,
            stageTitle: firstStage?.stageTitle || (isFa ? 'ثبت اقدام پاسخ ریسک' : 'Risk Response Action Submission'),
            comment: isFa ? `ایجاد اقدام از برنامه پاسخ ریسک «${risk.description}»` : `Action created from risk response plan`
        } : {
            action: 'Approved',
            date: new Date().toISOString(),
            actor: 'System (No Workflow)',
            stageTitle: isFa ? 'تایید خودکار' : 'Auto Approved',
            comment: isFa ? 'بدون گردش کار تایید شد' : 'Approved without workflow'
        };

        const actionData: Partial<ActionItem> = {
            title: risk.responsePlan || (isFa ? `برنامه پاسخ به ریسک: ${risk.description}` : `Risk Response: ${risk.description}`),
            description: isFa
                ? `برنامه پاسخ به ریسک: ${risk.responsePlan}\nشرح ریسک: ${risk.description}\nاحتمال: ${probLabels[normalizeRiskLevel(risk.probability)]} | اثر: ${impactLabels[normalizeRiskLevel(risk.impact)]}\nمسئول در ریسک: ${risk.assignedTo}`
                : `Risk Response: ${risk.responsePlan}\nRisk Description: ${risk.description}\nAssigned in Risk: ${risk.assignedTo}`,
            projectId: project?.id,
            responsibleUserId: assignedUserId,
            ownerUserId: currentUser?.id || project?.projectManagerId || null,
            calendarId: project?.calendarId || '1',
            owningUnit: project?.owningUnit || (owningUnits?.[0] || ''),
            startDate: project?.startDate || getISODateString(),
            endDate: project?.endDate || getISODateString(),
            status: 'Planning',
            sourceType: 'risk',
            sourceRiskId: risk.id,
            sourceInfo: {
                type: 'risk',
                projectName: project?.name,
                riskTitle: risk.description,
                riskPlan: risk.responsePlan
            },
            workflowType: 'risks',
            isApproved: !isRiskWorkflowEnabled,
            isPending: isRiskWorkflowEnabled,
            currentStageIndex: isRiskWorkflowEnabled ? 0 : undefined,
            currentApproverId: isRiskWorkflowEnabled ? initialApproverId : undefined,
            approvalHistory: [initialApprovalRecord]
        };

        setConvertActionItem(actionData);
    };

    const handleCellClick = (prob: 'Low' | 'Medium' | 'High', impact: 'Low' | 'Medium' | 'High') => {
        const key = `${prob}-${impact}`;
        setCellColors(prev => {
            const current = prev[key] || 'red';
            const next: RiskCellColor = current === 'red' ? 'yellow' : (current === 'yellow' ? 'green' : 'red');
            return { ...prev, [key]: next };
        });
    };

    const handleResetAllToRed = () => {
        setCellColors(INITIAL_RISK_MATRIX_COLORS);
        setSelectedFilter(null);
    };

    const filteredRisks = useMemo(() => {
        if (!selectedFilter) return risks || [];
        return (risks || []).filter(r => 
            normalizeRiskLevel(r.probability) === selectedFilter.probability &&
            normalizeRiskLevel(r.impact) === selectedFilter.impact
        );
    }, [risks, selectedFilter]);

    return (
        React.createElement("div", null,
            historyModalInfo && React.createElement(TabItemHistoryModal, {
                itemTitle: historyModalInfo.title,
                itemTypeLabel: historyModalInfo.typeLabel,
                approvalHistory: historyModalInfo.history,
                submittedBy: historyModalInfo.submittedBy,
                isApproved: historyModalInfo.isApproved,
                isRejected: historyModalInfo.isRejected,
                users: users || [],
                onClose: () => setHistoryModalInfo(null)
            }),
            commentModalState && React.createElement(ApprovalCommentModal, {
                title: `${language === 'fa' ? 'ثبت نظر و علت' : 'Review & Reason'} (${commentModalState.status === 'Approved' ? (language === 'fa' ? 'تایید' : 'Approve') : (language === 'fa' ? 'عدم تایید' : 'Reject')}) - ${language === 'fa' ? 'ریسک' : 'Risk'}`,
                initialComment: '',
                status: commentModalState.status,
                onSave: (comment, overrideStatus) => {
                    const finalStatus = overrideStatus || commentModalState.status;
                    if (finalStatus === 'Approved') {
                        onApprove?.(commentModalState.id, comment);
                    } else {
                        onReject?.(commentModalState.id, comment);
                    }
                    setCommentModalState(null);
                },
                onClose: () => setCommentModalState(null)
            }),
            project && onUpdateRisks && React.createElement(AiRiskModal, {
                project,
                isOpen: aiModalOpen,
                onClose: () => setAiModalOpen(false),
                isPMOrAdmin,
                currentUserId,
                requiresWorkflow,
                dynamicWorkflowSettings,
                users,
                onApplyRisks: (newRisks, replace) => {
                    let updated: ProjectRisk[] = [];
                    if (replace) {
                        updated = newRisks;
                    } else {
                        updated = [...risks, ...newRisks];
                    }
                    onUpdateRisks(updated);
                }
            }),
            convertActionItem && React.createElement(ActionModal, {
                initialAction: convertActionItem,
                users: users || [],
                calendars: calendars || [],
                projects: projects && projects.length > 0 ? projects : (project ? [project] : []),
                owningUnits: owningUnits || (project?.owningUnit ? [project.owningUnit] : []),
                currentUser: currentUser,
                isProjectLocked: true,
                onSave: (savedAction) => {
                    onSaveAction?.(savedAction);
                    setConvertActionItem(null);
                },
                onClose: () => setConvertActionItem(null)
            }),
            React.createElement("div", { className: "risk-tab-layout" },
                /* 1. Risk Register Table (Full Width on Top) */
                React.createElement("div", { className: "risk-table-section" },
                    !isReadOnly && React.createElement("div", { className: "tab-section-header", style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' } },
                        React.createElement("h4", { style: { margin: 0 } }, t('riskRegister')),
                        project && onUpdateRisks && React.createElement("button", {
                            className: "action-button primary",
                            onClick: () => setAiModalOpen(true),
                            title: language === 'fa' ? 'تحلیل ریسک و تولید ریسک‌های پیشنهادی با هوش مصنوعی' : 'AI Risk Analysis & Suggestions',
                            "aria-label": language === 'fa' ? 'تحلیل ریسک و تولید ریسک‌های پیشنهادی با هوش مصنوعی' : 'AI Risk Analysis & Suggestions',
                            style: { padding: '0.5rem 0.65rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
                        },
                            React.createElement("span", { className: "material-symbols-outlined" }, "auto_awesome")
                        )
                    ),
                    selectedFilter && React.createElement("div", { className: "risk-filter-active-banner" },
                        React.createElement("span", null,
                            isFa 
                                ? `فیلتر فعال براساس ماتریس: احتمال «${probLabels[selectedFilter.probability]}» و اثر «${impactLabels[selectedFilter.impact]}» (${toPersianDigits(filteredRisks.length)} مورد)`
                                : `Active Filter: Probability "${probLabels[selectedFilter.probability]}" & Impact "${impactLabels[selectedFilter.impact]}" (${filteredRisks.length} items)`
                        ),
                        React.createElement("button", { type: "button", className: "risk-filter-clear-btn", onClick: () => setSelectedFilter(null) },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "close"),
                            React.createElement("span", null, isFa ? 'حذف فیلتر و نمایش همه' : 'Clear Filter')
                        )
                    ),
                    React.createElement("table", { className: "tab-table font-compact-table", style: { fontSize: '0.8rem' } },
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, language === 'fa' ? 'ردیف' : '#'),
                                React.createElement("th", null, language === 'fa' ? 'عنوان ریسک' : t('riskDescription')),
                                React.createElement("th", null, t('probability')),
                                React.createElement("th", null, t('impact')),
                                React.createElement("th", null, t('responsePlan')),
                                React.createElement("th", null, t('assignedTo')),
                                React.createElement("th", null, language === 'fa' ? 'ثبت‌کننده' : 'Submitter'),
                                React.createElement("th", null, language === 'fa' ? 'تاییدکننده' : 'Approver'),
                                !hideApprovalStatus && React.createElement("th", { style: { textAlign: 'center' } }, language === 'fa' ? 'وضعیت تایید' : 'Approval Status'),
                                React.createElement("th", null, t('actions'))
                            )
                        ),
                        React.createElement("tbody", null,
                            filteredRisks.length > 0
                                ? filteredRisks.map((risk, index) => {
                                    const isPending = risk.isApproved === false && !(risk as any).isRejected;
                                    const isRejected = risk.isApproved === false && !!(risk as any).isRejected;

                                    const stages = getEffectiveProjectWorkflowStages('risks', project, dynamicWorkflowSettings);
                                    const currentStageIdx = risk.currentStageIndex ?? 0;
                                    const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                                    const effectiveApproverId = risk.currentApproverId ?? (stage && project ? resolveWorkflowApproverId(stage.approverId, project) : project?.projectManagerId);
                                    const approverUser = users?.find(u => Number(u.id) === Number(effectiveApproverId));
                                    const approverDisplay = approverUser 
                                        ? (approverUser.name ? `${approverUser.name} (${approverUser.username})` : approverUser.username)
                                        : (stage?.approverId === 'ROLE_PM' ? (language === 'fa' ? 'مدیر پروژه' : 'Project Manager') : stage?.approverId === 'ROLE_OWNER' ? (language === 'fa' ? 'مالک پروژه' : 'Project Owner') : '-');

                                    const isCurrentApprover = currentUserId && Number(effectiveApproverId) === Number(currentUserId);
                                    const canApproveThisRisk = isPMOrAdmin || isCurrentApprover;

                                    // Dynamic Row Highlighting based on Probability & Impact matrix cell color
                                    const normProb = normalizeRiskLevel(risk.probability);
                                    const normImpact = normalizeRiskLevel(risk.impact);
                                    const cellKey = `${normProb}-${normImpact}`;
                                    const rowColor = cellColors[cellKey] || 'red';

                                    return React.createElement("tr", { 
                                        key: risk.id, 
                                        className: `risk-row risk-row-color-${rowColor}`
                                    },
                                        React.createElement("td", null, language === 'fa' ? toPersianDigits(index + 1) : index + 1),
                                        React.createElement("td", null, risk.description),
                                        React.createElement("td", null, React.createElement(RiskLevelBadge, { level: risk.probability, isFa: language === 'fa' })),
                                        React.createElement("td", null, React.createElement(RiskLevelBadge, { level: risk.impact, isFa: language === 'fa' })),
                                        React.createElement("td", { style: { fontWeight: 500 } }, risk.responsePlan),
                                        React.createElement("td", null, risk.assignedTo),
                                        React.createElement("td", null, users?.find(u => Number(u.id) === Number(risk.submittedBy))?.username || '-'),
                                        React.createElement("td", null, approverDisplay),
                                        !hideApprovalStatus && React.createElement("td", { style: { textAlign: 'center' } },
                                            isPending && React.createElement("span", { className: "badge badge-yellow", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 500, whiteSpace: 'nowrap' } }, language === 'fa' ? 'در انتظار تایید' : 'Pending Approval'),
                                            isRejected && React.createElement("span", { className: "badge badge-red", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 500, whiteSpace: 'nowrap' } }, language === 'fa' ? 'عدم تایید' : 'Rejected'),
                                            (!isPending && !isRejected) && React.createElement("span", { className: "badge badge-green", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 500, whiteSpace: 'nowrap' } }, language === 'fa' ? 'تایید شده' : 'Approved')
                                        ),
                                        React.createElement("td", { className: "action-cell" },
                                            React.createElement("button", {
                                                onClick: () => setHistoryModalInfo({
                                                    title: risk.description,
                                                    typeLabel: language === 'fa' ? 'ریسک' : 'Risk',
                                                    history: risk.approvalHistory,
                                                    submittedBy: risk.submittedBy,
                                                    isApproved: risk.isApproved,
                                                    isRejected: (risk as any).isRejected
                                                }),
                                                className: "action-icon history",
                                                title: t('history')
                                            }, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                            !isReadOnly && isPending && canApproveThisRisk && onApprove && onReject && React.createElement(Fragment, null,
                                                React.createElement("button", { onClick: () => setCommentModalState({ id: risk.id, status: 'Approved', title: risk.description }), className: "action-icon edit", style: { color: 'green' }, title: language === 'fa' ? 'تایید' : 'Approve' }, React.createElement("span", { className: "material-symbols-outlined" }, "check")),
                                                React.createElement("button", { onClick: () => setCommentModalState({ id: risk.id, status: 'Rejected', title: risk.description }), className: "action-icon delete", style: { color: 'red' }, title: language === 'fa' ? 'عدم تایید' : 'Reject' }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                                            ),
                                            !isReadOnly && onSaveAction && React.createElement("button", {
                                                type: "button",
                                                onClick: () => handleConvertToRiskAction(risk),
                                                className: "action-icon",
                                                style: { color: 'var(--primary-color, #0284c7)' },
                                                title: isFa ? 'تبدیل برنامه پاسخ به اقدام پروژه' : 'Convert Response Plan to Action Item'
                                            }, React.createElement("span", { className: "material-symbols-outlined" }, "add_task")),
                                            !isReadOnly && ( (!requiresWorkflow) || risk.isApproved || (currentUserId && risk.submittedBy === currentUserId) || isPMOrAdmin ) && React.createElement(Fragment, null,
                                                React.createElement("button", { onClick: () => onEdit(risk), className: "action-icon edit", "aria-label": t('editRisk') }, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),
                                                React.createElement("button", { onClick: () => onDelete(risk.id), className: "action-icon delete", "aria-label": t('deleteRisk') }, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                                            )
                                        )
                                    );
                                })
                                : React.createElement("tr", null, React.createElement("td", { colSpan: 9 + (hideApprovalStatus ? 0 : 1), style: { textAlign: 'center' } }, t('noRisksDefined')))
                        )
                    )
                ),
                /* 2. Collapsible Side-by-side Risk Matrix and Risk Definitions Card (Closed by default) */
                React.createElement("div", {
                    style: {
                        marginTop: '1.5rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        backgroundColor: 'var(--card-bg-color, #ffffff)',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                    }
                },
                    React.createElement("div", {
                        onClick: () => setIsMatrixSectionExpanded(prev => !prev),
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.9rem 1.25rem',
                            cursor: 'pointer',
                            backgroundColor: isMatrixSectionExpanded ? 'var(--hover-bg-color, rgba(37, 99, 235, 0.05))' : 'var(--card-bg-color, #ffffff)',
                            borderBottom: isMatrixSectionExpanded ? '1px solid var(--border-color, #e2e8f0)' : 'none',
                            userSelect: 'none',
                            transition: 'background-color 0.2s ease'
                        }
                    },
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.6rem' } },
                            React.createElement("span", { className: "material-symbols-outlined", style: { color: '#2563eb', fontSize: '1.35rem' } }, "grid_view"),
                            React.createElement("span", { style: { fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-color, #1e293b)' } },
                                isFa ? 'ماتریس و جدول احتمال و اثر ریسک' : 'Risk Probability & Impact Matrix & Definitions'
                            ),
                            React.createElement("span", {
                                style: {
                                    fontSize: '0.72rem',
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    backgroundColor: isMatrixSectionExpanded ? '#dbeafe' : '#f1f5f9',
                                    color: isMatrixSectionExpanded ? '#1d4ed8' : '#64748b',
                                    fontWeight: 600
                                }
                            }, isMatrixSectionExpanded ? (isFa ? 'باز' : 'Expanded') : (isFa ? 'بسته' : 'Collapsed'))
                        ),
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2563eb', fontSize: '0.82rem', fontWeight: 600 } },
                            React.createElement("span", null, isMatrixSectionExpanded ? (isFa ? 'بستن ماتریس و جدول' : 'Collapse') : (isFa ? 'نمایش ماتریس و جدول احتمال و اثر' : 'Show Matrix & Table')),
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.25rem' } }, isMatrixSectionExpanded ? 'expand_less' : 'expand_more')
                        )
                    ),
                    isMatrixSectionExpanded && React.createElement("div", { style: { padding: '1.25rem' } },
                        React.createElement("div", { className: "risk-tab-bottom-grid", style: { marginTop: 0 } },
                            React.createElement(RiskProbabilityImpactMatrix, {
                                risks: risks || [],
                                language: language,
                                cellColors: cellColors,
                                onCellClick: handleCellClick,
                                onResetAllToRed: handleResetAllToRed,
                                selectedFilter: selectedFilter,
                                onSelectFilter: setSelectedFilter,
                                matrixClickMode: matrixClickMode,
                                onSetMatrixClickMode: setMatrixClickMode
                            }),
                            React.createElement(RiskDefinitionsCard, {
                                definitions: project?.riskDefinitions,
                                onSaveDefinitions: onUpdateRiskDefinitions,
                                language: language,
                                isReadOnly: isReadOnly || !isPMOrAdmin
                            })
                        )
                    )
                )
            )
        )
    );
};

export const StakeholderAnalysisMatrix = ({
    stakeholders = [],
    language,
    strategies,
    selectedFilter,
    onSelectFilter
}: {
    stakeholders: ProjectStakeholder[];
    language: string;
    strategies?: StakeholderStrategies;
    selectedFilter?: { power: 'Low' | 'High'; interest: 'Low' | 'High' } | null;
    onSelectFilter?: (filter: { power: 'Low' | 'High'; interest: 'Low' | 'High' } | null) => void;
}): ReactElement => {
    const isFa = language === 'fa';
    const totalCount = stakeholders.length;

    const powerList: ('High' | 'Low')[] = ['High', 'Low'];
    const interestList: ('Low' | 'High')[] = ['Low', 'High'];

    const powerLabels: Record<'High' | 'Low', string> = {
        High: isFa ? 'زیاد' : 'High',
        Low: isFa ? 'کم' : 'Low'
    };

    const interestLabels: Record<'Low' | 'High', string> = {
        Low: isFa ? 'کم' : 'Low',
        High: isFa ? 'زیاد' : 'High'
    };

    const effectiveStrategies = strategies || DEFAULT_STAKEHOLDER_STRATEGIES;

    return React.createElement("div", { className: "stakeholder-matrix-card" },
        React.createElement("div", { className: "stakeholder-matrix-header" },
            React.createElement("h5", { className: "stakeholder-matrix-title" },
                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.25rem', color: '#ea580c' } }, "group_work"),
                React.createElement("span", null, isFa ? 'ماتریس تحلیل ذینفعان (قدرت / علاقه)' : 'Stakeholder Analysis Matrix (Power / Interest)')
            ),
            selectedFilter && React.createElement("button", {
                type: "button",
                className: "risk-matrix-reset-btn",
                onClick: () => onSelectFilter?.(null),
                title: isFa ? 'حذف فیلتر ماتریس' : 'Clear filter'
            },
                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "filter_alt_off"),
                React.createElement("span", null, isFa ? 'نمایش همه' : 'Show All')
            )
        ),
        React.createElement("div", { className: "stakeholder-matrix-grid-wrapper" },
            /* Vertical Axis: Power (قدرت) */
            React.createElement("div", { className: "stakeholder-matrix-y-axis" },
                React.createElement("span", { className: "stakeholder-matrix-axis-title-v" },
                    isFa ? 'قدرت (Power) ↑' : 'Power (قدرت) ↑'
                )
            ),
            React.createElement("div", { className: "stakeholder-matrix-table-container" },
                React.createElement("table", { className: "stakeholder-matrix-grid" },
                    React.createElement("tbody", null,
                        /* 2 Rows for Power: High (Row 1), Low (Row 2) */
                        powerList.map(p => React.createElement("tr", { key: p },
                            React.createElement("th", { className: "row-label" }, powerLabels[p]),
                            interestList.map(i => {
                                const matchingStakeholders = stakeholders.filter(s => {
                                    const sp = s.power === 'Low' ? 'Low' : 'High';
                                    const si = s.interest === 'Low' ? 'Low' : 'High';
                                    return sp === p && si === i;
                                });
                                const count = matchingStakeholders.length;
                                const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                                const strat = getStakeholderStrategy(p, i, language, effectiveStrategies);
                                const isFilterActive = selectedFilter && selectedFilter.power === p && selectedFilter.interest === i;
                                const level = (p === 'High' && i === 'High') ? 4 : (p === 'High' && i === 'Low') ? 3 : (p === 'Low' && i === 'High') ? 2 : 1;

                                const tooltip = isFa
                                    ? `قدرت: ${powerLabels[p]} | علاقه: ${interestLabels[i]} | استراتژی: ${strat} | تعداد: ${toPersianDigits(count)} نفر (${toPersianDigits(pct)}٪)`
                                    : `Power: ${powerLabels[p]} | Interest: ${interestLabels[i]} | Strategy: ${strat} | Count: ${count} (${pct}%)`;

                                return React.createElement("td", {
                                    key: `${p}-${i}`,
                                    className: `stakeholder-matrix-cell level-${level} ${isFilterActive ? 'cell-selected' : ''}`,
                                    onClick: () => {
                                        if (onSelectFilter) {
                                            if (isFilterActive) {
                                                onSelectFilter(null);
                                            } else {
                                                onSelectFilter({ power: p, interest: i });
                                            }
                                        }
                                    },
                                    title: tooltip
                                },
                                    React.createElement("div", { className: "stakeholder-matrix-cell-content" },
                                        /* Spectrum circle displaying stakeholder count */
                                        React.createElement("div", { className: "stakeholder-matrix-count-circle" },
                                            isFa ? toPersianDigits(count) : count
                                        ),
                                        /* Strategy Title in cell */
                                        React.createElement("span", { className: "stakeholder-matrix-cell-label" }, strat)
                                    )
                                );
                            })
                        )),
                        /* Interest (علاقه) Columns at bottom of matrix: Low, High */
                        React.createElement("tr", { className: "stakeholder-matrix-col-label-row" },
                            React.createElement("th", { className: "corner-empty-cell" }),
                            interestList.map(i => React.createElement("th", { key: i, className: "col-label" }, interestLabels[i]))
                        )
                    )
                ),
                /* Horizontal Axis Title: Interest (علاقه) */
                React.createElement("div", { className: "stakeholder-matrix-axis-title-h" },
                    isFa ? '← علاقه (Interest) →' : '← Interest (علاقه) →'
                )
            )
        )
    );
};

export const StakeholderStrategiesCard = ({
    strategies,
    onSaveStrategies,
    language,
    isReadOnly = false
}: {
    strategies?: StakeholderStrategies;
    onSaveStrategies?: (strats: StakeholderStrategies) => void;
    language: string;
    isReadOnly?: boolean;
}): ReactElement => {
    const isFa = language === 'fa';
    const [isEditing, setIsEditing] = useState(false);
    const [localStrategies, setLocalStrategies] = useState<StakeholderStrategies>(strategies || DEFAULT_STAKEHOLDER_STRATEGIES);

    useEffect(() => {
        if (strategies) {
            setLocalStrategies(strategies);
        }
    }, [strategies]);

    const handleSave = () => {
        onSaveStrategies?.(localStrategies);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setLocalStrategies(strategies || DEFAULT_STAKEHOLDER_STRATEGIES);
        setIsEditing(false);
    };

    const handleResetDefaults = () => {
        if (window.confirm(isFa ? 'آیا مایل به بازنشانی استراتژی‌ها به مقادیر پیش‌فرض هستید؟' : 'Reset strategies to defaults?')) {
            setLocalStrategies(DEFAULT_STAKEHOLDER_STRATEGIES);
            onSaveStrategies?.(DEFAULT_STAKEHOLDER_STRATEGIES);
            setIsEditing(false);
        }
    };

    const quadrantConfigs: {
        key: keyof StakeholderStrategies;
        power: 'High' | 'Low';
        interest: 'High' | 'Low';
        titleFa: string;
        titleEn: string;
        badgeCls: string;
    }[] = [
        {
            key: 'highPower_highInterest',
            power: 'High',
            interest: 'High',
            titleFa: 'قدرت زیاد / علاقه زیاد',
            titleEn: 'High Power / High Interest',
            badgeCls: 'stakeholder-strategy-closely'
        },
        {
            key: 'highPower_lowInterest',
            power: 'High',
            interest: 'Low',
            titleFa: 'قدرت زیاد / علاقه کم',
            titleEn: 'High Power / Low Interest',
            badgeCls: 'stakeholder-strategy-satisfied'
        },
        {
            key: 'lowPower_highInterest',
            power: 'Low',
            interest: 'High',
            titleFa: 'قدرت کم / علاقه زیاد',
            titleEn: 'Low Power / High Interest',
            badgeCls: 'stakeholder-strategy-informed'
        },
        {
            key: 'lowPower_lowInterest',
            power: 'Low',
            interest: 'Low',
            titleFa: 'قدرت کم / علاقه کم',
            titleEn: 'Low Power / Low Interest',
            badgeCls: 'stakeholder-strategy-monitor'
        }
    ];

    return React.createElement("div", { className: "stakeholder-strategies-card" },
        React.createElement("div", { className: "risk-def-header" },
            React.createElement("h5", { className: "risk-def-title" },
                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.25rem', color: '#0284c7' } }, "psychology"),
                React.createElement("span", null, isFa ? 'استراتژی‌های ماتریس ذینفعان' : 'Stakeholder Strategies Definition')
            ),
            !isReadOnly && onSaveStrategies && (
                isEditing ? React.createElement("div", { className: "risk-def-actions" },
                    React.createElement("button", { type: "button", className: "risk-def-btn primary", onClick: handleSave },
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "save"),
                        React.createElement("span", null, isFa ? 'ذخیره' : 'Save')
                    ),
                    React.createElement("button", { type: "button", className: "risk-def-btn secondary", onClick: handleCancel },
                        React.createElement("span", null, isFa ? 'انصراف' : 'Cancel')
                    )
                ) : React.createElement("div", { className: "risk-def-actions" },
                    React.createElement("button", { type: "button", className: "risk-def-btn secondary", onClick: () => setIsEditing(true) },
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "edit"),
                        React.createElement("span", null, isFa ? 'ویرایش استراتژی‌ها' : 'Edit')
                    ),
                    React.createElement("button", { type: "button", className: "risk-def-btn reset", onClick: handleResetDefaults, title: isFa ? 'بازنشانی به پیش‌فرض' : 'Reset defaults' },
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "restart_alt")
                    )
                )
            )
        ),
        React.createElement("div", { className: "stakeholder-strat-grid" },
            quadrantConfigs.map(q => {
                const currentVal = localStrategies[q.key] || DEFAULT_STAKEHOLDER_STRATEGIES[q.key];
                return React.createElement("div", { key: q.key, className: "stakeholder-strat-item" },
                    React.createElement("div", { className: "stakeholder-strat-item-header" },
                        React.createElement("span", null, isFa ? q.titleFa : q.titleEn),
                        React.createElement("span", { className: `stakeholder-strategy-badge ${q.badgeCls}`, style: { fontSize: '0.7rem', padding: '1px 6px' } }, isFa ? 'الگوی ماتریس' : 'Matrix Rule')
                    ),
                    isEditing ? React.createElement("input", {
                        type: "text",
                        className: "risk-def-input",
                        value: currentVal,
                        onChange: (e: ChangeEvent<HTMLInputElement>) => {
                            const val = e.target.value;
                            setLocalStrategies(prev => ({ ...prev, [q.key]: val }));
                        }
                    }) : React.createElement("div", { className: "stakeholder-strat-item-title" }, currentVal)
                );
            })
        )
    );
};

export const ProjectStakeholdersTab = ({ 
    stakeholders = [], 
    users = [],
    onEdit, 
    onDelete, 
    isReadOnly = false, 
    isPMOrAdmin = false, 
    onApprove, 
    onReject, 
    currentUserId, 
    requiresWorkflow, 
    hideApprovalStatus = false, 
    project, 
    onUpdateStakeholders,
    onUpdateStakeholderStrategies,
    dynamicWorkflowSettings,
    onSaveAction,
    calendars = [],
    projects = [],
    owningUnits = [],
    currentUser
}: { 
    stakeholders?: ProjectStakeholder[], 
    users?: User[],
    onEdit: (stakeholder: ProjectStakeholder) => void,
    onDelete: (id: number) => void,
    isReadOnly?: boolean,
    isPMOrAdmin?: boolean,
    onApprove?: (id: number, comment?: string) => void,
    onReject?: (id: number, comment?: string) => void,
    currentUserId?: string,
    requiresWorkflow?: boolean,
    hideApprovalStatus?: boolean,
    project?: Project,
    onUpdateStakeholders?: (newStakeholders: ProjectStakeholder[]) => void,
    onUpdateStakeholderStrategies?: (strategies: StakeholderStrategies) => void,
    dynamicWorkflowSettings?: DynamicWorkflowSettings,
    onSaveAction?: (action: ActionItem) => void,
    calendars?: Calendar[],
    projects?: Project[],
    owningUnits?: string[],
    currentUser?: User | null
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [historyModalInfo, setHistoryModalInfo] = useState<{ title: string; typeLabel: string; history?: any[]; submittedBy?: number; isApproved?: boolean; isRejected?: boolean } | null>(null);
    const [commentModalState, setCommentModalState] = useState<{ id: number; status: 'Approved' | 'Rejected'; title: string } | null>(null);
    const [convertActionItem, setConvertActionItem] = useState<Partial<ActionItem> | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<{ power: 'Low' | 'High'; interest: 'Low' | 'High' } | null>(null);
    const [isMatrixSectionExpanded, setIsMatrixSectionExpanded] = useState(false);

    const effectiveStrategies = project?.stakeholderStrategies || DEFAULT_STAKEHOLDER_STRATEGIES;

    const filteredStakeholders = useMemo(() => {
        if (!selectedFilter) return stakeholders || [];
        return (stakeholders || []).filter(s => {
            const sp = s.power === 'Low' ? 'Low' : 'High';
            const si = s.interest === 'Low' ? 'Low' : 'High';
            return sp === selectedFilter.power && si === selectedFilter.interest;
        });
    }, [stakeholders, selectedFilter]);

    const powerLabels: Record<'High' | 'Low', string> = {
        High: isFa ? 'زیاد' : 'High',
        Low: isFa ? 'کم' : 'Low'
    };

    const interestLabels: Record<'Low' | 'High', string> = {
        Low: isFa ? 'کم' : 'Low',
        High: isFa ? 'زیاد' : 'High'
    };

    const handleConvertToStakeholderAction = (sh: ProjectStakeholder) => {
        const isShWorkflowEnabled = requiresWorkflow !== false;
        const stages = getEffectiveProjectWorkflowStages('stakeholders', project, dynamicWorkflowSettings);
        const firstStage = stages?.[0];
        const initialApproverId = firstStage && project ? resolveWorkflowApproverId(firstStage.approverId, project) : (project?.projectManagerId || undefined);

        const pVal = sh.power === 'Low' ? 'Low' : 'High';
        const iVal = sh.interest === 'Low' ? 'Low' : 'High';
        const strategyText = getStakeholderStrategy(pVal, iVal, language, effectiveStrategies);

        const submitterActor = currentUser ? (currentUser.name ? `${currentUser.name} (${currentUser.username})` : currentUser.username) : 'کاربر';
        const initialApprovalRecord: ProjectApprovalRecord = isShWorkflowEnabled ? {
            action: 'Submitted',
            date: new Date().toISOString(),
            actor: submitterActor,
            stageTitle: firstStage?.stageTitle || (isFa ? 'ثبت اقدام استراتژی ذینفع' : 'Stakeholder Strategy Action Submission'),
            comment: isFa ? `ایجاد اقدام از استراتژی تعامل با ذینفع «${sh.name}»` : `Action created from stakeholder strategy`
        } : {
            action: 'Approved',
            date: new Date().toISOString(),
            actor: 'System (No Workflow)',
            stageTitle: isFa ? 'تایید خودکار' : 'Auto Approved',
            comment: isFa ? 'بدون گردش کار تایید شد' : 'Approved without workflow'
        };

        const actionData: Partial<ActionItem> = {
            title: isFa ? `اقدام تعامل با ذینفع: ${sh.name} (${strategyText})` : `Stakeholder Action: ${sh.name} (${strategyText})`,
            description: isFa
                ? `نام ذینفع: ${sh.name}\nقدرت: ${powerLabels[pVal]} | علاقه: ${interestLabels[iVal]}\nاستراتژی برخورد: ${strategyText}\nنیازمندی‌ها و الزامات: ${sh.requirements || '-'}`
                : `Stakeholder: ${sh.name}\nPower: ${powerLabels[pVal]} | Interest: ${interestLabels[iVal]}\nStrategy: ${strategyText}\nRequirements: ${sh.requirements || '-'}`,
            projectId: project?.id,
            responsibleUserId: project?.projectManagerId || currentUser?.id || null,
            ownerUserId: currentUser?.id || project?.projectManagerId || null,
            calendarId: project?.calendarId || '1',
            owningUnit: project?.owningUnit || (owningUnits?.[0] || ''),
            startDate: project?.startDate || getISODateString(),
            endDate: project?.endDate || getISODateString(),
            status: 'Planning',
            sourceType: 'stakeholder',
            sourceStakeholderId: sh.id,
            sourceInfo: {
                type: 'stakeholder',
                projectName: project?.name,
                stakeholderName: sh.name,
                stakeholderStrategy: strategyText
            },
            workflowType: 'stakeholders',
            isApproved: !isShWorkflowEnabled,
            isPending: isShWorkflowEnabled,
            currentStageIndex: isShWorkflowEnabled ? 0 : undefined,
            currentApproverId: isShWorkflowEnabled ? initialApproverId : undefined,
            approvalHistory: [initialApprovalRecord]
        };

        setConvertActionItem(actionData);
    };

    return (
        React.createElement("div", null,
            historyModalInfo && React.createElement(TabItemHistoryModal, {
                itemTitle: historyModalInfo.title,
                itemTypeLabel: historyModalInfo.typeLabel,
                approvalHistory: historyModalInfo.history,
                submittedBy: historyModalInfo.submittedBy,
                isApproved: historyModalInfo.isApproved,
                isRejected: historyModalInfo.isRejected,
                users: users || [],
                onClose: () => setHistoryModalInfo(null)
            }),
            commentModalState && React.createElement(ApprovalCommentModal, {
                title: `${isFa ? 'ثبت نظر و علت' : 'Review & Reason'} (${commentModalState.status === 'Approved' ? (isFa ? 'تایید' : 'Approve') : (isFa ? 'عدم تایید' : 'Reject')}) - ${isFa ? 'ذینفع' : 'Stakeholder'}`,
                initialComment: '',
                status: commentModalState.status,
                onSave: (comment, overrideStatus) => {
                    const finalStatus = overrideStatus || commentModalState.status;
                    if (finalStatus === 'Approved') {
                        onApprove?.(commentModalState.id, comment);
                    } else {
                        onReject?.(commentModalState.id, comment);
                    }
                    setCommentModalState(null);
                },
                onClose: () => setCommentModalState(null)
            }),
            project && onUpdateStakeholders && React.createElement(AiStakeholderModal, {
                project,
                isOpen: aiModalOpen,
                onClose: () => setAiModalOpen(false),
                isPMOrAdmin,
                currentUserId,
                requiresWorkflow,
                dynamicWorkflowSettings,
                users,
                onApplyStakeholders: (newStakeholders, replace) => {
                    let updated: ProjectStakeholder[] = [];
                    if (replace) {
                        updated = newStakeholders;
                    } else {
                        updated = [...(stakeholders || []), ...newStakeholders];
                    }
                    onUpdateStakeholders(updated);
                }
            }),
            convertActionItem && React.createElement(ActionModal, {
                initialAction: convertActionItem,
                users: users || [],
                calendars: calendars || [],
                projects: projects && projects.length > 0 ? projects : (project ? [project] : []),
                owningUnits: owningUnits || (project?.owningUnit ? [project.owningUnit] : []),
                currentUser: currentUser,
                isProjectLocked: true,
                onSave: (savedAction) => {
                    onSaveAction?.(savedAction);
                    setConvertActionItem(null);
                },
                onClose: () => setConvertActionItem(null)
            }),
            !isReadOnly && React.createElement("div", { className: "tab-section-header", style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' } },
                React.createElement("h4", { style: { margin: 0 } }, isFa ? 'شناسایی و مدیریت ذینفعان پروژه' : 'Stakeholder Register & Management'),
                project && onUpdateStakeholders && React.createElement("button", {
                    className: "action-button primary",
                    onClick: () => setAiModalOpen(true),
                    title: isFa ? 'تحلیل ذینفعان و پیشنهادات با هوش مصنوعی' : 'AI Stakeholder Analysis & Suggestions',
                    "aria-label": isFa ? 'تحلیل ذینفعان و پیشنهادات با هوش مصنوعی' : 'AI Stakeholder Analysis & Suggestions',
                    style: { padding: '0.5rem 0.65rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
                },
                    React.createElement("span", { className: "material-symbols-outlined" }, "auto_awesome")
                )
            ),
            selectedFilter && React.createElement("div", { className: "risk-filter-active-banner", style: { background: 'rgba(234, 88, 12, 0.08)', borderColor: 'rgba(234, 88, 12, 0.3)', color: '#c2410c' } },
                React.createElement("span", null,
                    isFa 
                        ? `فیلتر فعال براساس ماتریس: قدرت «${powerLabels[selectedFilter.power]}» و علاقه «${interestLabels[selectedFilter.interest]}» (${toPersianDigits(filteredStakeholders.length)} نفر)`
                        : `Active Filter: Power "${powerLabels[selectedFilter.power]}" & Interest "${interestLabels[selectedFilter.interest]}" (${filteredStakeholders.length} stakeholders)`
                ),
                React.createElement("button", { type: "button", className: "risk-filter-clear-btn", onClick: () => setSelectedFilter(null) },
                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "close"),
                    React.createElement("span", null, isFa ? 'حذف فیلتر و نمایش همه' : 'Clear Filter')
                )
            ),
            React.createElement("div", { className: "table-responsive" },
                React.createElement("table", { className: "tab-table font-compact-table stakeholder-tab-table", style: { fontSize: '0.8rem' } },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", { style: { width: '40px' } }, isFa ? 'ردیف' : '#'),
                            React.createElement("th", null, isFa ? 'ذینفع' : 'Stakeholder'),
                            React.createElement("th", { style: { width: '85px', textAlign: 'center' } }, isFa ? 'قدرت' : 'Power'),
                            React.createElement("th", { style: { width: '85px', textAlign: 'center' } }, isFa ? 'علاقه' : 'Interest'),
                            React.createElement("th", { style: { width: '200px' } }, isFa ? 'استراتژی برخورد' : 'Engagement Strategy'),
                            React.createElement("th", null, isFa ? 'نیازمندی‌ها و الزامات فنی و ارتباطی' : 'Technical & Communication Requirements'),
                            React.createElement("th", null, isFa ? 'ثبت‌کننده' : 'Submitter'),
                            React.createElement("th", null, isFa ? 'تایید‌کننده' : 'Approver'),
                            !hideApprovalStatus && React.createElement("th", { style: { textAlign: 'center' } }, isFa ? 'وضعیت تایید' : 'Approval Status'),
                            React.createElement("th", { style: { width: '100px' } }, t('actions'))
                        )
                    ),
                    React.createElement("tbody", null,
                        filteredStakeholders && filteredStakeholders.length > 0
                            ? filteredStakeholders.map((sh, index) => {
                                const isPending = sh.isApproved === false && !(sh as any).isRejected;
                                const isRejected = sh.isApproved === false && !!(sh as any).isRejected;

                                const stages = getEffectiveProjectWorkflowStages('stakeholders', project, dynamicWorkflowSettings);
                                const currentStageIdx = sh.currentStageIndex ?? 0;
                                const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                                const effectiveApproverId = sh.currentApproverId ?? (stage && project ? resolveWorkflowApproverId(stage.approverId, project) : project?.projectManagerId);
                                const approverUser = users?.find(u => Number(u.id) === Number(effectiveApproverId));
                                const approverDisplay = approverUser ? (approverUser.name ? `${approverUser.name} (${approverUser.username})` : approverUser.username) : '-';
                                const canApproveThisItem = currentUserId && (
                                    Number(effectiveApproverId) === Number(currentUserId) || isPMOrAdmin
                                );

                                const pVal = sh.power === 'Low' ? 'Low' : 'High';
                                const iVal = sh.interest === 'Low' ? 'Low' : 'High';
                                const strategyText = getStakeholderStrategy(pVal, iVal, language, effectiveStrategies);

                                const pBadgeClass = pVal === 'High' ? 'stakeholder-badge-power-high' : 'stakeholder-badge-power-low';
                                const pBadgeLabel = pVal === 'High' ? (isFa ? 'زیاد' : 'High') : (isFa ? 'کم' : 'Low');

                                const iBadgeClass = iVal === 'High' ? 'stakeholder-badge-interest-high' : 'stakeholder-badge-interest-low';
                                const iBadgeLabel = iVal === 'High' ? (isFa ? 'زیاد' : 'High') : (isFa ? 'کم' : 'Low');

                                const strategyClass = (pVal === 'High' && iVal === 'High')
                                  ? 'stakeholder-strategy-closely'
                                  : (pVal === 'High' && iVal === 'Low')
                                    ? 'stakeholder-strategy-satisfied'
                                    : (pVal === 'Low' && iVal === 'High')
                                      ? 'stakeholder-strategy-informed'
                                      : 'stakeholder-strategy-monitor';

                                return React.createElement("tr", { key: sh.id },
                                    React.createElement("td", { style: { color: 'var(--text-muted, #64748b)' } }, isFa ? toPersianDigits(index + 1) : index + 1),
                                    React.createElement("td", { style: { fontWeight: 600 } }, sh.name),
                                    React.createElement("td", { style: { textAlign: 'center' } },
                                        React.createElement("span", { className: pBadgeClass }, pBadgeLabel)
                                    ),
                                    React.createElement("td", { style: { textAlign: 'center' } },
                                        React.createElement("span", { className: iBadgeClass }, iBadgeLabel)
                                    ),
                                    React.createElement("td", null,
                                        React.createElement("span", { className: `stakeholder-strategy-badge ${strategyClass}` }, strategyText)
                                    ),
                                    React.createElement("td", { style: { lineHeight: 1.4, color: 'var(--text-color, #1e293b)' } }, sh.requirements || '-'),
                                    React.createElement("td", null, users?.find(u => Number(u.id) === Number(sh.submittedBy))?.username || '-'),
                                    React.createElement("td", null, approverDisplay),
                                    !hideApprovalStatus && React.createElement("td", { style: { textAlign: 'center' } },
                                        isPending && React.createElement("span", { className: "badge badge-yellow", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 500, whiteSpace: 'nowrap' } }, isFa ? 'در انتظار تایید' : 'Pending Approval'),
                                        isRejected && React.createElement("span", { className: "badge badge-red", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 500, whiteSpace: 'nowrap' } }, isFa ? 'عدم تایید' : 'Rejected'),
                                        (!isPending && !isRejected) && React.createElement("span", { className: "badge badge-green", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 500, whiteSpace: 'nowrap' } }, isFa ? 'تایید شده' : 'Approved')
                                    ),
                                    React.createElement("td", { className: "action-cell" },
                                        React.createElement("button", {
                                            onClick: () => setHistoryModalInfo({
                                                title: sh.name,
                                                typeLabel: isFa ? 'ذینفع' : 'Stakeholder',
                                                history: sh.approvalHistory,
                                                submittedBy: sh.submittedBy,
                                                isApproved: sh.isApproved,
                                                isRejected: (sh as any).isRejected
                                            }),
                                            className: "action-icon history",
                                            title: t('history')
                                        }, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                        !isReadOnly && isPending && canApproveThisItem && onApprove && onReject && React.createElement(Fragment, null,
                                            React.createElement("button", { onClick: () => setCommentModalState({ id: sh.id, status: 'Approved', title: sh.name }), className: "action-icon edit", style: { color: 'green' }, title: isFa ? 'تایید' : 'Approve' }, React.createElement("span", { className: "material-symbols-outlined" }, "check")),
                                            React.createElement("button", { onClick: () => setCommentModalState({ id: sh.id, status: 'Rejected', title: sh.name }), className: "action-icon delete", style: { color: 'red' }, title: isFa ? 'عدم تایید' : 'Reject' }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                                        ),
                                        !isReadOnly && onSaveAction && React.createElement("button", {
                                            type: "button",
                                            onClick: () => handleConvertToStakeholderAction(sh),
                                            className: "action-icon",
                                            style: { color: 'var(--primary-color, #0284c7)' },
                                            title: isFa ? 'تبدیل استراتژی برخورد به اقدام پروژه' : 'Convert Strategy to Action Item'
                                        }, React.createElement("span", { className: "material-symbols-outlined" }, "add_task")),
                                        !isReadOnly && (!requiresWorkflow || !isPending) && React.createElement(Fragment, null,
                                            React.createElement("button", { onClick: () => onEdit(sh), className: "action-icon edit", title: t('edit') }, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),
                                            React.createElement("button", { onClick: () => onDelete(sh.id), className: "action-icon delete", title: t('delete') }, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                                        )
                                    )
                                );
                            })
                            : React.createElement("tr", null, React.createElement("td", { colSpan: 10, style: { textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted, #64748b)' } }, isFa ? 'هیچ ذینفعی برای این پروژه ثبت نشده است.' : 'No stakeholders registered for this project.'))
                    )
                )
            ),
            /* Stakeholder Analysis Matrix & Strategies below the grid (Closed by default) */
            React.createElement("div", {
                style: {
                    marginTop: '1.5rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    backgroundColor: 'var(--card-bg-color, #ffffff)',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                }
            },
                React.createElement("div", {
                    onClick: () => setIsMatrixSectionExpanded(prev => !prev),
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.9rem 1.25rem',
                        cursor: 'pointer',
                        backgroundColor: isMatrixSectionExpanded ? 'var(--hover-bg-color, rgba(234, 88, 12, 0.05))' : 'var(--card-bg-color, #ffffff)',
                        borderBottom: isMatrixSectionExpanded ? '1px solid var(--border-color, #e2e8f0)' : 'none',
                        userSelect: 'none',
                        transition: 'background-color 0.2s ease'
                    }
                },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.6rem' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: '#ea580c', fontSize: '1.35rem' } }, "group_work"),
                        React.createElement("span", { style: { fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-color, #1e293b)' } },
                            isFa ? 'ماتریس تحلیل و استراتژی‌های ذینفعان (قدرت / علاقه)' : 'Stakeholder Analysis & Engagement Strategy Matrix'
                        ),
                        React.createElement("span", {
                            style: {
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                backgroundColor: isMatrixSectionExpanded ? '#ffedd5' : '#f1f5f9',
                                color: isMatrixSectionExpanded ? '#c2410c' : '#64748b',
                                fontWeight: 600
                            }
                        }, isMatrixSectionExpanded ? (isFa ? 'باز' : 'Expanded') : (isFa ? 'بسته' : 'Collapsed'))
                    ),
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ea580c', fontSize: '0.82rem', fontWeight: 600 } },
                        React.createElement("span", null, isMatrixSectionExpanded ? (isFa ? 'بستن ماتریس و استراتژی‌ها' : 'Collapse') : (isFa ? 'نمایش ماتریس و استراتژی‌های ذینفعان' : 'Show Matrix & Strategies')),
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.25rem' } }, isMatrixSectionExpanded ? 'expand_less' : 'expand_more')
                    )
                ),
                isMatrixSectionExpanded && React.createElement("div", { style: { padding: '1.25rem' } },
                    React.createElement("div", { className: "stakeholder-tab-bottom-grid", style: { marginTop: 0 } },
                        React.createElement(StakeholderAnalysisMatrix, {
                            stakeholders: stakeholders || [],
                            language: language,
                            strategies: project?.stakeholderStrategies,
                            selectedFilter: selectedFilter,
                            onSelectFilter: setSelectedFilter
                        }),
                        React.createElement(StakeholderStrategiesCard, {
                            strategies: project?.stakeholderStrategies,
                            onSaveStrategies: onUpdateStakeholderStrategies,
                            language: language,
                            isReadOnly: isReadOnly || !isPMOrAdmin
                        })
                    )
                )
            )
        )
    );
};

export const ProjectStatusTab = ({ statusUpdates, users, onEdit, onDelete, isReadOnly = false, isPMOrAdmin = false, onApprove, onReject, currentUserId, requiresWorkflow, hideApprovalStatus = false, project, dynamicWorkflowSettings }: { 
    statusUpdates: ProjectStatusUpdate[], 
    users?: User[],
    onEdit: (update: ProjectStatusUpdate) => void,
    onDelete: (id: number) => void,
    isReadOnly?: boolean,
    isPMOrAdmin?: boolean,
    onApprove?: (id: number, comment?: string) => void,
    onReject?: (id: number, comment?: string) => void,
    currentUserId?: string,
    requiresWorkflow?: boolean,
    hideApprovalStatus?: boolean,
    project?: Project,
    dynamicWorkflowSettings?: DynamicWorkflowSettings
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [historyModalInfo, setHistoryModalInfo] = useState<{ title: string; typeLabel: string; history?: any[]; submittedBy?: number; isApproved?: boolean; isRejected?: boolean } | null>(null);
    const [commentModalState, setCommentModalState] = useState<{ id: number; status: 'Approved' | 'Rejected'; title: string } | null>(null);
    
    return (
        React.createElement("div", null,
            historyModalInfo && React.createElement(TabItemHistoryModal, {
                itemTitle: historyModalInfo.title,
                itemTypeLabel: historyModalInfo.typeLabel,
                approvalHistory: historyModalInfo.history,
                submittedBy: historyModalInfo.submittedBy,
                isApproved: historyModalInfo.isApproved,
                isRejected: historyModalInfo.isRejected,
                users: users || [],
                onClose: () => setHistoryModalInfo(null)
            }),
            commentModalState && React.createElement(ApprovalCommentModal, {
                title: `${language === 'fa' ? 'ثبت نظر و علت' : 'Review & Reason'} (${commentModalState.status === 'Approved' ? (language === 'fa' ? 'تایید' : 'Approve') : (language === 'fa' ? 'عدم تایید' : 'Reject')}) - ${language === 'fa' ? 'آخرین وضعیت' : 'Status Update'}`,
                initialComment: '',
                status: commentModalState.status,
                onSave: (comment, overrideStatus) => {
                    const finalStatus = overrideStatus || commentModalState.status;
                    if (finalStatus === 'Approved') {
                        onApprove?.(commentModalState.id, comment);
                    } else {
                        onReject?.(commentModalState.id, comment);
                    }
                    setCommentModalState(null);
                },
                onClose: () => setCommentModalState(null)
            }),
            !isReadOnly && React.createElement("div", { className: "tab-section-header" },
                React.createElement("h4", null, t('projectStatus'))
            ),
            React.createElement("table", { className: "tab-table" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, language === 'fa' ? 'ردیف' : '#'),
                        React.createElement("th", null, language === 'fa' ? 'تاریخ ثبت' : 'Registration Date'),
                        React.createElement("th", null, t('description')),
                        React.createElement("th", null, language === 'fa' ? 'ثبت‌کننده' : 'Submitter'),
                        React.createElement("th", null, language === 'fa' ? 'تایید‌کننده' : 'Approver'),
                        !hideApprovalStatus && React.createElement("th", { style: { textAlign: 'center' } }, language === 'fa' ? 'وضعیت تایید' : 'Approval Status'),
                        React.createElement("th", null, t('actions'))
                    )
                ),
                React.createElement("tbody", null,
                    statusUpdates.length > 0
                        ? statusUpdates.map((update, index) => {
                            const isPending = update.isApproved === false && !(update as any).isRejected;
                            const isRejected = update.isApproved === false && !!(update as any).isRejected;

                            const stages = getEffectiveProjectWorkflowStages('status_updates', project, dynamicWorkflowSettings);
                            const currentStageIdx = update.currentStageIndex ?? 0;
                            const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                            const effectiveApproverId = update.currentApproverId ?? (stage && project ? resolveWorkflowApproverId(stage.approverId, project) : project?.projectManagerId);
                            const approverUser = users?.find(u => Number(u.id) === Number(effectiveApproverId));
                            const approverDisplay = approverUser ? (approverUser.name ? `${approverUser.name} (${approverUser.username})` : approverUser.username) : '-';
                            const canApproveThisItem = currentUserId && (
                                Number(effectiveApproverId) === Number(currentUserId) || isPMOrAdmin
                            );

                            return React.createElement("tr", { key: update.id },
                                React.createElement("td", null, language === 'fa' ? toPersianDigits(index + 1) : index + 1),
                                React.createElement("td", null, formatDate(update.date, language)),
                                React.createElement("td", null, update.description),
                                React.createElement("td", null, users?.find(u => Number(u.id) === Number(update.submittedBy))?.username || '-'),
                                React.createElement("td", null, approverDisplay),
                                !hideApprovalStatus && React.createElement("td", { style: { textAlign: 'center' } },
                                    isPending && React.createElement("span", { className: "badge badge-yellow", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 500, whiteSpace: 'nowrap' } }, language === 'fa' ? 'در انتظار تایید' : 'Pending Approval'),
                                    isRejected && React.createElement("span", { className: "badge badge-red", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 500, whiteSpace: 'nowrap' } }, language === 'fa' ? 'عدم تایید' : 'Rejected'),
                                    (!isPending && !isRejected) && React.createElement("span", { className: "badge badge-green", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 500, whiteSpace: 'nowrap' } }, language === 'fa' ? 'تایید شده' : 'Approved')
                                ),
                                React.createElement("td", { className: "action-cell" },
                                    React.createElement("button", {
                                        onClick: () => setHistoryModalInfo({
                                            title: update.description,
                                            typeLabel: language === 'fa' ? 'آخرین وضعیت' : 'Status Update',
                                            history: update.approvalHistory,
                                            submittedBy: update.submittedBy,
                                            isApproved: update.isApproved,
                                            isRejected: (update as any).isRejected
                                        }),
                                        className: "action-icon history",
                                        title: t('history')
                                    }, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                    !isReadOnly && isPending && canApproveThisItem && onApprove && onReject && React.createElement(Fragment, null,
                                        React.createElement("button", { onClick: () => setCommentModalState({ id: update.id, status: 'Approved', title: update.description }), className: "action-icon edit", style: { color: 'green' }, title: language === 'fa' ? 'تایید' : 'Approve' }, React.createElement("span", { className: "material-symbols-outlined" }, "check")),
                                        React.createElement("button", { onClick: () => setCommentModalState({ id: update.id, status: 'Rejected', title: update.description }), className: "action-icon delete", style: { color: 'red' }, title: language === 'fa' ? 'عدم تایید' : 'Reject' }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                                    ),
                                    !isReadOnly && ( (!requiresWorkflow) || update.isApproved || (currentUserId && update.submittedBy === currentUserId) || isPMOrAdmin ) && React.createElement(Fragment, null,
                                        React.createElement("button", { onClick: () => onEdit(update), className: "action-icon edit", "aria-label": t('edit') }, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),
                                        React.createElement("button", { onClick: () => onDelete(update.id), className: "action-icon delete", "aria-label": t('delete') }, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                                    )
                                )
                            );
                        })
                        : React.createElement("tr", null, React.createElement("td", { colSpan: 6 + (hideApprovalStatus ? 0 : 1), style: { textAlign: 'center' } }, t('noStatusUpdates')))
                )
            )
        )
    );
};

export const ProjectDelayReasonsTab = ({ delayReasons, users, onEdit, onDelete, isReadOnly = false, isPMOrAdmin = false, onApprove, onReject, currentUserId, requiresWorkflow, hideApprovalStatus = false, project, dynamicWorkflowSettings }: { 
    delayReasons: ProjectDelayReason[], 
    users?: User[],
    onEdit: (reason: ProjectDelayReason) => void,
    onDelete: (id: number) => void,
    isReadOnly?: boolean,
    isPMOrAdmin?: boolean,
    onApprove?: (id: number, comment?: string) => void,
    onReject?: (id: number, comment?: string) => void,
    currentUserId?: string,
    requiresWorkflow?: boolean,
    hideApprovalStatus?: boolean,
    project?: Project,
    dynamicWorkflowSettings?: DynamicWorkflowSettings
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [historyModalInfo, setHistoryModalInfo] = useState<{ title: string; typeLabel: string; history?: any[]; submittedBy?: number; isApproved?: boolean; isRejected?: boolean } | null>(null);
    const [commentModalState, setCommentModalState] = useState<{ id: number; status: 'Approved' | 'Rejected'; title: string } | null>(null);
    
    return (
        React.createElement("div", null,
            historyModalInfo && React.createElement(TabItemHistoryModal, {
                itemTitle: historyModalInfo.title,
                itemTypeLabel: historyModalInfo.typeLabel,
                approvalHistory: historyModalInfo.history,
                submittedBy: historyModalInfo.submittedBy,
                isApproved: historyModalInfo.isApproved,
                isRejected: historyModalInfo.isRejected,
                users: users || [],
                onClose: () => setHistoryModalInfo(null)
            }),
            commentModalState && React.createElement(ApprovalCommentModal, {
                title: `${language === 'fa' ? 'ثبت نظر و علت' : 'Review & Reason'} (${commentModalState.status === 'Approved' ? (language === 'fa' ? 'تایید' : 'Approve') : (language === 'fa' ? 'عدم تایید' : 'Reject')}) - ${language === 'fa' ? 'علت تاخیر' : 'Delay Reason'}`,
                initialComment: '',
                status: commentModalState.status,
                onSave: (comment, overrideStatus) => {
                    const finalStatus = overrideStatus || commentModalState.status;
                    if (finalStatus === 'Approved') {
                        onApprove?.(commentModalState.id, comment);
                    } else {
                        onReject?.(commentModalState.id, comment);
                    }
                    setCommentModalState(null);
                },
                onClose: () => setCommentModalState(null)
            }),
            !isReadOnly && React.createElement("div", { className: "tab-section-header" },
                React.createElement("h4", null, language === 'fa' ? 'دلایل تاخیر پروژه' : 'Project Delay Reasons')
            ),
            React.createElement("table", { className: "tab-table" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, language === 'fa' ? 'ردیف' : '#'),
                        React.createElement("th", null, language === 'fa' ? 'تاریخ ثبت' : 'Registration Date'),
                        React.createElement("th", null, language === 'fa' ? 'علت تاخیر' : 'Delay Reason'),
                        React.createElement("th", null, language === 'fa' ? 'ثبت‌کننده' : 'Submitter'),
                        React.createElement("th", null, language === 'fa' ? 'تایید‌کننده' : 'Approver'),
                        !hideApprovalStatus && React.createElement("th", { style: { textAlign: 'center' } }, language === 'fa' ? 'وضعیت تایید' : 'Approval Status'),
                        React.createElement("th", null, t('actions'))
                    )
                ),
                React.createElement("tbody", null,
                    delayReasons && delayReasons.length > 0
                        ? delayReasons.map((reason, index) => {
                            const isPending = reason.isApproved === false && !(reason as any).isRejected;
                            const isRejected = reason.isApproved === false && !!(reason as any).isRejected;

                            const stages = getEffectiveProjectWorkflowStages('delay_reasons', project, dynamicWorkflowSettings);
                            const currentStageIdx = reason.currentStageIndex ?? 0;
                            const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                            const effectiveApproverId = reason.currentApproverId ?? (stage && project ? resolveWorkflowApproverId(stage.approverId, project) : project?.projectManagerId);
                            const approverUser = users?.find(u => Number(u.id) === Number(effectiveApproverId));
                            const approverDisplay = approverUser ? (approverUser.name ? `${approverUser.name} (${approverUser.username})` : approverUser.username) : '-';
                            const canApproveThisItem = currentUserId && (
                                Number(effectiveApproverId) === Number(currentUserId) || isPMOrAdmin
                            );

                            return React.createElement("tr", { key: reason.id },
                                React.createElement("td", null, language === 'fa' ? toPersianDigits(index + 1) : index + 1),
                                React.createElement("td", null, formatDate(reason.date, language)),
                                React.createElement("td", null, reason.description),
                                React.createElement("td", null, users?.find(u => Number(u.id) === Number(reason.submittedBy))?.username || '-'),
                                React.createElement("td", null, approverDisplay),
                                !hideApprovalStatus && React.createElement("td", { style: { textAlign: 'center' } },
                                    isPending && React.createElement("span", { className: "badge badge-yellow", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 500, whiteSpace: 'nowrap' } }, language === 'fa' ? 'در انتظار تایید' : 'Pending Approval'),
                                    isRejected && React.createElement("span", { className: "badge badge-red", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 500, whiteSpace: 'nowrap' } }, language === 'fa' ? 'عدم تایید' : 'Rejected'),
                                    (!isPending && !isRejected) && React.createElement("span", { className: "badge badge-green", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 500, whiteSpace: 'nowrap' } }, language === 'fa' ? 'تایید شده' : 'Approved')
                                ),
                                React.createElement("td", { className: "action-cell" },
                                    React.createElement("button", {
                                        onClick: () => setHistoryModalInfo({
                                            title: reason.description,
                                            typeLabel: language === 'fa' ? 'علت تاخیر' : 'Delay Reason',
                                            history: reason.approvalHistory,
                                            submittedBy: reason.submittedBy,
                                            isApproved: reason.isApproved,
                                            isRejected: (reason as any).isRejected
                                        }),
                                        className: "action-icon history",
                                        title: t('history')
                                    }, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                    !isReadOnly && isPending && canApproveThisItem && onApprove && onReject && React.createElement(Fragment, null,
                                        React.createElement("button", { onClick: () => setCommentModalState({ id: reason.id, status: 'Approved', title: reason.description }), className: "action-icon edit", style: { color: 'green' }, title: language === 'fa' ? 'تایید' : 'Approve' }, React.createElement("span", { className: "material-symbols-outlined" }, "check")),
                                        React.createElement("button", { onClick: () => setCommentModalState({ id: reason.id, status: 'Rejected', title: reason.description }), className: "action-icon delete", style: { color: 'red' }, title: language === 'fa' ? 'عدم تایید' : 'Reject' }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                                    ),
                                    !isReadOnly && ( (!requiresWorkflow) || reason.isApproved || (currentUserId && reason.submittedBy === currentUserId) || isPMOrAdmin ) && React.createElement(Fragment, null,
                                        React.createElement("button", { onClick: () => onEdit(reason), className: "action-icon edit", "aria-label": t('edit') }, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),
                                        React.createElement("button", { onClick: () => onDelete(reason.id), className: "action-icon delete", "aria-label": t('delete') }, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                                    )
                                )
                            );
                        })
                        : React.createElement("tr", null, React.createElement("td", { colSpan: 6 + (hideApprovalStatus ? 0 : 1), style: { textAlign: 'center' } }, language === 'fa' ? 'هیچ علت تاخیری ثبت نشده است' : 'No delay reasons registered.'))
                )
            )
        )
    );
};

export const ProjectDocumentsTab = ({ documents, users, onEdit, onDelete, isReadOnly = false, isPMOrAdmin = false, onApprove, onReject, currentUserId, requiresWorkflow, hideApprovalStatus = false, project, onUpdateDocuments, dynamicWorkflowSettings }: { 
    documents: ProjectDocument[], 
    users?: User[],
    onEdit: (doc: ProjectDocument) => void,
    onDelete: (id: number) => void,
    isReadOnly?: boolean,
    isPMOrAdmin?: boolean,
    onApprove?: (id: number, comment?: string) => void,
    onReject?: (id: number, comment?: string) => void,
    currentUserId?: string,
    requiresWorkflow?: boolean,
    hideApprovalStatus?: boolean,
    project?: Project,
    onUpdateDocuments?: (newDocs: ProjectDocument[]) => void,
    dynamicWorkflowSettings?: DynamicWorkflowSettings
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const [loadingDocId, setLoadingDocId] = useState<number | null>(null);
    const [historyModalInfo, setHistoryModalInfo] = useState<{ title: string; typeLabel: string; history?: any[]; submittedBy?: number; isApproved?: boolean; isRejected?: boolean } | null>(null);
    const [commentModalState, setCommentModalState] = useState<{ id: number; status: 'Approved' | 'Rejected'; title: string } | null>(null);

    const handleSummarizeDoc = async (doc: ProjectDocument) => {
        setLoadingDocId(doc.id);
        try {
            const res = await fetch('/api/ai/summarize-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docName: doc.name,
                    docDescription: doc.description,
                    docType: doc.type,
                    projectName: project?.name,
                    projectGoal: project?.goal || project?.description
                })
            });
            const data = await res.json();
            if (data.success && onUpdateDocuments) {
                const updatedDocs = documents.map(d => d.id === doc.id ? {
                    ...d,
                    aiSummary: data.summary,
                    aiRelevance: data.relevance,
                    aiRelevanceReason: data.relevanceReason
                } : d);
                onUpdateDocuments(updatedDocs);
            }
        } catch (err) {
            console.error("Error summarizing document:", err);
        } finally {
            setLoadingDocId(null);
        }
    };
   
    const docTypeTranslations: Record<ProjectDocument['type'], TranslationKey> = {
        Report: 'report',
        Letter: 'letter',
        'Meeting Minutes': 'meetingMinutes',
        Other: 'other'
    };

    return (
        React.createElement("div", null,
            historyModalInfo && React.createElement(TabItemHistoryModal, {
                itemTitle: historyModalInfo.title,
                itemTypeLabel: historyModalInfo.typeLabel,
                approvalHistory: historyModalInfo.history,
                submittedBy: historyModalInfo.submittedBy,
                isApproved: historyModalInfo.isApproved,
                isRejected: historyModalInfo.isRejected,
                users: users || [],
                onClose: () => setHistoryModalInfo(null)
            }),
            commentModalState && React.createElement(ApprovalCommentModal, {
                title: `${isFa ? 'ثبت نظر و علت' : 'Review & Reason'} (${commentModalState.status === 'Approved' ? (isFa ? 'تایید' : 'Approve') : (isFa ? 'عدم تایید' : 'Reject')}) - ${isFa ? 'مستندات' : 'Document'}`,
                initialComment: '',
                status: commentModalState.status,
                onSave: (comment, overrideStatus) => {
                    const finalStatus = overrideStatus || commentModalState.status;
                    if (finalStatus === 'Approved') {
                        onApprove?.(commentModalState.id, comment);
                    } else {
                        onReject?.(commentModalState.id, comment);
                    }
                    setCommentModalState(null);
                },
                onClose: () => setCommentModalState(null)
            }),
            !isReadOnly && React.createElement("div", { className: "tab-section-header" },
                React.createElement("h4", null, t('projectDocuments'))
            ),
            React.createElement("table", { className: "tab-table", style: { marginTop: '1rem' } },
                React.createElement("thead", null, React.createElement("tr", null,
                    React.createElement("th", null, isFa ? 'ردیف' : '#'),
                    React.createElement("th", null, t('fileName')),
                    React.createElement("th", null, t('description')),
                    React.createElement("th", { style: { minWidth: '240px' } }, isFa ? 'خلاصه و ارتباط با پروژه (هوش مصنوعی)' : 'AI Summary & Relevance'),
                    React.createElement("th", null, t('docType')),
                    React.createElement("th", null, isFa ? 'تاریخ ثبت' : 'Registration Date'),
                    React.createElement("th", null, isFa ? 'ثبت‌کننده' : 'Submitter'),
                    React.createElement("th", null, isFa ? 'تایید‌کننده' : 'Approver'),
                    !hideApprovalStatus && React.createElement("th", { style: { textAlign: 'center' } }, isFa ? 'وضعیت تایید' : 'Approval Status'),
                    React.createElement("th", null, t('actions'))
                )),
                React.createElement("tbody", null,
                    documents.length > 0
                        ? documents.map((doc, index) => {
                            const isPending = doc.isApproved === false && !(doc as any).isRejected;
                            const isRejected = doc.isApproved === false && !!(doc as any).isRejected;
                            const isSummarizing = loadingDocId === doc.id;

                            const stages = getEffectiveProjectWorkflowStages('documents', project, dynamicWorkflowSettings);
                            const currentStageIdx = doc.currentStageIndex ?? 0;
                            const stage = stages ? (stages[currentStageIdx] || stages[0]) : undefined;
                            const effectiveApproverId = doc.currentApproverId ?? (stage && project ? resolveWorkflowApproverId(stage.approverId, project) : project?.projectManagerId);
                            const approverUser = users?.find(u => Number(u.id) === Number(effectiveApproverId));
                            const approverDisplay = approverUser ? (approverUser.name ? `${approverUser.name} (${approverUser.username})` : approverUser.username) : '-';
                            const canApproveThisItem = currentUserId && (
                                Number(effectiveApproverId) === Number(currentUserId) || isPMOrAdmin
                            );

                            return React.createElement("tr", { key: doc.id },
                                React.createElement("td", null, isFa ? toPersianDigits(index + 1) : index + 1),
                                React.createElement("td", { style: { fontWeight: 600 } }, doc.name),
                                React.createElement("td", { style: { maxWidth: '200px' } }, doc.description),
                                React.createElement("td", { style: { fontSize: '0.83rem', lineHeight: '1.4' } },
                                    doc.aiSummary ? React.createElement("div", { className: "doc-ai-summary-card" },
                                        React.createElement("div", { className: "doc-ai-summary-text" }, doc.aiSummary),
                                        doc.aiRelevance && React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' } },
                                            React.createElement("span", {
                                                className: `doc-relevance-badge ${doc.aiRelevance.includes('کاملاً') || doc.aiRelevance.includes('High') ? 'doc-relevance-high' : (doc.aiRelevance.includes('نامرتبط') || doc.aiRelevance.includes('Low') ? 'doc-relevance-low' : 'doc-relevance-medium')}`
                                            }, doc.aiRelevance)
                                        ),
                                        doc.aiRelevanceReason && React.createElement("div", { className: "doc-relevance-reason" },
                                            `📌 ${doc.aiRelevanceReason}`
                                        )
                                    ) : React.createElement("button", {
                                        onClick: () => handleSummarizeDoc(doc),
                                        disabled: isSummarizing,
                                        style: {
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            padding: '0.3rem 0.6rem',
                                            fontSize: '0.78rem',
                                            borderRadius: '6px',
                                            border: '1px solid #c7d2fe',
                                            backgroundColor: '#f5f3ff',
                                            color: '#4f46e5',
                                            cursor: isSummarizing ? 'wait' : 'pointer'
                                        }
                                    },
                                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.95rem' } }, isSummarizing ? 'sync' : 'auto_awesome'),
                                        React.createElement("span", null, isSummarizing ? (isFa ? 'در حال خلاصه‌سازی...' : 'Summarizing...') : (isFa ? 'تولید خلاصه و تحلیل با AI' : 'Summarize with AI'))
                                    )
                                ),
                                React.createElement("td", null, t(docTypeTranslations[doc.type])),
                                React.createElement("td", null, formatDate(doc.date || getISODateString(), language)),
                                React.createElement("td", null, users?.find(u => Number(u.id) === Number(doc.submittedBy))?.username || '-'),
                                React.createElement("td", null, approverDisplay),
                                !hideApprovalStatus && React.createElement("td", { style: { textAlign: 'center' } },
                                    isPending && React.createElement("span", { className: "badge badge-yellow", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 500, whiteSpace: 'nowrap' } }, isFa ? 'در انتظار تایید' : 'Pending Approval'),
                                    isRejected && React.createElement("span", { className: "badge badge-red", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 500, whiteSpace: 'nowrap' } }, isFa ? 'عدم تایید' : 'Rejected'),
                                    (!isPending && !isRejected) && React.createElement("span", { className: "badge badge-green", style: { display: 'inline-block', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 500, whiteSpace: 'nowrap' } }, isFa ? 'تایید شده' : 'Approved')
                                ),
                                React.createElement("td", { className: "action-cell" },
                                    React.createElement("button", {
                                        onClick: () => setHistoryModalInfo({
                                            title: doc.name,
                                            typeLabel: isFa ? 'مستندات' : 'Document',
                                            history: doc.approvalHistory,
                                            submittedBy: doc.submittedBy,
                                            isApproved: doc.isApproved,
                                            isRejected: (doc as any).isRejected
                                        }),
                                        className: "action-icon history",
                                        title: t('history')
                                    }, React.createElement("span", { className: "material-symbols-outlined" }, "history")),
                                    !isReadOnly && isPending && canApproveThisItem && onApprove && onReject && React.createElement(Fragment, null,
                                        React.createElement("button", { onClick: () => setCommentModalState({ id: doc.id, status: 'Approved', title: doc.name }), className: "action-icon edit", style: { color: 'green' }, title: isFa ? 'تایید' : 'Approve' }, React.createElement("span", { className: "material-symbols-outlined" }, "check")),
                                        React.createElement("button", { onClick: () => setCommentModalState({ id: doc.id, status: 'Rejected', title: doc.name }), className: "action-icon delete", style: { color: 'red' }, title: isFa ? 'عدم تایید' : 'Reject' }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                                    ),
                                    !isReadOnly && ( (!requiresWorkflow) || doc.isApproved || (currentUserId && doc.submittedBy === currentUserId) || isPMOrAdmin ) && React.createElement(Fragment, null,
                                        React.createElement("button", { onClick: () => onEdit(doc), className: "action-icon edit", "aria-label": t('edit') }, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),
                                        React.createElement("button", { onClick: () => onDelete(doc.id), className: "action-icon delete", "aria-label": t('delete') }, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                                    )
                                )
                            );
                        })
                        : React.createElement("tr", null, React.createElement("td", { colSpan: 9 + (hideApprovalStatus ? 0 : 1), style: { textAlign: 'center' } }, t('noDocuments')))
                )
            )
        )
    );
};

export const ProjectScheduleTab = ({ project, users, calendars, onUpdateSchedule, isReadOnly = false, currentUser, dynamicWorkflowSettings }: { 
    project: Project, 
    users: User[], 
    calendars: any[], 
    onUpdateSchedule: (schedule: ProjectActivity[]) => void,
    isReadOnly?: boolean,
    currentUser?: User | null,
    dynamicWorkflowSettings?: DynamicWorkflowSettings
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [localSchedule, setLocalSchedule] = useState<ProjectActivity[]>(project.schedule || []);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({ "project-root": true });
    const [selectedWbsLevel, setSelectedWbsLevel] = useState<number>(1);
    const [ganttModalOpen, setGanttModalOpen] = useState(false);
    const [wbsModalOpen, setWbsModalOpen] = useState(false);
    const [progressChartModalOpen, setProgressChartModalOpen] = useState(false);
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [msProjectModalOpen, setMsProjectModalOpen] = useState(false);
    const [msProjectExportModalOpen, setMsProjectExportModalOpen] = useState(false);
    const [detailsModalActivity, setDetailsModalActivity] = useState<ProjectActivity | null>(null);
    const lastWeightingType = useRef(project.weightingType);

    const teamMembers = useMemo(() => {
        const ids = project?.teamMemberIds || [];
        const assignableUsers = users.filter(u => ids.includes(u.id));
        return assignableUsers;
    }, [users, project?.teamMemberIds]);
    
    const projectCalendar = useMemo(() => {
        return pickCalendar(calendars, project.calendarId)!;
    }, [calendars, project.calendarId]);
    
    const processedSchedule = useMemo(() => {
        const projectWithLocalSchedule = { ...project, schedule: localSchedule };
        const { rootNode } = calculateScheduleTreeAndProgress(projectWithLocalSchedule, projectCalendar, project.weightingType, project.plannedProgressType);
        return rootNode ? [rootNode] : [];
    }, [localSchedule, project, projectCalendar]);

    const maxScheduleLevel = useMemo(() => {
        let maxLvl = 1;
        const findMax = (nodes: ProjectActivity[] | undefined, lvl: number) => {
            if (!nodes || nodes.length === 0) return;
            nodes.forEach(n => {
                if (n.id !== 'project-root') {
                    if (lvl > maxLvl) maxLvl = lvl;
                    if (n.children && n.children.length > 0) {
                        findMax(n.children, lvl + 1);
                    }
                } else {
                    if (n.children && n.children.length > 0) {
                        findMax(n.children, 1);
                    }
                }
            });
        };
        findMax(processedSchedule, 0);
        return Math.max(1, maxLvl);
    }, [processedSchedule]);

    const applyLevelCollapse = useCallback((targetLevel: number, rootNodeToUse?: ProjectActivity | null) => {
        const root = rootNodeToUse !== undefined ? rootNodeToUse : (processedSchedule[0] || null);
        if (!root) {
            setExpandedRows({ "project-root": true });
            return;
        }
        const newExpanded: Record<string, boolean> = { 'project-root': true };
        const traverse = (node: ProjectActivity, currentLevel: number) => {
            if (node.id !== 'project-root') {
                if (currentLevel < targetLevel) {
                    newExpanded[node.id] = true;
                } else {
                    newExpanded[node.id] = false;
                }
            }
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => traverse(child, (node.id === 'project-root') ? 1 : currentLevel + 1));
            }
        };
        traverse(root, 0);
        setExpandedRows(newExpanded);
    }, [processedSchedule]);

    const handleWbsLevelChange = (newLevel: number) => {
        setSelectedWbsLevel(newLevel);
        applyLevelCollapse(newLevel, processedSchedule[0]);
    };

    const prevScheduleRef = useRef(project.schedule);
    
    const updateScheduleAndLocal = useCallback((newSchedule: ProjectActivity[]) => {
        setLocalSchedule(newSchedule);
        onUpdateSchedule(newSchedule);
    }, [onUpdateSchedule]);

    useEffect(() => {
        if (project.schedule !== prevScheduleRef.current) {
            prevScheduleRef.current = project.schedule;
            setLocalSchedule(project.schedule || []);
        }
    }, [project.schedule]);

    useEffect(() => {
        if (project.weightingType === lastWeightingType.current) return;
        lastWeightingType.current = project.weightingType;

        const projectWithCurrentState = { ...project, schedule: localSchedule };
        const { rootNode } = calculateScheduleTreeAndProgress(projectWithCurrentState, projectCalendar, project.weightingType, project.plannedProgressType);

        if (!rootNode) return;

        const processedActivitiesMap = new Map<string, ProjectActivity>();
        const flatten = (nodes: ProjectActivity[] | undefined) => {
            if (!nodes) return;
            nodes.forEach(node => {
                if(node.id !== 'project-root') {
                    processedActivitiesMap.set(node.id, node);
                }
                if (node.children) flatten(node.children);
            });
        };
        flatten(rootNode.children);
        
        const newSchedule = localSchedule.map(activity => {
            const processed = processedActivitiesMap.get(activity.id);
            if (processed && typeof processed.weight === 'number') {
                return { ...activity, weight: processed.weight };
            }
            return activity;
        });

        if (JSON.stringify(newSchedule) !== JSON.stringify(localSchedule)) {
            updateScheduleAndLocal(newSchedule);
        }
    }, [project.weightingType, localSchedule, project, projectCalendar, project.plannedProgressType, updateScheduleAndLocal]);


    const handleUpdate = (id: string, field: keyof ProjectActivity, value: any) => {
        const newSchedule = localSchedule.map(act => act.id === id ? { ...act, [field]: value } : act);
        updateScheduleAndLocal(newSchedule);
    };

    const handleAddActivity = (parentId: string | null) => {
        const newActivity: ProjectActivity = {
            id: `task-${Date.now()}`,
            name: t('newActivity'),
            duration: 1,
            prerequisiteId: null,
            weight: 0,
            assignedToId: null,
            actualProgress: 0,
            parentId: parentId,
            cost: 0,
            manHour: 0,
            importance: 'Medium',
            complexity: 'Medium',
            lag: 0,
            prerequisiteType: 'FS',
            approver1Id: project.projectManagerId,
            approver2Id: null,
            approver3Id: null,
        };
        const newSchedule = [...localSchedule, newActivity];
        updateScheduleAndLocal(newSchedule);
        if (parentId) {
            setExpandedRows(prev => ({ ...prev, [parentId]: true }));
        }
    };

    const handleDeleteActivity = (id: string) => {
        if (!window.confirm(t('confirmActivityDelete'))) return;
        
        const idsToDelete = new Set<string>([id]);
        const queue = [id];
        
        while(queue.length > 0) {
            const currentId = queue.shift()!;
            localSchedule.forEach(act => {
                if(act.parentId === currentId) {
                    idsToDelete.add(act.id);
                    queue.push(act.id);
                }
            });
        }
        
        const newSchedule = localSchedule.filter(act => !idsToDelete.has(act.id));
        updateScheduleAndLocal(newSchedule);
    };
    
    const handleSaveActivityDetails = (updatedActivity: ProjectActivity) => {
        const newSchedule = localSchedule.map(act => (act.id === updatedActivity.id ? { ...act, ...updatedActivity } : act));
        updateScheduleAndLocal(newSchedule);
        setDetailsModalActivity(null);
    };
    
    const flatProcessedSchedule = useMemo(() => {
        const list: ProjectActivity[] = [];
        const dive = (nodes: ProjectActivity[]) => {
            nodes.forEach(node => {
                list.push(node);
                if (node.children) dive(node.children);
            });
        };
        dive(processedSchedule);
        return list;
    }, [processedSchedule]);
    
    const isAdmin = currentUser?.role === 'Admin';
    const isPM = !!(currentUser && (Number(project.projectManagerId) === Number(currentUser.id) || Number(project.ownerId || 1) === Number(currentUser.id)));
    const isScheduleWorkflowActive = project.tabWorkflows?.schedule !== false;

    // Admin can edit actualProgress if workflow active or inactive. PM can edit ONLY if workflow is inactive. Team members cannot edit.
    const canEditActualProgress = !isReadOnly && (
        isScheduleWorkflowActive ? isAdmin : (isAdmin || isPM)
    );
    
    const activityForModal = useMemo(() => {
        if (!detailsModalActivity) return null;
        return flatProcessedSchedule.find(a => a.id === detailsModalActivity.id);
    }, [detailsModalActivity, flatProcessedSchedule]);


    const toggleRow = (id: string) => setExpandedRows(prev => ({...prev, [id]: !prev[id]}));
    
    const renderTaskRows = (tasks: ProjectActivity[], level: number): ReactElement[] => {
        return tasks.flatMap(task => {
            const isExpanded = !!expandedRows[task.id];
            
            const rows: ReactElement[] = [React.createElement("tr", { key: task.id, className: `task-row ${task.isParent ? 'parent-task summary-row' : 'child-task'}` },
                React.createElement("td", { style: { paddingInlineStart: `${level * 20 + 10}px` } },
                    React.createElement("div", { className: "task-name-cell" },
                        task.isParent && React.createElement("button", { className: "expand-collapse-icon", onClick: () => toggleRow(task.id) },
                            React.createElement("span", { className: "material-symbols-outlined" }, isExpanded ? 'expand_more' : (language === 'fa' ? 'chevron_left' : 'chevron_right'))
                        ),
                        task.id === 'project-root' ? React.createElement("strong", null, task.name) : React.createElement("input", { type: "text", value: task.name, onChange: (e: ChangeEvent<HTMLInputElement>) => handleUpdate(task.id, 'name', e.target.value), disabled: isReadOnly })
                    )
                ),
                React.createElement("td", null,
                    task.id !== 'project-root' && !task.isParent && !isReadOnly ? 
                       React.createElement("input", { 
                           type: language === 'fa' ? "text" : "number", 
                           min: 1, 
                           value: language === 'fa' ? toPersianDigits(task.duration || '') : (task.duration || ''), 
                           onChange: (e: ChangeEvent<HTMLInputElement>) => {
                               const val = e.target.value;
                               const engVal = val.replace(/[۰-۹]/g, d => String(['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'].indexOf(d)));
                               const parsed = parseInt(engVal.replace(/[^0-9]/g, '')) || 0;
                               handleUpdate(task.id, 'duration', Math.max(1, parsed));
                           }, 
                           className: "short-input",
                           disabled: isReadOnly
                       }) 
                       : (language === 'fa' ? toPersianDigits(task.duration || 0) : (task.duration || 0))
                ),
                React.createElement("td", null, task.startDate ? formatDate(task.startDate, language) : ''),
                React.createElement("td", null, task.endDate ? formatDate(task.endDate, language) : ''),
                React.createElement("td", null,
                    task.id !== 'project-root' && !task.isParent && project.weightingType === 'manual' && !isReadOnly ?
                        React.createElement("input", { 
                            type: language === 'fa' ? "text" : "number", 
                            min: 0, 
                            max: 100, 
                            value: language === 'fa' ? toPersianDigits(task.weight ?? '') : (task.weight ?? ''), 
                            onChange: (e: ChangeEvent<HTMLInputElement>) => {
                                const val = e.target.value;
                                const engVal = val.replace(/[۰-۹]/g, d => String(['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'].indexOf(d)));
                                const parsed = parseInt(engVal.replace(/[^0-9]/g, '')) || 0;
                                handleUpdate(task.id, 'weight', Math.min(100, Math.max(0, parsed)));
                            }, 
                            className: "weight-input",
                            style: { width: '50px', textAlign: 'center' },
                            disabled: isReadOnly
                        })
                        : (language === 'fa' ? toPersianDigits(Math.round(task.weight || 0)) : Math.round(task.weight || 0))
                ),
                React.createElement("td", null,
                    task.id !== 'project-root' && !task.isParent && !isReadOnly ? React.createElement("select", { value: task.assignedToId || '', onChange: (e: ChangeEvent<HTMLSelectElement>) => handleUpdate(task.id, 'assignedToId', parseInt(e.target.value) || null), disabled: isReadOnly },
                        React.createElement("option", { value: "" }, "-"),
                        teamMembers.map(m => React.createElement("option", { key: m.id, value: m.id }, m.username))
                    ) : (teamMembers.find(m => m.id === task.assignedToId)?.username || '-')
                ),
                React.createElement("td", null, (() => {
                    if (task.id === 'project-root') return '';
                    const stages = dynamicWorkflowSettings?.activity_progress || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS.activity_progress;
                    const stage = stages[0];
                    const effectiveApproverId = task.approver1Id ?? (stage && project ? resolveWorkflowApproverId(stage.approverId, project) : project?.projectManagerId);
                    const approverUser = users?.find(u => Number(u.id) === Number(effectiveApproverId));
                    return approverUser ? (approverUser.name ? `${approverUser.name} (${approverUser.username})` : approverUser.username) : '-';
                })()),
                React.createElement("td", null,
                    task.id === 'project-root' ? 
                        React.createElement(ProgressBar, { value: task.plannedProgress || 0, type: 'planned' }) :
                        `${language === 'fa' ? toPersianDigits(Math.round(task.plannedProgress || 0)) : Math.round(task.plannedProgress || 0)}%`
                ),
                React.createElement("td", null,
                    task.id === 'project-root' ?
                        React.createElement(ProgressBar, { value: task.actualProgress || 0, type: 'actual' }) :
                    (canEditActualProgress && !task.isParent) ?
                        React.createElement("input", { 
                            type: language === 'fa' ? "text" : "number", 
                            min: 0, 
                            max: 100, 
                            value: language === 'fa' ? toPersianDigits(task.actualProgress ?? '') : (task.actualProgress ?? ''), 
                            onChange: (e: ChangeEvent<HTMLInputElement>) => {
                                const val = e.target.value;
                                const engVal = val.replace(/[۰-۹]/g, d => String(['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'].indexOf(d)));
                                const parsed = parseInt(engVal.replace(/[^0-9]/g, '')) || 0;
                                handleUpdate(task.id, 'actualProgress', Math.min(100, Math.max(0, parsed)));
                            }, 
                            className: "short-input",
                            style: { width: '60px', textAlign: 'center' },
                            disabled: isReadOnly
                        }) :
                        `${language === 'fa' ? toPersianDigits(Math.round(task.actualProgress || 0)) : Math.round(task.actualProgress || 0)}%`
                ),
                React.createElement("td", { className: "action-cell" },
                     task.id !== 'project-root' && React.createElement(Fragment, null,
                        React.createElement("button", { onClick: () => setDetailsModalActivity(task), className: "action-icon", title: t('activityDetails') }, React.createElement("span", { className: "material-symbols-outlined" }, "info")),
                        !isReadOnly && React.createElement("button", { onClick: () => handleAddActivity(task.id), className: "action-icon add-sub-item-icon", title: t('addSubActivity') }, React.createElement("span", { className: "material-symbols-outlined" }, "add_task")),
                        !isReadOnly && React.createElement("button", { onClick: () => handleDeleteActivity(task.id), className: "action-icon delete", title: t('deleteActivity') }, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                     )
                )
            )];
            if(isExpanded && task.children) {
                rows.push(...renderTaskRows(task.children, level + 1));
            }
            return rows;
        });
    };
    
    return (
        React.createElement("div", null,
            activityForModal && React.createElement(ActivityDetailsModal, {
                activity: activityForModal,
                allActivities: flatProcessedSchedule,
                onSave: handleSaveActivityDetails,
                onClose: () => setDetailsModalActivity(null),
                users: users
            }),
            ganttModalOpen && processedSchedule[0] && React.createElement(GanttChartModal, { activities: processedSchedule, project: project, onClose: () => setGanttModalOpen(false) }),
            wbsModalOpen && processedSchedule[0] && React.createElement(WBSModal, { 
                root: processedSchedule[0], 
                onClose: () => setWbsModalOpen(false),
                onNodeClick: (activity) => {
                    setDetailsModalActivity(activity);
                    setWbsModalOpen(false);
                }
            }),
            progressChartModalOpen && processedSchedule[0] && React.createElement(ProgressChartModal, {
                activities: processedSchedule,
                project,
                calendar: projectCalendar,
                onClose: () => setProgressChartModalOpen(false)
            }),
            React.createElement(AiWbsModal, {
                project,
                projectType: 'waterfall',
                isOpen: aiModalOpen,
                onClose: () => setAiModalOpen(false),
                onApplyWaterfallSchedule: (newActivities, replace) => {
                    let updatedSchedule: ProjectActivity[] = [];
                    if (replace) {
                        updatedSchedule = newActivities;
                    } else {
                        const currentSchedule = project.schedule || [];
                        const maxId = currentSchedule.reduce((max, act) => Math.max(max, parseInt(act.id) || 0), 0);
                        const reindexed = newActivities.map((act, i) => ({
                            ...act,
                            id: String(maxId + i + 1)
                        }));
                        updatedSchedule = [...currentSchedule, ...reindexed];
                    }
                    updateScheduleAndLocal(updatedSchedule);
                }
            }),
            React.createElement(MsProjectImportModal, {
                project,
                isOpen: msProjectModalOpen,
                onClose: () => setMsProjectModalOpen(false),
                onApplySchedule: (newActivities, replace, parentIdsToExpand) => {
                    let updatedSchedule: ProjectActivity[] = [];
                    if (replace) {
                        updatedSchedule = newActivities;
                    } else {
                        const currentSchedule = project.schedule || [];
                        updatedSchedule = [...currentSchedule, ...newActivities];
                    }
                    updateScheduleAndLocal(updatedSchedule);
                    if (parentIdsToExpand && parentIdsToExpand.length > 0) {
                        const toExpandMap: Record<string, boolean> = { 'project-root': true };
                        parentIdsToExpand.forEach(id => {
                            toExpandMap[id] = true;
                        });
                        setExpandedRows(prev => ({ ...prev, ...toExpandMap }));
                    }
                }
            }),
            React.createElement(MsProjectExportModal, {
                project,
                scheduleActivities: processedSchedule,
                calendar: projectCalendar,
                users,
                isOpen: msProjectExportModalOpen,
                onClose: () => setMsProjectExportModalOpen(false)
            }),
            React.createElement("div", { className: "schedule-toolbar", style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' } },
                React.createElement("div", { className: "toolbar-actions-left", style: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' } },
                    !isReadOnly && React.createElement("button", { className: "action-button", onClick: () => handleAddActivity(null), title: t('createMainActivity'), style: { padding: '0.6rem' } }, 
                        React.createElement("span", { className: "material-symbols-outlined" }, "playlist_add")
                    ),
                    React.createElement("button", { className: "action-button", onClick: () => setGanttModalOpen(true), title: t('gantt'), style: { padding: '0.6rem' } }, 
                        React.createElement("span", { className: "material-symbols-outlined" }, "align_horizontal_left")
                    ),
                    React.createElement("button", { className: "action-button", onClick: () => setWbsModalOpen(true), title: t('wbs'), style: { padding: '0.6rem' } }, 
                        React.createElement("span", { className: "material-symbols-outlined" }, "toc")
                    ),
                    React.createElement("button", { className: "action-button", onClick: () => setProgressChartModalOpen(true), title: language === 'fa' ? 'نمودار پیشرفت برنامه‌ای (S-Curve)' : 'Planned Progress Chart (S-Curve)', style: { padding: '0.6rem' } }, 
                        React.createElement("span", { className: "material-symbols-outlined" }, "monitoring")
                    ),
                    !isReadOnly && React.createElement("button", { 
                        className: "action-button", 
                        onClick: () => setMsProjectModalOpen(true), 
                        title: language === 'fa' ? 'ایمپورت از Microsoft Project (فایل XML)' : 'Import from Microsoft Project (XML)', 
                        style: { padding: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' } 
                    }, 
                        React.createElement("span", { className: "material-symbols-outlined" }, "upload_file")
                    ),
                    React.createElement("button", { 
                        className: "action-button", 
                        onClick: () => setMsProjectExportModalOpen(true), 
                        title: language === 'fa' ? 'خروجی به Microsoft Project (فایل XML)' : 'Export to Microsoft Project (XML)', 
                        style: { padding: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' } 
                    }, 
                        React.createElement("span", { className: "material-symbols-outlined" }, "file_download")
                    ),
                    React.createElement("div", {
                        className: "wbs-level-combobox-container"
                    },
                        React.createElement("span", {
                            className: "material-symbols-outlined wbs-level-icon",
                            title: language === 'fa' ? 'سطح ساختار شکست کار (WBS)' : 'WBS Level'
                        }, "account_tree"),
                        React.createElement("span", {
                            className: "wbs-level-label"
                        }, language === 'fa' ? 'سطح نمایش:' : 'Level:'),
                        React.createElement("select", {
                            id: "wbs-level-select",
                            className: "wbs-level-select",
                            "aria-label": language === 'fa' ? 'انتخاب سطح ساختار شکست کار' : 'Select WBS Level',
                            value: selectedWbsLevel,
                            onChange: (e: ChangeEvent<HTMLSelectElement>) => {
                                const lvl = parseInt(e.target.value, 10) || 1;
                                handleWbsLevelChange(lvl);
                            }
                        },
                            Array.from({ length: maxScheduleLevel }, (_, i) => i + 1).map(lvl => 
                                React.createElement("option", { key: lvl, value: lvl }, 
                                    language === 'fa' ? `سطح ${toPersianDigits(lvl)}` : `Level ${lvl}`
                                )
                            )
                        )
                    )
                ),
                !isReadOnly && React.createElement("div", { className: "toolbar-actions-right", style: { marginInlineStart: 'auto' } },
                    React.createElement("button", { className: "action-button primary", onClick: () => setAiModalOpen(true), title: language === 'fa' ? 'تولید WBS با هوش مصنوعی' : 'AI WBS Assistant', "aria-label": language === 'fa' ? 'تولید WBS با هوش مصنوعی' : 'AI WBS Assistant', style: { padding: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } }, 
                        React.createElement("span", { className: "material-symbols-outlined" }, "auto_awesome")
                    )
                )
            ),
            React.createElement("div", { className: "schedule-table-container" },
                React.createElement("table", { className: "schedule-table" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", { className: "th-name" }, t('activityName')),
                            React.createElement("th", { className: "th-short" }, t('durationDays')),
                            React.createElement("th", { className: "th-date" }, t('startDate')),
                            React.createElement("th", { className: "th-date" }, t('endDate')),
                            React.createElement("th", { className: "th-weight" }, t('weight')),
                            React.createElement("th", { className: "th-assign" }, t('assignedTo')),
                            React.createElement("th", { className: "th-assign" }, language === 'fa' ? 'تایید‌کننده' : 'Approver'),
                            React.createElement("th", { className: "th-progress" }, t('plannedPercent')),
                            React.createElement("th", { className: "th-progress" }, t('actualPercent')),
                            React.createElement("th", { className: "th-actions" }, t('actions'))
                        )
                    ),
                    React.createElement("tbody", null,
                        processedSchedule.length > 0 && renderTaskRows(processedSchedule, 0)
                    )
                )
            )
        )
    );
};

export const ProjectKanbanTab = ({ project, users, onUpdateTasks, progressUpdates, onAddKanbanStatusUpdate, isReadOnly = false, dynamicWorkflowSettings }: { 
    project: Project, 
    users: User[], 
    onUpdateTasks: (tasks: KanbanTask[]) => void,
    progressUpdates: ProgressUpdate[],
    onAddKanbanStatusUpdate?: (projectId: number, taskId: number, newStatus: KanbanStatus, comment: string) => void,
    isReadOnly?: boolean,
    dynamicWorkflowSettings?: DynamicWorkflowSettings
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [agileChartModalOpen, setAgileChartModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Partial<KanbanTask> | null>(null);
    const [historyModalInfo, setHistoryModalInfo] = useState<{ taskId: number; projectId: number } | null>(null);


    const teamMembers = useMemo(() => {
        const ids = project?.teamMemberIds || [];
        const projectManagerId = project?.projectManagerId;
        const assignableUsers = users.filter(u => 
            ids.includes(u.id) || 
            u.id === projectManagerId ||
            u.role === 'Admin'
        );
        return Array.from(new Map(assignableUsers.map(item => [item['id'], item])).values());
    }, [users, project.teamMemberIds, project.projectManagerId]);

    const handleAddTask = (status: KanbanStatus) => {
        if (isReadOnly) return;
        setEditingTask({ status: status, priority: 'Medium', sprintNumber: 1, approver1Id: project.projectManagerId, approver2Id: null, approver3Id: null });
        setIsModalOpen(true);
    };

    const handleEditTask = (task: KanbanTask) => {
        setEditingTask(task);
        setIsModalOpen(true);
    };

    const handleDeleteTask = (taskId: number) => {
        if(window.confirm(t('confirmTaskDelete'))) {
            const updatedTasks = (project.kanbanTasks || []).filter(t => t.id !== taskId);
            onUpdateTasks(updatedTasks);
        }
    };
    
    const handleSaveTask = (taskData: KanbanTask) => {
        let updatedTasks;
        if(taskData.id) { 
            updatedTasks = (project.kanbanTasks || []).map(t => t.id === taskData.id ? taskData : t);
        } else {
            updatedTasks = [...(project.kanbanTasks || []), {...taskData, id: Date.now() }];
        }
        onUpdateTasks(updatedTasks);
        setIsModalOpen(false);
        setEditingTask(null);
    };

    const handleSendForApproval = (taskId: number) => {
        if (onAddKanbanStatusUpdate) {
            onAddKanbanStatusUpdate(project.id, taskId, 'Doing', t('sendForApproval'));
        }
    };

    const columns: KanbanStatus[] = ['To-Do', 'Doing', 'Done'];
    const columnTranslations: Record<KanbanStatus, TranslationKey> = {
        'To-Do': 'toDo',
        'Doing': 'doing',
        'Done': 'done'
    };
    const tasks = project.kanbanTasks || [];

    return (
        React.createElement("div", null,
            React.createElement(KanbanTaskModal, {
                isOpen: isModalOpen,
                onClose: () => setIsModalOpen(false),
                onSave: handleSaveTask,
                task: editingTask,
                teamMembers: teamMembers,
                sprintCount: project.sprintCount || 1
            }),
             historyModalInfo && React.createElement(KanbanHistoryModal, {
                taskId: historyModalInfo.taskId,
                projectId: historyModalInfo.projectId,
                users: users,
                progressUpdates: progressUpdates,
                onClose: () => setHistoryModalInfo(null),
                projects: [project]
            }),
            React.createElement(AiWbsModal, {
                project,
                projectType: 'agile',
                isOpen: aiModalOpen,
                onClose: () => setAiModalOpen(false),
                onApplyAgileTasks: (newTasks, replace) => {
                    let updatedTasks: KanbanTask[] = [];
                    if (replace) {
                        updatedTasks = newTasks;
                    } else {
                        const currentTasks = project.kanbanTasks || [];
                        updatedTasks = [...currentTasks, ...newTasks];
                    }
                    onUpdateTasks(updatedTasks);
                }
            }),
            agileChartModalOpen && React.createElement(AgileProgressChartModal, {
                project,
                users,
                progressUpdates,
                onClose: () => setAgileChartModalOpen(false)
            }),
            React.createElement("div", { className: "kanban-toolbar", style: { marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '0.75rem' } },
                !isReadOnly ? React.createElement("button", { 
                    className: "action-button primary", 
                    onClick: () => setAiModalOpen(true), 
                    title: language === 'fa' ? 'تولید فعالیت‌های چابک با هوش مصنوعی' : 'AI Agile Tasks',
                    style: { padding: '0.5rem 0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' } 
                }, 
                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem' } }, "auto_awesome")
                ) : React.createElement("div", null),
                React.createElement("button", { 
                    className: "action-button secondary", 
                    onClick: () => setAgileChartModalOpen(true), 
                    title: language === 'fa' ? 'نمودار پیشرفت اسپرینت‌ها (Burn-Up / Burn-Down)' : 'Sprint Progress Chart (Burn-Up / Burn-Down)', 
                    style: { padding: '0.5rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 } 
                }, 
                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem' } }, "monitoring")
                )
            ),
            React.createElement("div", { className: "kanban-board", style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', alignItems: 'start' } },
                columns.map(columnStatus => (
                    React.createElement("div", { key: columnStatus, className: "kanban-column" },
                        React.createElement("div", { className: "kanban-column-header" },
                            React.createElement("h3", { className: "kanban-column-title" }, t(columnTranslations[columnStatus])),
                             !isReadOnly && columnStatus === 'To-Do' && (
                                React.createElement("button", { onClick: () => handleAddTask(columnStatus), className: "add-task-btn", "aria-label": t('addTaskTo', { status: t(columnTranslations[columnStatus]) }) },
                                    React.createElement("span", { className: "material-symbols-outlined" }, "add")
                                )
                            )
                        ),
                        React.createElement("div", { className: "kanban-cards" },
                            tasks.filter(t => t.status === columnStatus).map(task => {
                                const isPending = progressUpdates.some(up => up.taskId === task.id && up.status === 'Pending Approval');
                                return React.createElement("div", { key: task.id, className: `kanban-card priority-${task.priority.toLowerCase()}` },
                                    React.createElement("div", { className: "kanban-card-header" },
                                        React.createElement("p", { className: "kanban-card-desc" }, task.description),
                                        !isReadOnly && React.createElement("div", { className: "kanban-card-actions" },
                                            React.createElement("button", { onClick: () => setHistoryModalInfo({ taskId: task.id, projectId: project.id }), className: "action-icon history", title: t('history') }, 
                                                React.createElement("span", { className: "material-symbols-outlined" }, "history")
                                            ),
                                            React.createElement("button", { onClick: () => handleEditTask(task), className: "action-icon edit", title: isPending ? t('updateAlreadyPending') : t('edit'), disabled: isPending || isReadOnly }, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),
                                            React.createElement("button", { onClick: () => handleDeleteTask(task.id), className: "action-icon delete", title: isPending ? t('updateAlreadyPending') : t('delete'), disabled: isPending || isReadOnly }, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                                        )
                                    ),
                                    React.createElement("div", { className: "kanban-card-footer" },
                                        React.createElement("div", { className: "kanban-card-detail", title: t('dueDate') },
                                            React.createElement("span", { className: "material-symbols-outlined" }, "event"),
                                            React.createElement("span", null, formatDate(task.dueDate, language) || 'N/A')
                                        ),
                                        React.createElement("div", { className: "kanban-card-detail", title: t('assignedTo') },
                                            React.createElement("span", { className: "material-symbols-outlined" }, "person"),
                                            React.createElement("span", null, users.find(u => u.id === task.assignedToId)?.username || 'N/A')
                                        ),
                                        React.createElement("div", { className: "kanban-card-detail", title: language === 'fa' ? 'تایید‌کننده' : 'Approver' },
                                            React.createElement("span", { className: "material-symbols-outlined" }, "verified_user"),
                                            React.createElement("span", null, (() => {
                                                const stages = dynamicWorkflowSettings?.activity_progress || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS.activity_progress;
                                                const stage = stages[0];
                                                const effectiveApproverId = task.approver1Id ?? (stage && project ? resolveWorkflowApproverId(stage.approverId, project) : project?.projectManagerId);
                                                const approverUser = users.find(u => Number(u.id) === Number(effectiveApproverId));
                                                return approverUser?.username || 'N/A';
                                            })())
                                        )
                                    ),
                                     isPending && (
                                        React.createElement("div", { className: "kanban-card-pending-tag" },
                                            React.createElement("span", { className: "status-badge status-pending" }, t('pendingApproval'))
                                        )
                                    )
                                )
                            }),
                             tasks.filter(t => t.status === columnStatus).length === 0 && (
                                React.createElement("div", { className: "kanban-card-placeholder" }, t('noTasksHere'))
                            )
                        )
                    )
                ))
            )
        )
    );
};

export const ProjectSprintsTab = ({ project, users }: { 
    project: Project, 
    users: User[]
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);

    const sprints = useMemo(() => {
        const sprintMap: Record<number, KanbanTask[]> = {};
        const backlog: KanbanTask[] = [];

        (project.kanbanTasks || []).forEach(task => {
            const sprintNum = task.sprintNumber;
            if (sprintNum && sprintNum > 0) {
                if (!sprintMap[sprintNum]) {
                    sprintMap[sprintNum] = [];
                }
                sprintMap[sprintNum].push(task);
            } else {
                backlog.push(task);
            }
        });

        const sortedSprints = Object.entries(sprintMap).sort(([a], [b]) => Number(a) - Number(b));
        if (backlog.length > 0) {
            sortedSprints.unshift(["0", backlog]); // 0 represents the backlog
        }

        return sortedSprints;
    }, [project.kanbanTasks]);

    const taskPriorityTranslations: Record<TaskPriority, TranslationKey> = { 'Low': 'low', 'Medium': 'medium', 'High': 'high' };
    const kanbanStatusTranslations: Record<KanbanStatus, TranslationKey> = { 'To-Do': 'toDo', 'Doing': 'doing', 'Done': 'done' };

    return React.createElement("div", { className: "sprints-container" },
        sprints.length > 0 ? sprints.map(([sprintNum, tasks]) => (
            React.createElement("div", { key: sprintNum, className: "sprint-group" },
                React.createElement("h4", null, Number(sprintNum) > 0 ? `${t('sprintNumber')} ${sprintNum}` : t('unassigned')),
                React.createElement("div", { className: "table-responsive" },
                    React.createElement("table", { className: "tab-table" },
                        React.createElement("thead", null, React.createElement("tr", null,
                            React.createElement("th", null, t('kanbanDesc')),
                            React.createElement("th", null, t('assignedTo')),
                            React.createElement("th", null, t('importance')),
                            React.createElement("th", null, t('status')),
                            React.createElement("th", null, t('dueDate'))
                        )),
                        React.createElement("tbody", null,
                            tasks.map(task => {
                                const assignee = users.find(u => u.id === task.assignedToId);
                                return React.createElement("tr", { key: task.id },
                                    React.createElement("td", null, task.description),
                                    React.createElement("td", null, assignee?.username || t('unassigned')),
                                    React.createElement("td", null, t(taskPriorityTranslations[task.priority])),
                                    React.createElement("td", null, t(kanbanStatusTranslations[task.status])),
                                    React.createElement("td", null, formatDate(task.dueDate, language))
                                );
                            })
                        )
                    )
                )
            )
        )) : React.createElement("p", null, t('noTasksHere'))
    );
};

const _DeprecatedProjectSettingsTab = ({ 
    project,
    onSaveSettings,
    scheduleSnapshots, 
    onSaveSnapshot, 
    onDeleteSnapshot, 
    onViewSnapshot,
    currentUser,
    users = [],
    dynamicWorkflowSettings,
    isReadOnly = false
}: {
    project: Project,
    onSaveSettings: (settings: Partial<Project>) => void,
    scheduleSnapshots: ScheduleSnapshot[],
    onSaveSnapshot: (name: string, type: 'Baseline' | 'Progress Information') => void,
    onDeleteSnapshot: (id: number) => void,
    onViewSnapshot: (snapshot: ScheduleSnapshot) => void,
    currentUser?: User | null,
    users?: User[],
    dynamicWorkflowSettings?: DynamicWorkflowSettings,
    isReadOnly?: boolean
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';
    const isFa = language === 'fa';
    const [snapshotName, setSnapshotName] = useState('');
    const [snapshotType, setSnapshotType] = useState<'Baseline' | 'Progress Information'>('Baseline');
    const [localWeightingType, setLocalWeightingType] = useState(project.weightingType || 'manual');
    const [localPlannedProgressType, setLocalPlannedProgressType] = useState(project.plannedProgressType || 'continuous');
    const [timeWeightFactor, setTimeWeightFactor] = useState(project.timeWeightFactor || 34);
    const [costWeightFactor, setCostWeightFactor] = useState(project.costWeightFactor || 33);
    const [complexityWeightFactor, setComplexityWeightFactor] = useState(project.complexityWeightFactor || 33);
    const [localEnabledTabs, setLocalEnabledTabs] = useState<string[]>(project.enabledTabs ?? ['charter', 'schedule', 'team', 'risks', 'status', 'delays', 'docs', 'actions']);
    const defaultTabWorkflows = { charter: true, schedule: true, team: true, risks: true, stakeholders: true, status: true, delays: true, docs: true, actions: true };
    const [localTabWorkflows, setLocalTabWorkflows] = useState<Record<string, boolean>>(project.tabWorkflows ?? defaultTabWorkflows);
    const [localCustomWorkflowSettings, setLocalCustomWorkflowSettings] = useState<DynamicWorkflowSettings>(
        project.customWorkflowSettings || dynamicWorkflowSettings || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS
    );
    const [activeWorkflowEntity, setActiveWorkflowEntity] = useState<WorkflowEntityType>('charter');
    const [expandedTabId, setExpandedTabId] = useState<string | null>(null);

    const projectOwnerId = project.ownerId || 1;
    const isOwner = !!(currentUser && (Number(projectOwnerId) === Number(currentUser.id) || currentUser.role === 'Admin'));

    useEffect(() => {
        setLocalWeightingType(project.weightingType || 'manual');
        setLocalPlannedProgressType(project.plannedProgressType || 'continuous');
        setTimeWeightFactor(project.timeWeightFactor || 34);
        setCostWeightFactor(project.costWeightFactor || 33);
        setComplexityWeightFactor(project.complexityWeightFactor || 33);
        setLocalEnabledTabs(project.enabledTabs ?? ['charter', 'schedule', 'team', 'risks', 'stakeholders', 'status', 'delays', 'docs', 'actions']);
        setLocalTabWorkflows(project.tabWorkflows ?? defaultTabWorkflows);
        setLocalCustomWorkflowSettings(project.customWorkflowSettings || dynamicWorkflowSettings || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS);
    }, [project, dynamicWorkflowSettings]);
    
    const totalWeightFactor = timeWeightFactor + costWeightFactor + complexityWeightFactor;

    const tabDefinitions: { id: string; name: string; entityType?: WorkflowEntityType }[] = [
        { id: 'charter', name: t('projectCharter'), entityType: 'charter' },
        { id: 'schedule', name: t('projectSchedule'), entityType: 'activity_progress' },
        { id: 'team', name: t('projectTeam') },
        { id: 'risks', name: t('projectRisks'), entityType: 'risks' },
        { id: 'stakeholders', name: language === 'fa' ? 'ذینفعان پروژه' : 'Project Stakeholders', entityType: 'stakeholders' },
        { id: 'status', name: t('projectStatus'), entityType: 'status_updates' },
        { id: 'delays', name: language === 'fa' ? 'دلایل تاخیر' : 'Reasons for Delay', entityType: 'delay_reasons' },
        { id: 'docs', name: t('projectDocuments'), entityType: 'documents' },
        { id: 'actions', name: t('relatedActions'), entityType: 'activity_progress' },
    ];

    const handleToggleTab = (tabId: string) => {
        if (localEnabledTabs.includes(tabId)) {
            setLocalEnabledTabs(localEnabledTabs.filter(id => id !== tabId));
        } else {
            setLocalEnabledTabs([...localEnabledTabs, tabId]);
        }
    };

    const handleToggleWorkflow = (tabId: string, directValue?: boolean) => {
        setLocalTabWorkflows(prev => ({
            ...prev,
            [tabId]: directValue !== undefined ? directValue : !prev[tabId]
        }));
    };

    const handleSave = () => {
        if (localWeightingType === 'combined' && totalWeightFactor !== 100) {
            alert(t('weightFactorsMustSum100'));
            return;
        }
        onSaveSettings({ 
            weightingType: localWeightingType, 
            plannedProgressType: localPlannedProgressType,
            timeWeightFactor,
            costWeightFactor,
            complexityWeightFactor,
            enabledTabs: localEnabledTabs,
            tabWorkflows: localTabWorkflows,
            customWorkflowSettings: localCustomWorkflowSettings,
        });
    };

    const handleSaveSnapshotClick = () => {
        onSaveSnapshot(snapshotName, snapshotType);
        setSnapshotName('');
    };

    const pmUser = users.find(u => Number(u.id) === Number(project.projectManagerId));
    const ownerUser = users.find(u => Number(u.id) === Number(project.ownerId));

    return React.createElement("div", { className: "project-settings-tab" },
        React.createElement("div", { className: "form-section" },
            React.createElement("h4", null, t('projectSettings')),
            React.createElement("div", { className: "settings-form" },
                React.createElement("div", { className: "settings-grid-2col" },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "weightingType" }, t('weightingType')),
                        React.createElement("select", { id: "weightingType", value: localWeightingType, onChange: (e: ChangeEvent<HTMLSelectElement>) => setLocalWeightingType(e.target.value as any) },
                            React.createElement("option", { value: "manual" }, t('manual')),
                            React.createElement("option", { value: "time-based" }, t('timeBased')),
                            React.createElement("option", { value: "cost-based" }, t('costBased')),
                            React.createElement("option", { value: "complexity-based" }, t('complexityBased')),
                            React.createElement("option", { value: "combined" }, t('combined'))
                        )
                    ),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "plannedProgressCalculation" }, t('plannedProgressCalculation')),
                        React.createElement("select", { id: "plannedProgressCalculation", value: localPlannedProgressType, onChange: (e: ChangeEvent<HTMLSelectElement>) => setLocalPlannedProgressType(e.target.value as any) },
                            React.createElement("option", { value: "continuous" }, t('continuousTime')),
                            React.createElement("option", { value: "zero-hundred" }, t('zeroHundred'))
                        )
                    )
                ),
                localWeightingType === 'combined' && React.createElement("div", { className: "combined-weight-factors" },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "timeWeightFactor" }, t('timeWeightFactor')),
                        React.createElement("input", { type: "number", id: "timeWeightFactor", value: timeWeightFactor, onChange: (e) => setTimeWeightFactor(Number(e.target.value)), min: "0", max: "100" })
                    ),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "costWeightFactor" }, t('costWeightFactor')),
                        React.createElement("input", { type: "number", id: "costWeightFactor", value: costWeightFactor, onChange: (e) => setCostWeightFactor(Number(e.target.value)), min: "0", max: "100" })
                    ),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "complexityWeightFactor" }, t('complexityWeightFactor')),
                        React.createElement("input", { type: "number", id: "complexityWeightFactor", value: complexityWeightFactor, onChange: (e) => setComplexityWeightFactor(Number(e.target.value)), min: "0", max: "100" })
                    ),
                    React.createElement("div", { className: `combined-weight-factors-total ${totalWeightFactor !== 100 ? 'error' : ''}` }, `${t('totalWeight')}: ${language === 'fa' ? toPersianDigits(totalWeightFactor) : totalWeightFactor}%`)
                )
            ),
            isOwner && React.createElement(Fragment, null,
                React.createElement("div", { className: "form-section-separator", style: { margin: '2rem 0 1.5rem 0', borderTop: '1px solid var(--border-color, #e2e8f0)' } }),
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' } },
                    React.createElement("h4", { style: { margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' } }, 
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: isDark ? '#a5b4fc' : '#4f46e5' } }, "account_tree"),
                        isFa ? 'دسترسی‌ها و گردش کار صفحات پروژه' : 'Project Pages Access & Workflows'
                    ),
                    React.createElement("span", { style: { fontSize: '0.8rem', color: isDark ? '#9ca3af' : '#6b7280' } },
                        isFa ? 'تیک = گردش کار عمومی | بدون تیک = گردش کار منحصربفرد پروژه' : 'Checked = Global Workflow | Unchecked = Project Unique Workflow'
                    )
                ),
                React.createElement("div", { 
                    style: { 
                        backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#f0fdf4', 
                        border: isDark ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid #bbf7d0', 
                        borderRadius: '8px', 
                        padding: '0.75rem 1rem', 
                        marginBottom: '1.25rem', 
                        fontSize: '0.85rem', 
                        color: isDark ? '#bbf7d0' : '#166534', 
                        lineHeight: 1.6 
                    } 
                },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '0.5rem' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem', color: isDark ? '#4ade80' : '#15803d', marginTop: '2px' } }, "info"),
                        React.createElement("div", null,
                            React.createElement("strong", { style: { color: isDark ? '#ecfdf5' : '#14532d' } }, isFa ? 'راهنمای گردش کار صفحات:' : 'Workflow Guide:'),
                            ' ',
                            isFa 
                                ? 'در صورتی که ستون «نیاز به گردش کار» تیک داشته باشد، تاییدیه بر اساس گردش کار استاندارد و عمومی کل سیستم انجام می‌گیرد. اگر تیک برداشته شود، این صفحه گردش کار منحصربفرد این پروژه را خواهد داشت و می‌توانید مراحل، عناوین و تاییدکنندگان اختصاصی را در بخش زیر تعریف فرمایید.'
                                : 'When checked, the global workflow is used. When unchecked, a unique project workflow is activated allowing per-page stage and approver customization below.'
                        )
                    )
                ),
                React.createElement("div", { className: "table-responsive", style: { marginBottom: '1.5rem' } },
                    React.createElement("table", { className: "users-table" },
                        React.createElement("thead", null, React.createElement("tr", null,
                            React.createElement("th", null, isFa ? 'صفحه / تب پروژه' : 'Page / Tab'),
                            React.createElement("th", { style: { textAlign: 'center' } }, isFa ? 'نمایش تب (فعال)' : 'Show Tab (Active)'),
                            React.createElement("th", { style: { textAlign: 'center' } }, isFa ? 'نیاز به گردش کار (تیک = عمومی)' : 'Requires Workflow (Checked = Global)'),
                            React.createElement("th", { style: { textAlign: 'center' } }, isFa ? 'وضعیت گردش کار فعال' : 'Active Workflow Status'),
                            React.createElement("th", { style: { textAlign: 'center' } }, isFa ? 'تنظیم مراحل و دسترسی' : 'Configure Stages')
                        )),
                        React.createElement("tbody", null,
                            tabDefinitions.map(tab => {
                                const isTabEnabled = localEnabledTabs.includes(tab.id);
                                const isWorkflowGlobal = localTabWorkflows[tab.id] !== false;
                                const isCustom = !isWorkflowGlobal;
                                const entityKey = tab.entityType;
                                const customStages = entityKey ? (localCustomWorkflowSettings[entityKey] || []) : [];
                                const stageCount = customStages.length;
                                const isExpanded = expandedTabId === tab.id;

                                return React.createElement(Fragment, { key: tab.id },
                                    React.createElement("tr", { 
                                        style: { 
                                            backgroundColor: isExpanded 
                                                ? (isDark ? 'rgba(124, 58, 237, 0.18)' : '#faf5ff') 
                                                : (isCustom ? (isDark ? 'rgba(217, 119, 6, 0.12)' : '#fffbeb') : undefined),
                                            transition: 'background-color 0.2s ease'
                                        } 
                                    },
                                    React.createElement("td", { style: { fontWeight: 600 } }, 
                                        React.createElement("span", { style: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem' } },
                                            tab.name,
                                            isCustom && React.createElement("span", { 
                                                style: { 
                                                    backgroundColor: isDark ? 'rgba(217, 119, 6, 0.25)' : '#fef3c7', 
                                                    color: isDark ? '#fde68a' : '#b45309', 
                                                    fontSize: '0.7rem', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px',
                                                    border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a',
                                                    fontWeight: 600
                                                } 
                                            }, isFa ? '⭐ منحصربفرد' : '⭐ Custom')
                                        )
                                    ),
                                    React.createElement("td", { style: { textAlign: 'center' } }, 
                                        React.createElement("input", { 
                                            type: "checkbox", 
                                            checked: isTabEnabled,
                                            onChange: () => handleToggleTab(tab.id)
                                        })
                                    ),
                                    React.createElement("td", { style: { textAlign: 'center' } }, 
                                        React.createElement("input", { 
                                            type: "checkbox", 
                                            checked: isWorkflowGlobal,
                                            disabled: currentUser?.role !== 'Admin',
                                            title: currentUser?.role !== 'Admin' ? (isFa ? 'تنها ادمین سیستم می‌تواند گردش کار را تغییر دهد' : 'Only Admin can change tab workflow setting') : undefined,
                                            onChange: () => currentUser?.role === 'Admin' && handleToggleWorkflow(tab.id)
                                        })
                                    ),
                                    React.createElement("td", { style: { textAlign: 'center' } },
                                        isWorkflowGlobal ? (
                                            React.createElement("span", { 
                                                style: { 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    gap: '4px',
                                                    backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : '#e0e7ff', 
                                                    color: isDark ? '#c7d2fe' : '#3730a3', 
                                                    padding: '4px 10px', 
                                                    borderRadius: '9999px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    border: isDark ? '1px solid rgba(129, 140, 248, 0.4)' : '1px solid #c7d2fe'
                                                } 
                                            },
                                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.95rem', color: isDark ? '#a5b4fc' : '#4f46e5' } }, "public"),
                                                isFa ? 'گردش کار عمومی سیستم' : 'Global System Workflow'
                                            )
                                        ) : (
                                            React.createElement("span", { 
                                                style: { 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    gap: '4px',
                                                    backgroundColor: isDark ? 'rgba(217, 119, 6, 0.25)' : '#fef3c7', 
                                                    color: isDark ? '#fef08a' : '#b45309', 
                                                    padding: '4px 10px', 
                                                    borderRadius: '9999px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a'
                                                } 
                                            },
                                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.95rem', color: isDark ? '#fbbf24' : '#d97706' } }, "star"),
                                                isFa ? `منحصربفرد پروژه (${toPersianDigits(stageCount)} مرحله)` : `Unique Project (${stageCount} stages)`
                                            )
                                        )
                                    ),
                                    React.createElement("td", { style: { textAlign: 'center' } },
                                        entityKey ? (
                                            React.createElement("button", {
                                                type: "button",
                                                onClick: () => {
                                                    if (isExpanded) {
                                                        setExpandedTabId(null);
                                                    } else {
                                                        setExpandedTabId(tab.id);
                                                        setActiveWorkflowEntity(entityKey);
                                                        if (isWorkflowGlobal && currentUser?.role === 'Admin') {
                                                            handleToggleWorkflow(tab.id, false);
                                                        }
                                                    }
                                                },
                                                style: {
                                                    backgroundColor: isExpanded 
                                                        ? '#7c3aed' 
                                                        : (isCustom ? (isDark ? 'rgba(124, 58, 237, 0.25)' : '#f5f3ff') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc')),
                                                    color: isExpanded 
                                                        ? '#ffffff' 
                                                        : (isCustom ? (isDark ? '#ddd6fe' : '#6d28d9') : (isDark ? '#e2e8f0' : '#475569')),
                                                    border: isExpanded 
                                                        ? '1px solid #7c3aed' 
                                                        : (isCustom ? (isDark ? '1px solid #a78bfa' : '1px solid #c4b5fd') : (isDark ? '1px solid #475569' : '1px solid #cbd5e1')),
                                                    borderRadius: '6px',
                                                    padding: '0.35rem 0.75rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    transition: 'all 0.15s ease',
                                                    boxShadow: isExpanded ? '0 2px 4px rgba(124, 58, 237, 0.35)' : undefined
                                                }
                                            },
                                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.95rem' } }, 
                                                    isExpanded ? "expand_less" : "tune"
                                                ),
                                                isExpanded 
                                                    ? (isFa ? 'بستن کشو' : 'Close Drawer')
                                                    : (isFa ? 'تنظیم مراحل' : 'Configure')
                                            )
                                        ) : '-'
                                    )
                                ),
                                /* Single Entity Inline Collapsible Drawer below the row */
                                isExpanded && entityKey && React.createElement("tr", {
                                    key: `${tab.id}-drawer`,
                                    className: "workflow-drawer-row"
                                },
                                    React.createElement("td", { 
                                        colSpan: 5, 
                                        style: { 
                                            padding: '1.25rem', 
                                            backgroundColor: isDark ? 'rgba(124, 58, 237, 0.1)' : '#faf5ff', 
                                            borderBottom: '2px solid #a855f7',
                                            borderTop: isDark ? '1px dashed #7c3aed' : '1px dashed #d8b4fe',
                                            boxShadow: isDark ? 'inset 0 2px 6px rgba(0, 0, 0, 0.3)' : 'inset 0 2px 6px rgba(124, 58, 237, 0.05)'
                                        } 
                                    },
                                        React.createElement("div", { 
                                            style: { 
                                                borderRight: isFa ? '4px solid #a855f7' : undefined,
                                                borderLeft: !isFa ? '4px solid #a855f7' : undefined,
                                                paddingRight: isFa ? '1rem' : undefined,
                                                paddingLeft: !isFa ? '1rem' : undefined
                                            } 
                                        },
                                            React.createElement(DynamicWorkflowSettingsEditor, {
                                                settings: localCustomWorkflowSettings,
                                                onUpdateSettings: setLocalCustomWorkflowSettings,
                                                users: users || [],
                                                language: language,
                                                isDark: isDark,
                                                activeEntityType: entityKey,
                                                hideEntityTabs: true,
                                                showHeaderBanner: true,
                                                onCloseDrawer: () => setExpandedTabId(null),
                                                projectContext: {
                                                    projectName: project.name,
                                                    pmName: pmUser?.name ? `${pmUser.name} (${pmUser.username})` : pmUser?.username,
                                                    ownerName: ownerUser?.name ? `${ownerUser.name} (${ownerUser.username})` : ownerUser?.username,
                                                    tabWorkflows: localTabWorkflows,
                                                    onToggleTabWorkflow: (tabKey, reqWorkflow) => {
                                                        handleToggleWorkflow(tabKey, reqWorkflow);
                                                    }
                                                }
                                            })
                                        )
                                    )
                                )
                            );
                        })
                    )
                )
            )
        ),
        React.createElement("button", { 
                onClick: handleSave, 
                className: "save-btn",
                style: { marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }
            }, 
                React.createElement("span", { className: "material-symbols-outlined" }, "save"),
                t('save')
            )
        ),
        React.createElement("div", { className: "form-section" },
            React.createElement("h4", null, t('saveProgressInformation')),
            React.createElement("div", { className: "inline-form snapshot-form" },
                 React.createElement("input", { type: "text", value: snapshotName, onChange: (e: ChangeEvent<HTMLInputElement>) => setSnapshotName(e.target.value), placeholder: t('snapshotName'), "aria-label": t('snapshotName') }),
                 React.createElement("select", { value: snapshotType, onChange: (e: ChangeEvent<HTMLSelectElement>) => setSnapshotType(e.target.value as any) },
                    React.createElement("option", { value: "Baseline" }, t('baseline')),
                    React.createElement("option", { value: "Progress Information" }, t('progressInfo'))
                 ),
                 React.createElement("button", { onClick: handleSaveSnapshotClick, className: "action-button", title: t('save'), "aria-label": t('save'), style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem' } },
                     React.createElement("span", { className: "material-symbols-outlined" }, "save")
                 )
            ),
            React.createElement("h4", { style: { marginTop: '1.5rem' } }, t('savedSnapshots')),
            scheduleSnapshots.length === 0 ? React.createElement("p", null, t('noSnapshotsSaved')) : (
                React.createElement("div", { className: "table-responsive" },
                    React.createElement("table", { className: "users-table" },
                        React.createElement("thead", null, React.createElement("tr", null,
                            React.createElement("th", null, language === 'fa' ? 'ردیف' : '#'),
                            React.createElement("th", null, t('snapshotName')),
                            React.createElement("th", null, t('snapshotType')),
                            React.createElement("th", null, t('snapshotDate')),
                            React.createElement("th", null, t('actions'))
                        )),
                        React.createElement("tbody", null,
                            scheduleSnapshots.map((snapshot, idx) => (
                                React.createElement("tr", { key: snapshot.id },
                                    React.createElement("td", null, language === 'fa' ? toPersianDigits(idx + 1) : (idx + 1)),
                                    React.createElement("td", null, snapshot.name),
                                    React.createElement("td", null, t(snapshot.type === 'Baseline' ? 'baseline' : 'progressInfo')),
                                    React.createElement("td", null, formatDate(snapshot.date, language)),
                                    React.createElement("td", { className: "action-cell" },
                                        React.createElement("button", { onClick: () => onViewSnapshot(snapshot), className: "action-icon view", title: t('viewSnapshot') }, React.createElement("span", { className: "material-symbols-outlined" }, "visibility")),
                                        React.createElement("button", { onClick: () => onDeleteSnapshot(snapshot.id), className: "action-icon delete", title: t('delete') }, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                                    )
                                )
                            ))
                        )
                    )
                )
            )
        )
    );
};