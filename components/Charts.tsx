import React, { useMemo, useContext, useEffect, useRef, ReactElement } from 'react';
import { motion, animate } from 'framer-motion';
import { LocalizationContext } from '../context';
import { toPersianDigits } from '../utils';

export const ProjectCountCard = ({ count, title }: { count: number, title: string }): ReactElement => {
    const { language } = useContext(LocalizationContext);
    const countRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const node = countRef.current;
        if (!node) return;
        
        const controls = animate(0, count, {
            duration: 1,
            ease: "easeOut",
            onUpdate(value) {
                if (node) {
                    const rounded = Math.round(value);
                    node.textContent = language === 'fa' ? toPersianDigits(rounded) : rounded.toString();
                }
            }
        });

        return () => controls.stop();
    }, [count, language]);

    return (
        React.createElement("div", { className: "stat-card-content" },
            React.createElement(motion.h2, { ref: countRef, className: "stat-card-number" }, language === 'fa' ? toPersianDigits(0) : 0),
            React.createElement("p", { className: "stat-card-title" }, title)
        )
    );
};

export const CostStatCard = ({ cost, title }: { cost: number, title: string }): ReactElement => {
    const { language } = useContext(LocalizationContext);
    const costRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const node = costRef.current;
        if (!node) return;
        
        const controls = animate(0, cost, {
            duration: 1,
            ease: "easeOut",
            onUpdate(value) {
                if (node) {
                    const formatted = new Intl.NumberFormat('en-US').format(Math.round(value));
                    node.textContent = language === 'fa' ? toPersianDigits(formatted) : formatted;
                }
            }
        });

        return () => controls.stop();
    }, [cost, language]);

    return (
        React.createElement("div", { className: "stat-card-content" },
            React.createElement("div", { className: "cost-stat-card-main" },
                 React.createElement(motion.h2, { ref: costRef, className: "stat-card-number" }, language === 'fa' ? toPersianDigits(0) : 0)
            ),
            React.createElement("p", { className: "stat-card-title" }, title)
        )
    );
};

export const VIBRANT_CHART_COLORS = [
    '#3B82F6', // Vibrant Royal Blue
    '#10B981', // Vibrant Emerald Green
    '#F59E0B', // Vibrant Amber Gold
    '#8B5CF6', // Vibrant Vivid Violet
    '#EC4899', // Vibrant Fuchsia Pink
    '#06B6D4', // Vibrant Cyan
    '#F97316', // Vibrant Sunset Orange
    '#14B8A6', // Vibrant Teal
    '#6366F1', // Vibrant Indigo
    '#E11D48', // Vibrant Rose
    '#84CC16', // Vibrant Lime Green
    '#A855F7', // Vibrant Purple
    '#0284C7', // Vibrant Sky Blue
    '#D97706', // Vibrant Warm Bronze
    '#059669', // Vibrant Jade
    '#7C3AED', // Vibrant Deep Violet
];

