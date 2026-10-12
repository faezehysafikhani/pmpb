

import React, { useMemo, useContext, useState, useRef, useEffect, useCallback, ChangeEvent, ReactElement } from 'react';
import { LocalizationContext, ThemeContext } from '../context';
import { User, Project, Calendar, TranslationKey, WorkStatus, ActionItem, ActionRecurrence, RecurrenceFrequency } from '../types';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { getCalendarDisplayName, toPersianDigits, getRecurrenceSummary, PERSIAN_WEEKDAY_NAMES, PERSIAN_MONTH_NAMES } from '../utils';
import { useDirectory } from '../directory/DirectoryContext';

interface OwningUnitTreeNode {
    id: string;
    name: string;
    parentId: string | null;
}

export const OwningUnitTreeSelect = ({
    value,
    onChange,
    owningUnits,
    disabled = false,
    id = "owningUnit",
    placeholder = "انتخاب واحد سازمانی..."
}: {
    value: string;
    onChange: (val: string) => void;
    owningUnits: string[];
    disabled?: boolean;
    id?: string;
    placeholder?: string;
}) => {
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';
    const [isOpen, setIsOpen] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // The organisation chart as the backend holds it; a unit's value is its full path from the top ("Organization > Engineering > Civil").
    const { unitNodes: treeNodes } = useDirectory();

    const pathOf = useCallback((node: OwningUnitTreeNode): string => {
        const names = [node.name];
        const seen = new Set([node.id]);
        let parent = treeNodes.find(n => n.id === node.parentId);
        while (parent && !seen.has(parent.id)) {
            names.unshift(parent.name);
            seen.add(parent.id);
            parent = treeNodes.find(n => n.id === parent!.parentId);
        }
        return names.join(' > ');
    }, [treeNodes]);

    const rootNodes = useMemo(() => treeNodes.filter(n => !n.parentId), [treeNodes]);

    const getChildren = useCallback((parentId: string) => {
        return treeNodes.filter(n => n.parentId === parentId);
    }, [treeNodes]);

    const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setExpandedIds(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
    };

    const handleSelectNode = (node: OwningUnitTreeNode) => {
        onChange(pathOf(node));
        setIsOpen(false);
    };

    const renderNode = (node: OwningUnitTreeNode, level = 0) => {
        const children = getChildren(node.id);
        const hasChildren = children.length > 0;
        const isExpanded = !!expandedIds[node.id];
        const isSelected = value === pathOf(node);

        return React.createElement("div", { key: node.id, style: { display: 'flex', flexDirection: 'column' } },
            React.createElement("div", {
                onClick: () => !disabled && handleSelectNode(node),
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.65rem',
                    paddingRight: `${level * 18 + 10}px`,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    borderRadius: '6px',
                    backgroundColor: isSelected 
                        ? (isDark ? 'rgba(37, 99, 235, 0.25)' : 'rgba(37, 99, 235, 0.12)') 
                        : 'transparent',
                    color: isSelected ? (isDark ? '#60a5fa' : '#2563eb') : (isDark ? '#f8fafc' : '#1e293b'),
                    fontWeight: isSelected ? 700 : (level === 0 ? 600 : 400),
                    fontSize: '0.85rem',
                    transition: 'background-color 0.15s ease'
                }
            },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' } },
                    hasChildren ? (
                        React.createElement("button", {
                            type: "button",
                            onClick: (e) => toggleExpand(node.id, e),
                            style: {
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                                background: isDark ? '#334155' : '#f8fafc',
                                color: isDark ? '#f8fafc' : '#334155',
                                fontSize: '0.9rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                padding: 0,
                                lineHeight: 1
                            },
                            title: isExpanded ? "بستن زیرگروه" : "باز کردن زیرگروه"
                        }, isExpanded ? '−' : '+')
                    ) : (
                        React.createElement("span", { style: { width: '20px', display: 'inline-block', textAlign: 'center', color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.75rem' } }, '•')
                    ),

                    React.createElement("span", {
                        className: "material-symbols-outlined",
                        style: {
                            fontSize: '1.1rem',
                            color: isSelected ? (isDark ? '#60a5fa' : '#2563eb') : (hasChildren ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? '#94a3b8' : '#64748b'))
                        }
                    }, hasChildren ? 'domain' : 'subdirectory_arrow_right'),

                    React.createElement("span", { style: { whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' } }, node.name)
                ),

                hasChildren && React.createElement("span", {
                    style: {
                        fontSize: '0.7rem',
                        color: isDark ? '#94a3b8' : '#64748b',
                        background: isDark ? '#1e293b' : '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: '4px'
                    }
                }, `${children.length} زیرگروه`)
            ),

            hasChildren && isExpanded && React.createElement("div", {
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: isDark ? '1px dashed #475569' : '1px dashed #cbd5e1',
                    marginRight: `${level * 18 + 18}px`,
                    marginTop: '0.15rem'
                }
            }, children.map(child => renderNode(child, level + 1)))
        );
    };

    return React.createElement("div", { ref: containerRef, className: "owning-unit-tree-container", style: { position: 'relative', width: '100%', zIndex: isOpen ? 1000 : 'auto' } },
        React.createElement("div", {
            id: id,
            onClick: () => !disabled && setIsOpen(!isOpen),
            style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                background: disabled 
                    ? (isDark ? '#1e293b' : '#f1f5f9') 
                    : (isDark ? '#0f172a' : '#ffffff'),
                color: isDark ? '#f8fafc' : '#0f172a',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '0.88rem',
                minHeight: '38px'
            }
        },
            React.createElement("span", { style: { color: value ? 'inherit' : (isDark ? '#64748b' : '#94a3b8'), fontWeight: value ? 500 : 400 } },
                value || placeholder
            ),
            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem', color: isDark ? '#94a3b8' : '#64748b' } },
                isOpen ? 'expand_less' : 'expand_more'
            )
        ),

        isOpen && React.createElement("div", {
            style: {
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 1001,
                background: isDark ? '#0f172a' : '#ffffff',
                border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '0.4rem'
            }
        },
            rootNodes.length === 0 ? (
                React.createElement("div", { style: { padding: '0.75rem', textAlign: 'center', fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b' } },
                    "هیچ واحد مالکی ثبت نشده است"
                )
            ) : (
                rootNodes.map(node => renderNode(node, 0))
            )
        )
    );
};

export const ProjectCharterForm = ({ projectData, setProjectData, users, calendars, owningUnits, projectStatuses, currentUser, isReadOnly = false, isProjectWorkflowEnabled, isEditing = false }: { 
    projectData: Partial<Project>, 
    setProjectData: (data: Partial<Project>) => void, 
    users: User[], 
    calendars: any[], 
    owningUnits: string[],
    projectStatuses: string[],
    currentUser?: User | null,
    isReadOnly?: boolean,
    isProjectWorkflowEnabled?: boolean,
    isEditing?: boolean
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const projectManagers = useMemo(() => 
        users.filter(u => u.role === 'Project Manager' || u.role === 'Admin'), 
        [users]
    );

    const adminUsers = useMemo(() => 
        users.filter(u => u.role === 'Admin'), 
        [users]
    );

    const projectOwnerName = useMemo(() => {
        const ownerId = projectData.ownerId || (projectData.id ? 1 : currentUser?.id);
        const owner = users.find(u => u.id === ownerId);
        return owner ? owner.username : (currentUser?.username || 'admin');
    }, [projectData.ownerId, users, currentUser, projectData.id]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (isReadOnly) return;
        const { name, value } = e.target;
        if (name === 'projectManagerId' || name === 'calendarId' || name === 'approver1Id') {
            setProjectData({ ...projectData, [name]: value || null });
        } else if (name === 'sprintCount') {
            setProjectData({ ...projectData, [name]: parseInt(value, 10) || 1 });
        } else if (name === 'cost') {
            const asciiValue = value
                .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
            const numericValue = parseInt(asciiValue.replace(/[^0-9]/g, ''), 10);
            setProjectData({ ...projectData, cost: isNaN(numericValue) ? undefined : numericValue });
        }
        else {
            setProjectData({ ...projectData, [name]: value });
        }
    };
    
    const formattedCost = useMemo(() => {
        if (projectData.cost === undefined || projectData.cost === null) return '';
        if (projectData.cost === 0) return language === 'fa' ? toPersianDigits(0) : '0';
        const formatted = new Intl.NumberFormat('en-US').format(projectData.cost);
        return language === 'fa' ? toPersianDigits(formatted) : formatted;
    }, [projectData.cost, language]);

    const statusTranslations: Record<string, TranslationKey> = {
        'Planning': 'planning',
        'In Progress': 'inProgress',
        'On Hold': 'onHold',
        'Completed': 'completed'
    };

    return (
        React.createElement("form", { className: "charter-form" },
            React.createElement("div", { className: "form-group full-width", style: { display: 'grid', gridTemplateColumns: '1fr 200px', gap: '1rem', margin: 0, padding: 0 } },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "name" }, t('projectName') + '*'),
                    React.createElement("input", { type: "text", id: "name", name: "name", value: projectData.name || '', onChange: handleChange, required: true, disabled: isReadOnly })
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "code" }, language === 'fa' ? 'کد پروژه' : 'Project Code'),
                    React.createElement("input", { type: "text", id: "code", name: "code", value: projectData.code || '', onChange: handleChange, disabled: isReadOnly, placeholder: language === 'fa' ? 'مثال: PRJ-101' : 'e.g. PRJ-101' })
                )
            ),
            React.createElement("div", { className: "form-group" },
                React.createElement("label", { htmlFor: "projectOwner" }, language === 'fa' ? 'مالک پروژه' : 'Project Owner'),
                React.createElement("input", { type: "text", id: "projectOwner", value: projectOwnerName, disabled: true, className: "disabled-input" })
            ),
            React.createElement("div", { className: "form-group" },
                React.createElement("label", { htmlFor: "projectManagerId" }, t('projectManager') + '*'),
                React.createElement("select", { id: "projectManagerId", name: "projectManagerId", value: projectData.projectManagerId || '', onChange: handleChange, required: true, disabled: isReadOnly },
                    React.createElement("option", { value: "" }, t('selectAManager')),
                    projectManagers.map(pm => (
                        React.createElement("option", { key: pm.id, value: pm.id }, pm.username)
                    ))
                )
            ),
             React.createElement("div", { className: "form-group" },
                React.createElement("label", { htmlFor: "calendarId" }, t('projectCalendar') + '*'),
                React.createElement("select", { id: "calendarId", name: "calendarId", value: projectData.calendarId || '', onChange: handleChange, required: true, disabled: isReadOnly },
                    calendars.map(c => (
                        React.createElement("option", { key: c.id, value: c.id }, getCalendarDisplayName(c.name, language))
                    ))
                )
            ),
            React.createElement("div", { className: "form-group" },
                React.createElement("label", { htmlFor: "status" }, t('status') + '*'),
                React.createElement("select", { id: "status", name: "status", value: projectData.status || 'Planning', onChange: handleChange, required: true, disabled: isReadOnly },
                    projectStatuses.map(statusKey => (
                         React.createElement("option", { key: statusKey, value: statusKey }, t(statusTranslations[statusKey] || statusKey as any))
                    ))
                )
            ),
            React.createElement("div", { className: "form-group full-width", style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: 0, padding: 0 } },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "startDate" }, t('startDate') + '*'),
                    React.createElement(ShamsiDatePicker, { id: "startDate", name: "startDate", value: projectData.startDate || '', onChange: (val: string) => !isReadOnly && setProjectData({ ...projectData, startDate: val }), required: true, disabled: isReadOnly })
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "endDate" }, t('endDate') + '*'),
                    React.createElement(ShamsiDatePicker, { id: "endDate", name: "endDate", value: projectData.endDate || '', onChange: (val: string) => !isReadOnly && setProjectData({ ...projectData, endDate: val }), required: true, disabled: isReadOnly })
                )
            ),
            React.createElement("div", { className: "form-group" },
                React.createElement("label", { htmlFor: "owningUnit" }, t('owningUnit') + '*'),
                React.createElement(OwningUnitTreeSelect, {
                    id: "owningUnit",
                    value: projectData.owningUnit || '',
                    onChange: (val: string) => !isReadOnly && setProjectData({ ...projectData, owningUnit: val }),
                    owningUnits: owningUnits,
                    disabled: isReadOnly,
                    placeholder: t('selectAUnit')
                })
            ),
            projectData.type === 'agile' && React.createElement("div", { className: "form-group" },
                React.createElement("label", { htmlFor: "sprintCount" }, t('sprintCount') + '*'),
                React.createElement("input", { type: "number", id: "sprintCount", name: "sprintCount", value: projectData.sprintCount || 1, onChange: handleChange, required: true, min: "1", disabled: isReadOnly })
            ),
            React.createElement("div", { className: "form-group" },
                React.createElement("label", { htmlFor: "cost" }, t('cost')),
                React.createElement("input", { type: "text", id: "cost", name: "cost", value: formattedCost || '', onChange: handleChange, placeholder: "1,000,000", inputMode: "numeric", disabled: isReadOnly })
            ),
            React.createElement("div", { className: "form-group full-width" },
                React.createElement("label", { htmlFor: "goal" }, t('projectGoal') + '*'),
                React.createElement("textarea", { id: "goal", name: "goal", value: projectData.goal || '', onChange: handleChange, disabled: isReadOnly, placeholder: language === 'fa' ? 'اهداف عملیاتی و نتیجه مورد انتظار پروژه را وارد کنید (باید متناسب با عنوان پروژه باشد)...' : 'Enter project goals aligned with project title...' })
            ),
            React.createElement("div", { className: "form-group full-width" },
                React.createElement("label", { htmlFor: "requirements" }, t('projectRequirements') + '*'),
                React.createElement("textarea", { id: "requirements", name: "requirements", value: projectData.requirements || '', onChange: handleChange, disabled: isReadOnly, placeholder: language === 'fa' ? 'الزامات کلیدی، فنی و اجرایی پروژه را وارد کنید (باید متناسب با عنوان پروژه باشد)...' : 'Enter key project requirements aligned with project title...' })
            ),
            React.createElement("div", { className: "form-group full-width" },
                React.createElement("label", { htmlFor: "constraintsAndAssumptions" }, language === 'fa' ? 'محدودیت‌ها و مفروضات*' : 'Constraints & Assumptions*'),
                React.createElement("textarea", { id: "constraintsAndAssumptions", name: "constraintsAndAssumptions", value: projectData.constraintsAndAssumptions || '', onChange: handleChange, required: true, disabled: isReadOnly, placeholder: language === 'fa' ? 'محدودیت‌های بودجه‌ای، زمانی، منابع انسانی یا مفروضات کلیدی پروژه را وارد کنید (الزامی)...' : 'Enter project constraints and key assumptions (required)...' })
            ),
            React.createElement("div", { className: "form-group full-width" },
                React.createElement("label", { htmlFor: "description" }, t('description')),
                React.createElement("textarea", { id: "description", name: "description", value: projectData.description || '', onChange: handleChange, disabled: isReadOnly })
            )
        )
    );
};

