

import React, { useContext, useState, useMemo, useEffect, useCallback, SetStateAction, Dispatch, FormEvent, ChangeEvent, MouseEvent, ReactElement, Fragment } from 'react';
import { LocalizationContext, ThemeContext, ColorScheme } from '../context';
import { 
    Project, Calendar, Strategy, AlignmentLevel, ProjectStrategyAlignment, TranslationKey, SpecificHoliday, KnowledgeDocument, KnowledgeDocumentType, WorkStatus, OwningUnitTreeNode
} from '../types';
import { getISODateString, formatDate, getJalaliInfo, toGregorian, toPersianDigits, getCalendarDisplayName } from '../utils';
import { useDirectory } from '../directory/DirectoryContext';
import type { Outcome } from '../directory/DirectoryContext';
import { calendars as calendarsApi } from '../services/backend/directory';
import { HolidayReasonModal, SpecificHolidaysListModal } from '../components/Modals';
import { ProgressBar } from '../components/Indicators';

// --- CalendarManagementPage & EditCalendarPage ---
export const CalendarManagementPage = ({ calendars, onNavigate, onDelete }: {
    calendars: Calendar[],
    onNavigate: (page: string, context?: any) => void,
    /** Deletes through the backend, which refuses the default calendar and any calendar still in use. */
    onDelete: (id: string) => Promise<Outcome>
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    const handleDelete = async (calendar: Calendar) => {
        if (window.confirm(t('confirmCalendarDelete'))) {
            const outcome = await onDelete(calendar.id);
            if (!outcome.ok) alert(outcome.message ?? t('error'));
        }
    };
    
    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('calendarManagement')),
                React.createElement("div", { className: "page-header-actions" },
                    React.createElement("button", { onClick: () => onNavigate('edit_calendar'), className: "action-button" } as React.HTMLAttributes<HTMLButtonElement>,
                        React.createElement("span", { className: "material-symbols-outlined" }, "add"),
                        t('newCalendar')
                    )
                )
            ),
            React.createElement("div", { className: "table-responsive" },
              React.createElement("table", { className: "users-table" },
                  React.createElement("thead", null,
                      React.createElement("tr", null,
                          React.createElement("th", null, t('name')),
                          React.createElement("th", { className: "th-actions no-print" }, t('actions'))
                      )
                  ),
                  React.createElement("tbody", null,
                      calendars.map(cal => (
                          React.createElement("tr", { key: cal.id },
                              React.createElement("td", null, getCalendarDisplayName(cal.name, language)),
                              React.createElement("td", { className: "action-cell no-print" },
                                  React.createElement("button", { onClick: () => onNavigate('edit_calendar', { calendar: cal }), className: "action-icon edit", "aria-label": t('edit') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),
                                  React.createElement("button", { onClick: () => handleDelete(cal), className: "action-icon delete", "aria-label": t('delete') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                              )
                          )
                      ))
                  )
              )
            )
        )
    );
};

