import React, { useMemo, useState, useContext, ReactElement, Fragment } from 'react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { LocalizationContext } from '../context';
import { 
    Project, ProjectActivity, Calendar, ProgressUpdate, KanbanStatus
} from '../types';
import { 
    calculateSCurveData, formatDate, toPersianDigits, exportDashboardToLandscapePdf 
} from '../utils';

export const SCurveChartInline = ({ 
    project, 
    activities, 
    calendar 
}: { 
    project: Project, 
    activities: ProjectActivity[], 
    calendar: Calendar 
}): ReactElement => {
    const { language } = useContext(LocalizationContext);

    const sCurveData = useMemo(() => {
        return calculateSCurveData(project, activities, calendar, language);
    }, [activities, project, calendar, language]);

    const hasActualData = useMemo(() => {
        return sCurveData.some(p => p.actualProgress !== null && p.actualProgress !== undefined);
    }, [sCurveData]);

    if (sCurveData.length === 0) {
        return (
            React.createElement("div", { className: "form-section" },
                React.createElement("h3", null, language === 'fa' ? 'نمودار پیشرفت (S-Curve)' : 'Progress S-Curve'),
                React.createElement("div", { style: { textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' } },
                    language === 'fa' ? 'هیچ فعالیت زمان‌بندی‌شده‌ای برای محاسبه پیشرفت وجود ندارد.' : 'No scheduled activities found for calculating progress.'
                )
            )
        );
    }

    return (
        React.createElement("div", { className: "form-section" },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                React.createElement("h3", null, language === 'fa' ? 'نمودار پیشرفت (S-Curve)' : 'Progress S-Curve'),
                React.createElement("button", { 
                    onClick: () => exportDashboardToLandscapePdf(`${project.name || 'Project'}_S_Curve`),
                    className: "action-button no-print",
                    title: language === 'fa' ? 'خروجی PDF' : 'Export PDF',
                    style: { padding: '0.5rem', backgroundColor: '#ef4444', border: 'none', color: '#fff', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
                }, React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem', color: '#fff' } }, "picture_as_pdf"))
            ),
            React.createElement("div", { className: "chart-card", style: { padding: '1.5rem', marginTop: '1rem' } },
                React.createElement("div", { style: { marginBottom: '1.5rem', display: 'flex', gap: '1.75rem', flexWrap: 'wrap', fontSize: '0.88rem', color: 'var(--text-secondary)' } },
                    React.createElement("div", null,
                        React.createElement("strong", null, language === 'fa' ? 'نهایی پیشرفت برنامه‌ای: ' : 'Final Planned Progress: '),
                        React.createElement("span", { style: { color: '#2563eb', fontWeight: 700 } }, `${language === 'fa' ? toPersianDigits(sCurveData[sCurveData.length - 1]?.plannedProgress || 100) : (sCurveData[sCurveData.length - 1]?.plannedProgress || 100)}%`)
                    ),
                    hasActualData && React.createElement("div", null,
                        React.createElement("strong", null, language === 'fa' ? 'آخرین پیشرفت واقعی: ' : 'Latest Actual Progress: '),
                        React.createElement("span", { style: { color: '#ef4444', fontWeight: 700 } }, `${language === 'fa' ? toPersianDigits(Math.round(sCurveData.filter(d => d.actualProgress !== null && d.actualProgress !== undefined).pop()?.actualProgress || 0)) : Math.round(sCurveData.filter(d => d.actualProgress !== null && d.actualProgress !== undefined).pop()?.actualProgress || 0)}%`)
                    )
                ),
                React.createElement("div", { style: { width: '100%', height: 450 } },
                    React.createElement(ResponsiveContainer, { width: "100%", height: "100%" },
                        React.createElement(LineChart, { data: sCurveData, margin: { top: 15, right: 30, left: 35, bottom: 90 } },
                            React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--border-color, #e2e8f0)" }),
                            React.createElement(XAxis, { 
                                dataKey: "dateLabel", 
                                tick: { fontSize: 10, fill: 'var(--text-color, #64748b)' }, 
                                angle: -90, 
                                textAnchor: "start", 
                                height: 75,
                                interval: 0,
                                orientation: 'bottom',
                                dy: 8
                            }),
                            React.createElement(YAxis, { 
                                domain: [0, 100], 
                                width: 60,
                                orientation: "left",
                                tick: { fontSize: 11, fill: 'var(--text-color, #64748b)', dx: -16 },
                                tickFormatter: (val) => language === 'fa' ? `${toPersianDigits(val)}٪` : `${val}%`
                            }),
                            React.createElement(Tooltip, {
                                formatter: (val: number, name: string) => [
                                    val !== null && val !== undefined ? `${language === 'fa' ? toPersianDigits(Math.round(val)) : Math.round(val)}%` : '-',
                                    name
                                ],
                                labelStyle: { fontWeight: 'bold', color: '#1e293b' },
                                contentStyle: { borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', direction: language === 'fa' ? 'rtl' : 'ltr' }
                            }),
                            React.createElement(Legend, { 
                                layout: 'horizontal', 
                                align: 'center', 
                                verticalAlign: "bottom", 
                                height: 36, 
                                wrapperStyle: { 
                                    fontSize: '0.85rem', 
                                    paddingTop: '20px',
                                    direction: language === 'fa' ? 'rtl' : 'ltr'
                                } 
                            }),
                            React.createElement(Line, { 
                                type: "monotone", 
                                dataKey: "plannedProgress", 
                                name: language === 'fa' ? 'پیشرفت برنامه‌ای' : 'Planned Progress', 
                                stroke: "#2563eb", 
                                strokeWidth: 3, 
                                dot: (props: any) => {
                                    const { cx, cy, value } = props;
                                    if (value === null || value === undefined || isNaN(value)) return null;
                                    const r = 5;
                                    return React.createElement("circle", {
                                        key: `planned-dot-${cx}-${cy}`,
                                        cx: cx,
                                        cy: cy,
                                        r: r,
                                        fill: "#eab308",
                                        stroke: "#ffffff",
                                        strokeWidth: 1.5
                                    });
                                },
                                activeDot: (props: any) => {
                                    const { cx, cy, value } = props;
                                    if (value === null || value === undefined || isNaN(value)) return null;
                                    const r = 8;
                                    return React.createElement("circle", {
                                        key: `planned-active-dot-${cx}-${cy}`,
                                        cx: cx,
                                        cy: cy,
                                        r: r,
                                        fill: "#ca8a04",
                                        stroke: "#ffffff",
                                        strokeWidth: 2
                                    });
                                }
                            }),
                            hasActualData && React.createElement(Line, { 
                                type: "monotone", 
                                dataKey: "actualProgress", 
                                name: language === 'fa' ? 'پیشرفت واقعی' : 'Actual Progress', 
                                stroke: "#ef4444", 
                                strokeWidth: 3, 
                                connectNulls: true,
                                dot: (props: any) => {
                                    const { cx, cy, value, payload } = props;
                                    if (value === null || value === undefined || isNaN(value)) return null;
                                    if (!payload?.hasActualSnapshot && payload?.dayIndex !== 0) return null;
                                    const r = 6;
                                    return React.createElement("polygon", {
                                        key: `diamond-${cx}-${cy}`,
                                        points: `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`,
                                        fill: "#10b981",
                                        stroke: "#ffffff",
                                        strokeWidth: 1.5
                                    });
                                },
                                activeDot: { r: 6 } 
                            })
                        )
                    )
                )
            )
        )
    );
};

export const AgileProgressChartInline = ({ 
    project, 
    progressUpdates = [] 
}: { 
    project: Project, 
    progressUpdates?: ProgressUpdate[]
}): ReactElement => {
    const { language } = useContext(LocalizationContext);
    const [chartMode, setChartMode] = useState<'burnup' | 'burndown'>('burnup');

    const sprintCount = project.sprintCount || Math.max(1, ...(project.kanbanTasks || []).map(t => t.sprintNumber || 1));
    
    const chartData = useMemo(() => {
        const tasks = project.kanbanTasks || [];
        const data = [];
        let cumulativeCompleted = 0;
        let cumulativeTotal = 0;

        for (let s = 1; s <= sprintCount; s++) {
            const sprintTasks = tasks.filter(t => (t.sprintNumber || 1) === s);
            const totalInSprint = sprintTasks.length;
            cumulativeTotal += totalInSprint;

            const completedInSprint = sprintTasks.filter(t => {
                if (t.status === 'Done') return true;
                const hasApproval = progressUpdates.some(pu => pu.projectId === project.id && pu.taskId === t.id && pu.status === 'Approved');
                if (hasApproval) return true;
                return false;
            }).length;

            cumulativeCompleted += completedInSprint;
            const remaining = Math.max(0, cumulativeTotal - cumulativeCompleted);

            data.push({
                sprintName: language === 'fa' ? `اسپرینت ${toPersianDigits(s)}` : `Sprint ${s}`,
                sprintNum: s,
                total: cumulativeTotal,
                completed: cumulativeCompleted,
                remaining: remaining,
                sprintCompleted: completedInSprint,
                sprintTotal: totalInSprint
            });
        }
        return data;
    }, [project, progressUpdates, sprintCount, language]);

    return (
        React.createElement("div", { className: "form-section" },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                React.createElement("h3", null, language === 'fa' ? 'نمودار پیشرفت اسپرینت‌ها (Burn-Up / Burn-Down)' : 'Sprint Progress Chart (Burn-Up / Burn-Down)'),
                React.createElement("button", { 
                    onClick: () => exportDashboardToLandscapePdf(`${project.name || 'Project'}_Agile_Progress`),
                    className: "action-button no-print",
                    title: language === 'fa' ? 'خروجی PDF' : 'Export PDF',
                    style: { padding: '0.5rem', backgroundColor: '#ef4444', border: 'none', color: '#fff', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
                }, React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem', color: '#fff' } }, "picture_as_pdf"))
            ),
            React.createElement("div", { className: "chart-card", style: { padding: '1.5rem', marginTop: '1rem' } },
                React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' } },
                    React.createElement("div", { style: { display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary, #f1f5f9)', padding: '4px', borderRadius: '8px' } },
                        React.createElement("button", {
                            onClick: () => setChartMode('burnup'),
                            style: {
                                padding: '0.4rem 0.8rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: chartMode === 'burnup' ? 'var(--primary-color, #2563eb)' : 'transparent',
                                color: chartMode === 'burnup' ? '#fff' : 'var(--text-secondary, #64748b)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }
                        }, language === 'fa' ? 'نمودار برن آپ (Burn Up)' : 'Burn Up'),
                        React.createElement("button", {
                            onClick: () => setChartMode('burndown'),
                            style: {
                                padding: '0.4rem 0.8rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: chartMode === 'burndown' ? 'var(--primary-color, #2563eb)' : 'transparent',
                                color: chartMode === 'burndown' ? '#fff' : 'var(--text-secondary, #64748b)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }
                        }, language === 'fa' ? 'نمودار برن داون (Burn Down)' : 'Burn Down')
                    ),
                    React.createElement("div", { style: { fontSize: '0.85rem', color: 'var(--text-secondary)' } },
                        language === 'fa' ? `تعداد اسپرینت‌ها: ${toPersianDigits(sprintCount)}` : `Total Sprints: ${sprintCount}`
                    )
                ),
                React.createElement("div", { style: { width: '100%', height: 350 } },
                    React.createElement(ResponsiveContainer, { width: "100%", height: "100%" },
                        chartMode === 'burnup' ? (
                            React.createElement(LineChart, { data: chartData, margin: { top: 20, right: 30, left: 20, bottom: 20 } },
                                React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--border-color, #e2e8f0)" }),
                                React.createElement(XAxis, { dataKey: "sprintName", tick: { fontSize: 12, fill: 'var(--text-color, #64748b)' } }),
                                React.createElement(YAxis, { allowDecimals: false, tick: { fontSize: 12, fill: 'var(--text-color, #64748b)' } }),
                                React.createElement(Tooltip, {
                                    formatter: (val: any, name: string) => [
                                        val,
                                        name === 'completed' ? (language === 'fa' ? 'موارد تکمیل شده' : 'Completed Items') : (language === 'fa' ? 'کل موارد (Scope)' : 'Total Scope')
                                    ],
                                    contentStyle: { borderRadius: '8px', fontSize: '0.85rem', direction: language === 'fa' ? 'rtl' : 'ltr' }
                                }),
                                React.createElement(Legend, {
                                    layout: 'horizontal',
                                    align: 'center',
                                    verticalAlign: 'bottom',
                                    wrapperStyle: { paddingTop: '20px', direction: language === 'fa' ? 'rtl' : 'ltr', fontSize: '0.85rem' },
                                    formatter: (value) => value === 'completed' ? (language === 'fa' ? 'موارد تکمیل شده' : 'Completed') : (language === 'fa' ? 'مجموع حوزه (Scope)' : 'Total Scope')
                                }),
                                React.createElement(Line, { type: "monotone", dataKey: "completed", name: "completed", stroke: "#10b981", strokeWidth: 3, dot: { r: 5, fill: '#10b981' }, activeDot: { r: 8 } }),
                                React.createElement(Line, { type: "monotone", dataKey: "total", name: "total", stroke: "#2563eb", strokeWidth: 2, strokeDasharray: "5 5", dot: { r: 4, fill: '#2563eb' } })
                            )
                        ) : (
                            React.createElement(AreaChart, { data: chartData, margin: { top: 20, right: 30, left: 20, bottom: 20 } },
                                React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--border-color, #e2e8f0)" }),
                                React.createElement(XAxis, { dataKey: "sprintName", tick: { fontSize: 12, fill: 'var(--text-color, #64748b)' } }),
                                React.createElement(YAxis, { allowDecimals: false, tick: { fontSize: 12, fill: 'var(--text-color, #64748b)' } }),
                                React.createElement(Tooltip, {
                                    formatter: (val: any, name: string) => [
                                        val,
                                        language === 'fa' ? 'باقیمانده' : 'Remaining'
                                    ],
                                    contentStyle: { borderRadius: '8px', fontSize: '0.85rem', direction: language === 'fa' ? 'rtl' : 'ltr' }
                                }),
                                React.createElement(Area, { type: "monotone", dataKey: "remaining", stroke: "#f43f5e", fill: "#f43f5e", fillOpacity: 0.1, strokeWidth: 3, dot: { r: 5, fill: '#f43f5e' } })
                            )
                        )
                    )
                )
            )
        )
    );
};