export const PieDoughnutChart = ({ data, type = 'doughnut' }: { data: { name: string, value: number, color?: string }[], type?: 'pie' | 'doughnut' }): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
    const radius = 80;
    const strokeWidth = type === 'pie' ? radius : 35;
    const innerRadius = radius - strokeWidth / 2;
    const circumference = 2 * Math.PI * innerRadius;

    // Ensure each item has a distinct, vibrant color
    const enrichedData = useMemo(() => {
        return data.map((item, idx) => ({
            ...item,
            color: item.color && item.color !== 'var(--inactive-color)' 
                ? item.color 
                : VIBRANT_CHART_COLORS[idx % VIBRANT_CHART_COLORS.length]
        }));
    }, [data]);

    const total = useMemo(() => enrichedData.reduce((acc, item) => acc + item.value, 0), [enrichedData]);

    let accumulatedAngle = -90; // Start from the top

    const activeItem = hoveredIndex !== null ? enrichedData[hoveredIndex] : null;

    return (
        React.createElement("div", { className: "doughnut-chart-container", style: { position: 'relative' } },
            activeItem && React.createElement("div", { className: "chart-tooltip" },
                React.createElement("span", { className: "legend-color-box", style: { backgroundColor: activeItem.color } }),
                React.createElement("strong", null, activeItem.name),
                ": ",
                language === 'fa' ? toPersianDigits(activeItem.value) : activeItem.value,
                total > 0 && ` (${language === 'fa' ? toPersianDigits(Math.round((activeItem.value / total) * 100)) : Math.round((activeItem.value / total) * 100)}%)`
            ),
            React.createElement("div", { className: "doughnut-chart-svg-wrapper", style: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
                React.createElement("svg", { viewBox: "0 0 200 200", className: "doughnut-chart-svg" },
                    type === 'doughnut' && React.createElement("circle", { cx: "100", cy: "100", r: innerRadius, fill: "transparent", stroke: "var(--border-color)", strokeWidth: strokeWidth, strokeOpacity: "0.15" }),
                    total > 0 && enrichedData.map((item, index) => {
                        const arcLength = (item.value / total) * circumference;
                        const rotation = accumulatedAngle;
                        accumulatedAngle += (item.value / total) * 360;
                        const isHovered = hoveredIndex === index;

                        return (
                            React.createElement(motion.circle, {
                                key: index,
                                cx: "100",
                                cy: "100",
                                r: innerRadius,
                                fill: "transparent",
                                stroke: item.color,
                                strokeWidth: isHovered ? strokeWidth + 5 : strokeWidth,
                                strokeDasharray: `${circumference} ${circumference}`,
                                strokeLinecap: type === 'pie' ? "butt" : "round",
                                transform: `rotate(${rotation} 100 100)`,
                                style: { 
                                    cursor: 'pointer', 
                                    transition: 'stroke-width 0.25s ease, opacity 0.2s ease, filter 0.2s ease', 
                                    opacity: hoveredIndex !== null && !isHovered ? 0.45 : 1,
                                    filter: isHovered ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' : 'none'
                                },
                                onMouseEnter: () => setHoveredIndex(index),
                                onMouseLeave: () => setHoveredIndex(null),
                                initial: { strokeDashoffset: circumference },
                                animate: { strokeDashoffset: circumference - arcLength },
                                transition: { duration: 0.9, ease: "easeInOut", delay: index * 0.08 }
                            })
                        );
                    })
                ),
                type === 'doughnut' && (
                    React.createElement("div", {
                        style: {
                            position: 'absolute',
                            pointerEvents: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center'
                        }
                    },
                        React.createElement("span", {
                            style: {
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                color: activeItem ? activeItem.color : 'var(--text-primary, #1e293b)',
                                lineHeight: 1.2,
                                transition: 'color 0.2s ease'
                            }
                        }, activeItem 
                            ? (language === 'fa' ? toPersianDigits(activeItem.value) : activeItem.value)
                            : (language === 'fa' ? toPersianDigits(total) : total)
                        ),
                        React.createElement("span", {
                            style: {
                                fontSize: '0.72rem',
                                color: 'var(--text-muted, #64748b)',
                                fontWeight: 600
                            }
                        }, activeItem ? (language === 'fa' ? 'تعداد' : 'Count') : (language === 'fa' ? 'مجموع' : 'Total'))
                    )
                )
            ),
            React.createElement("div", { className: "doughnut-chart-legend" },
                enrichedData.map((item, index) => (
                    React.createElement("div", {
                        key: index,
                        className: "legend-item",
                        style: { 
                            cursor: 'pointer', 
                            opacity: hoveredIndex !== null && hoveredIndex !== index ? 0.45 : 1,
                            transform: hoveredIndex === index ? 'scale(1.04)' : 'none',
                            transition: 'all 0.2s ease'
                        },
                        onMouseEnter: () => setHoveredIndex(index),
                        onMouseLeave: () => setHoveredIndex(null)
                    },
                        React.createElement("span", { className: "legend-color-box", style: { backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}55` } }),
                        React.createElement("span", { className: "legend-label", style: { fontWeight: hoveredIndex === index ? 700 : 500 } }, `${item.name}: ${language === 'fa' ? toPersianDigits(item.value) : item.value}`)
                    )
                ))
            )
        )
    );
};

export interface ChartDataItem {
    name: string;
    value: number;
    color?: string;
    label?: string;
}

export const HorizontalBarChart = ({ data }: { data: { label?: string; name?: string; value: number; color?: string }[] }): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
    
    const normalized = useMemo(() => data.map((d, idx) => ({
        label: d.label || d.name || '',
        value: d.value,
        color: d.color && d.color !== 'var(--inactive-color)'
            ? d.color
            : VIBRANT_CHART_COLORS[idx % VIBRANT_CHART_COLORS.length]
    })), [data]);

    const maxValue = useMemo(() => Math.max(...normalized.map(d => d.value), 1), [normalized]);

    return React.createElement("div", { className: "horizontal-bar-chart-container", style: { position: 'relative' } },
        hoveredIdx !== null && normalized[hoveredIdx] && React.createElement("div", { className: "chart-tooltip" },
            React.createElement("span", { className: "legend-color-box", style: { backgroundColor: normalized[hoveredIdx].color } }),
            React.createElement("strong", null, normalized[hoveredIdx].label),
            ": ",
            language === 'fa' ? toPersianDigits(normalized[hoveredIdx].value) : normalized[hoveredIdx].value
        ),
        React.createElement("div", { className: "chart-area-horizontal" },
            normalized.length > 0 ? (
                normalized.map((item, idx) => (
                    React.createElement("div", {
                        key: `${item.label}-${idx}`,
                        className: "bar-grid-row",
                        style: { 
                            cursor: 'pointer', 
                            opacity: hoveredIdx !== null && hoveredIdx !== idx ? 0.5 : 1, 
                            transition: 'opacity 0.2s ease, transform 0.2s ease',
                            transform: hoveredIdx === idx ? 'translateX(2px)' : 'none'
                        },
                        onMouseEnter: () => setHoveredIdx(idx),
                        onMouseLeave: () => setHoveredIdx(null)
                    },
                         React.createElement("span", { 
                             className: "bar-label-horizontal", 
                             title: item.label,
                             style: { fontWeight: hoveredIdx === idx ? 700 : 600, color: hoveredIdx === idx ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #334155)' }
                         }, item.label),
                         React.createElement("div", { className: "bar-wrapper-horizontal" },
                            React.createElement(motion.div, {
                                className: "bar-fill-horizontal",
                                style: { 
                                    background: `linear-gradient(90deg, ${item.color}, ${item.color}cc)`,
                                    borderRadius: '6px',
                                    boxShadow: hoveredIdx === idx ? `0 0 10px ${item.color}88` : `0 1px 3px ${item.color}44`,
                                    filter: hoveredIdx === idx ? 'brightness(1.1)' : 'none' 
                                },
                                initial: { width: '0%' },
                                animate: { width: `${Math.max(4, (item.value / maxValue) * 100)}%` },
                                transition: { duration: 0.8, ease: "easeInOut", delay: idx * 0.05 }
                            })
                         ),
                         React.createElement("span", { 
                             className: "bar-value-horizontal",
                             style: { 
                                 fontWeight: 700, 
                                 color: item.color,
                                 minWidth: '28px',
                                 textAlign: 'center'
                             } 
                         }, language === 'fa' ? toPersianDigits(item.value) : item.value)
                    )
                ))
            ) : (
                 React.createElement("div", { className: "placeholder-content", style: { marginTop: 0, padding: '2rem' } }, t('noProjectsToDisplay'))
            )
        )
    );
};

export const SwitchableChartCard = ({
    title,
    data,
    defaultChartType = 'doughnut',
    pieType = 'doughnut'
}: {
    title: string;
    data: ChartDataItem[];
    defaultChartType?: 'doughnut' | 'pie' | 'bar';
    pieType?: 'pie' | 'doughnut';
}): ReactElement => {
    const { language } = useContext(LocalizationContext);
    const initialType = defaultChartType === 'pie' ? 'pie' : defaultChartType;
    const [chartType, setChartType] = React.useState<'pie' | 'doughnut' | 'bar'>(initialType);

    const activePieType = pieType === 'pie' || defaultChartType === 'pie' ? 'pie' : 'doughnut';

    const formattedData = useMemo(() => {
        return data.map(item => ({
            ...item,
            label: item.label || item.name
        }));
    }, [data]);

    const isPieActive = chartType === 'doughnut' || chartType === 'pie';

    return React.createElement("div", { className: "chart-card switchable-chart-card" },
        React.createElement("div", { className: "chart-card-header" },
            React.createElement("h4", null, title),
            React.createElement("div", { className: "chart-type-toggle" },
                React.createElement("button", {
                    type: "button",
                    className: `chart-toggle-btn ${isPieActive ? 'active' : ''}`,
                    onClick: () => setChartType(activePieType),
                    title: language === 'fa' ? 'نمودار دایره‌ای' : 'Pie Chart'
                },
                    React.createElement("span", { className: "material-symbols-outlined" }, "pie_chart"),
                    React.createElement("span", { className: "toggle-btn-label" }, language === 'fa' ? 'دایره‌ای' : 'Pie')
                ),
                React.createElement("button", {
                    type: "button",
                    className: `chart-toggle-btn ${chartType === 'bar' ? 'active' : ''}`,
                    onClick: () => setChartType('bar'),
                    title: language === 'fa' ? 'نمودار میله‌ای' : 'Bar Chart'
                },
                    React.createElement("span", { className: "material-symbols-outlined" }, "bar_chart"),
                    React.createElement("span", { className: "toggle-btn-label" }, language === 'fa' ? 'میله‌ای' : 'Bar')
                )
            )
        ),
        React.createElement("div", { className: "chart-card-body" },
            isPieActive
                ? React.createElement(PieDoughnutChart, { data: formattedData, type: activePieType })
                : React.createElement(HorizontalBarChart, { data: formattedData })
        )
    );
};

export const GaugeChart = ({ value, label }: { value: number; label: string }): ReactElement => {
    const { language } = useContext(LocalizationContext);
    const [isHovered, setIsHovered] = React.useState<boolean>(false);
    const valueRef = useRef<HTMLSpanElement>(null);
    const clampedValue = Math.max(0, Math.min(100, value || 0));

    useEffect(() => {
        const node = valueRef.current;
        if (!node) return;
        
        const controls = animate(0, clampedValue, {
            duration: 1.5,
            ease: "circOut",
            onUpdate(v) {
                if (node) {
                    const rounded = Math.round(v);
                    node.textContent = language === 'fa' ? `${toPersianDigits(rounded)}%` : `${rounded}%`;
                }
            }
        });
        return () => controls.stop();
    }, [clampedValue, language]);

    const circumference = Math.PI * 70; // PI * radius
    const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

    return (
        React.createElement("div", {
            className: "gauge-card",
            style: { position: 'relative', cursor: 'pointer' },
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false)
        },
            isHovered && React.createElement("div", { className: "chart-tooltip" },
                label && React.createElement("strong", null, label),
                label ? ": " : "",
                language === 'fa' ? `${toPersianDigits(clampedValue)}%` : `${clampedValue}%`
            ),
            React.createElement("div", { className: "gauge-container" },
                React.createElement("svg", { viewBox: "0 0 160 80" },
                    React.createElement("path", {
                        d: "M 10 80 A 70 70 0 0 1 150 80",
                        className: "gauge-background"
                    }),
                    React.createElement(motion.path, {
                        d: "M 10 80 A 70 70 0 0 1 150 80",
                        className: "gauge-value",
                        initial: { strokeDashoffset: circumference },
                        animate: { strokeDashoffset },
                        transition: { duration: 1.5, ease: "circOut" }
                    })
                ),
                React.createElement("span", { ref: valueRef, className: "gauge-text-value" }, language === 'fa' ? `${toPersianDigits(0)}%` : "0%")
            ),
            React.createElement("h4", { className: "gauge-label" }, label)
        )
    );
};