export const EditCalendarPage = ({ onNavigate, onSave, existingCalendar }: { 
    onNavigate: (page: string, context?: any) => void,
    onSave: (calendar: Calendar) => Promise<Outcome>,
    existingCalendar?: Calendar | null 
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [calendar, setCalendar] = useState<Calendar>(
        existingCalendar || { id: '', name: '', workingDays: [6, 0, 1, 2, 3], specificHolidays: [], applyOfficialHolidays: true }
    );
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
    const [isHolidaysListModalOpen, setIsHolidaysListModalOpen] = useState(false);
    const [selectedDateForHoliday, setSelectedDateForHoliday] = useState<string | null>(null);

    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';
    const isShamsi = language === 'fa';

    const dayNames = useMemo(() => (
        isShamsi 
            ? [t('Saturday'), t('Sunday'), t('Monday'), t('Tuesday'), t('Wednesday'), t('Thursday'), t('Friday')]
            : [t('Sunday'), t('Monday'), t('Tuesday'), t('Wednesday'), t('Thursday'), t('Friday'), t('Saturday')]
    ), [t, isShamsi]);
    
    const monthNames = useMemo(() => (
        isShamsi
            ? ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
            : [t('January'), t('February'), t('March'), t('April'), t('May'), t('June'), t('July'), t('August'), t('September'), t('October'), t('November'), t('December')]
    ), [t, isShamsi]);
    
    const [saving, setSaving] = useState(false);
    // Official holidays of the month on screen, as the backend knows them.
    const [officialHolidays, setOfficialHolidays] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        let cancelled = false;
        const from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        from.setDate(from.getDate() - 40);
        const to = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        to.setDate(to.getDate() + 75);
        calendarsApi.officialHolidays(getISODateString(from), getISODateString(to)).then(result => {
            if (!cancelled && result.ok) setOfficialHolidays(new Map((result.value ?? []).map(h => [h.date, h.reason])));
        });
        return () => { cancelled = true; };
    }, [currentDate]);

    const handleSave = async () => {
        if(!calendar.name.trim()){
            alert(t('fillRequiredFields'));
            return;
        }
        setSaving(true);
        const outcome = await onSave(calendar);
        setSaving(false);
        if (!outcome.ok) {
            alert(outcome.message ?? t('error'));
            return;
        }
        onNavigate('calendar_management');
    }
    
    const toggleWorkingDay = (dayIndex: number) => {
        const jsDayIndex = isShamsi ? (dayIndex + 6) % 7 : dayIndex; // Sat=0 -> 6, Sun=1 -> 0
        setCalendar(prev => {
            const newWorkingDays = prev.workingDays.includes(jsDayIndex)
                ? prev.workingDays.filter(d => d !== jsDayIndex)
                : [...prev.workingDays, jsDayIndex];
            return { ...prev, workingDays: newWorkingDays.sort() };
        });
    };
    
    const handleDayClick = (date: Date) => {
        const dateString = getISODateString(date);
        const existingHoliday = calendar.specificHolidays.find(h => h.date === dateString);

        if (existingHoliday) { // If it's a holiday, remove it
            setCalendar(prev => ({
                ...prev,
                specificHolidays: prev.specificHolidays.filter(h => h.date !== dateString)
            }));
        } else { // If not a holiday, open modal to add it
            setSelectedDateForHoliday(dateString);
            setIsReasonModalOpen(true);
        }
    };
    
    const saveSpecificHoliday = (reason: string) => {
        if (selectedDateForHoliday) {
            setCalendar(prev => ({
                ...prev,
                specificHolidays: [...prev.specificHolidays, { date: selectedDateForHoliday, reason }]
            }));
        }
        setIsReasonModalOpen(false);
        setSelectedDateForHoliday(null);
    };

    const changeMonth = (amount: number) => {
        setCurrentDate(prev => {
            if (isShamsi) {
                const { jYear, jMonth } = getJalaliInfo(prev);
                let newJMonth = jMonth + amount;
                let newJYear = jYear;
                if (newJMonth > 12) {
                    newJMonth = 1;
                    newJYear++;
                } else if (newJMonth < 1) {
                    newJMonth = 12;
                    newJYear--;
                }
                const g = toGregorian(newJYear, newJMonth, 1);
                return new Date(g.gy, g.gm - 1, g.gd);
            } else {
                return new Date(prev.getFullYear(), prev.getMonth() + amount, 1);
            }
        });
    };

    const renderCalendar = () => {
        let year, month, firstDayOfWeek, daysInMonth;

        if (isShamsi) {
            const jalaliInfo = getJalaliInfo(currentDate);
            year = jalaliInfo.jYear;
            month = jalaliInfo.jMonth;
            daysInMonth = jalaliInfo.daysInMonth;
            firstDayOfWeek = (jalaliInfo.firstDayOfWeek + 1) % 7; // Convert to Sat=0
        } else {
            year = currentDate.getFullYear();
            month = currentDate.getMonth();
            daysInMonth = new Date(year, month + 1, 0).getDate();
            firstDayOfWeek = new Date(year, month, 1).getDay(); // Sun=0
        }

        const cells = [];
        for (let i = 0; i < firstDayOfWeek; i++) {
            cells.push(React.createElement("div", { key: `empty-${i}`, className: "calendar-cell other-month" }));
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let day = 1; day <= daysInMonth; day++) {
            let date;
            if (isShamsi) {
                const g = toGregorian(year, month, day);
                date = new Date(g.gy, g.gm - 1, g.gd);
            } else {
                date = new Date(year, month, day);
            }

            const dateString = getISODateString(date);
            const isWeeklyHoliday = !calendar.workingDays.includes(date.getDay());
            const specificHoliday = calendar.specificHolidays.find(h => h.date === dateString);
            const officialHolidayReason = calendar.applyOfficialHolidays !== false ? (officialHolidays.get(dateString) ?? null) : null;
            const isHoliday = isWeeklyHoliday || !!specificHoliday || !!officialHolidayReason;

            const classes = [
                'calendar-cell',
                isHoliday ? 'holiday-cell' : '',
                (specificHoliday || officialHolidayReason) ? 'specific-holiday-cell' : '',
                date.getTime() === today.getTime() ? 'today-cell' : ''
            ].filter(Boolean).join(' ');

            const tooltipText = specificHoliday?.reason || officialHolidayReason || '';

            cells.push(
                React.createElement("div", { key: day, className: classes, onClick: () => handleDayClick(date), title: tooltipText } as React.HTMLAttributes<HTMLDivElement>,
                    React.createElement("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', minWidth: 0 } },
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.25rem' } },
                            React.createElement("span", { style: { fontWeight: 'bold' } }, day),
                            (specificHoliday || officialHolidayReason) && React.createElement("span", { className: "holiday-dot-inline" })
                        ),
                        (officialHolidayReason || specificHoliday?.reason) && React.createElement("div", {
                            style: {
                                fontSize: '0.62rem',
                                color: '#dc3545',
                                lineHeight: '1.2',
                                overflow: 'hidden',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                maxWidth: '100%',
                                alignSelf: 'stretch',
                                fontWeight: '500'
                            }
                        }, officialHolidayReason || specificHoliday?.reason)
                    )
                )
            );
        }
        return cells;
    };


    return (
        React.createElement("div", { className: "content-container" },
            isReasonModalOpen && selectedDateForHoliday && (
                React.createElement(HolidayReasonModal, {
                    date: formatDate(selectedDateForHoliday, language),
                    onSave: saveSpecificHoliday,
                    onClose: () => setIsReasonModalOpen(false)
                })
            ),
             isHolidaysListModalOpen && (
                React.createElement(SpecificHolidaysListModal, {
                    holidays: calendar.specificHolidays,
                    onClose: () => setIsHolidaysListModalOpen(false)
                })
            ),
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, existingCalendar ? t('editCalendar') : t('newCalendar')),
                React.createElement("button", { onClick: () => onNavigate('calendar_management'), className: "back-button" } as React.HTMLAttributes<HTMLButtonElement>,
                    React.createElement("span", { className: "material-symbols-outlined" }, backIcon),
                    t('backToCalendars')
                )
            ),
            React.createElement("div", { className: "edit-calendar-container" },
                React.createElement("div", { className: "calendar-sidebar" },
                    React.createElement("div", null, 
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "calendarName" }, t('calendarName') + '*'),
                            React.createElement("input", { type: "text", id: "calendarName", value: calendar.name, onChange: (e: ChangeEvent<HTMLInputElement>) => setCalendar({...calendar, name: e.target.value}) })
                        ),
                        React.createElement("h4", null, t('workingDays')),
                        React.createElement("div", { className: "weekly-holiday-toggle" },
                            dayNames.map((day, index) => {
                                const jsDayIndex = isShamsi ? (index + 6) % 7 : index;
                                return React.createElement("label", { key: day },
                                    React.createElement("input", { type: "checkbox", checked: calendar.workingDays.includes(jsDayIndex), onChange: () => toggleWorkingDay(index) }),
                                    day
                                )
                            })
                        ),
                        React.createElement("div", { className: "form-group", style: { marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                            React.createElement("input", {
                                type: "checkbox",
                                id: "applyOfficialHolidays",
                                checked: calendar.applyOfficialHolidays !== false,
                                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCalendar({ ...calendar, applyOfficialHolidays: e.target.checked }),
                                style: { width: 'auto', margin: 0, cursor: 'pointer' }
                            }),
                            React.createElement("label", { htmlFor: "applyOfficialHolidays", style: { margin: 0, fontWeight: '500', cursor: 'pointer' } }, 
                                language === 'fa' ? 'اعمال تعطیلات رسمی' : 'Apply Official Holidays'
                            )
                        )
                    ),
                    React.createElement("div", { className: "calendar-sidebar-actions" },
                        React.createElement("button", { onClick: () => setIsHolidaysListModalOpen(true), className: "action-button" } as React.HTMLAttributes<HTMLButtonElement>, t('holidays')),
                        React.createElement("button", { onClick: handleSave, className: "save-btn", disabled: saving } as React.HTMLAttributes<HTMLButtonElement>, t('save'))
                    )
                ),
                React.createElement("div", { className: "calendar-main" },
                     React.createElement("div", { className: "calendar-header" },
                        React.createElement("button", { onClick: () => changeMonth(-1) } as React.HTMLAttributes<HTMLButtonElement>, "<"),
                        React.createElement("span", null, `${monthNames[isShamsi ? getJalaliInfo(currentDate).jMonth - 1 : currentDate.getMonth()]} ${isShamsi ? getJalaliInfo(currentDate).jYear : currentDate.getFullYear()}`),
                        React.createElement("button", { onClick: () => changeMonth(1) } as React.HTMLAttributes<HTMLButtonElement>, ">")
                    ),
                    React.createElement("div", { className: "calendar-grid days-header" },
                        dayNames.map(day => React.createElement("div", { key: day, className: "calendar-cell day-header" }, day))
                    ),
                    React.createElement("div", { className: "calendar-grid" },
                        renderCalendar()
                    )
                )
            )
        )
    );
};

