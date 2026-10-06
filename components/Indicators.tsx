import React, { useMemo, useContext, ReactElement } from 'react';
import { motion } from 'framer-motion';
import { LocalizationContext } from '../context';
import { toPersianDigits } from '../utils';

export const ProgressBar = ({ value = 0, type = 'actual', showLabel = true }: {
    value: number;
    type: 'actual' | 'planned';
    showLabel?: boolean;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const clampedValue = Math.max(0, Math.min(100, value));
    const rounded = Math.round(clampedValue);
    const displayNum = language === 'fa' ? toPersianDigits(rounded) : `${rounded}`;

    const barTitle = `${t(type === 'actual' ? 'actualPercent' : 'plannedPercent')}: ${displayNum}%`;

    return (
        React.createElement("div", { className: "progress-bar-container", title: barTitle },
            React.createElement(motion.div, {
                className: `progress-bar-fill ${type}`,
                initial: { width: "0%" },
                animate: { width: `${clampedValue}%` },
                transition: { duration: 0.8, ease: "easeInOut" }
            }),
            showLabel && React.createElement("span", { className: "progress-bar-label" }, `${displayNum}%`)
        )
    );
};

export const StackedProgressBar = ({ actual = 0, planned = 0, showLabel = true }: {
    actual: number;
    planned: number;
    showLabel?: boolean;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const actualRounded = Math.round(actual);
    const plannedRounded = Math.round(planned);
    const actualDisplay = language === 'fa' ? toPersianDigits(actualRounded) : `${actualRounded}`;
    const plannedDisplay = language === 'fa' ? toPersianDigits(plannedRounded) : `${plannedRounded}`;
    
    return (
        React.createElement("div", { className: "stacked-progress-bar-wrapper" },
            React.createElement("div", { title: `${t('plannedPercent')}: ${plannedDisplay}%` },
                React.createElement(ProgressBar, { value: planned, type: 'planned', showLabel: showLabel })
            ),
             React.createElement("div", { title: `${t('actualPercent')}: ${actualDisplay}%` },
                React.createElement(ProgressBar, { value: actual, type: 'actual', showLabel: showLabel })
            )
        )
    );
};


export const PerformanceIndicator = ({ performance }: { performance: number }) => {
    const { t, language } = useContext(LocalizationContext);
    const rounded = Math.round(performance);
    const displayNum = language === 'fa' ? toPersianDigits(rounded) : `${rounded}`;

    const { icon, colorClass, label } = useMemo(() => {
        if (performance >= 95) return { icon: 'trending_up', colorClass: 'performance-good', label: 'Good' };
        if (performance >= 80) return { icon: 'trending_flat', colorClass: 'performance-ok', label: 'OK' };
        return { icon: 'trending_down', colorClass: 'performance-bad', label: 'At Risk' };
    }, [performance]);

    return React.createElement(motion.div,
        {
            className: `performance-indicator ${colorClass}`,
            title: label,
            initial: { opacity: 0, scale: 0.8 },
            animate: { opacity: 1, scale: 1 },
            transition: { duration: 0.5 }
        },
        React.createElement("span", { className: "material-symbols-outlined" }, icon),
        React.createElement("span", null, `${displayNum}%`)
    );
};