const AiCharterValidationSection = ({ projectData }: { projectData: Partial<Project> }) => {
    const { language } = useContext(LocalizationContext);
    const [isValidating, setIsValidating] = React.useState(false);
    const [validationResult, setValidationResult] = React.useState<{
        isValid?: boolean;
        issues?: string[];
        suggestions?: string[];
        summaryMessage?: string;
        error?: string;
    } | null>(null);

    const handleValidateCharter = async () => {
        if (!projectData.name) {
            alert(language === 'fa' ? 'لطفاً ابتدا عنوان پروژه را وارد کنید.' : 'Please enter project name first.');
            return;
        }

        setIsValidating(true);
        setValidationResult(null);

        try {
            const res = await fetch('/api/ai/validate-charter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: projectData.name,
                    goal: projectData.goal,
                    requirements: projectData.requirements,
                    constraintsAndAssumptions: projectData.constraintsAndAssumptions,
                    description: projectData.description,
                    startDate: projectData.startDate,
                    endDate: projectData.endDate
                })
            });

            const data = await res.json();
            if (data.success) {
                setValidationResult(data);
            } else {
                setValidationResult({ error: data.error || 'خطا در صحت‌سنجی هوشمند' });
            }
        } catch (err: any) {
            setValidationResult({ error: err.message || 'خطا در ارتباط با سرور' });
        } finally {
            setIsValidating(false);
        }
    };

    return React.createElement("div", { className: "form-group full-width", style: { marginTop: '1rem' } },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' } },
            React.createElement("button", {
                type: "button",
                className: "btn-ai-sparkle",
                onClick: handleValidateCharter,
                disabled: isValidating,
                style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                }
            },
                React.createElement("span", { className: `material-symbols-outlined ${isValidating ? 'spin' : ''}` }, isValidating ? "sync" : "auto_awesome"),
                isValidating 
                    ? (language === 'fa' ? 'در حال بررسی صحت داده‌ها...' : 'Validating Charter...')
                    : (language === 'fa' ? 'صحت‌سنجی منشور با هوش مصنوعی' : 'AI Charter Validation')
            )
        ),
        validationResult && React.createElement("div", {
            style: {
                padding: '1rem',
                borderRadius: '8px',
                border: `1px solid ${validationResult.isValid ? '#10b981' : '#ef4444'}`,
                backgroundColor: validationResult.isValid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                marginTop: '0.5rem'
            }
        },
            validationResult.summaryMessage && React.createElement("div", { style: { fontWeight: 600, marginBottom: '0.5rem', color: validationResult.isValid ? '#059669' : '#dc2626' } }, validationResult.summaryMessage),
            validationResult.error && React.createElement("div", { style: { color: '#dc2626', fontWeight: 600 } }, validationResult.error),
            validationResult.issues && validationResult.issues.length > 0 && React.createElement("div", { style: { marginTop: '0.5rem' } },
                React.createElement("strong", { style: { color: '#dc2626' } }, language === 'fa' ? 'اشکالات یافته شده:' : 'Issues Found:'),
                React.createElement("ul", { style: { marginTop: '0.25rem', paddingRight: '1.25rem' } },
                    validationResult.issues.map((issue, i) => React.createElement("li", { key: i, style: { color: '#b91c1c', fontSize: '0.88rem' } }, issue))
                )
            ),
            validationResult.suggestions && validationResult.suggestions.length > 0 && React.createElement("div", { style: { marginTop: '0.5rem' } },
                React.createElement("strong", { style: { color: '#059669' } }, language === 'fa' ? 'پیشنهادهای بهبود:' : 'Suggestions:'),
                React.createElement("ul", { style: { marginTop: '0.25rem', paddingRight: '1.25rem' } },
                    validationResult.suggestions.map((sug, i) => React.createElement("li", { key: i, style: { color: '#047857', fontSize: '0.88rem' } }, sug))
                )
            )
        )
    );
};