interface FlatWbsUnitNode {
    id: string;
    name: string;
    parentId: string | null;
    parentName?: string;
    fullPath?: string;
    wbsCode: string;
    level: number;
}

export const ReferenceTablesPage = ({
    projectStatuses,
    onNavigate
}: {
    projectStatuses: string[];
    onNavigate: (page: string) => void;
}) => {
    const { t, language } = useContext(LocalizationContext);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    // The organisation chart lives in the backend: every change below is sent there and the tree is read back.
    const { unitNodes, createUnit, renameUnit, deleteUnit } = useDirectory();

    // State for new root unit input
    const [newRootUnitName, setNewRootUnitName] = useState('');

    // State for expanded/collapsed nodes (Level 2 closed by default)
    const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set());

    const toggleExpandUnit = (id: string) => {
        setExpandedUnitIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleExpandAllUnits = () => {
        const allParentIds = new Set(unitNodes.map(n => n.id));
        setExpandedUnitIds(allParentIds);
    };

    const handleCollapseAllUnits = () => {
        setExpandedUnitIds(new Set());
    };
    const [addingChildToId, setAddingChildToId] = useState<string | null>(null);
    const [newChildName, setNewChildName] = useState('');
    const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
    const [editingUnitName, setEditingUnitName] = useState('');

    // Project Statuses State

    const workStatusTranslations: Record<string, TranslationKey> = { 
        'Planning': 'planning', 
        'In Progress': 'inProgress', 
        'On Hold': 'onHold', 
        'Completed': 'completed' 
    };

    // Calculate flat WBS nodes
    const flatWbsUnits = useMemo(() => {
        const flatList: FlatWbsUnitNode[] = [];
        
        const getChildren = (pId: string | null) => unitNodes.filter(n => n.parentId === pId);

        const processNode = (node: OwningUnitTreeNode, parentWbs: string, level: number, parentName?: string, parentPath?: string, indexInSiblings: number = 0) => {
            const currentWbs = parentWbs ? `${parentWbs}.${indexInSiblings + 1}` : `${indexInSiblings + 1}`;
            const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
            flatList.push({
                id: node.id,
                name: node.name,
                parentId: node.parentId,
                parentName,
                fullPath: currentPath,
                wbsCode: currentWbs,
                level
            });

            const children = getChildren(node.id);
            children.forEach((child, idx) => {
                processNode(child, currentWbs, level + 1, node.name, currentPath, idx);
            });
        };

        const rootNodes = getChildren(null);
        rootNodes.forEach((root, idx) => {
            processNode(root, '', 1, undefined, undefined, idx);
        });

        return flatList;
    }, [unitNodes]);

    // Handlers for Unit Tree
    const report = (outcome: Outcome) => {
        if (!outcome.ok) alert(outcome.message ?? 'عملیات انجام نشد.');
        return outcome.ok;
    };

    const handleAddRootUnit = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newRootUnitName.trim();
        if (!name) return;
        if (report(await createUnit(name, null))) setNewRootUnitName('');
    };

    const handleSaveChildUnit = async (parentId: string) => {
        const name = newChildName.trim();
        if (!name) return;
        if (report(await createUnit(name, parentId))) {
            setAddingChildToId(null);
            setNewChildName('');
        }
    };

    const handleSaveEditUnit = async (id: string) => {
        const name = editingUnitName.trim();
        if (!name) return;
        if (report(await renameUnit(id, name))) {
            setEditingUnitId(null);
            setEditingUnitName('');
        }
    };

    const handleDeleteUnitNode = async (id: string, name: string) => {
        if (window.confirm(`آیا از حذف واحد/زیرگروه «${name}» و تمامی زیرگروه‌های آن اطمینان دارید؟`)) {
            report(await deleteUnit(id));
        }
    };

    
    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('defineTables'))
            ),

            React.createElement("div", { className: "team-management-grid", style: { gridTemplateColumns: '1fr', gap: '1.5rem' } },
                // Owning Units Section
                React.createElement("div", { className: "form-section", style: { marginTop: 0 } },
                    React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' } },
                        React.createElement("div", null,
                            React.createElement("h3", { style: { margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                                React.createElement("span", { className: "material-symbols-outlined", style: { color: '#2563eb' } }, "account_tree"),
                                language === 'fa' ? 'واحد سازمانی (ساختار شکست سازمانی)' : 'Organizational Unit Breakdown Structure'
                            ),
                            React.createElement("p", { style: { margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#64748b' } },
                                "در این بخش می‌توانید واحدهای اصلی و زیرگروه‌های تخصصی آن‌ها (سطح ۱ و سطح ۲) را به صورت درختی و ساختار شکست سازمانی مدیریت نمایید."
                            )
                        ),
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                            React.createElement("button", {
                                type: "button",
                                onClick: handleExpandAllUnits,
                                className: "action-button",
                                style: { padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }
                            },
                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "unfold_more"),
                                language === 'fa' ? 'باز کردن همه' : 'Expand All'
                            ),
                            React.createElement("button", {
                                type: "button",
                                onClick: handleCollapseAllUnits,
                                className: "cancel-btn",
                                style: { padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }
                            },
                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "unfold_less"),
                                language === 'fa' ? 'بستن همه (پیش‌فرض)' : 'Collapse All'
                            )
                        )
                    ),

                    React.createElement("form", { onSubmit: handleAddRootUnit, className: "inline-form", style: { marginBottom: '1.25rem' } },
                        React.createElement("input", {
                            type: "text",
                            value: newRootUnitName,
                            onChange: (e) => setNewRootUnitName(e.target.value),
                            placeholder: "عنوان واحد اصلی جدید (سطح ۱)...",
                            "aria-label": "عنوان واحد اصلی جدید"
                        }),
                        React.createElement("button", { type: "submit", className: "action-button", style: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem' } },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.1rem' } }, "add"),
                            language === 'fa' ? 'افزودن' : t('add')
                        )
                    ),

                    React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } },
                        flatWbsUnits.length === 0 ? (
                            React.createElement("div", { style: { padding: '1.5rem', textAlign: 'center', color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.85rem' } },
                                "هیچ واحد سازمانی ثبت نشده است. از فرم بالا واحد اصلی جدید اضافه کنید."
                            )
                        ) : (
                            flatWbsUnits
                                .filter(unit => {
                                    // Level 1 is always visible. Lower levels are visible only if all ancestor parent IDs are in expandedUnitIds
                                    let currentParentId = unit.parentId;
                                    while (currentParentId) {
                                        if (!expandedUnitIds.has(currentParentId)) return false;
                                        const parentNode = unitNodes.find(n => n.id === currentParentId);
                                        currentParentId = parentNode ? parentNode.parentId : null;
                                    }
                                    return true;
                                })
                                .map((unit) => {
                                const isEditing = editingUnitId === unit.id;
                                const isAddingChild = addingChildToId === unit.id;
                                const hasChildren = unitNodes.some(n => n.parentId === unit.id);
                                const isExpanded = expandedUnitIds.has(unit.id);

                                return React.createElement("div", { key: unit.id, style: { display: 'flex', flexDirection: 'column', gap: '0.35rem' } },
                                    React.createElement("div", {
                                        style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.6rem 0.85rem',
                                            paddingRight: `${(unit.level - 1) * 24 + 12}px`,
                                            borderRadius: '8px',
                                            background: isDark 
                                                ? (unit.level === 1 ? '#0f172a' : unit.level === 2 ? '#1e293b' : '#141e2e') 
                                                : (unit.level === 1 ? '#f8fafc' : unit.level === 2 ? '#f1f5f9' : '#fafafa'),
                                            border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                                            borderRight: unit.level === 1 
                                                ? '4px solid #2563eb' 
                                                : unit.level === 2 
                                                    ? '4px solid #059669' 
                                                    : '4px solid #7c3aed'
                                        }
                                    },
                                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                                            hasChildren ? (
                                                React.createElement("button", {
                                                    type: "button",
                                                    title: isExpanded ? "بستن زیرمجموعه‌ها" : "مشاهده زیرمجموعه‌ها (سطح ۲)",
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        toggleExpandUnit(unit.id);
                                                    },
                                                    style: {
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        padding: '2px',
                                                        border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                                                        borderRadius: '4px',
                                                        background: isDark ? '#1e293b' : '#ffffff',
                                                        color: isDark ? '#38bdf8' : '#0284c7',
                                                        cursor: 'pointer'
                                                    }
                                                },
                                                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.1rem', fontWeight: 800 } },
                                                        isExpanded ? 'expand_more' : (language === 'fa' ? 'chevron_left' : 'chevron_right')
                                                    )
                                                )
                                            ) : (
                                                React.createElement("span", { style: { width: '22px', display: 'inline-block' } })
                                            ),

                                            React.createElement("span", {
                                                style: {
                                                    background: unit.level === 1 ? '#2563eb' : unit.level === 2 ? '#059669' : '#7c3aed',
                                                    color: '#ffffff',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    fontFamily: 'monospace'
                                                }
                                            }, unit.wbsCode),

                                            React.createElement("span", {
                                                className: "material-symbols-outlined",
                                                style: {
                                                    fontSize: '1.1rem',
                                                    color: unit.level === 1 ? '#3b82f6' : unit.level === 2 ? '#10b981' : '#a855f7'
                                                }
                                            }, unit.level === 1 ? 'corporate_fare' : unit.level === 2 ? 'subdirectory_arrow_right' : 'schema'),

                                            isEditing ? (
                                                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.35rem' } },
                                                    React.createElement("input", {
                                                        type: "text",
                                                        value: editingUnitName,
                                                        onChange: (e) => setEditingUnitName(e.target.value),
                                                        autoFocus: true,
                                                        onKeyDown: (e) => e.key === 'Enter' && handleSaveEditUnit(unit.id),
                                                        style: { padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #2563eb', fontSize: '0.85rem' }
                                                    }),
                                                    React.createElement("button", { onClick: () => handleSaveEditUnit(unit.id), className: "action-icon", style: { color: '#059669' } }, React.createElement("span", { className: "material-symbols-outlined" }, "check")),
                                                    React.createElement("button", { onClick: () => setEditingUnitId(null), className: "action-icon", style: { color: '#64748b' } }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                                                )
                                            ) : (
                                                React.createElement("span", { style: { fontWeight: unit.level === 1 ? 700 : 500, fontSize: '0.88rem', color: isDark ? '#f8fafc' : '#1e293b' } },
                                                    unit.name,
                                                    unit.parentName ? React.createElement("span", { style: { fontSize: '0.72rem', color: isDark ? '#94a3b8' : '#64748b', marginRight: '8px' } }, `(زیرمجموعه: ${unit.parentName})`) : null
                                                )
                                            )
                                        ),

                                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.35rem' } },
                                            React.createElement("button", {
                                                title: "افزودن زیرگروه",
                                                onClick: () => { setAddingChildToId(unit.id); setNewChildName(''); },
                                                className: "action-icon",
                                                style: { color: '#059669' }
                                            }, React.createElement("span", { className: "material-symbols-outlined" }, "add_box")),

                                            React.createElement("button", {
                                                title: "ویرایش عنوان",
                                                onClick: () => { setEditingUnitId(unit.id); setEditingUnitName(unit.name); },
                                                className: "action-icon edit"
                                            }, React.createElement("span", { className: "material-symbols-outlined" }, "edit")),

                                            React.createElement("button", {
                                                title: "حذف واحد",
                                                onClick: () => handleDeleteUnitNode(unit.id, unit.name),
                                                className: "action-icon delete"
                                            }, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
                                        )
                                    ),

                                    isAddingChild ? (
                                        React.createElement("div", {
                                            style: {
                                                marginRight: `${unit.level * 24 + 12}px`,
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '8px',
                                                background: isDark ? '#1e293b' : '#f0fdf4',
                                                border: isDark ? '1px solid #059669' : '1px solid #86efac',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                marginTop: '0.2rem'
                                            }
                                        },
                                            React.createElement("span", { className: "material-symbols-outlined", style: { color: '#059669', fontSize: '1.1rem' } }, "subdirectory_arrow_right"),
                                            React.createElement("span", { style: { fontSize: '0.8rem', fontWeight: 600, color: isDark ? '#a7f3d0' : '#166534', whiteSpace: 'nowrap' } }, `افزودن زیرگروه به «${unit.name}»:`),
                                            React.createElement("input", {
                                                type: "text",
                                                value: newChildName,
                                                onChange: (e) => setNewChildName(e.target.value),
                                                placeholder: "عنوان زیرگروه جدید...",
                                                autoFocus: true,
                                                onKeyDown: (e) => e.key === 'Enter' && handleSaveChildUnit(unit.id),
                                                style: { flex: 1, padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #059669', fontSize: '0.82rem' }
                                            }),
                                            React.createElement("button", {
                                                onClick: () => handleSaveChildUnit(unit.id),
                                                style: { padding: '0.35rem 0.75rem', borderRadius: '6px', background: '#059669', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }
                                            }, "ثبت زیرگروه"),
                                            React.createElement("button", {
                                                onClick: () => setAddingChildToId(null),
                                                style: { padding: '0.35rem 0.5rem', borderRadius: '6px', background: 'transparent', color: isDark ? '#cbd5e1' : '#64748b', border: 'none', fontSize: '0.8rem', cursor: 'pointer' }
                                            }, "انصراف")
                                        )
                                    ) : null
                                );
                            })
                        )
                    )
                ),

                // Project Statuses Section: the backend's fixed set, shown for reference only
                React.createElement("div", { className: "form-section", style: { marginTop: 0 } },
                    React.createElement("h3", null, t('projectStatus')),
                    React.createElement("p", { style: { color: 'var(--text-muted, #64748b)', fontSize: '0.85rem', margin: '0 0 0.5rem' } },
                        language === 'fa'
                            ? 'وضعیت‌های کاری پروژه توسط سامانه تعریف شده‌اند و قابل ویرایش نیستند.'
                            : 'Project work statuses are defined by the system and cannot be edited.'),
                    React.createElement("ul", { className: "team-list" },
                        projectStatuses.map(status => (
                            React.createElement("li", { key: status },
                                React.createElement("span", null, t(workStatusTranslations[status] || status as any))
                            )
                        ))
                    )
                )
            )
        )
    );
};


