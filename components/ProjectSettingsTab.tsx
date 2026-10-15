import React, { useState, useEffect, useMemo, useContext, ChangeEvent, ReactElement, Fragment } from 'react';
import { LocalizationContext, ThemeContext } from '../context';
import { 
    User, Project, ScheduleSnapshot, WorkflowEntityType, DynamicWorkflowSettings, 
    ProjectContractPermissions, ProjectInvoicePermissions,
    Calendar, ProjectActivity
} from '../types';
import { formatDate, toPersianDigits } from '../utils';
import { DynamicWorkflowSettingsEditor } from './DynamicWorkflowSettingsEditor';
import { emptyWorkflowSettings, useGovernance } from '../directory/GovernanceContext';

export const ProjectSettingsTab = ({ 
    project,
    calendar,
    activities,
    onSaveSettings,
    scheduleSnapshots, 
    onSaveSnapshot, 
    onDeleteSnapshot, 
    onViewSnapshot,
    currentUser,
    users = [],
    isReadOnly = false
}: {
    project: Project,
    calendar?: Calendar,
    activities?: ProjectActivity[],
    onSaveSettings: (settings: Partial<Project>) => void,
    scheduleSnapshots: ScheduleSnapshot[],
    onSaveSnapshot: (name: string, type: 'Baseline' | 'Progress Information') => void,
    onDeleteSnapshot: (id: string) => void,
    onViewSnapshot: (snapshot: ScheduleSnapshot) => void,
    currentUser?: User | null,
    users?: User[],
    isReadOnly?: boolean
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';
    const isFa = language === 'fa';
    
    // Collapsible sections - closed by default
    const [expandedSections, setExpandedSections] = useState<{
        weighting: boolean;
        tabsDisplay: boolean;
        workflows: boolean;
        performance: boolean;
    }>({
        weighting: false,
        tabsDisplay: false,
        workflows: false,
        performance: false
    });

    const toggleSection = (section: 'weighting' | 'tabsDisplay' | 'workflows' | 'performance') => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const [snapshotName, setSnapshotName] = useState('');
    const [snapshotType, setSnapshotType] = useState<'Baseline' | 'Progress Information'>('Baseline');

    // A progress record is always taken for today (the backend dates it); the name is only a label.
    const sCurveDates: string[] = [];
    const [localWeightingType, setLocalWeightingType] = useState(project.weightingType || 'manual');
    const [localPlannedProgressType, setLocalPlannedProgressType] = useState(project.plannedProgressType || 'continuous');
    const [timeWeightFactor, setTimeWeightFactor] = useState(project.timeWeightFactor || 34);
    const [costWeightFactor, setCostWeightFactor] = useState(project.costWeightFactor || 33);
    const [complexityWeightFactor, setComplexityWeightFactor] = useState(project.complexityWeightFactor || 33);
    // Which sections the project shows, who may see its contracts and invoices, and the project's own approval chains are the backend's;
    // they are edited here as a draft and saved together.
    const governance = useGovernance();
    const stored = governance.settingsOf(project.id);
    const ALL_TABS = ['charter', 'schedule', 'team', 'risks', 'stakeholders', 'status', 'delays', 'docs', 'actions', 'contracts', 'invoices'];
    const [localEnabledTabs, setLocalEnabledTabs] = useState<string[]>(stored.enabledTabs ?? ALL_TABS);
    /** By tab: the project has its own approval chain for it. */
    const [localTabWorkflows, setLocalTabWorkflows] = useState<Record<string, boolean>>({});
    const [localCustomWorkflowSettings, setLocalCustomWorkflowSettings] = useState<DynamicWorkflowSettings>(emptyWorkflowSettings());
    const [contractPermissions, setContractPermissions] = useState<ProjectContractPermissions>(stored.contractPermissions);
    const [invoicePermissions, setInvoicePermissions] = useState<ProjectInvoicePermissions>(stored.invoicePermissions);

    const [activeWorkflowEntity, setActiveWorkflowEntity] = useState<WorkflowEntityType>('charter');
    const [expandedTabId, setExpandedTabId] = useState<string | null>(null);

    const projectOwnerId = project.ownerId || 1;
    const isOwner = !!(currentUser && (String(projectOwnerId) === String(currentUser.id) || currentUser.role === 'Admin'));

    useEffect(() => {
        setLocalWeightingType(project.weightingType || 'manual');
        setLocalPlannedProgressType(project.plannedProgressType || 'continuous');
        setTimeWeightFactor(project.timeWeightFactor || 34);
        setCostWeightFactor(project.costWeightFactor || 33);
        setComplexityWeightFactor(project.complexityWeightFactor || 33);
    }, [project]);

    // The sections / access settings follow what the backend holds for this project.
    useEffect(() => {
        const settings = governance.settingsOf(project.id);
        setLocalEnabledTabs(settings.enabledTabs ?? ALL_TABS);
        setContractPermissions(settings.contractPermissions);
        setInvoicePermissions(settings.invoicePermissions);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id, governance.projectSettings]);

    // The approval chains that apply to this project (its own where it has one, otherwise the organisation's), read when the tab opens.
    useEffect(() => {
        let cancelled = false;
        void governance.loadProjectWorkflow(project.id).then(view => {
            if (cancelled || !view) return;
            setLocalTabWorkflows(view.custom);
            setLocalCustomWorkflowSettings(view.settings);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id]);
    
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
        { id: 'contracts', name: isFa ? 'اطلاعات قرارداد' : 'Contract Information', entityType: 'contracts' },
        { id: 'invoices', name: isFa ? 'صورتحساب‌ها' : 'Invoices', entityType: 'invoices' },
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

    const handleSave = async () => {
        if (localWeightingType === 'combined' && totalWeightFactor !== 100) {
            alert(t('weightFactorsMustSum100'));
            return;
        }
        const failed = async (work: Promise<{ ok: boolean; message?: string }>) => {
            const outcome = await work;
            if (!outcome.ok) alert(outcome.message || (isFa ? 'ذخیره انجام نشد.' : 'The settings could not be saved.'));
            return !outcome.ok;
        };
        if (await failed(governance.saveProjectWorkflow(project.id, { custom: localTabWorkflows, settings: localCustomWorkflowSettings }))) return;
        if (await failed(governance.saveProjectSettings(project.id, { enabledTabs: localEnabledTabs, contractPermissions, invoicePermissions }))) return;
        onSaveSettings({ 
            weightingType: localWeightingType, 
            plannedProgressType: localPlannedProgressType,
            timeWeightFactor,
            costWeightFactor,
            complexityWeightFactor
        });
    };

    const handleSaveSnapshotClick = () => {
        if (!snapshotName.trim()) {
            alert(snapshotType === 'Progress Information' && isFa
                ? 'لطفاً یکی از تاریخ‌های نمودار S را انتخاب کنید.'
                : t('snapshotNameRequired')
            );
            return;
        }
        onSaveSnapshot(snapshotName, snapshotType);
        setSnapshotName('');
    };

    const pmUser = users.find(u => String(u.id) === String(project.projectManagerId));
    const ownerUser = users.find(u => String(u.id) === String(project.ownerId));

    return React.createElement("div", { className: "project-settings-tab", style: { display: 'flex', flexDirection: 'column', gap: '1.25rem' } },
        
        // ==========================================
        // SECTION 1: تنظیمات وزن‌دهی و محاسبه پیشرفت
        // ==========================================
        React.createElement("div", {
            className: "card shadow-sm",
            style: {
                borderRadius: '12px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: 'var(--card-bg-color, #ffffff)',
                overflow: 'hidden'
            }
        },
            // Accordion Header
            React.createElement("div", {
                onClick: () => toggleSection('weighting'),
                style: {
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: expandedSections.weighting ? (isDark ? 'rgba(79, 70, 229, 0.15)' : '#eef2ff') : 'transparent',
                    borderBottom: expandedSections.weighting ? '1px solid var(--border-color, #e2e8f0)' : 'none',
                    transition: 'background-color 0.2s ease'
                }
            },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' } },
                    React.createElement("span", {
                        className: "material-symbols-outlined",
                        style: {
                            color: '#4f46e5',
                            backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : '#e0e7ff',
                            padding: '6px',
                            borderRadius: '8px',
                            fontSize: '1.25rem'
                        }
                    }, "scale"),
                    React.createElement("div", null,
                        React.createElement("h4", { style: { margin: 0, fontSize: '1rem', fontWeight: 700 } },
                            isFa ? 'تنظیمات وزن‌دهی و محاسبه پیشرفت' : 'Weighting & Progress Calculation'
                        ),
                        React.createElement("p", { style: { margin: 0, fontSize: '0.78rem', color: '#64748b' } },
                            isFa ? 'تعیین شیوه وزن‌دهی فعالیت‌ها و فرمول محاسبه پیشرفت برنامه‌ای' : 'Define activity weight allocation and planned progress method'
                        )
                    )
                ),
                React.createElement("span", {
                    className: "material-symbols-outlined",
                    style: { color: '#64748b', transform: expandedSections.weighting ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }
                }, "expand_more")
            ),

            // Accordion Body
            expandedSections.weighting && React.createElement("div", { style: { padding: '1.25rem' } },
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
                    localWeightingType === 'combined' && React.createElement("div", { className: "combined-weight-factors", style: { marginTop: '1rem' } },
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
                        React.createElement("p", { className: `total-factor ${totalWeightFactor !== 100 ? 'error' : ''}`, style: { gridColumn: '1 / -1', margin: '0.5rem 0' } },
                            `${t('totalWeightFactor')}: ${language === 'fa' ? toPersianDigits(totalWeightFactor) : totalWeightFactor}%`
                        )
                    )
                ),
                !isReadOnly && React.createElement("button", { 
                    onClick: handleSave, 
                    className: "save-btn",
                    style: { marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }
                }, 
                    React.createElement("span", { className: "material-symbols-outlined" }, "save"),
                    t('save')
                )
            )
        ),

        // ==========================================
        // SECTION 2: نمایش تب‌ها و بخش‌های پروژه (Tabs Display)
        // ==========================================
        React.createElement("div", {
            className: "card shadow-sm",
            style: {
                borderRadius: '12px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: 'var(--card-bg-color, #ffffff)',
                overflow: 'hidden'
            }
        },
            // Accordion Header
            React.createElement("div", {
                onClick: () => toggleSection('tabsDisplay'),
                style: {
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: expandedSections.tabsDisplay ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5') : 'transparent',
                    borderBottom: expandedSections.tabsDisplay ? '1px solid var(--border-color, #e2e8f0)' : 'none',
                    transition: 'background-color 0.2s ease'
                }
            },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' } },
                    React.createElement("span", {
                        className: "material-symbols-outlined",
                        style: {
                            color: '#10b981',
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#d1fae5',
                            padding: '6px',
                            borderRadius: '8px',
                            fontSize: '1.25rem'
                        }
                    }, "tab"),
                    React.createElement("div", null,
                        React.createElement("h4", { style: { margin: 0, fontSize: '1rem', fontWeight: 700 } },
                            isFa ? 'نمایش تب‌ها و بخش‌های پروژه' : 'Project Tabs Display'
                        ),
                        React.createElement("p", { style: { margin: 0, fontSize: '0.78rem', color: '#64748b' } },
                            isFa ? 'انتخاب و تعیین تب‌های فعال و قابل مشاهده در پروژه' : 'Configure visible and active tabs in this project'
                        )
                    )
                ),
                React.createElement("span", {
                    className: "material-symbols-outlined",
                    style: { color: '#64748b', transform: expandedSections.tabsDisplay ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }
                }, "expand_more")
            ),

            // Accordion Body
            expandedSections.tabsDisplay && React.createElement("div", { style: { padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' } },
                React.createElement("div", { className: "tabs-visibility-grid", style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' } },
                    tabDefinitions.map(tab => (
                        React.createElement("label", { key: tab.id, className: "checkbox-label", style: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' } },
                            React.createElement("input", {
                                type: "checkbox",
                                checked: localEnabledTabs.includes(tab.id),
                                onChange: () => handleToggleTab(tab.id)
                            }),
                            tab.name
                        ))
                    )
                ),

                !isReadOnly && React.createElement("button", { 
                    onClick: handleSave, 
                    className: "save-btn",
                    style: { marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start' }
                }, 
                    React.createElement("span", { className: "material-symbols-outlined" }, "save"),
                    t('save')
                )
            )
        ),

        // ==========================================
        // SECTION 3: گردش‌کار و تأییدیه‌های صفحات پروژه (Approval Workflows)
        // ==========================================
        React.createElement("div", {
            className: "card shadow-sm",
            style: {
                borderRadius: '12px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: 'var(--card-bg-color, #ffffff)',
                overflow: 'hidden'
            }
        },
            // Accordion Header
            React.createElement("div", {
                onClick: () => toggleSection('workflows'),
                style: {
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: expandedSections.workflows ? (isDark ? 'rgba(124, 58, 237, 0.15)' : '#faf5ff') : 'transparent',
                    borderBottom: expandedSections.workflows ? '1px solid var(--border-color, #e2e8f0)' : 'none',
                    transition: 'background-color 0.2s ease'
                }
            },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' } },
                    React.createElement("span", {
                        className: "material-symbols-outlined",
                        style: {
                            color: '#7c3aed',
                            backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#ede9fe',
                            padding: '6px',
                            borderRadius: '8px',
                            fontSize: '1.25rem'
                        }
                    }, "account_tree"),
                    React.createElement("div", null,
                        React.createElement("h4", { style: { margin: 0, fontSize: '1rem', fontWeight: 700 } },
                            isFa ? 'گردش‌کار و تأییدیه‌های صفحات پروژه' : 'Project Pages Approval Workflows'
                        ),
                        React.createElement("p", { style: { margin: 0, fontSize: '0.78rem', color: '#64748b' } },
                            isFa ? 'تنظیم مراحل تأیید و گردش‌کارهای اختصاصی یا عمومی بخش‌های پروژه' : 'Configure dynamic approval stages and custom workflows for project tabs'
                        )
                    )
                ),
                React.createElement("span", {
                    className: "material-symbols-outlined",
                    style: { color: '#64748b', transform: expandedSections.workflows ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }
                }, "expand_more")
            ),

            // Accordion Body
            expandedSections.workflows && React.createElement("div", { style: { padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' } },
                React.createElement("div", { className: "table-responsive" },
                    React.createElement("table", { className: "users-table", style: { width: '100%', fontSize: '0.85rem' } },
                        React.createElement("thead", null, React.createElement("tr", null,
                            React.createElement("th", null, language === 'fa' ? 'ردیف' : '#'),
                            React.createElement("th", null, isFa ? 'عنوان بخش / صفحه' : 'Page / Section'),
                            React.createElement("th", { style: { textAlign: 'center' } }, isFa ? 'نیاز به گردش کار' : 'Requires Workflow'),
                            React.createElement("th", { style: { textAlign: 'center' } }, isFa ? 'نوع گردش کار' : 'Workflow Type'),
                            React.createElement("th", { style: { textAlign: 'center' } }, isFa ? 'پیکربندی مراحل' : 'Stages Config')
                        )),
                        React.createElement("tbody", null,
                            tabDefinitions.map((tab, idx) => {
                                const entityKey = tab.entityType;
                                const isWorkflowGlobal = !localTabWorkflows[tab.id];
                                const isCustom = !isWorkflowGlobal;
                                const isExpanded = expandedTabId === tab.id;
                                const stageCount = entityKey ? (localCustomWorkflowSettings[entityKey]?.length || 0) : 0;

                                return React.createElement(Fragment, { key: tab.id },
                                    React.createElement("tr", { 
                                        style: { 
                                            backgroundColor: isExpanded ? (isDark ? 'rgba(124, 58, 237, 0.15)' : '#faf5ff') : undefined,
                                            fontWeight: isExpanded ? 600 : undefined
                                        } 
                                    },
                                        React.createElement("td", null, language === 'fa' ? toPersianDigits(idx + 1) : (idx + 1)),
                                        React.createElement("td", { style: { fontWeight: 600 } }, tab.name),
                                        React.createElement("td", { style: { textAlign: 'center' } },
                                            React.createElement("input", {
                                                type: "checkbox",
                                                checked: isCustom,
                                                onChange: () => handleToggleWorkflow(tab.id),
                                                style: { transform: 'scale(1.15)', cursor: 'pointer' },
                                                title: isFa ? 'فعال‌سازی گردش کار اختصاصی برای این پروژه' : 'Enable custom project workflow'
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
                                                        padding: '3px 8px', 
                                                        borderRadius: '9999px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    } 
                                                },
                                                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "public"),
                                                    isFa ? 'عمومی سیستم' : 'Global System'
                                                )
                                            ) : (
                                                React.createElement("span", { 
                                                    style: { 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '4px',
                                                        backgroundColor: isDark ? 'rgba(217, 119, 6, 0.25)' : '#fef3c7', 
                                                        color: isDark ? '#fef08a' : '#b45309', 
                                                        padding: '3px 8px', 
                                                        borderRadius: '9999px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    } 
                                                },
                                                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, "star"),
                                                    isFa ? `منحصربفرد پروژه (${toPersianDigits(stageCount)} مرحله)` : `Custom (${stageCount} stages)`
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
                                                        backgroundColor: isExpanded ? '#7c3aed' : (isCustom ? (isDark ? 'rgba(124, 58, 237, 0.25)' : '#f5f3ff') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc')),
                                                        color: isExpanded ? '#ffffff' : (isCustom ? (isDark ? '#ddd6fe' : '#6d28d9') : (isDark ? '#e2e8f0' : '#475569')),
                                                        border: isExpanded ? '1px solid #7c3aed' : (isCustom ? (isDark ? '1px solid #a78bfa' : '1px solid #c4b5fd') : (isDark ? '1px solid #475569' : '1px solid #cbd5e1')),
                                                        borderRadius: '6px',
                                                        padding: '0.3rem 0.65rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }
                                                },
                                                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.9rem' } }, 
                                                        isExpanded ? "expand_less" : "tune"
                                                    ),
                                                    isExpanded ? (isFa ? 'بستن' : 'Close') : (isFa ? 'تنظیم مراحل' : 'Configure')
                                                )
                                            ) : '-'
                                        )
                                    ),
                                    isExpanded && entityKey && React.createElement("tr", {
                                        key: `${tab.id}-drawer`,
                                        className: "workflow-drawer-row"
                                    },
                                        React.createElement("td", { 
                                            colSpan: 5, 
                                            style: { 
                                                padding: '1.25rem', 
                                                backgroundColor: isDark ? 'rgba(124, 58, 237, 0.1)' : '#faf5ff', 
                                                borderBottom: '2px solid #a855f7'
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
                                                    // The editor's wording: true = the tab follows the organisation's chain.
                                                    tabWorkflows: Object.fromEntries(tabDefinitions.map(tabDef => [tabDef.id, !localTabWorkflows[tabDef.id]])),
                                                    onToggleTabWorkflow: (tabKey, isCurrentlyCustom) => {
                                                        handleToggleWorkflow(tabKey, !isCurrentlyCustom);
                                                    }
                                                }
                                            })
                                        )
                                    )
                                );
                            })
                        )
                    )
                ),

                !isReadOnly && React.createElement("button", { 
                    onClick: handleSave, 
                    className: "save-btn",
                    style: { marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start' }
                }, 
                    React.createElement("span", { className: "material-symbols-outlined" }, "save"),
                    t('save')
                )
            )
        ),

        // ==========================================
        // SECTION 4: ذخیره اطلاعات عملکرد
        // ==========================================
        React.createElement("div", {
            className: "card shadow-sm",
            style: {
                borderRadius: '12px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: 'var(--card-bg-color, #ffffff)',
                overflow: 'hidden'
            }
        },
            // Accordion Header
            React.createElement("div", {
                onClick: () => toggleSection('performance'),
                style: {
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: expandedSections.performance ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb') : 'transparent',
                    borderBottom: expandedSections.performance ? '1px solid var(--border-color, #e2e8f0)' : 'none',
                    transition: 'background-color 0.2s ease'
                }
            },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' } },
                    React.createElement("span", {
                        className: "material-symbols-outlined",
                        style: {
                            color: '#f59e0b',
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#fef3c7',
                            padding: '6px',
                            borderRadius: '8px',
                            fontSize: '1.25rem'
                        }
                    }, "save_as"),
                    React.createElement("div", null,
                        React.createElement("h4", { style: { margin: 0, fontSize: '1rem', fontWeight: 700 } },
                            isFa ? 'ذخیره اطلاعات عملکرد' : 'Performance Data Storage'
                        ),
                        React.createElement("p", { style: { margin: 0, fontSize: '0.78rem', color: '#64748b' } },
                            isFa ? 'ثبت خط مبنا (Baseline) و اسنپ‌شات‌های دوره‌ای از پیشرفت پروژه' : 'Record project baselines and historic progress snapshots'
                        )
                    )
                ),
                React.createElement("span", {
                    className: "material-symbols-outlined",
                    style: { color: '#64748b', transform: expandedSections.performance ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }
                }, "expand_more")
            ),

            // Accordion Body
            expandedSections.performance && React.createElement("div", { style: { padding: '1.25rem' } },
                React.createElement("div", { className: "inline-form snapshot-form", style: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' } },
                    false ? (
                        React.createElement("select", {
                            value: snapshotName,
                            onChange: (e: ChangeEvent<HTMLSelectElement>) => setSnapshotName(e.target.value),
                            "aria-label": isFa ? 'انتخاب تاریخ نمودار S' : 'Select S-Curve Date',
                            style: {
                                minWidth: '220px',
                                flex: '1 1 200px',
                                padding: '0.45rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color, #cbd5e1)',
                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                color: 'var(--text-color, #1e293b)',
                                fontSize: '0.85rem'
                            }
                        },
                            React.createElement("option", { value: "" }, isFa ? '-- انتخاب تاریخ از نمودار S --' : '-- Select S-Curve Date --'),
                            sCurveDates.map(dateStr => React.createElement("option", { key: dateStr, value: dateStr }, dateStr))
                        )
                    ) : (
                        React.createElement("input", {
                            type: "text",
                            value: snapshotName,
                            onChange: (e: ChangeEvent<HTMLInputElement>) => setSnapshotName(e.target.value),
                            placeholder: t('snapshotName'),
                            "aria-label": t('snapshotName'),
                            style: { minWidth: '200px', flex: '1 1 200px' }
                        })
                    ),
                    React.createElement("select", {
                        value: snapshotType,
                        onChange: (e: ChangeEvent<HTMLSelectElement>) => {
                            const newType = e.target.value as any;
                            setSnapshotType(newType);
                            setSnapshotName(newType === 'Progress Information' ? formatDate(new Date(), language) : '');
                        }
                    },
                        React.createElement("option", { value: "Baseline" }, t('baseline')),
                        React.createElement("option", { value: "Progress Information" }, t('progressInfo'))
                    ),
                    React.createElement("button", { onClick: handleSaveSnapshotClick, className: "action-button" }, t('save'))
                ),
                React.createElement("h4", { style: { marginTop: '1.5rem', fontSize: '0.95rem' } }, t('savedSnapshots')),
                scheduleSnapshots.length === 0 ? React.createElement("p", { style: { color: '#64748b', fontSize: '0.85rem' } }, t('noSnapshotsSaved')) : (
                    React.createElement("div", { className: "table-responsive", style: { marginTop: '0.75rem' } },
                        React.createElement("table", { className: "users-table", style: { width: '100%', fontSize: '0.85rem' } },
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
                                        React.createElement("td", { style: { fontWeight: 600 } },
                                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                                                React.createElement("span", null, snapshot.name),
                                                snapshot.type === 'Progress Information' && snapshot.actualProgress !== undefined && React.createElement("span", {
                                                    style: {
                                                        fontSize: '0.75rem',
                                                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                                        color: '#ef4444',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontWeight: 700
                                                    }
                                                }, `${language === 'fa' ? `پیشرفت: ${toPersianDigits(snapshot.actualProgress)}٪` : `Progress: ${snapshot.actualProgress}%`}`)
                                            )
                                        ),
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
        )
    );
};