export const ActionForm = ({ 
    actionData, 
    setActionData, 
    users, 
    calendars, 
    projects, 
    owningUnits, 
    currentUser, 
    isProjectLocked = false,
    activeTab,
    setActiveTab
}: {
    actionData: Partial<ActionItem>;
    setActionData: (data: Partial<ActionItem>) => void;
    users: User[];
    calendars: Calendar[];
    projects: Project[];
    owningUnits: string[];
    currentUser?: User | null;
    isProjectLocked?: boolean;
    activeTab?: 'info' | 'approvers';
    setActiveTab?: (tab: 'info' | 'approvers') => void;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';

    const [internalTab, setInternalTab] = useState<'info' | 'approvers'>('info');
    const currentTab = activeTab !== undefined ? activeTab : internalTab;
    const handleTabChange = (tab: 'info' | 'approvers') => {
        if (setActiveTab) {
            setActiveTab(tab);
        } else {
            setInternalTab(tab);
        }
    };

    // Ensure approver1Id defaults to responsibleUserId if not set
    useEffect(() => {
        if (actionData.responsibleUserId && !actionData.approver1Id) {
            setActionData({
                ...actionData,
                approver1Id: actionData.responsibleUserId
            });
        }
    }, [actionData.responsibleUserId, actionData.approver1Id]);

    const ownerUser = users.find(u => String(u.id) === String(actionData.ownerUserId)) || currentUser;
    const ownerDisplayName = ownerUser ? (ownerUser.name ? `${ownerUser.name} (${ownerUser.username})` : ownerUser.username) : (isFa ? 'نامشخص' : 'Unknown');

    const recurrence = actionData.recurrence || {
        isRecurring: false,
        frequency: 'daily' as RecurrenceFrequency,
        interval: 1,
        durationHours: 2,
        daysOfWeek: [6, 0, 1, 2, 3],
        dayOfMonth: 1,
        monthsOfYear: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        allMonths: true
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'responsibleUserId') {
            const newRespId = value || null;
            const prevRespId = actionData.responsibleUserId;
            // If approver1Id was not explicitly set or was equal to the previous responsible user, keep it synced
            const shouldSyncApprover1 = !actionData.approver1Id || actionData.approver1Id === prevRespId;
            setActionData({
                ...actionData,
                responsibleUserId: newRespId,
                approver1Id: shouldSyncApprover1 ? newRespId : actionData.approver1Id
            });
        } else if (name === 'calendarId' || name.startsWith('approver') || name === 'projectId') {
            setActionData({ ...actionData, [name]: value || null });
        } else {
            setActionData({ ...actionData, [name]: value });
        }
    };

    const handleRecurrenceChange = (partial: Partial<ActionRecurrence>) => {
        const updatedRecurrence: ActionRecurrence = {
            ...recurrence,
            ...partial
        };
        setActionData({ ...actionData, recurrence: updatedRecurrence });
    };

    const toggleWeekday = (dayNum: number) => {
        const currentDays = recurrence.daysOfWeek || [];
        let newDays: number[];
        if (currentDays.includes(dayNum)) {
            newDays = currentDays.filter(d => d !== dayNum);
            if (newDays.length === 0) newDays = [dayNum]; // Keep at least one
        } else {
            newDays = [...currentDays, dayNum].sort((a, b) => a - b);
        }
        handleRecurrenceChange({ daysOfWeek: newDays });
    };

    const toggleMonth = (mNum: number) => {
        const currentMonths = recurrence.monthsOfYear || [];
        let newMonths: number[];
        if (currentMonths.includes(mNum)) {
            newMonths = currentMonths.filter(m => m !== mNum);
        } else {
            newMonths = [...currentMonths, mNum].sort((a, b) => a - b);
        }
        handleRecurrenceChange({ monthsOfYear: newMonths, allMonths: newMonths.length === 12 });
    };

    const workStatusTranslations: Record<WorkStatus, TranslationKey> = { 'Planning': 'planning', 'In Progress': 'inProgress', 'On Hold': 'onHold', 'Completed': 'completed' };

    const recurrenceSummary = getRecurrenceSummary(recurrence, isFa);

    // Selected user helpers for approver preview
    const respUser = users.find(u => String(u.id) === String(actionData.responsibleUserId));
    const appr1User = users.find(u => String(u.id) === String(actionData.approver1Id ?? actionData.responsibleUserId));
    const appr2User = users.find(u => String(u.id) === String(actionData.approver2Id));
    const appr3User = users.find(u => String(u.id) === String(actionData.approver3Id));

    const getUserDisplayName = (u?: User | null) => {
        if (!u) return isFa ? 'تعیین‌نشده' : 'Unassigned';
        return u.name ? `${u.name} (${u.username})` : u.username;
    };

    return (
        React.createElement("div", { className: "action-form-wrapper" },
            /* Tabs Navigation */
            React.createElement("div", {
                className: "tabs-nav",
                role: "tablist",
                style: {
                    marginBottom: '1.25rem',
                    display: 'flex',
                    gap: '0.5rem',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    paddingBottom: '0.5rem'
                }
            },
                React.createElement("button", {
                    type: "button",
                    id: "tab-action-info-btn",
                    className: `tab-item ${currentTab === 'info' ? 'active' : ''}`,
                    onClick: () => handleTabChange('info'),
                    role: "tab",
                    "aria-selected": currentTab === 'info',
                    style: {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem 1.1rem',
                        cursor: 'pointer',
                        fontWeight: currentTab === 'info' ? 700 : 500,
                        borderRadius: '6px'
                    }
                },
                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem' } }, "assignment"),
                    React.createElement("span", null, t('actionInformation'))
                ),
                React.createElement("button", {
                    type: "button",
                    id: "tab-action-approvers-btn",
                    className: `tab-item ${currentTab === 'approvers' ? 'active' : ''}`,
                    onClick: () => handleTabChange('approvers'),
                    role: "tab",
                    "aria-selected": currentTab === 'approvers',
                    style: {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.55rem 1.1rem',
                        cursor: 'pointer',
                        fontWeight: currentTab === 'approvers' ? 700 : 500,
                        borderRadius: '6px'
                    }
                },
                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem' } }, "verified_user"),
                    React.createElement("span", null, t('approvers')),
                    React.createElement("span", {
                        style: {
                            backgroundColor: currentTab === 'approvers' ? 'var(--primary-color, #2563eb)' : 'var(--bg-card-muted, #e2e8f0)',
                            color: currentTab === 'approvers' ? '#ffffff' : 'var(--text-muted, #64748b)',
                            fontSize: '0.72rem',
                            padding: '0.1rem 0.5rem',
                            borderRadius: '9999px',
                            fontWeight: 700
                        }
                    }, isFa ? '۳ تاییدکننده' : '3 Approvers')
                )
            ),

            /* TAB 1: Action Information */
            currentTab === 'info' && React.createElement(React.Fragment, null,
                /* Informative Banner if Converted from Risk or Stakeholder */
                actionData.sourceInfo && React.createElement("div", {
                className: "action-source-banner",
                style: {
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.85rem 1.1rem',
                    marginBottom: '1.25rem',
                    borderRadius: '8px',
                    backgroundColor: actionData.sourceInfo.type === 'risk' ? '#fff7ed' : '#eff6ff',
                    border: `1px solid ${actionData.sourceInfo.type === 'risk' ? '#fdba74' : '#93c5fd'}`,
                    color: actionData.sourceInfo.type === 'risk' ? '#9a3412' : '#1e40af'
                }
            },
                React.createElement("span", {
                    className: "material-symbols-outlined",
                    style: { fontSize: '1.4rem', color: actionData.sourceInfo.type === 'risk' ? '#ea580c' : '#2563eb', flexShrink: 0, marginTop: '2px' }
                }, actionData.sourceInfo.type === 'risk' ? 'security' : 'group'),
                React.createElement("div", { style: { fontSize: '0.88rem', lineHeight: 1.55 } },
                    React.createElement("div", { style: { fontWeight: 700, marginBottom: '2px' } },
                        actionData.sourceInfo.type === 'risk' 
                            ? (isFa ? 'اطلاعیه: ایجاد اقدام از برنامه پاسخ ریسک پروژه' : 'Notice: Created from Project Risk Response Plan')
                            : (isFa ? 'اطلاعیه: ایجاد اقدام از استراتژی برخورد با ذینفع پروژه' : 'Notice: Created from Stakeholder Engagement Strategy')
                    ),
                    actionData.sourceInfo.type === 'risk' ? (
                        React.createElement("span", null,
                            isFa
                                ? `این اقدام بر اساس برنامه پاسخ ریسک «${actionData.sourceInfo.riskPlan || '-'}» (مربوط به ریسک «${actionData.sourceInfo.riskTitle || '-'}») در پروژه «${actionData.sourceInfo.projectName || '-'}» درج گردیده است. فرآیند تایید این اقدام طبق تنظیمات گردش کار ریسک پروژه عمل خواهد کرد.`
                                : `This action is generated from the risk response plan "${actionData.sourceInfo.riskPlan || '-'}" in project "${actionData.sourceInfo.projectName || '-'}". Approval will follow project risk workflow rules.`
                        )
                    ) : (
                        React.createElement("span", null,
                            isFa
                                ? `این اقدام بر اساس استراتژی برخورد با ذینفع «${actionData.sourceInfo.stakeholderName || '-'}» با الگوی استراتژی «${actionData.sourceInfo.stakeholderStrategy || '-'}» در پروژه «${actionData.sourceInfo.projectName || '-'}» ایجاد شده است. فرآیند تایید این اقدام طبق تنظیمات گردش کار ذینفعان پروژه عمل خواهد کرد.`
                                : `This action is generated from the engagement strategy for stakeholder "${actionData.sourceInfo.stakeholderName || '-'}" in project "${actionData.sourceInfo.projectName || '-'}". Approval will follow stakeholder workflow rules.`
                        )
                    )
                )
            ),

            React.createElement("form", { className: "charter-form", style: { gridTemplateColumns: '1fr 1fr 1fr' } },
                React.createElement("div", { className: "form-group full-width", style: { gridColumn: '1 / -1' } },
                    React.createElement("label", { htmlFor: "title" }, t('actionTitle') + '*'),
                    React.createElement("input", { type: "text", id: "title", name: "title", value: actionData.title || '', onChange: handleChange, required: true, placeholder: isFa ? 'عنوان شفاف اقدام...' : 'Action title...' })
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "action-owner" }, isFa ? 'مالک (ایجادکننده)' : 'Owner (Creator)'),
                    React.createElement("input", { type: "text", id: "action-owner", value: ownerDisplayName, disabled: true, style: { backgroundColor: 'var(--bg-card-muted, #f1f5f9)', cursor: 'not-allowed', opacity: 0.85 } })
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "projectId" }, t('relatedProject')),
                    React.createElement("select", { id: "projectId", name: "projectId", value: actionData.projectId || '', onChange: handleChange, disabled: isProjectLocked },
                        React.createElement("option", { value: "" }, t('none')),
                        projects.filter(p => p.approvalStatus === 'Approved').map(project => (
                            React.createElement("option", { key: project.id, value: project.id }, project.name)
                        ))
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "responsibleUserId" }, t('responsiblePerson') + '*'),
                    React.createElement("select", { id: "responsibleUserId", name: "responsibleUserId", value: actionData.responsibleUserId || '', onChange: handleChange, required: true },
                        React.createElement("option", { value: "" }, t('selectUser')),
                        users.map(user => (
                            React.createElement("option", { key: user.id, value: user.id }, user.name ? `${user.name} (${user.username})` : user.username)
                        ))
                    ),
                    React.createElement("div", { style: { marginTop: '0.35rem', fontSize: '0.78rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.95rem' } }, "verified_user"),
                        React.createElement("span", null, isFa ? 'پیش‌فرض تاییدکننده اول همین کاربر است.' : 'Approver 1 defaults to this user.'),
                        React.createElement("button", {
                            type: "button",
                            onClick: () => handleTabChange('approvers'),
                            style: { background: 'none', border: 'none', color: '#0284c7', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '0.78rem', fontWeight: 600 }
                        }, isFa ? 'تنظیم در تب تاییدکنندگان' : 'Configure in Approvers Tab')
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "status" }, t('status')),
                    React.createElement("select", { id: "status", name: "status", value: actionData.status || 'Planning', disabled: true },
                        Object.keys(workStatusTranslations).map(s => React.createElement("option", { key: s, value: s }, t(workStatusTranslations[s as WorkStatus])))
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "calendarId" }, t('actionCalendar') + '*'),
                    React.createElement("select", { id: "calendarId", name: "calendarId", value: actionData.calendarId || '', onChange: handleChange, required: true },
                        calendars.map(c => (
                            React.createElement("option", { key: c.id, value: c.id }, getCalendarDisplayName(c.name, language))
                        ))
                    )
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "owningUnit" }, t('owningUnit') + '*'),
                    React.createElement(OwningUnitTreeSelect, {
                        id: "owningUnit",
                        value: actionData.owningUnit || '',
                        onChange: (val: string) => setActionData({ ...actionData, owningUnit: val }),
                        owningUnits: owningUnits,
                        placeholder: t('selectAUnit')
                    })
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "startDate" }, t('startDate') + '*'),
                    React.createElement(ShamsiDatePicker, { id: "startDate", name: "startDate", value: actionData.startDate || '', onChange: (val: string) => setActionData({ ...actionData, startDate: val }), required: true })
                ),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "endDate" }, t('endDate') + '*'),
                    React.createElement(ShamsiDatePicker, { id: "endDate", name: "endDate", value: actionData.endDate || '', onChange: (val: string) => setActionData({ ...actionData, endDate: val }), required: true })
                ),

                /* Recurrence Section Card */
                React.createElement("div", {
                    className: "form-group full-width",
                    style: {
                        gridColumn: '1 / -1',
                        backgroundColor: recurrence.isRecurring ? 'rgba(79, 70, 229, 0.04)' : 'var(--bg-card-muted, #f8fafc)',
                        border: recurrence.isRecurring ? '1px solid #c7d2fe' : '1px dashed var(--border-color, #cbd5e1)',
                        borderRadius: '10px',
                        padding: '1.1rem',
                        marginTop: '0.5rem',
                        marginBottom: '0.5rem'
                    }
                },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: recurrence.isRecurring ? '1rem' : 0 } },
                        React.createElement("label", {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.65rem',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                color: recurrence.isRecurring ? '#4338ca' : 'var(--text-color, #1e293b)',
                                margin: 0
                            }
                        },
                            React.createElement("input", {
                                type: "checkbox",
                                checked: !!recurrence.isRecurring,
                                onChange: (e: ChangeEvent<HTMLInputElement>) => handleRecurrenceChange({ isRecurring: e.target.checked }),
                                style: { width: '1.15rem', height: '1.15rem', accentColor: '#4f46e5', cursor: 'pointer' }
                            }),
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.25rem', color: recurrence.isRecurring ? '#4f46e5' : '#64748b' } }, "event_repeat"),
                            React.createElement("span", null, isFa ? 'تعریف به عنوان اقدام تکرارشونده (Recurrence)' : 'Recurring Action Item')
                        ),
                        recurrence.isRecurring && React.createElement("span", {
                            className: "badge badge-info",
                            style: { backgroundColor: '#e0e7ff', color: '#3730a3', fontSize: '0.78rem', padding: '3px 10px', borderRadius: '9999px', fontWeight: 600 }
                        }, isFa ? 'حالت تکرار فعال' : 'Recurrence Enabled')
                    ),

                    recurrence.isRecurring && React.createElement("div", { className: "recurrence-settings-grid", style: { display: 'flex', flexDirection: 'column', gap: '1rem' } },
                        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-start' } },
                            /* Duration in Hours */
                            React.createElement("div", { className: "form-group", style: { margin: 0 } },
                                React.createElement("label", { style: { fontSize: '0.85rem', fontWeight: 600 } }, isFa ? 'مدت زمان هر نوبت (ساعت)*' : 'Duration per Occurrence (Hours)*'),
                                React.createElement("input", {
                                    type: "number",
                                    min: 0.5,
                                    step: 0.5,
                                    value: recurrence.durationHours || 2,
                                    onChange: (e: ChangeEvent<HTMLInputElement>) => handleRecurrenceChange({ durationHours: parseFloat(e.target.value) || 1 }),
                                    style: { width: '100%', padding: '0.45rem 0.65rem' }
                                })
                            ),

                            /* Frequency Type */
                            React.createElement("div", { className: "form-group", style: { margin: 0 } },
                                React.createElement("label", { style: { fontSize: '0.85rem', fontWeight: 600 } }, isFa ? 'بازه تکرار*' : 'Recurrence Frequency*'),
                                React.createElement("select", {
                                    value: recurrence.frequency,
                                    onChange: (e: ChangeEvent<HTMLSelectElement>) => handleRecurrenceChange({ frequency: e.target.value as RecurrenceFrequency }),
                                    style: { width: '100%', padding: '0.45rem 0.65rem' }
                                },
                                    React.createElement("option", { value: "daily" }, isFa ? 'روزانه (Daily)' : 'Daily'),
                                    React.createElement("option", { value: "weekly" }, isFa ? 'هفتگی (Weekly)' : 'Weekly'),
                                    React.createElement("option", { value: "monthly" }, isFa ? 'ماهیانه (Monthly)' : 'Monthly')
                                )
                            ),

                            /* Interval (هر چند روز/هفته/ماه) */
                            React.createElement("div", { className: "form-group", style: { margin: 0 } },
                                React.createElement("label", { style: { fontSize: '0.85rem', fontWeight: 600 } },
                                    recurrence.frequency === 'daily'
                                        ? (isFa ? 'توالی روزها (هر N روز یک‌بار)' : 'Day Interval (Every N days)')
                                        : recurrence.frequency === 'weekly'
                                            ? (isFa ? 'توالی هفته‌ها (هر N هفته یک‌بار)' : 'Week Interval (Every N weeks)')
                                            : (isFa ? 'توالی ماه‌ها (هر N ماه یک‌بار)' : 'Month Interval (Every N months)')
                                ),
                                React.createElement("input", {
                                    type: "number",
                                    min: 1,
                                    max: 30,
                                    value: recurrence.interval || 1,
                                    onChange: (e: ChangeEvent<HTMLInputElement>) => handleRecurrenceChange({ interval: parseInt(e.target.value, 10) || 1 }),
                                    style: { width: '100%', padding: '0.45rem 0.65rem' }
                                })
                            )
                        ),

                        /* Weekly Days Selection */
                        recurrence.frequency === 'weekly' && React.createElement("div", {
                            style: {
                                padding: '0.75rem',
                                backgroundColor: 'var(--bg-card, #ffffff)',
                                border: '1px solid var(--border-color, #e2e8f0)',
                                borderRadius: '8px'
                            }
                        },
                            React.createElement("div", { style: { fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-color, #334155)' } },
                                isFa ? 'انتخاب روزهای هفته جهت اجرای اقدام:' : 'Select days of week for task execution:'
                            ),
                            React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' } },
                                [6, 0, 1, 2, 3, 4, 5].map(dayNum => {
                                    const isSelected = (recurrence.daysOfWeek || []).includes(dayNum);
                                    const label = isFa ? PERSIAN_WEEKDAY_NAMES[dayNum] : (dayNum === 6 ? 'Sat' : dayNum === 0 ? 'Sun' : dayNum === 1 ? 'Mon' : dayNum === 2 ? 'Tue' : dayNum === 3 ? 'Wed' : dayNum === 4 ? 'Thu' : 'Fri');
                                    return React.createElement("button", {
                                        key: dayNum,
                                        type: "button",
                                        onClick: () => toggleWeekday(dayNum),
                                        style: {
                                            padding: '0.35rem 0.75rem',
                                            borderRadius: '6px',
                                            border: isSelected ? '1px solid #4f46e5' : '1px solid var(--border-color, #cbd5e1)',
                                            backgroundColor: isSelected ? '#4f46e5' : 'var(--bg-card-muted, #f8fafc)',
                                            color: isSelected ? '#ffffff' : 'var(--text-color, #334155)',
                                            fontWeight: isSelected ? 600 : 400,
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }
                                    }, label);
                                })
                            )
                        ),

                        /* Monthly Specific Day and Months Selection */
                        recurrence.frequency === 'monthly' && React.createElement("div", {
                            style: {
                                padding: '0.75rem',
                                backgroundColor: 'var(--bg-card, #ffffff)',
                                border: '1px solid var(--border-color, #e2e8f0)',
                                borderRadius: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem'
                            }
                        },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' } },
                                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                                    React.createElement("span", { style: { fontSize: '0.85rem', fontWeight: 600 } }, isFa ? 'روز چندم ماه:' : 'Day of Month:'),
                                    React.createElement("input", {
                                        type: "number",
                                        min: 1,
                                        max: 31,
                                        value: recurrence.dayOfMonth || 1,
                                        onChange: (e: ChangeEvent<HTMLInputElement>) => handleRecurrenceChange({ dayOfMonth: parseInt(e.target.value, 10) || 1 }),
                                        style: { width: '70px', padding: '0.3rem 0.5rem' }
                                    })
                                ),
                                React.createElement("button", {
                                    type: "button",
                                    onClick: () => handleRecurrenceChange({ allMonths: !recurrence.allMonths, monthsOfYear: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }),
                                    style: {
                                        padding: '0.3rem 0.65rem',
                                        fontSize: '0.8rem',
                                        borderRadius: '6px',
                                        border: '1px solid #93c5fd',
                                        backgroundColor: recurrence.allMonths ? '#eff6ff' : 'transparent',
                                        color: '#1d4ed8',
                                        cursor: 'pointer'
                                    }
                                }, recurrence.allMonths ? (isFa ? '✓ تمام ۱۲ ماه سال' : '✓ All 12 Months') : (isFa ? 'انتخاب ماه‌های خاص' : 'Select Specific Months'))
                            ),

                            !recurrence.allMonths && React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem' } },
                                    isFa ? 'ماه‌های فعال جهت اجرای اقدام:' : 'Active months for recurrence:'
                                ),
                                React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' } },
                                    Array.from({ length: 12 }, (_, i) => i + 1).map(mNum => {
                                        const isSelected = (recurrence.monthsOfYear || []).includes(mNum);
                                        const mName = isFa ? PERSIAN_MONTH_NAMES[mNum - 1] : `M${mNum}`;
                                        return React.createElement("button", {
                                            key: mNum,
                                            type: "button",
                                            onClick: () => toggleMonth(mNum),
                                            style: {
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: '5px',
                                                border: isSelected ? '1px solid #2563eb' : '1px solid var(--border-color, #cbd5e1)',
                                                backgroundColor: isSelected ? '#2563eb' : 'var(--bg-card-muted, #f8fafc)',
                                                color: isSelected ? '#ffffff' : 'var(--text-color, #334155)',
                                                fontSize: '0.78rem',
                                                cursor: 'pointer'
                                            }
                                        }, mName);
                                    })
                                )
                            )
                        ),

                        /* Recurrence Summary Box */
                        React.createElement("div", {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.65rem 0.9rem',
                                backgroundColor: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: '6px',
                                color: '#166534',
                                fontSize: '0.85rem',
                                fontWeight: 500
                            }
                        },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem', color: '#16a34a' } }, "info"),
                            React.createElement("span", null, isFa ? `خلاصه الگوی تکرار: ${recurrenceSummary}` : `Recurrence Summary: ${recurrenceSummary}`)
                        )
                    )
                ),

                React.createElement("div", { className: "form-group full-width", style: { gridColumn: '1 / -1' } },
                    React.createElement("label", { htmlFor: "description" }, t('actionDescription')),
                    React.createElement("textarea", {
                        id: "description",
                        name: "description",
                        value: actionData.description || '',
                        onChange: handleChange,
                        rows: 3,
                        placeholder: isFa ? 'شرح و جزئیات اقدام...' : 'Action details & specifications...'
                    })
                )
            )),

            /* TAB 2: Approvers Configuration */
            currentTab === 'approvers' && React.createElement("div", {
                className: "approvers-tab-content",
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    padding: '0.25rem 0'
                }
            },
                /* Guide Banner */
                React.createElement("div", {
                    style: {
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.85rem',
                        padding: '1rem 1.25rem',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(2, 132, 199, 0.08)',
                        border: '1px solid rgba(2, 132, 199, 0.25)',
                        color: 'var(--text-color, #0f172a)'
                    }
                },
                    React.createElement("span", {
                        className: "material-symbols-outlined",
                        style: { fontSize: '1.75rem', color: '#0284c7', flexShrink: 0, marginTop: '2px' }
                    }, "verified_user"),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontWeight: 700, fontSize: '0.98rem', marginBottom: '0.3rem', color: '#0369a1' } },
                            isFa ? 'پیکربندی تاییدکنندگان اقدام (گردش کار ۳ مرحله‌ای)' : 'Action Approvers Configuration (3-Stage Workflow)'
                        ),
                        React.createElement("div", { style: { fontSize: '0.86rem', color: 'var(--text-muted, #475569)', lineHeight: 1.6 } },
                            isFa
                                ? 'برای این اقدام می‌توانید تا ۳ مرحله تاییدکننده تعریف نمایید. تاییدکننده اول به صورت پیش‌فرض همان مسئول اقدام است. پس از ثبت تغییر وضعیت در کارتابل وظایف، درخواست تایید به ترتیب مراحل بین تاییدکنندگان مشخص‌شده به گردش درمی‌آید.'
                                : 'You can define up to 3 approvers for this action. Approver 1 defaults to the action responsible person. Status updates submitted in the Cartable will route sequentially through these approvers.'
                        )
                    )
                ),

                /* 3 Approvers Cards Grid */
                React.createElement("div", {
                    style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: '1.1rem'
                    }
                },
                    /* Approver 1 Card */
                    React.createElement("div", {
                        style: {
                            padding: '1.1rem',
                            borderRadius: '10px',
                            border: '1px solid #93c5fd',
                            backgroundColor: 'rgba(239, 246, 255, 0.6)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                        }
                    },
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                                React.createElement("span", {
                                    style: {
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: '#0284c7',
                                        color: '#ffffff',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.82rem',
                                        fontWeight: 700
                                    }
                                }, "۱"),
                                React.createElement("span", { style: { fontWeight: 700, fontSize: '0.92rem', color: '#0369a1' } }, t('approver1') + '*')
                            ),
                            React.createElement("span", {
                                style: {
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '9999px',
                                    backgroundColor: (actionData.approver1Id ?? actionData.responsibleUserId) === actionData.responsibleUserId ? '#dbeafe' : '#f1f5f9',
                                    color: (actionData.approver1Id ?? actionData.responsibleUserId) === actionData.responsibleUserId ? '#1d4ed8' : '#475569'
                                }
                            }, isFa ? ((actionData.approver1Id ?? actionData.responsibleUserId) === actionData.responsibleUserId ? 'پیش‌فرض: مسئول اقدام' : 'سفارشی') : 'Default: Responsible')
                        ),
                        React.createElement("div", { className: "form-group", style: { margin: 0 } },
                            React.createElement("label", { htmlFor: "approver1Id", style: { fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' } },
                                isFa ? 'انتخاب تاییدکننده اول:' : 'Select Approver 1:'
                            ),
                            React.createElement("select", {
                                id: "approver1Id",
                                name: "approver1Id",
                                value: actionData.approver1Id ?? actionData.responsibleUserId ?? '',
                                onChange: handleChange,
                                required: true,
                                style: { width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #93c5fd', backgroundColor: '#ffffff' }
                            },
                                React.createElement("option", { value: "" }, t('selectUser')),
                                users.map(user => (
                                    React.createElement("option", { key: user.id, value: user.id },
                                        `${user.name ? `${user.name} (${user.username})` : user.username}${String(user.id) === String(actionData.responsibleUserId) ? (isFa ? ' - (مسئول اقدام)' : ' - (Responsible)') : ''}`
                                    )
                                ))
                            )
                        ),
                        React.createElement("div", { style: { fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 } },
                            isFa 
                                ? 'درخواست اولیه تغییر وضعیت اقدام در کارتابل به این کاربر ارسال می‌گردد.'
                                : 'Initial status change request routes directly to this user.'
                        )
                    ),

                    /* Approver 2 Card */
                    React.createElement("div", {
                        style: {
                            padding: '1.1rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color, #cbd5e1)',
                            backgroundColor: actionData.approver2Id ? 'rgba(240, 253, 244, 0.6)' : 'var(--bg-card, #ffffff)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                        }
                    },
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                                React.createElement("span", {
                                    style: {
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: actionData.approver2Id ? '#16a34a' : '#64748b',
                                        color: '#ffffff',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.82rem',
                                        fontWeight: 700
                                    }
                                }, "۲"),
                                React.createElement("span", { style: { fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-color, #0f172a)' } }, t('approver2'))
                            ),
                            React.createElement("span", {
                                style: {
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '9999px',
                                    backgroundColor: actionData.approver2Id ? '#dcfce7' : '#f1f5f9',
                                    color: actionData.approver2Id ? '#15803d' : '#64748b'
                                }
                            }, actionData.approver2Id ? (isFa ? 'فعال' : 'Active') : (isFa ? 'اختیاری' : 'Optional'))
                        ),
                        React.createElement("div", { className: "form-group", style: { margin: 0 } },
                            React.createElement("label", { htmlFor: "approver2Id", style: { fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' } },
                                isFa ? 'انتخاب تاییدکننده دوم:' : 'Select Approver 2:'
                            ),
                            React.createElement("select", {
                                id: "approver2Id",
                                name: "approver2Id",
                                value: actionData.approver2Id || '',
                                onChange: handleChange,
                                style: { width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', backgroundColor: '#ffffff' }
                            },
                                React.createElement("option", { value: "" }, isFa ? 'هیچ‌کدام (بدون تاییدکننده دوم)' : 'None (No Approver 2)'),
                                users.map(user => (
                                    React.createElement("option", { key: user.id, value: user.id }, user.name ? `${user.name} (${user.username})` : user.username)
                                ))
                            )
                        ),
                        React.createElement("div", { style: { fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.5 } },
                            isFa 
                                ? 'در صورت تعیین، پس از تایید توسط تاییدکننده اول، درخواست جهت تایید مرحله ۲ به این کاربر ارجاع خواهد شد.'
                                : 'If specified, routes to this user after Approver 1 approves.'
                        )
                    ),

                    /* Approver 3 Card */
                    React.createElement("div", {
                        style: {
                            padding: '1.1rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color, #cbd5e1)',
                            backgroundColor: actionData.approver3Id ? 'rgba(250, 245, 255, 0.6)' : 'var(--bg-card, #ffffff)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                        }
                    },
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                                React.createElement("span", {
                                    style: {
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: actionData.approver3Id ? '#9333ea' : '#64748b',
                                        color: '#ffffff',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.82rem',
                                        fontWeight: 700
                                    }
                                }, "۳"),
                                React.createElement("span", { style: { fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-color, #0f172a)' } }, t('approver3'))
                            ),
                            React.createElement("span", {
                                style: {
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '9999px',
                                    backgroundColor: actionData.approver3Id ? '#f3e8ff' : '#f1f5f9',
                                    color: actionData.approver3Id ? '#7e22ce' : '#64748b'
                                }
                            }, actionData.approver3Id ? (isFa ? 'تایید نهایی' : 'Final Approver') : (isFa ? 'اختیاری' : 'Optional'))
                        ),
                        React.createElement("div", { className: "form-group", style: { margin: 0 } },
                            React.createElement("label", { htmlFor: "approver3Id", style: { fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.35rem' } },
                                isFa ? 'انتخاب تاییدکننده سوم:' : 'Select Approver 3:'
                            ),
                            React.createElement("select", {
                                id: "approver3Id",
                                name: "approver3Id",
                                value: actionData.approver3Id || '',
                                onChange: handleChange,
                                style: { width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', backgroundColor: '#ffffff' }
                            },
                                React.createElement("option", { value: "" }, isFa ? 'هیچ‌کدام (بدون تاییدکننده سوم)' : 'None (No Approver 3)'),
                                users.map(user => (
                                    React.createElement("option", { key: user.id, value: user.id }, user.name ? `${user.name} (${user.username})` : user.username)
                                ))
                            )
                        ),
                        React.createElement("div", { style: { fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.5 } },
                            isFa 
                                ? 'در صورت تعیین، تایید نهایی و اعمال وضعیت اقدام پس از تایید توسط این کاربر انجام می‌گیرد.'
                                : 'If specified, final status approval completes after this user reviews.'
                        )
                    )
                ),

                /* Visual Sequential Workflow Preview */
                React.createElement("div", {
                    style: {
                        padding: '1.1rem',
                        backgroundColor: 'var(--bg-card-muted, #f8fafc)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '10px'
                    }
                },
                    React.createElement("div", { style: { fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.85rem', color: 'var(--text-color, #0f172a)', display: 'flex', alignItems: 'center', gap: '0.4rem' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem', color: '#0284c7' } }, "alt_route"),
                        React.createElement("span", null, isFa ? 'پیش‌نمایش مسیر گردش کار تایید تغییر وضعیت اقدام:' : 'Action Status Approval Route Preview:')
                    ),
                    React.createElement("div", {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.6rem',
                            fontSize: '0.84rem'
                        }
                    },
                        /* Step 0: Submitter / Responsible */
                        React.createElement("div", {
                            style: {
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.45rem 0.75rem',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }
                        },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem', color: '#475569' } }, "person"),
                            React.createElement("span", null, isFa ? `ثبت در کارتابل: ${getUserDisplayName(respUser)}` : `Submitter: ${getUserDisplayName(respUser)}`)
                        ),

                        React.createElement("span", { className: "material-symbols-outlined", style: { color: '#94a3b8', fontSize: '1.2rem' } }, isFa ? "arrow_back" : "arrow_forward"),

                        /* Step 1: Approver 1 */
                        React.createElement("div", {
                            style: {
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.45rem 0.75rem',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #93c5fd',
                                borderRadius: '8px',
                                color: '#1d4ed8',
                                fontWeight: 600,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }
                        },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem', color: '#2563eb' } }, "looks_one"),
                            React.createElement("span", null, isFa ? `تاییدکننده ۱: ${getUserDisplayName(appr1User)}` : `Approver 1: ${getUserDisplayName(appr1User)}`)
                        ),

                        /* Step 2: Approver 2 (if present) */
                        actionData.approver2Id ? React.createElement(React.Fragment, null,
                            React.createElement("span", { className: "material-symbols-outlined", style: { color: '#94a3b8', fontSize: '1.2rem' } }, isFa ? "arrow_back" : "arrow_forward"),
                            React.createElement("div", {
                                style: {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.45rem 0.75rem',
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #86efac',
                                    borderRadius: '8px',
                                    color: '#15803d',
                                    fontWeight: 600,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }
                            },
                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem', color: '#16a34a' } }, "looks_two"),
                                React.createElement("span", null, isFa ? `تاییدکننده ۲: ${getUserDisplayName(appr2User)}` : `Approver 2: ${getUserDisplayName(appr2User)}`)
                            )
                        ) : null,

                        /* Step 3: Approver 3 (if present) */
                        actionData.approver3Id ? React.createElement(React.Fragment, null,
                            React.createElement("span", { className: "material-symbols-outlined", style: { color: '#94a3b8', fontSize: '1.2rem' } }, isFa ? "arrow_back" : "arrow_forward"),
                            React.createElement("div", {
                                style: {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.45rem 0.75rem',
                                    backgroundColor: '#faf5ff',
                                    border: '1px solid #d8b4fe',
                                    borderRadius: '8px',
                                    color: '#7e22ce',
                                    fontWeight: 600,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }
                            },
                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem', color: '#9333ea' } }, "looks_3"),
                                React.createElement("span", null, isFa ? `تاییدکننده ۳: ${getUserDisplayName(appr3User)}` : `Approver 3: ${getUserDisplayName(appr3User)}`)
                            )
                        ) : null,

                        React.createElement("span", { className: "material-symbols-outlined", style: { color: '#94a3b8', fontSize: '1.2rem' } }, isFa ? "arrow_back" : "arrow_forward"),

                        /* Final: Approved */
                        React.createElement("div", {
                            style: {
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.45rem 0.75rem',
                                backgroundColor: '#ecfdf5',
                                border: '1px solid #6ee7b7',
                                borderRadius: '8px',
                                color: '#047857',
                                fontWeight: 700,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }
                        },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem', color: '#059669' } }, "check_circle"),
                            React.createElement("span", null, isFa ? 'تایید نهایی و اعمال وضعیت' : 'Final Approval & Status Application')
                        )
                    )
                )
            )
        )
    );
};