// --- Strategy Pages ---
export const StrategyManagementHubPage = ({ onNavigate }: { onNavigate: (page: string) => void }): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    const menuOptions = useMemo(() => [
        { name: t('defineStrategies'), icon: 'account_tree', page: 'define_strategies' },
        { name: t('projectStrategyAlignment'), icon: 'table_chart', page: 'alignment_matrix' },
    ], [t]);

    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('projectStrategyManagement'))
            ),
            React.createElement("div", { className: "strategy-hub-grid" },
                menuOptions.map((opt) => (
                    React.createElement("a", {
                        href: "#",
                        className: "settings-item",
                        key: opt.name,
                        role: "button",
                        "aria-label": opt.name,
                        onClick: (e) => { e.preventDefault(); onNavigate(opt.page); }
                    } as React.HTMLAttributes<HTMLAnchorElement>,
                        React.createElement("span", { className: "material-symbols-outlined", "aria-hidden": "true" }, opt.icon),
                        React.createElement("span", { className: "settings-text" }, opt.name)
                    )
                ))
            )
        )
    );
};

export const DefineStrategiesPage = ({ strategies, onSaveStrategies, onNavigate, setInfoModal }: { 
    strategies: Strategy[], 
    onSaveStrategies: (strategies: Strategy[]) => Promise<{ ok: boolean }>, 
    onNavigate: (page: string) => void,
    setInfoModal: (modal: { title: string, message: string } | null) => void 
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';
    const [localStrategies, setLocalStrategies] = useState<Strategy[]>(JSON.parse(JSON.stringify(strategies)));

    const processedStrategies = useMemo(() => {
        const strategyMap = new Map<string, Strategy & { children: Strategy[]; level: number; isLeaf: boolean }>(
            localStrategies.map(s => [s.id, { ...s, children: [] as Strategy[], level: 0, isLeaf: false }])
        );
        const tree: Strategy[] = [];
        localStrategies.forEach(s => {
            const strat = strategyMap.get(s.id)!;
            if (s.parentId && strategyMap.has(s.parentId)) {
                strategyMap.get(s.parentId)!.children.push(strat);
            } else {
                tree.push(strat);
            }
        });

        const setLevelsAndCalculateWeights = (nodes: Strategy[], level: number): void => {
            nodes.forEach(node => {
                node.level = level;
                if (node.children.length > 0) {
                    node.isLeaf = false;
                    setLevelsAndCalculateWeights(node.children, level + 1);
                    node.weight = node.children.reduce((sum, child) => sum + (child.weight || 0), 0);
                } else {
                    node.isLeaf = true;
                }
            });
        };
        
        setLevelsAndCalculateWeights(tree, 0);
        return tree;
    }, [localStrategies]);

    const totalWeight = useMemo(() => {
        return processedStrategies.reduce((sum, s) => sum + (s.weight || 0), 0);
    }, [processedStrategies]);
    
    const handleUpdate = (id: string, field: 'name' | 'weight' | 'description', value: string | number) => {
        setLocalStrategies(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleAdd = (parentId: string | null) => {
        const newStrategy: Strategy = {
            id: `strat-${Date.now()}`,
            name: '',
            description: '',
            weight: 0,
            parentId: parentId,
        };
        setLocalStrategies(prev => [...prev, newStrategy]);
    };

    const handleDelete = (id: string) => {
        if (!window.confirm(t('confirmStrategyDelete'))) return;
        const idsToDelete = new Set<string>([id]);
        const queue = [id];
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            localStrategies.forEach(s => {
                if (s.parentId === currentId) {
                    idsToDelete.add(s.id);
                    queue.push(s.id);
                }
            });
        }
        setLocalStrategies(prev => prev.filter(s => !idsToDelete.has(s.id)));
    };
    
    // Whether the weights add up to 100 is the backend's call: it refuses the tree and the App shows its message.
    const handleSave = async () => {
        const outcome = await onSaveStrategies(localStrategies);
        if (outcome.ok) onNavigate('strategy_management');
    };

    const renderRow = (strategy: Strategy): ReactElement => (
        React.createElement("tr", { key: strategy.id },
            React.createElement("td", null,
                React.createElement("div", { className: "strategy-name-cell", style: { paddingInlineStart: `${strategy.level * 35}px` } },
                    React.createElement("input", { type: "text", value: strategy.name, onChange: (e: ChangeEvent<HTMLInputElement>) => handleUpdate(strategy.id, 'name', e.target.value) })
                )
            ),
            React.createElement("td", { className: "td-description" },
                React.createElement("input", { type: "text", value: strategy.description, onChange: (e: ChangeEvent<HTMLInputElement>) => handleUpdate(strategy.id, 'description', e.target.value) })
            ),
            React.createElement("td", { className: "td-weight" },
                strategy.isLeaf ?
                    (language === 'fa' ?
                        React.createElement("input", {
                            type: "text",
                            value: toPersianDigits(strategy.weight),
                            onChange: (e: ChangeEvent<HTMLInputElement>) => {
                                const cleanValue = e.target.value
                                    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                                    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
                                const numericValue = parseInt(cleanValue.replace(/[^0-9]/g, ''), 10) || 0;
                                handleUpdate(strategy.id, 'weight', numericValue);
                            }
                        })
                        : React.createElement("input", {
                            type: "number",
                            value: strategy.weight,
                            onChange: (e: ChangeEvent<HTMLInputElement>) => handleUpdate(strategy.id, 'weight', parseInt(e.target.value, 10) || 0),
                            min: "0"
                        })
                    )
                    : React.createElement("div", { className: "strategy-weight-cell" }, `${language === 'fa' ? toPersianDigits(strategy.weight) : strategy.weight}%`)
            ),
            React.createElement("td", { className: "action-cell" },
                React.createElement("button", { onClick: () => handleAdd(strategy.id), className: "action-icon add-sub-item-icon", title: t('addSubStrategy') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "add_task")),
                React.createElement("button", { onClick: () => handleDelete(strategy.id), className: "action-icon delete", title: t('delete') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "delete"))
            )
        )
    );

    const renderTree = (nodes: Strategy[]): ReactElement[] => nodes.flatMap(node => [
        renderRow(node),
        ...(node.children ? renderTree(node.children) : [])
    ]);

    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('defineStrategies'))
            ),
            React.createElement("div", { className: "strategy-toolbar" },
                React.createElement("button", { className: "action-button", onClick: () => handleAdd(null) } as React.HTMLAttributes<HTMLButtonElement>, t('createMainStrategy'))
            ),
            React.createElement("div", { className: "table-responsive" },
                React.createElement("table", { className: "users-table strategy-table" },
                    React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", { className: "th-name" }, t('strategyName')), React.createElement("th", { className: "th-description" }, t('strategyDescription')), React.createElement("th", { className: "th-weight" }, t('strategyWeight')), React.createElement("th", { className: "th-actions" }, t('actions')))),
                    React.createElement("tbody", null,
                        renderTree(processedStrategies)
                    )
                )
            ),
            React.createElement("div", { className: "strategy-footer" },
                React.createElement("div", { className: `total-weight-display ${Math.round(totalWeight) !== 100 ? 'error' : ''}` }, `${t('totalWeight')}: ${language === 'fa' ? toPersianDigits(Math.round(totalWeight)) : Math.round(totalWeight)}%`),
                React.createElement("button", { className: "save-btn", onClick: handleSave } as React.HTMLAttributes<HTMLButtonElement>, t('save'))
            )
        )
    );
};

export const AlignmentMatrixPage = ({ projects, strategies, alignments, percentages, onSaveAlignments, onNavigate }: {
    projects: Project[],
    strategies: Strategy[],
    alignments: ProjectStrategyAlignment[],
    /** Each project's alignment percentage as the backend worked it out. */
    percentages: Map<string, number>,
    onSaveAlignments: (alignments: ProjectStrategyAlignment[], projectIds: string[]) => Promise<{ ok: boolean }>,
    onNavigate: (page: string) => void
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';
    const [localAlignments, setLocalAlignments] = useState(alignments);

    const { strategyTree, leafStrategies } = useMemo(() => {
        const strategyMap = new Map(strategies.map(s => [s.id, { ...s, children: [] as Strategy[], isLeaf: false, level: 0 }]));
        const tree: Strategy[] = [];
        strategies.forEach(s => {
            const strat = strategyMap.get(s.id)!;
            if (s.parentId && strategyMap.has(s.parentId)) {
                strategyMap.get(s.parentId)!.children.push(strat);
            } else {
                tree.push(strat);
            }
        });
        
        const setLevelsWeightsAndLeafStatus = (nodes: Strategy[], level: number) => {
            nodes.forEach(node => {
                node.level = level;
                if (node.children.length > 0) {
                    node.isLeaf = false;
                    setLevelsWeightsAndLeafStatus(node.children, level + 1);
                    node.weight = node.children.reduce((sum, child) => sum + (child.weight || 0), 0);
                } else {
                    node.isLeaf = true;
                }
            });
        };
        setLevelsWeightsAndLeafStatus(tree, 0);

        const leafStrategiesResult: Strategy[] = [];
        const traverseForLeaves = (nodes: Strategy[]) => {
            nodes.forEach(node => {
                if (node.isLeaf) {
                    leafStrategiesResult.push(node);
                } else if (node.children) {
                    traverseForLeaves(node.children);
                }
            });
        };
        traverseForLeaves(tree);

        return { strategyTree: tree, leafStrategies: leafStrategiesResult };
    }, [strategies]);
    
    const getLeafCount = useCallback((strategy: Strategy): number => {
        if (strategy.isLeaf) {
            return 1;
        }
        return strategy.children?.reduce((sum, child) => sum + getLeafCount(child), 0) || 0;
    }, []);

    const getMaxDepth = useCallback((nodes: Strategy[]): number => {
        if (!nodes || nodes.length === 0) return 0;
        let max = 0;
        for (const node of nodes) {
            max = Math.max(max, 1 + getMaxDepth(node.children || []));
        }
        return max;
    }, []);
    
    const maxDepth = useMemo(() => getMaxDepth(strategyTree) || 1, [strategyTree, getMaxDepth]);

    const headerRows = useMemo(() => {
        if (maxDepth === 0) return [];
        
        const rows: { label: string, colspan: number, rowspan: number, key: string }[][] = Array.from({ length: maxDepth }, () => []);

        const buildHeader = (nodes: Strategy[], level: number) => {
            if (!nodes) return;
            nodes.forEach(node => {
                const colspan = getLeafCount(node);
                const rowspan = node.isLeaf ? maxDepth - level : 1;
                
                if (colspan > 0) { // Only add to header if it has leaf nodes
                    rows[level].push({
                        label: `${node.name} (${language === 'fa' ? toPersianDigits(node.weight) : node.weight}%)`,
                        colspan,
                        rowspan,
                        key: node.id
                    });
                }
                
                if (node.children) {
                    buildHeader(node.children, level + 1);
                }
            });
        };

        buildHeader(strategyTree, 0);
        return rows.filter(row => row.length > 0);
    }, [strategyTree, maxDepth, getLeafCount]);
    
    const projectAlignments = useMemo(() => {
        return projects
            .filter(p => p.approvalStatus === 'Approved')
            .map(project => {
                const alignmentMap = new Map<string, AlignmentLevel>();
                leafStrategies.forEach(strategy => {
                    const existing = localAlignments.find(a => a.projectId === project.id && a.strategyId === strategy.id);
                    alignmentMap.set(strategy.id, existing?.level || 'None');
                });
                return {
                    project,
                    alignmentMap,
                    alignmentPercentage: percentages.get(project.id) ?? 0
                };
            });
    }, [projects, leafStrategies, localAlignments, percentages]);
    
    const alignmentLevels: AlignmentLevel[] = ['None', 'Low', 'Medium', 'High'];
    const levelTranslations: Record<AlignmentLevel, TranslationKey> = {
        'None': 'none', 'Low': 'low', 'Medium': 'medium', 'High': 'high'
    };

    const handleAlignmentChange = (projectId: string, strategyId: string, level: AlignmentLevel) => {
        setLocalAlignments(prev => {
            const otherAlignments = prev.filter(a => !(a.projectId === projectId && a.strategyId === strategyId));
            if (level !== 'None') {
                return [...otherAlignments, { projectId, strategyId, level }];
            }
            return otherAlignments;
        });
    };

    // The projects whose levels differ from what the backend holds are the ones sent.
    const handleSave = async () => {
        const key = (a: ProjectStrategyAlignment) => `${a.projectId}|${a.strategyId}|${a.level}`;
        const saved = new Set(alignments.map(key));
        const now = new Set(localAlignments.map(key));
        const changed = new Set<string>([
            ...localAlignments.filter(a => !saved.has(key(a))).map(a => a.projectId),
            ...alignments.filter(a => !now.has(key(a))).map(a => a.projectId)
        ]);
        const outcome = changed.size ? await onSaveAlignments(localAlignments, [...changed]) : { ok: true };
        if (outcome.ok) onNavigate('strategy_management');
    };

    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('alignmentMatrix'))
            ),
            strategies.length === 0 ? (
                 React.createElement("div", { className: "placeholder-content" }, t('noStrategiesDefined'))
            ) : (
            React.createElement(Fragment, null,
            React.createElement("div", { className: "table-responsive alignment-matrix-container" },
                React.createElement("table", { className: "users-table alignment-matrix" },
                    React.createElement("thead", null,
                        headerRows.map((row, rowIndex) => (
                             React.createElement("tr", { key: `header-row-${rowIndex}` },
                                rowIndex === 0 && React.createElement("th", { className: "sticky-col", rowSpan: headerRows.length, style: { zIndex: 11 } }, t('projectNameColumn')),
                                row.map(header => (
                                    React.createElement("th", { key: header.key, colSpan: header.colspan, rowSpan: header.rowspan }, header.label)
                                )),
                                rowIndex === 0 && React.createElement("th", { rowSpan: headerRows.length, style: { zIndex: 11 } }, t('alignmentPercentage'))
                            )
                        ))
                    ),
                    React.createElement("tbody", null,
                        projectAlignments.map(({ project, alignmentMap, alignmentPercentage }) => (
                            React.createElement("tr", { key: project.id },
                                React.createElement("td", { className: "sticky-col", style: { zIndex: 1 } }, project.name),
                                leafStrategies.map(strategy => {
                                    const currentLevel = alignmentMap.get(strategy.id) || 'None';
                                    return (
                                        React.createElement("td", { key: strategy.id },
                                            React.createElement("select",
                                                {
                                                    className: `alignment-select level-${currentLevel.toLowerCase()}`,
                                                    value: currentLevel,
                                                    onChange: (e: ChangeEvent<HTMLSelectElement>) => handleAlignmentChange(project.id, strategy.id, e.target.value as AlignmentLevel)
                                                },
                                                alignmentLevels.map(level => (
                                                    React.createElement("option", { key: level, value: level }, t(levelTranslations[level]))
                                                ))
                                            )
                                        )
                                    )
                                }),
                                React.createElement("td", null, React.createElement(ProgressBar, { value: alignmentPercentage, type: "actual" }))
                            )
                        ))
                    )
                )
            ),
            React.createElement("div", { className: "strategy-footer" },
                React.createElement("button", { className: "save-btn", onClick: handleSave } as React.HTMLAttributes<HTMLButtonElement>,
                    t('save')
                )
            ))
            )
        )
    );
};


export const ColorFormatPage = ({ onNavigate }: { onNavigate: (page: string) => void }): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const { theme, setTheme, colorScheme, setColorScheme } = useContext(ThemeContext);

    const handleThemeChange = (val: 'light' | 'dark') => {
        setTheme(val);
    };

    const schemes: { id: ColorScheme; labelFa: string; labelEn: string; color: string }[] = [
        { id: 'teal', labelFa: 'تیل (پیش‌فرض)', labelEn: 'Teal (Default)', color: '#005f73' },
        { id: 'blue', labelFa: 'آبی کلاسیک', labelEn: 'Classic Blue', color: '#1d4ed8' },
        { id: 'emerald', labelFa: 'زمردی', labelEn: 'Emerald Green', color: '#047857' },
        { id: 'purple', labelFa: 'بنفش سلطنتی', labelEn: 'Royal Purple', color: '#6d28d9' },
        { id: 'crimson', labelFa: 'یاقوتی (سرخ)', labelEn: 'Crimson Red', color: '#be123c' },
    ];

    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, t('colorAndFormat'))
            ),
            React.createElement("div", { className: "form-section" },
                React.createElement("h3", null, language === 'fa' ? 'حالت نمایش (پوسته)' : t('themeSettings')),
                React.createElement("div", { className: "theme-radio-group" },
                    React.createElement("div", {
                        className: `theme-card-option ${theme === 'light' ? 'active' : ''}`,
                        onClick: () => handleThemeChange('light')
                    },
                        React.createElement("span", { className: "material-symbols-outlined" }, "light_mode"),
                        React.createElement("span", null, t('lightMode'))
                    ),
                    React.createElement("div", {
                        className: `theme-card-option ${theme === 'dark' ? 'active' : ''}`,
                        onClick: () => handleThemeChange('dark')
                    },
                        React.createElement("span", { className: "material-symbols-outlined" }, "dark_mode"),
                        React.createElement("span", null, t('darkMode'))
                    )
                )
            ),
            React.createElement("div", { className: "form-section" },
                React.createElement("h3", null, language === 'fa' ? 'پالت رنگ اصلی سیستم' : 'Primary Color Palette'),
                React.createElement("div", { className: "color-palettes-grid" },
                    schemes.map(s => (
                        React.createElement("div", {
                            key: s.id,
                            className: `color-palette-card ${colorScheme === s.id ? 'active' : ''}`,
                            onClick: () => setColorScheme(s.id)
                        },
                            React.createElement("div", { className: "color-circle", style: { backgroundColor: s.color } }),
                            React.createElement("span", { className: "color-label" }, language === 'fa' ? s.labelFa : s.labelEn),
                            colorScheme === s.id && React.createElement("span", { className: "material-symbols-outlined check-icon" }, "check_circle")
                        )
                    ))
                )
            )
        )
    );
};

export const KnowledgeManagementPage = ({ onNavigate, knowledgeDocuments, onSave, onDelete, onDownload }: {
    onNavigate: (page: string) => void;
    knowledgeDocuments: KnowledgeDocument[];
    onSave: (file: File, description: string, type: KnowledgeDocumentType) => Promise<{ ok: boolean }>;
    onDelete: (id: string) => void;
    onDownload: (doc: KnowledgeDocument) => void;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const backIcon = language === 'fa' ? 'arrow_forward' : 'arrow_back';

    const [newDoc, setNewDoc] = useState<Omit<KnowledgeDocument, 'id' | 'name'>>({ description: '', type: 'Book' });
    const [fileName, setFileName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFileName(e.target.files[0].name);
            setFile(e.target.files[0]);
        }
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!file || !newDoc.description) {
            alert(t('selectFileAndDesc'));
            return;
        }
        const outcome = await onSave(file, newDoc.description, newDoc.type);
        if (!outcome.ok) return;
        setNewDoc({ description: '', type: 'Book' });
        setFileName('');
        setFile(null);
        setIsAddModalOpen(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const handleDelete = (id: string) => {
        if(window.confirm(t('confirmDocDelete'))) {
            onDelete(id);
        }
    };

    const docTypeTranslations: Record<KnowledgeDocumentType, TranslationKey> = {
        'Book': 'book',
        'Pamphlet': 'pamphlet',
        'Software': 'software',
        'Other': 'other'
    };

    const filteredDocuments = useMemo(() => {
        if (!searchTerm.trim()) return knowledgeDocuments;
        const term = searchTerm.toLowerCase();
        return knowledgeDocuments.filter(doc => {
            const translatedType = (docTypeTranslations[doc.type] && t(docTypeTranslations[doc.type])) || doc.type;
            return doc.name.toLowerCase().includes(term) ||
                   doc.description.toLowerCase().includes(term) ||
                   translatedType.toLowerCase().includes(term);
        });
    }, [knowledgeDocuments, searchTerm, t]);

    const groupedDocuments = useMemo(() => {
        return filteredDocuments.reduce((acc, doc) => {
            (acc[doc.type] = acc[doc.type] || []).push(doc);
            return acc;
        }, {} as Record<KnowledgeDocumentType, KnowledgeDocument[]>);
    }, [filteredDocuments]);

    const docTypeOrder: KnowledgeDocumentType[] = ['Book', 'Pamphlet', 'Software', 'Other'];

    return (
        React.createElement(Fragment, null,
            isAddModalOpen && React.createElement("div", { className: "modal-overlay", onClick: () => setIsAddModalOpen(false) },
                React.createElement("div", { className: "modal-content", onClick: (e: React.MouseEvent) => e.stopPropagation(), style: { maxWidth: '500px', width: '90%' } },
                    React.createElement("div", { className: "modal-header" },
                        React.createElement("h3", null, language === 'fa' ? 'مورد جدید - افزودن سند دانش' : t('addKnowledgeDocument')),
                        React.createElement("button", { onClick: () => setIsAddModalOpen(false), className: "modal-close-button" },
                            React.createElement("span", { className: "material-symbols-outlined" }, "close")
                        )
                    ),
                    React.createElement("form", { onSubmit: handleSave, style: { display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' } },
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "modal-doc-desc" }, t('docDescription') + '*'),
                            React.createElement("input", { type: "text", id: "modal-doc-desc", value: newDoc.description, onChange: (e: ChangeEvent<HTMLInputElement>) => setNewDoc({...newDoc, description: e.target.value}), required: true })
                        ),
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "modal-doc-type" }, t('knowledgeDocumentType')),
                            React.createElement("select", { id: "modal-doc-type", value: newDoc.type, onChange: (e: ChangeEvent<HTMLSelectElement>) => setNewDoc({...newDoc, type: e.target.value as any}) },
                                Object.keys(docTypeTranslations).map(key => (
                                   React.createElement("option", { key: key, value: key }, t(docTypeTranslations[key as KnowledgeDocumentType]))
                                ))
                            )
                        ),
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "modal-docFile" }, t('docFile') + '*'),
                            React.createElement("input", { type: "file", id: "modal-docFile", onChange: handleFileChange, required: true, ref: fileInputRef })
                        ),
                        React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' } },
                            React.createElement("button", { type: "button", className: "cancel-btn", onClick: () => setIsAddModalOpen(false) }, language === 'fa' ? 'انصراف' : 'Cancel'),
                            React.createElement("button", { type: "submit", className: "action-button" }, t('addDocument'))
                        )
                    )
                )
            ),

            React.createElement("div", { className: "content-container" },
                React.createElement("div", { className: "page-header" },
                    React.createElement("h2", null, t('knowledgeManagement'))
                ),

                React.createElement("div", { className: "page-top-bar" },
                    React.createElement("div", { className: "search-filter-box" },
                        React.createElement("span", { className: "material-symbols-outlined" }, "search"),
                        React.createElement("input", {
                            type: "text",
                            className: "search-filter-input",
                            placeholder: language === 'fa' ? 'فیلتر و جستجوی اسناد دانش (عنوان، توضیحات، نوع)...' : 'Search knowledge documents...',
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
                    React.createElement("h3", null, t('knowledgeDocsList')),
                    filteredDocuments.length === 0 
                    ? React.createElement("p", { style: { padding: '1.5rem', textAlign: 'center', color: '#64748b' } }, language === 'fa' ? 'هیچ سند دانشی با این مشخصات یافت نشد.' : t('noKnowledgeDocs'))
                    : docTypeOrder.map(type => (
                        groupedDocuments[type] && groupedDocuments[type].length > 0 && (
                            React.createElement(Fragment, { key: type },
                                React.createElement("h4", null, t(docTypeTranslations[type])),
                                React.createElement("div", { className: "table-responsive", style: { marginBottom: '2rem' } },
                                    React.createElement("table", { className: "users-table" },
                                        React.createElement("thead", null,
                                            React.createElement("tr", null,
                                                React.createElement("th", { style: { width: '40%' } }, t('fileName')),
                                                React.createElement("th", { style: { width: '50%' } }, t('description')),
                                                React.createElement("th", { style: { width: '10%' } }, t('actions'))
                                            )
                                        ),
                                        React.createElement("tbody", null,
                                            groupedDocuments[type].map(doc => (
                                                React.createElement("tr", { key: doc.id },
                                                    React.createElement("td", null, doc.name),
                                                    React.createElement("td", null, doc.description),
                                                    React.createElement("td", { className: "action-cell" },
                                                        React.createElement("button", { onClick: () => onDownload(doc), className: "action-icon", "aria-label": language === 'fa' ? 'دانلود' : 'Download' } as React.HTMLAttributes<HTMLButtonElement>,
                                                            React.createElement("span", { className: "material-symbols-outlined" }, "download")
                                                        ),
                                                        React.createElement("button", { onClick: () => handleDelete(doc.id), className: "action-icon delete", "aria-label": t('delete') } as React.HTMLAttributes<HTMLButtonElement>, 
                                                            React.createElement("span", { className: "material-symbols-outlined" }, "delete")
                                                        )
                                                    )
                                                )
                                            ))
                                        )
                                    )
                                )
                            )
                        )
                    ))
                )
            )
        )
    );
};