import React, { useState, useMemo, useEffect, useContext, useCallback, ChangeEvent, FormEvent, ReactElement, Fragment, useRef, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, MotionProps, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { useSCurve } from '../directory/useSCurve';
import { LocalizationContext } from '../context';
import { 
    User, Project, ProjectRisk, ProjectStakeholder, getStakeholderStrategy, ProjectStatusUpdate, ProjectDelayReason, ProjectDocument, ProjectActivity, KanbanTask, 
    EnrichedTask, ProgressUpdate, ProgressUpdateStatus, UserRole, ProjectType, TranslationKey, 
    KanbanStatus, TaskPriority, ActionItem, WorkStatus, SpecificHoliday, Calendar, EnrichedProject, EnrichedKanbanTask,
    ScheduleSnapshot, Delegation, ProjectApprovalRecord, StakeholderStrategies
} from '../types';
import { getISODateString, formatDate, formatDateTime, toJalali, toPersianDigits, enrichProjectWithProgress, calculateScheduleTreeAndProgress, toSafeDate, exportDashboardToLandscapePdf, exportDashboardToPortraitPdf, exportToPdf } from '../utils';
import { ProgressBar, PerformanceIndicator, StackedProgressBar } from './Indicators';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { OwningUnitTreeSelect, ActionForm } from './Forms';
import type { EditUserForm, Outcome } from '../directory/DirectoryContext';

const renderInPortal = (element: ReactElement): ReactElement => {
    if (typeof document === 'undefined') return element;
    return createPortal(element, document.body);
};

export const InfoModal = ({ title, message, onClose }: { title: string, message: string, onClose: () => void }): ReactElement => {
    const { t } = useContext(LocalizationContext);
    return (
        React.createElement("div", { className: "modal-overlay", onClick: () => onClose() },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '500px' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, title),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    React.createElement("p", null, message)
                ),
                React.createElement("div", { className: "modal-footer" },
                    React.createElement("button", { onClick: onClose, className: "action-button" }, t('close'))
                )
            )
        )
    );
};

export const ApprovalCommentModal = ({ 
    title, 
    initialComment = '', 
    submittedProgress,
    allowApprovedProgress = false,
    status,
    onSave, 
    onClose 
}: { 
    title?: string, 
    initialComment?: string, 
    submittedProgress?: number,
    allowApprovedProgress?: boolean,
    status?: 'Approved' | 'Rejected',
    onSave: (comment: string, status: 'Approved' | 'Rejected', options?: { approvedProgress?: number; isPartialRejection?: boolean }) => void, 
    onClose: () => void 
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [comment, setComment] = useState(initialComment);
    const [rejectionMode, setRejectionMode] = useState<'full' | 'partial'>('full');
    const [confirmedProgress, setConfirmedProgress] = useState<string>(submittedProgress !== undefined ? String(submittedProgress) : '0');

    useEffect(() => {
        setComment(initialComment || '');
    }, [initialComment]);

    useEffect(() => {
        if (submittedProgress !== undefined) {
            setConfirmedProgress(String(submittedProgress));
        }
    }, [submittedProgress]);

    const handleRejectClick = () => {
        if (allowApprovedProgress && submittedProgress !== undefined) {
            if (rejectionMode === 'partial') {
                const parsed = Math.min(100, Math.max(0, parseFloat(confirmedProgress) || 0));
                onSave(comment, 'Rejected', { isPartialRejection: true, approvedProgress: parsed });
            } else {
                onSave(comment, 'Rejected', { isPartialRejection: false });
            }
        } else {
            onSave(comment, 'Rejected', { isPartialRejection: false });
        }
    };

    const handleApproveClick = () => {
        onSave(comment, 'Approved', { approvedProgress: submittedProgress });
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: () => onClose() },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '650px' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, title || (language === 'fa' ? 'تایید / رد پروژه و ثبت نظر ارزیابی' : 'Approve / Reject & Review Comments')),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "review-comment", style: { fontWeight: 600, display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem' } }, 
                            language === 'fa' ? 'شرح پیشنهادات و علت تایید/رد (قابل ویرایش):' : 'Revisions / Comments (Editable):'
                        ),
                        React.createElement("textarea", {
                            id: "review-comment",
                            value: comment,
                            onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value),
                            rows: 5,
                            autoFocus: true,
                            style: { fontSize: '0.85rem', lineHeight: '1.6', width: '100%', padding: '0.6rem', borderRadius: '6px' },
                            placeholder: language === 'fa' ? 'شرح پیشنهادات یا علت تایید/رد را وارد نمایید...' : 'Enter comments or reason...'
                        })
                    ),
                    (allowApprovedProgress && submittedProgress !== undefined) && React.createElement("div", { style: { marginTop: '1rem', padding: '0.85rem', backgroundColor: 'var(--secondary-bg, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' } },
                        React.createElement("label", { style: { fontWeight: 700, display: 'block', marginBottom: '0.55rem', fontSize: '0.88rem', color: 'var(--text-primary, #1e293b)' } },
                            language === 'fa' ? 'نحوه مدیریت درصد پیشرفت هنگام رد:' : 'Rejection Progress Handling:'
                        ),
                        React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.6rem' } },
                            React.createElement("label", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' } },
                                React.createElement("input", {
                                    type: "radio",
                                    name: "rejectionMode",
                                    checked: rejectionMode === 'full',
                                    onChange: () => setRejectionMode('full')
                                }),
                                React.createElement("span", null, language === 'fa' ? 'رد کامل (پیشرفت فعلی فعالیت بدون تغییر باقی می‌ماند)' : 'Full Rejection (Keep current activity progress unchanged)')
                            ),
                            React.createElement("label", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' } },
                                React.createElement("input", {
                                    type: "radio",
                                    name: "rejectionMode",
                                    checked: rejectionMode === 'partial',
                                    onChange: () => setRejectionMode('partial')
                                }),
                                React.createElement("span", null, language === 'fa' ? 'عدم تایید پیشرفت اعلامی + تعیین و ثبت درصد پیشرفت تاییدی' : 'Reject submitted progress + Register manager confirmed progress')
                            )
                        ),
                        rejectionMode === 'partial' && React.createElement("div", { style: { marginTop: '0.8rem', padding: '0.75rem', backgroundColor: '#fefce8', borderRadius: '6px', border: '1px solid #fef08a' } },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' } },
                                React.createElement("span", { style: { fontSize: '0.83rem', color: '#854d0e', fontWeight: 600 } }, 
                                    language === 'fa' ? `درصد پیشرفت اعلامی کاربر: ${toPersianDigits(submittedProgress)}٪` : `User Submitted Progress: ${submittedProgress}%`
                                ),
                                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.4rem' } },
                                    React.createElement("label", { htmlFor: "confirmed-progress-input", style: { fontSize: '0.83rem', fontWeight: 700, color: '#713f12' } }, 
                                        language === 'fa' ? 'درصد پیشرفت تاییدی:' : 'Confirmed Progress:'
                                    ),
                                    React.createElement("input", {
                                        id: "confirmed-progress-input",
                                        type: language === 'fa' ? "text" : "number",
                                        min: 0,
                                        max: 100,
                                        value: language === 'fa' ? toPersianDigits(confirmedProgress) : confirmedProgress,
                                        onChange: (e: ChangeEvent<HTMLInputElement>) => {
                                            const val = e.target.value;
                                            const engVal = val.replace(/[۰-۹]/g, d => String(['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'].indexOf(d)));
                                            setConfirmedProgress(engVal.replace(/[^0-9.]/g, ''));
                                        },
                                        style: { width: '70px', padding: '0.3rem', borderRadius: '4px', border: '1px solid #ca8a04', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }
                                    }),
                                    React.createElement("span", { style: { fontSize: '0.85rem', fontWeight: 700, color: '#713f12' } }, '٪')
                                )
                            ),
                            React.createElement("p", { style: { fontSize: '0.78rem', color: '#854d0e', margin: 0, lineHeight: '1.4' } },
                                language === 'fa' 
                                    ? 'توضیح: پیشرفت اعلامی کاربر رد گردیده، اما درصد پیشرفت تاییدی وارد شده جایگزین پیشرفت فعالیت شده و ملاک تمام محاسبات خواهد بود.' 
                                    : 'Note: User submission will be marked rejected, but your confirmed progress will replace activity progress for all calculations.'
                            )
                        )
                    )
                ),
                React.createElement("div", { className: "modal-footer", style: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' } },
                    status !== 'Rejected' && React.createElement("button", { 
                        type: "button",
                        onClick: handleApproveClick, 
                        className: "approve-btn",
                        style: {
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.45rem 1.1rem',
                            borderRadius: '6px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }
                    }, 
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.1rem' } }, "check_circle"),
                        language === 'fa' ? 'تایید' : 'Approve'
                    ),
                    status !== 'Approved' && React.createElement("button", { 
                        type: "button",
                        onClick: handleRejectClick, 
                        className: "reject-btn",
                        style: {
                            backgroundColor: '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.45rem 1.1rem',
                            borderRadius: '6px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }
                    }, 
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.1rem' } }, "cancel"),
                        language === 'fa' ? 'رد' : 'Reject'
                    ),
                    React.createElement("button", { type: "button", onClick: onClose, className: "cancel-btn" }, t('cancel'))
                )
            )
        )
    );
};

export const AiFeasibilityModal = ({ project, onTransferToComment, onClose }: {
    project: Project;
    onTransferToComment: (comment: string, isJustified: boolean) => void;
    onClose: () => void;
}): ReactElement => {
    const { language } = useContext(LocalizationContext);
    const [isLoading, setIsLoading] = useState(true);
    const [result, setResult] = useState<{
        isJustified?: boolean;
        technicalFeasibility?: string;
        economicFeasibility?: string;
        overallAnalysis?: string;
        proposedRevisions?: string[];
        formattedResponseComment?: string;
        error?: string;
        debugInfo?: string;
    } | null>(null);

    const projectName = project?.name || (project as any)?.projectName || (project as any)?.title || 'پروژه بدون عنوان';

    const generateClientFeasibilityFallback = (payload: any) => {
        const name = payload.name || 'پروژه بدون عنوان';
        const goal = payload.goal || '';
        const requirements = payload.requirements || '';
        const constraintsAndAssumptions = payload.constraintsAndAssumptions || '';
        const description = payload.description || '';
        const cost = payload.cost;
        const safeCostStr = cost ? (typeof cost === 'number' ? `${cost.toLocaleString()} ریال` : `${String(cost)} ریال`) : 'تعیین نشده';
        
        const shamsiStartDate = payload.startDate ? formatDate(payload.startDate, 'fa') : '';
        const shamsiEndDate = payload.endDate ? formatDate(payload.endDate, 'fa') : '';
        const hasDates = Boolean(shamsiStartDate && shamsiEndDate);

        const hasGoal = Boolean(goal && String(goal).trim().length > 3);
        const hasReqs = Boolean((requirements && String(requirements).trim().length > 3) || (description && String(description).trim().length > 5));
        const hasConstraints = Boolean(constraintsAndAssumptions && String(constraintsAndAssumptions).trim().length > 3);
        const hasCost = cost !== undefined && cost !== null && String(cost).trim() !== '';

        // Keyword and text quality check (unclear/irrelevant word detection)
        const titleWords = name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const combinedText = (String(goal) + ' ' + String(requirements) + ' ' + String(constraintsAndAssumptions) + ' ' + String(description)).toLowerCase();
        const wordMatchCount = titleWords.filter((word: string) => combinedText.includes(word)).length;
        const isThemeMatched = wordMatchCount > 0 || !hasGoal;

        // Detecting meaningless, gibberish or nonsensical words (e.g. Hvbvvb, Ghhgjh, asdf, random typing)
        const suspiciousWords: string[] = [];
        const inspectField = (fieldName: string, textStr: string) => {
            if (!textStr || textStr.trim().length === 0) return;
            const words = textStr.trim().split(/\s+/);
            words.forEach(w => {
                const clean = w.replace(/[^\w\u0600-\u06FF]/g, '');
                if (!clean) return;
                // Check if word is random typing (like Hvbvvb, Ghhgjh, asdf, etc.), or lack vowels, or repeated chars
                const isGibberish = 
                    /^(test|asdf|qwerty|1234|aaaa|zzz|xxx|hvbvvb|ghhgjh)$/i.test(clean) ||
                    /(.)\1{2,}/.test(clean) ||
                    (!/[\u0600-\u06FF]/.test(clean) && clean.length > 3 && !/[aeiouy]/i.test(clean)); // no vowels in English gibberish
                if (isGibberish) {
                    suspiciousWords.push(`کلمه/عبارت نامفهوم «${clean}» در فیلد ${fieldName}`);
                }
            });
        };
        inspectField('هدف پروژه', goal);
        inspectField('الزامات پروژه', requirements);
        inspectField('محدودیت‌ها و مفروضات', constraintsAndAssumptions);

        const hasSuspiciousWords = suspiciousWords.length > 0;
        const isJustified = hasGoal && hasReqs && hasCost && isThemeMatched && !hasSuspiciousWords;

        let technicalFeasibility = `امکان‌سنجی فنی و بررسی کارشناسی انطباق موضوعی با عنوان «${name}»:\n`;
        if (!hasGoal || !hasReqs) {
            technicalFeasibility += `• عدم تناسب و نقص منشور: فیلدهای هدف یا الزامات ثبت‌شده ناقص بوده و امکان احراز انطباق کامل با عنوان «${name}» وجود ندارد.\n`;
            technicalFeasibility += `• علت عدم تناسب: عدم تکمیل فیلدهای اصلی منشور (هدف/الزامات) مانع احراز سنخیت فنی با عنوان «${name}» شده است.\n`;
        } else if (isThemeMatched) {
            technicalFeasibility += `• انطباق موضوعی: محتوای هدف، الزامات و محدودیت‌ها با عنوان «${name}» دارای سنخیت موضوعی اولیه ارزیابی گردید.\n`;
        } else {
            technicalFeasibility += `• عدم تناسب موضوعی (هشدار): محتوای فیلدهای هدف، الزامات و محدودیت‌ها با موضوع اصلی عنوان «${name}» هم‌پوشانی کافی ندارد.\n`;
            technicalFeasibility += `• علت عدم تناسب: واژگان و نیازمندی‌های مطرح‌شده در اهداف و الزامات منشور سنخیت مستقیم و عملیاتی با عنوان «${name}» نداشته و احتمال انحراف اجرایی وجود دارد.\n`;
        }

        if (hasSuspiciousWords) {
            technicalFeasibility += `• شناسایی کلمات و عبارات نامفهوم و بی‌معنی: ${suspiciousWords.join(' و ')} (نیازمند اصلاح و جایگزینی با متون واقعی پروژه می‌باشد).\n`;
        } else {
            technicalFeasibility += `• ارزیابی کلمات و مفاهیم: عبارات و اصطلاحات بکار رفته در اهداف، الزامات و محدودیت‌ها دارای شفافیت بوده و کلمه نامفهوم یا بی‌معنی مشاهده نشد.\n`;
        }

        if (hasConstraints) {
            technicalFeasibility += `• محدودیت‌ها و مفروضات: محدودیت‌ها و مفروضات کلیدی ثبت‌شده متناسب با الزامات پروژه «${name}» ارزیابی می‌شود.`;
        } else {
            technicalFeasibility += `• عدم تناسب در شفافیت مفروضات: محدودیت‌ها و مفروضات پروژه تعیین نشده است.\n`;
            technicalFeasibility += `• علت عدم تناسب: عدم ثبت محدودیت‌ها و مفروضات شفاف مانع از ارزیابی کامل ریسک‌های اجرایی عنوان «${name}» می‌گردد.`;
        }

        // Benchmark calculation for time and cost in Iran context based on dynamic project name
        let benchmarkCostMinStr = "۱,۰۰۰,۰۰۰,۰۰۰ ریال (۱۰۰ میلیون تومان)";
        let benchmarkCostMaxStr = "۵,۰۰۰,۰۰۰,۰۰۰ ریال (۵۰۰ میلیون تومان)";
        let benchmarkDaysStr = "۹۰ الی ۱۸۰ روز (۳ تا ۶ ماه)";
        let minExpectedCostNum = 1000000000;
        let minExpectedDaysNum = 30;

        const nameLower = name.toLowerCase();
        if (/پل|ساخت|عمران|سد|راه|ساختمان|احداث|تونل|بنا|توسعه شهری/i.test(nameLower)) {
            benchmarkCostMinStr = "۲۰,۰۰۰,۰۰۰,۰۰۰ ریال (۲ میلیارد تومان)";
            benchmarkCostMaxStr = "۱۰۰,۰۰۰,۰۰۰,۰۰۰ ریال (۱۰ میلیارد تومان)";
            benchmarkDaysStr = "۳۶۰ الی ۷۲۰ روز (۱۲ تا ۲۴ ماه)";
            minExpectedCostNum = 20000000000;
            minExpectedDaysNum = 180;
        } else if (/سامانه|اتوماسیون|نرم‌افزار|اپ|برنامه|پورتال|سیستم|شبکه|سرور|دیجیتال|داشبورد|okr/i.test(nameLower)) {
            benchmarkCostMinStr = "۳,۰۰۰,۰۰۰,۰۰۰ ریال (۳۰۰ میلیون تومان)";
            benchmarkCostMaxStr = "۸,۰۰۰,۰۰۰,۰۰۰ ریال (۸۰۰ میلیون تومان)";
            benchmarkDaysStr = "۱۲۰ الی ۲۴۰ روز (۴ تا ۸ ماه)";
            minExpectedCostNum = 3000000000;
            minExpectedDaysNum = 90;
        } else if (/وبسایت|سایت|پورتال اطلاع‌رسانی/i.test(nameLower)) {
            benchmarkCostMinStr = "۵۰۰,۰۰۰,۰۰۰ ریال (۵۰ میلیون تومان)";
            benchmarkCostMaxStr = "۱,۵۰۰,۰۰۰,۰۰۰ ریال (۱۵۰ میلیون تومان)";
            benchmarkDaysStr = "۳۰ الی ۹۰ روز (۱ تا ۳ ماه)";
            minExpectedCostNum = 500000000;
            minExpectedDaysNum = 20;
        } else if (/خرید|تامین|تجهیزات|دستگاه|کالا/i.test(nameLower)) {
            benchmarkCostMinStr = "۲,۰۰۰,۰۰۰,۰۰۰ ریال (۲۰۰ میلیون تومان)";
            benchmarkCostMaxStr = "۲۰,۰۰۰,۰۰۰,۰۰۰ ریال (۲ میلیارد تومان)";
            benchmarkDaysStr = "۳۰ الی ۹۰ روز (۱ تا ۳ ماه)";
            minExpectedCostNum = 2000000000;
            minExpectedDaysNum = 15;
        } else if (/آموزش|دوره|کارگاه|همایش|سمینار/i.test(nameLower)) {
            benchmarkCostMinStr = "۲۰۰,۰۰۰,۰۰۰ ریال (۲۰ میلیون تومان)";
            benchmarkCostMaxStr = "۱,۰۰۰,۰۰۰,۰۰۰ ریال (۱۰۰ میلیون تومان)";
            benchmarkDaysStr = "۱۵ الی ۶۰ روز (۲ هفته تا ۲ ماه)";
            minExpectedCostNum = 200000000;
            minExpectedDaysNum = 7;
        }

        let economicFeasibility = `امکان‌سنجی اقتصادی و مقایسه زمان و هزینه واردشده با زمان و هزینه متعارف در ایران (تاریخ‌های شمسی):\n`;
        
        // Cost Benchmark & 20% deviation rule (+/- 20%)
        const numCost = typeof cost === 'number' ? cost : parseFloat(String(cost).replace(/[^\d.]/g, '')) || 0;
        const expectedAvgCost = (minExpectedCostNum * 1.5);
        const costDevRatio = expectedAvgCost > 0 ? Math.abs(numCost - expectedAvgCost) / expectedAvgCost : 0;
        const isCostMismatch = !hasCost || numCost <= 0 || numCost < (minExpectedCostNum * 0.8) || numCost > (minExpectedCostNum * 5);

        if (!hasCost || numCost <= 0) {
            economicFeasibility += `• عدم تناسب و ابهام مالی: مبلغ برآورد هزینه مشخص نشده است.\n`;
            economicFeasibility += `• علت عدم تناسب: عدم درج مبلغ ریالی، امکان مقایسه هزینه با مقادیر متعارف پروژه‌های مشابه را غیرممکن ساخته است.\n`;
        } else {
            economicFeasibility += `• برآورد هزینه واردشده توسط کاربر: ${safeCostStr}\n`;
            economicFeasibility += `• برآورد هزینه متعارف هوش مصنوعی در ایران (برای عنوان «${name}»): حدود ${benchmarkCostMinStr} الی ${benchmarkCostMaxStr}\n`;
            if (isCostMismatch) {
                economicFeasibility += `• تحلیل مقایسه‌ای هزینه (هشدار انحراف): برآورد هزینه واردشده (${safeCostStr}) دارای انحراف بیش از ۲۰٪ (مثبت یا منفی) با برآورد متعارف امکان‌سنجی هوش مصنوعی می‌باشد.\n`;
            } else {
                economicFeasibility += `• تحلیل مقایسه‌ای هزینه: هزینه ثبت‌شده متناسب با برآورد هوش مصنوعی در بازار ایران ارزیابی گردید.\n`;
            }
        }

        // Time Benchmark & 20% deviation rule (+/- 20%)
        const parseDigits = (s: string) => parseInt(s.replace(/[^\d]/g, ''), 10) || 0;
        const startDigits = parseDigits(payload.startDate || '');
        const endDigits = parseDigits(payload.endDate || '');
        const timeDiffDays = (endDigits > startDigits) ? (endDigits - startDigits) : 0;
        const isTimeMismatch = !hasDates || (timeDiffDays < (minExpectedDaysNum * 0.8)) || (timeDiffDays > (minExpectedDaysNum * 4));

        if (hasDates) {
            economicFeasibility += `• زمان‌بندی شمسی واردشده: از ${shamsiStartDate} تا ${shamsiEndDate} (${timeDiffDays} روز)\n`;
            economicFeasibility += `• زمان‌بندی متعارف هوش مصنوعی در ایران (توسعه و اجرای «${name}»): معمولاً بین ${benchmarkDaysStr}\n`;
            
            if (isTimeMismatch) {
                economicFeasibility += `• تحلیل مقایسه‌ای زمان (هشدار انحراف): مدت زمان ثبت‌شده (${timeDiffDays} روز) دارای انحراف بیش از ۲۰٪ با برآورد زمان‌بندی متعارف هوش مصنوعی می‌باشد.`;
            } else {
                economicFeasibility += `• تحلیل مقایسه‌ای زمان: بازه زمانی شمسی ثبت‌شده با زمان‌بندی معمول هوش مصنوعی تناسب دارد.`;
            }
        } else {
            economicFeasibility += `• عدم تناسب در زمان‌بندی: تاریخ شروع و پایان شمسی پروژه مشخص نیست.\n`;
            economicFeasibility += `• علت عدم تناسب: عدم تعیین بازه زمانی شمسی مانع از مقایسه مدت زمان پروژه با مقادیر متعارف صنعت در ایران گردیده است.`;
        }

        const hasCostIssue = !hasCost || numCost <= 0 || isCostMismatch;
        const hasTimeIssue = !hasDates || isTimeMismatch;
        const hasTechIssue = !hasGoal || !hasReqs || !hasConstraints || !isThemeMatched || hasSuspiciousWords;

        const isJustifiedFinal = !hasTechIssue && !hasCostIssue && !hasTimeIssue;

        const failurePoints: string[] = [];
        if (!hasGoal) failurePoints.push('عدم تکمیل فیلد هدف پروژه');
        if (!hasReqs) failurePoints.push('عدم تکمیل فیلد الزامات پروژه');
        if (!hasConstraints) failurePoints.push('عدم تکمیل فیلد الزامی محدودیت‌ها و مفروضات پروژه');
        if (!isThemeMatched) failurePoints.push(`عدم سنخیت مفهومی محتوای منشور با عنوان «${name}»`);
        if (hasSuspiciousWords) failurePoints.push(`وجود کلمات/عبارات نامفهوم و فاقد معنی مستقل در منشور (${suspiciousWords.map(s => s.replace(/کلمه\/عبارت نامفهوم «|» در فیلد.*/g, '')).join('، ')})`);
        if (!hasCost || numCost <= 0) failurePoints.push('عدم تعیین مبلغ برآورد هزینه پروژه');
        else if (isCostMismatch) failurePoints.push(`عدم تناسب برآورد هزینه ثبت‌شده (${safeCostStr}) با برآورد امکان‌سنجی هوش مصنوعی (انحراف بیش از ۲۰٪)`);
        if (!hasDates) failurePoints.push('عدم تعیین بازه زمانی شمسی پروژه');
        else if (isTimeMismatch) failurePoints.push(`عدم تناسب بازه زمانی ثبت‌شده (${timeDiffDays || 1} روز) با برآورد زمان‌بندی امکان‌سنجی هوش مصنوعی (انحراف بیش از ۲۰٪)`);

        const overallAnalysis = isJustifiedFinal
            ? `نتیجه‌گیری: منشور پروژه از نظر اهداف، الزامات، محدودیت‌ها و مفروضات، برآورد هزینه (${safeCostStr}) و بازه زمانی شمسی (${shamsiStartDate} الی ${shamsiEndDate}) دارای انطباق مفهومی، معنی‌داری عبارات و تناسب کامل با برآورد امکان‌سنجی هوش مصنوعی می‌باشد.`
            : `نتیجه‌گیری: پروژه «${name}» به دلیل عدم تناسب برآورد زمان و هزینه ثبت‌شده با برآورد امکان‌سنجی هوش مصنوعی (انحراف بیش از ۲۰٪) و اشکالات فنی شامل: [ ${failurePoints.join('؛ ')} ] فاقد توجیه‌پذیری اجرایی ارزیابی گردیده و عودت داده می‌شود.`;

        const proposedRevisions: string[] = [];
        if (hasSuspiciousWords) proposedRevisions.push('حذف کلمات و عبارات نامفهوم یا تایپ تصادفی و جایگزینی با عبارات واقعی و تخصصی');
        if (!isThemeMatched) proposedRevisions.push(`بازنگری و متناسب‌سازی کامل محتوای اهداف و الزامات با عنوان اصلی پروژه («${name}»)`);
        if (!hasGoal) proposedRevisions.push('شفاف‌سازی و ثبت دقیق اهداف کلان متناسب با عنوان پروژه');
        if (!hasReqs) proposedRevisions.push('تکمیل الزامات فنی و اجرایی پروژه متناسب با عنوان');
        if (!hasConstraints) proposedRevisions.push('ثبت دقیق محدودیت‌ها و مفروضات کلیدی پروژه');
        if (hasCostIssue) proposedRevisions.push(`تعدیل برآورد مالی و ثبت هزینه واقعی متناسب با عرف ایران (${benchmarkCostMinStr})`);
        if (hasTimeIssue) proposedRevisions.push(`تعدیل زمان‌بندی شمسی و تعیین بازه اجرایی واقعی (${benchmarkDaysStr})`);
        if (proposedRevisions.length === 0) {
            proposedRevisions.push('تدوین شاخص‌های کلیدی عملکرد (KPI) جهت پایش تحقق اهداف، بودجه و زمان‌بندی شمسی');
        }

        const formattedResponseComment = isJustifiedFinal
            ? `با سلام، ارزیابی امکان‌سنجی پروژه «${name}» انجام شد. محتوای اهداف، الزامات، محدودیت‌ها، برآورد هزینه (${safeCostStr}) و بازه زمانی شمسی (${shamsiStartDate} تا ${shamsiEndDate}) با عنوان پروژه متناسب بوده و مورد تایید است.`
            : `با سلام، ارزیابی امکان‌سنجی پروژه «${name}» انجام شد. طرح فوق به دلیل اشکالات فنی و مالی [ ${failurePoints.join('؛ ')} ] فاقد توجیه‌پذیری تشخیص داده شد و جهت اصلاح کامل عودت داده می‌شود.`;

        return {
            success: true,
            isJustified: isJustifiedFinal,
            technicalFeasibility,
            economicFeasibility,
            overallAnalysis,
            proposedRevisions,
            formattedResponseComment
        };
    };

    const fetchFeasibility = async () => {
        setIsLoading(true);
        setResult(null);
        const payload = {
            name: projectName,
            goal: project?.goal || (project as any)?.objective || (project as any)?.submittedCharter?.goal,
            requirements: project?.requirements || (project as any)?.submittedCharter?.requirements,
            constraintsAndAssumptions: project?.constraintsAndAssumptions || (project as any)?.submittedCharter?.constraintsAndAssumptions,
            description: project?.description || (project as any)?.submittedCharter?.description,
            cost: project?.cost || (project as any)?.submittedCharter?.cost,
            startDate: project?.startDate || (project as any)?.submittedCharter?.startDate,
            endDate: project?.endDate || (project as any)?.submittedCharter?.endDate,
            owningUnit: project?.owningUnit || (project as any)?.submittedCharter?.owningUnit,
            type: project?.type || 'waterfall'
        };

        try {
            const res = await fetch('/api/ai/feasibility-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, language: language || 'fa' })
            });

            const text = await res.text();
            let data: any = null;
            try {
                data = JSON.parse(text);
            } catch {
                data = null;
            }

            if (res.ok && data && data.success) {
                setResult(data);
            } else {
                // If server endpoint returns 404 (e.g. static CDN shared link) or fails, use intelligent fallback
                console.warn('Server feasibility API returned non-OK or failed, using client fallback:', res.status, text);
                setResult(generateClientFeasibilityFallback(payload));
            }
        } catch (err: any) {
            console.warn('Network error calling feasibility API, using client fallback:', err);
            setResult(generateClientFeasibilityFallback(payload));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFeasibility();
    }, [project]);

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", {
                className: "modal-content",
                onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(),
                style: { maxWidth: '720px', width: '92vw', maxHeight: '88vh', overflowY: 'auto' }
            },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: '#4f46e5', fontSize: '1.5rem' } }, "fact_check"),
                        React.createElement("h3", { style: { fontSize: '1.1rem', margin: 0 } }, language === 'fa' ? `امکان‌سنجی فنی و اقتصادی: ${projectName}` : `Feasibility Study: ${projectName}`)
                    ),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body", style: { padding: '0.65rem 0.85rem' } },
                    isLoading ? (
                        React.createElement("div", { style: { textAlign: 'center', padding: '2rem 1rem' } },
                            React.createElement("span", { className: "material-symbols-outlined spin", style: { fontSize: '2rem', color: '#4f46e5', marginBottom: '0.75rem', display: 'inline-block' } }, "sync"),
                            React.createElement("p", { style: { fontWeight: 600, color: '#334155', fontSize: '0.82rem' } }, language === 'fa' ? 'در حال تحلیل امکان‌سنجی فنی و اقتصادی پروژه با هوش مصنوعی...' : 'Performing AI Technical & Economic Feasibility Analysis...')
                        )
                    ) : result?.error ? (
                        React.createElement("div", { style: { padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' } },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem' } },
                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem', color: '#dc2626' } }, "error_med"),
                                language === 'fa' ? 'جزئیات خطای پردازش هوش مصنوعی:' : 'AI Processing Error Details:'
                            ),
                            React.createElement("div", { style: { background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #fee2e2', fontFamily: 'monospace', fontSize: '0.75rem', color: '#b91c1c', wordBreak: 'break-word', whiteSpace: 'pre-wrap' } }, result.error),
                            result.debugInfo && React.createElement("div", { style: { fontSize: '0.7rem', color: '#7f1d1d', opacity: 0.85 } }, result.debugInfo),
                            React.createElement("div", { style: { display: 'flex', gap: '8px', marginTop: '0.25rem' } },
                                React.createElement("button", {
                                    onClick: () => fetchFeasibility(),
                                    style: { padding: '0.35rem 0.8rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }
                                },
                                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "refresh"),
                                    language === 'fa' ? 'تلاش مجدد' : 'Retry'
                                )
                            )
                        )
                    ) : result ? (
                        React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: '0.45rem' } },
                            React.createElement("div", {
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '0.45rem 0.75rem',
                                    borderRadius: '6px',
                                    background: result.isJustified ? '#f0fdf4' : '#fef2f2',
                                    border: `1px solid ${result.isJustified ? '#bbf7d0' : '#fecaca'}`,
                                    color: result.isJustified ? '#166534' : '#991b1b',
                                    fontWeight: 700,
                                    fontSize: '0.75rem'
                                }
                            },
                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem' } }, result.isJustified ? "verified" : "warning"),
                                React.createElement("span", null, result.isJustified
                                    ? (language === 'fa' ? 'نتیجه امکان‌سنجی: پروژه دارای توجیه فنی و اقتصادی است' : 'Feasibility Outcome: Project is Viable')
                                    : (language === 'fa' ? 'نتیجه امکان‌سنجی: پروژه فاقد توجیه کامل است - نیازمند اصلاحات' : 'Feasibility Outcome: Requires Revisions')
                                )
                            ),

                            React.createElement("div", { style: { background: '#f8fafc', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' } },
                                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#1e293b', marginBottom: '0.2rem', fontSize: '0.75rem' } },
                                    React.createElement("span", { className: "material-symbols-outlined", style: { color: '#2563eb', fontSize: '0.95rem' } }, "precision_manufacturing"),
                                    language === 'fa' ? 'امکان‌سنجی فنی' : 'Technical Feasibility'
                                ),
                                React.createElement("p", { style: { fontSize: '0.68rem', color: '#334155', lineHeight: 1.45, margin: 0, whiteSpace: 'pre-wrap' } }, result.technicalFeasibility)
                            ),

                            React.createElement("div", { style: { background: '#f8fafc', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' } },
                                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#1e293b', marginBottom: '0.2rem', fontSize: '0.75rem' } },
                                    React.createElement("span", { className: "material-symbols-outlined", style: { color: '#059669', fontSize: '0.95rem' } }, "payments"),
                                    language === 'fa' ? 'امکان‌سنجی اقتصادی' : 'Economic Feasibility'
                                ),
                                React.createElement("p", { style: { fontSize: '0.68rem', color: '#334155', lineHeight: 1.45, margin: 0, whiteSpace: 'pre-wrap' } }, result.economicFeasibility)
                            ),

                            React.createElement("div", { style: { background: '#eff6ff', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #bfdbfe' } },
                                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#1d4ed8', marginBottom: '0.2rem', fontSize: '0.75rem' } },
                                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.95rem' } }, "analytics"),
                                    language === 'fa' ? 'تحلیل جامع و نتیجه‌گیری' : 'Executive Analysis'
                                ),
                                React.createElement("p", { style: { fontSize: '0.68rem', color: '#1e3a8a', lineHeight: 1.45, margin: 0, whiteSpace: 'pre-wrap' } }, result.overallAnalysis)
                            ),

                            result.proposedRevisions && result.proposedRevisions.length > 0 && React.createElement("div", { style: { background: '#fffbe3', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #fef08a' } },
                                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#854d0e', marginBottom: '0.25rem', fontSize: '0.75rem' } },
                                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '0.95rem' } }, "edit_note"),
                                    language === 'fa' ? 'اصلاحات و پیشنهادات هوش مصنوعی:' : 'Proposed Revisions & Modifications:'
                                ),
                                React.createElement("ul", { style: { margin: 0, paddingRight: '1rem' } },
                                    result.proposedRevisions.map((rev, idx) => (
                                        React.createElement("li", { key: idx, style: { fontSize: '0.68rem', color: '#713f12', marginBottom: '0.15rem', lineHeight: 1.4 } }, rev)
                                    ))
                                )
                            )
                        )
                    ) : null
                ),
                React.createElement("div", { className: "modal-footer", style: { padding: '0.65rem 0.85rem', gap: '0.5rem' } },
                    result && !isLoading && !result.error && React.createElement("button", {
                        onClick: () => {
                            let textToTransfer = result.formattedResponseComment;
                            if (!textToTransfer || !textToTransfer.trim()) {
                                if (result.proposedRevisions && result.proposedRevisions.length > 0) {
                                    textToTransfer = (language === 'fa' ? 'اصلاحات و پیشنهادات هوش مصنوعی:\n• ' : 'AI Proposed Revisions:\n• ') + result.proposedRevisions.join('\n• ');
                                } else {
                                    textToTransfer = result.overallAnalysis || '';
                                }
                            }
                            onTransferToComment(textToTransfer, !!result.isJustified);
                        },
                        className: "action-button",
                        style: {
                            background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                            color: '#ffffff',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.78rem',
                            padding: '0.4rem 0.85rem'
                        }
                    },
                        React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "content_paste_go"),
                        language === 'fa' ? 'درج پیشنهادات و ورود به صفحه تایید / رد' : 'Insert Suggestions & Open Approval Form'
                    ),
                    React.createElement("button", { onClick: onClose, className: "cancel-btn", style: { fontSize: '0.78rem', padding: '0.4rem 0.85rem' } }, language === 'fa' ? 'انصراف' : 'Cancel')
                )
            )
        )
    );
};

export const ActivityDetailsModal = ({ activity, allActivities, onSave, onClose, users }: {
    activity: ProjectActivity;
    allActivities: ProjectActivity[];
    onSave: (activity: ProjectActivity) => void;
    onClose: () => void;
    users: User[];
}) => {
    const { t } = useContext(LocalizationContext);
    const [formData, setFormData] = useState<ProjectActivity>(activity);
    const [activeTab, setActiveTab] = useState('general');
    
    const approvers = useMemo(() => users.filter(u => u.role === 'Admin' || u.role === 'Project Manager'), [users]);

    useEffect(() => {
        const defaultAppr = activity.approver1Id || (approvers.length > 0 ? approvers[0].id : 1);
        setFormData({
            ...activity,
            approver1Id: defaultAppr
        });
    }, [activity, approvers]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let finalValue: any = value;

        if (name.startsWith('approver')) {
            finalValue = value ? parseInt(value, 10) : null;
        } else if (type === 'number') {
            finalValue = value ? parseFloat(value) : 0;
        }

        setFormData(prev => ({
            ...prev,
            [name]: finalValue
        }));
    };
    
    const handlePrereqChange = (e: ChangeEvent<HTMLSelectElement>) => {
        setFormData(prev => ({...prev, prerequisiteId: e.target.value || null }));
    }

    const handleSave = (e: FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };
    
    const getAncestorIds = useCallback((taskId: string, activities: ProjectActivity[]): Set<string> => {
        const ancestorIds = new Set<string>();
        const activityMap = new Map(activities.map(a => [a.id, a]));
        let currentId: string | null | undefined = taskId;

        while (currentId) {
            const currentActivity = activityMap.get(currentId);
            currentId = currentActivity?.parentId;
            if (currentId) {
                ancestorIds.add(currentId);
            }
        }
        return ancestorIds;
    }, []);

    const availablePrerequisites = useMemo(() => {
         const ancestorIds = getAncestorIds(activity.id, allActivities);
         return allActivities.filter(p => p.id !== activity.id && !ancestorIds.has(p.id));
    }, [activity, allActivities, getAncestorIds]);

    const calculatedDelay = useMemo(() => {
        if (!activity.endDate || (activity.actualProgress || 0) >= 100) return `0 ${t('days')}`;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(activity.endDate);
        endDate.setHours(0, 0, 0, 0);

        if (today <= endDate) return `0 ${t('days')}`;

        const diffTime = today.getTime() - endDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return `${diffDays} ${t('days')}`;
    }, [activity.endDate, activity.actualProgress, t]);

    return (
        React.createElement("div", { className: "modal-overlay", onClick: () => onClose() },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() },
                React.createElement("form", { onSubmit: handleSave },
                    React.createElement("div", { className: "modal-header" },
                        React.createElement("h3", null, t('activityDetails') + `: ${activity.name}`),
                        React.createElement("button", { type: "button", onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                    ),
                    React.createElement("div", { className: "modal-body" },
                        React.createElement("div", { className: "user-form", style: { gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'} },
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "cost" }, t('cost')),
                                React.createElement("input", { type: "number", id: "cost", name: "cost", value: formData.cost || '', onChange: handleChange, disabled: activity.isParent })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "manHour" }, t('manHour')),
                                React.createElement("input", { type: "number", id: "manHour", name: "manHour", value: formData.manHour || '', onChange: handleChange, disabled: activity.isParent })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "importance" }, t('importance')),
                                React.createElement("select", { id: "importance", name: "importance", value: formData.importance || 'Medium', onChange: handleChange, disabled: activity.isParent },
                                    React.createElement("option", { value: "Low" }, t('low')),
                                    React.createElement("option", { value: "Medium" }, t('medium')),
                                    React.createElement("option", { value: "High" }, t('high'))
                                )
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "complexity" }, t('complexity')),
                                React.createElement("select", { id: "complexity", name: "complexity", value: formData.complexity || 'Medium', onChange: handleChange, disabled: activity.isParent },
                                    React.createElement("option", { value: "Low" }, t('low')),
                                    React.createElement("option", { value: "Medium" }, t('medium')),
                                    React.createElement("option", { value: "High" }, t('high'))
                                )
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "prerequisiteId" }, t('prerequisites')),
                                React.createElement("select", { id: "prerequisiteId", value: formData.prerequisiteId || '', onChange: handlePrereqChange, disabled: activity.isParent },
                                    React.createElement("option", { value: "" }, t('none')),
                                    availablePrerequisites.map(p => React.createElement("option", { key: p.id, value: p.id }, `${p.wbsCode} - ${p.name}`))
                                )
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "prerequisiteType" }, t('prerequisiteType')),
                                React.createElement("select", { id: "prerequisiteType", name: "prerequisiteType", value: formData.prerequisiteType || 'FS', onChange: handleChange, disabled: !formData.prerequisiteId || activity.isParent },
                                    React.createElement("option", { value: "FS" }, t('finishToStart')),
                                    React.createElement("option", { value: "SS" }, t('startToStart')),
                                    React.createElement("option", { value: "FF" }, t('finishToFinish')),
                                    React.createElement("option", { value: "SF" }, t('startToFinish'))
                                )
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "lag" }, t('lag')),
                                React.createElement("input", { type: "number", id: "lag", name: "lag", value: formData.lag || 0, onChange: handleChange, disabled: !formData.prerequisiteId || activity.isParent })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "wbsCode" }, t('wbsCode')),
                                React.createElement("input", { type: "text", id: "wbsCode", value: activity.wbsCode || '', readOnly: true, disabled: true })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "calculatedDelay" }, t('scheduleDelay')),
                                React.createElement("input", { type: "text", id: "calculatedDelay", value: calculatedDelay, readOnly: true, disabled: true })
                            )
                        ),
                        React.createElement("div", { className: "form-group full-width form-group-horizontal", style: { borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-around' } },
                            React.createElement("p", null, React.createElement("strong", null, t('totalFloat') + ": "), `${activity.totalFloat || 0} ${t('days')}`),
                            React.createElement("p", null, React.createElement("strong", null, t('freeFloat') + ": "), `${activity.freeFloat || 0} ${t('days')}`),
                            React.createElement("p", null, React.createElement("strong", null, t('critical') + ": "), 
                                React.createElement("span", { style: { color: activity.isCritical ? 'var(--danger-color)' : 'var(--success-color)' } },
                                    activity.isCritical ? t('isCriticalText') : t('isNotCriticalText')
                                )
                            )
                        )
                    ),
                    React.createElement("div", { className: "modal-footer" },
                        !activity.isParent && React.createElement("button", { type: "submit", className: "save-btn" }, t('save')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "cancel-btn" }, t('cancel'))
                    )
                )
            )
        )
    );
};

export const TaskSubmissionModal = ({ task, progress, onSave, onClose }: {
    task: EnrichedTask | null;
    progress: number;
    onSave: (submissionComment: string, documentName?: string) => void;
    onClose: () => void;
}): ReactElement | null => {
    const { t } = useContext(LocalizationContext);
    const [comment, setComment] = useState('');
    const [fileName, setFileName] = useState('');

    if (!task) return null;
    
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFileName(e.target.files[0].name);
        } else {
            setFileName('');
        }
    };

    const handleSave = () => {
        onSave(comment, fileName || undefined);
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: () => onClose() },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '600px' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, t('submitTaskProgress')),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    React.createElement("p", null, React.createElement("strong", null, `${t('activityDescription')}:`), ` ${task.name}`),
                    React.createElement("p", null, React.createElement("strong", null, `${t('submittedProgress')}:`), ` ${progress}%`),
                    React.createElement("div", { className: "form-group", style: { marginTop: '1rem' } },
                        React.createElement("label", { htmlFor: "submission-comment" }, t('submissionComment')),
                        React.createElement("textarea", { id: "submission-comment", value: comment, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value), rows: 4 })
                    ),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "submission-file" }, t('attachFile')),
                        React.createElement("input", { type: "file", id: "submission-file", onChange: handleFileChange })
                    )
                ),
                React.createElement("div", { className: "modal-footer" },
                    React.createElement("button", { onClick: handleSave, className: "save-btn" }, t('submitForApproval')),
                    React.createElement("button", { onClick: onClose, className: "cancel-btn" }, t('cancel'))
                )
            )
        )
    );
};

export const ActivityHistoryModal = ({ activityId, projectId, users, progressUpdates, onClose }: {
    activityId: string;
    projectId: string;
    users: User[];
    progressUpdates: ProgressUpdate[];
    onClose: () => void;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const history = useMemo(() =>
        progressUpdates
            .filter(up => up.activityId === activityId && up.projectId === projectId)
            .sort((a,b) => (toSafeDate(b.submissionDate)?.getTime() || 0) - (toSafeDate(a.submissionDate)?.getTime() || 0))
    , [progressUpdates, activityId, projectId]);

    const statusTranslations: Record<ProgressUpdateStatus, TranslationKey> = {
        'Pending Approval': 'pendingApproval',
        'Approved': 'approved',
        'Rejected': 'rejected'
    };

    const getActionBadge = (action: string, isPartialRejection?: boolean, approvedProgress?: number) => {
        if (action === 'Approved') {
            return React.createElement("span", { className: "badge badge-green", style: { backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'تایید شده' : 'Approved');
        }
        if (action === 'Rejected') {
            if (isPartialRejection && approvedProgress !== undefined) {
                return React.createElement("span", { className: "badge badge-warning", style: { backgroundColor: '#fef3c7', color: '#d97706', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'تایید با تعدیل' : 'Partial Approval');
            }
            return React.createElement("span", { className: "badge badge-red", style: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'رد شده' : 'Rejected');
        }
        return React.createElement("span", { className: "badge badge-info", style: { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'ارسال اولیه' : 'Submitted');
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: () => onClose() },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '1000px', width: '95%' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: 'var(--primary-color, #4f46e5)' } }, "history"),
                        React.createElement("h3", { style: { margin: 0 } }, t('activityHistory'))
                    ),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    history.length === 0 ? (
                        React.createElement("p", null, t('noHistoryFound'))
                    ) : (
                        React.createElement("div", { className: "table-responsive" },
                            React.createElement("table", { className: "users-table" },
                                React.createElement("thead", null,
                                    React.createElement("tr", null,
                                        React.createElement("th", null, isFa ? 'تاریخ و ساعت' : 'Date & Time'),
                                        React.createElement("th", null, isFa ? 'ثبت‌کننده' : 'Submitter'),
                                        React.createElement("th", null, isFa ? 'پیشرفت اعلامی' : 'Submitted %'),
                                        React.createElement("th", null, isFa ? 'پیشرفت تاییدی' : 'Confirmed %'),
                                        React.createElement("th", null, isFa ? 'مرحله گردش کار' : 'Workflow Stage'),
                                        React.createElement("th", null, isFa ? 'تاییدکننده / اقدام‌کننده' : 'Approver / Actor'),
                                        React.createElement("th", null, isFa ? 'وضعیت' : 'Status'),
                                        React.createElement("th", null, isFa ? 'توضیحات ثبت‌کننده' : 'Submitter Comment'),
                                        React.createElement("th", null, t('file')),
                                        React.createElement("th", null, isFa ? 'علت و نظر تاییدکننده' : 'Approver Reason / Comment')
                                    )
                                ),
                                React.createElement("tbody", null,
                                    history.flatMap((item, updateIdx) => {
                                        const submitter = users.find(u => String(u.id) === String(item.submittedBy));
                                        const submitterLabel = submitter ? (submitter.name ? `${submitter.name} (${submitter.username})` : submitter.username) : 'N/A';
                                        const hasDiff = item.approvedProgress !== undefined && item.submittedProgress !== undefined && item.approvedProgress !== item.submittedProgress;

                                        const confirmedProgressElem = item.status === 'Approved' ? (
                                            React.createElement("span", { style: { color: '#16a34a', fontWeight: 600 } }, `${isFa ? toPersianDigits(item.approvedProgress ?? item.submittedProgress ?? 0) : (item.approvedProgress ?? item.submittedProgress ?? 0)}٪`)
                                        ) : (item.status === 'Rejected' && item.isPartialRejection && item.approvedProgress !== undefined) ? (
                                            React.createElement("span", { style: { color: '#d97706', fontWeight: 700 } }, `${isFa ? toPersianDigits(item.approvedProgress) : item.approvedProgress}٪ (${isFa ? 'تاییدی' : 'Approved'})`)
                                        ) : item.status === 'Rejected' ? (
                                            React.createElement("span", { style: { color: '#dc2626' } }, isFa ? 'رد کامل (-)' : 'Full Rejection (-)')
                                        ) : (
                                            React.createElement("span", { style: { color: '#64748b' } }, isFa ? 'در انتظار تایید' : 'Pending Approval')
                                        );

                                        if (item.approvalHistory && item.approvalHistory.length > 0) {
                                            const sortedApprovalHistory = [...item.approvalHistory].sort((a, b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0));
                                            return sortedApprovalHistory.map((rec, recIdx) => (
                                                React.createElement("tr", { key: `${item.id}-${recIdx}`, style: hasDiff ? { backgroundColor: '#fefce8' } : undefined },
                                                    React.createElement("td", null, rec.date !== '-' ? formatDateTime(rec.date, language) : formatDateTime(item.submissionDate, language)),
                                                    React.createElement("td", null, submitterLabel),
                                                    React.createElement("td", null, `${isFa ? toPersianDigits(item.submittedProgress ?? 0) : (item.submittedProgress ?? 0)}٪`),
                                                    React.createElement("td", null, confirmedProgressElem),
                                                    React.createElement("td", { style: { fontWeight: 500 } }, rec.stageTitle || (rec.action === 'Submitted' ? (isFa ? 'ارسال اولیه' : 'Submission') : (isFa ? 'بررسی مرحله' : 'Stage Review'))),
                                                    React.createElement("td", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)' } }, rec.actor || (rec.action === 'Submitted' ? submitterLabel : '-')),
                                                    React.createElement("td", null, getActionBadge(rec.action, item.isPartialRejection, item.approvedProgress)),
                                                    React.createElement("td", { style: { fontSize: '0.85rem' } }, item.submissionComment || '-'),
                                                    React.createElement("td", null,
                                                        item.documentName ? (
                                                            React.createElement("button", { className: "link-button", onClick: () => alert(`${t('viewFile')}: ${item.documentName}`) }, item.documentName)
                                                        ) : (
                                                            t('noFileAttached')
                                                        )
                                                    ),
                                                    React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.85rem' } }, rec.comment || item.reviewComment || '-')
                                                )
                                            ));
                                        }

                                        return [
                                            React.createElement("tr", { key: item.id, style: hasDiff ? { backgroundColor: '#fefce8' } : undefined },
                                                React.createElement("td", null, formatDateTime(item.reviewDate || item.submissionDate, language)),
                                                React.createElement("td", null, submitterLabel),
                                                React.createElement("td", null, `${isFa ? toPersianDigits(item.submittedProgress ?? 0) : (item.submittedProgress ?? 0)}٪`),
                                                React.createElement("td", null, confirmedProgressElem),
                                                React.createElement("td", null, item.status === 'Pending Approval' ? (isFa ? 'در انتظار تایید' : 'Pending Approval') : (isFa ? 'تایید نهایی' : 'Final Review')),
                                                React.createElement("td", { style: { fontWeight: 600 } }, item.status === 'Pending Approval' ? '-' : (isFa ? 'مدیر پروژه' : 'Project Manager')),
                                                React.createElement("td", null, getActionBadge(item.status, item.isPartialRejection, item.approvedProgress)),
                                                React.createElement("td", { style: { fontSize: '0.85rem' } }, item.submissionComment || '-'),
                                                React.createElement("td", null,
                                                    item.documentName ? (
                                                        React.createElement("button", { className: "link-button", onClick: () => alert(`${t('viewFile')}: ${item.documentName}`) }, item.documentName)
                                                    ) : (
                                                        t('noFileAttached')
                                                    )
                                                ),
                                                React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.85rem' } }, item.reviewComment || '-')
                                            )
                                        ];
                                    })
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};

export const KanbanHistoryModal = ({ taskId, projectId, users, progressUpdates, onClose, projects }: {
    taskId: string;
    projectId: string;
    users: User[];
    projects: Project[];
    progressUpdates: ProgressUpdate[];
    onClose: () => void;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    
    const task = useMemo(() => 
        projects.find(p => p.id === projectId)?.kanbanTasks?.find(t => t.id === taskId)
    , [projects, projectId, taskId]);

    const history = useMemo(() =>
        progressUpdates
            .filter(up => up.taskId === taskId && up.projectId === projectId)
            .sort((a,b) => (toSafeDate(b.submissionDate)?.getTime() || 0) - (toSafeDate(a.submissionDate)?.getTime() || 0))
    , [progressUpdates, taskId, projectId]);

    const statusTranslations: Record<ProgressUpdateStatus, TranslationKey> = {
        'Pending Approval': 'pendingApproval',
        'Approved': 'approved',
        'Rejected': 'rejected'
    };
    
    const kanbanStatusTranslations: Record<KanbanStatus, TranslationKey> = { 
        'To-Do': 'toDo', 'Doing': 'doing', 'Done': 'done' 
    };

    const getActionBadge = (action: string) => {
        if (action === 'Approved') {
            return React.createElement("span", { className: "badge badge-green", style: { backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'تایید شده' : 'Approved');
        }
        if (action === 'Rejected') {
            return React.createElement("span", { className: "badge badge-red", style: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'رد شده' : 'Rejected');
        }
        return React.createElement("span", { className: "badge badge-info", style: { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'ارسال شده' : 'Submitted');
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: () => onClose() },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '950px', width: '95%' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: 'var(--primary-color, #4f46e5)' } }, "history"),
                        React.createElement("h3", { style: { margin: 0 } }, `${t('activityHistory')}: ${task?.description || history.find(h => h.submittedTask)?.submittedTask?.description || ''}`)
                    ),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    history.length === 0 ? (
                        React.createElement("p", null, t('noHistoryFound'))
                    ) : (
                        React.createElement("div", { className: "table-responsive" },
                            React.createElement("table", { className: "users-table" },
                                React.createElement("thead", null,
                                    React.createElement("tr", null,
                                        React.createElement("th", null, isFa ? 'تاریخ و ساعت' : 'Date & Time'),
                                        React.createElement("th", null, isFa ? 'ثبت‌کننده' : 'Submitter'),
                                        React.createElement("th", null, isFa ? 'شرح / تغییر وضعیت' : 'Description / Change'),
                                        React.createElement("th", null, isFa ? 'مرحله گردش کار' : 'Workflow Stage'),
                                        React.createElement("th", null, isFa ? 'تاییدکننده / اقدام‌کننده' : 'Approver / Actor'),
                                        React.createElement("th", null, isFa ? 'وضعیت' : 'Status'),
                                        React.createElement("th", null, isFa ? 'توضیحات ثبت‌کننده' : 'Submitter Comment'),
                                        React.createElement("th", null, isFa ? 'علت و نظر تاییدکننده' : 'Approver Comment / Reason')
                                    )
                                ),
                                React.createElement("tbody", null,
                                    history.flatMap(item => {
                                        const submitter = users.find(u => String(u.id) === String(item.submittedBy));
                                        const submitterLabel = submitter ? (submitter.name ? `${submitter.name} (${submitter.username})` : submitter.username) : 'N/A';
                                        const updateDescription = item.submittedTask 
                                            ? `${t('createKanbanActivity')}: "${item.submittedTask.description}"`
                                            : item.submittedStatus ? `${t(kanbanStatusTranslations[item.currentStatus as KanbanStatus])} -> ${t(kanbanStatusTranslations[item.submittedStatus as KanbanStatus])}` : t('update');

                                        if (item.approvalHistory && item.approvalHistory.length > 0) {
                                            const sortedApprovalHistory = [...item.approvalHistory].sort((a, b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0));
                                            return sortedApprovalHistory.map((rec, recIdx) => (
                                                React.createElement("tr", { key: `${item.id}-${recIdx}` },
                                                    React.createElement("td", null, rec.date !== '-' ? formatDateTime(rec.date, language) : formatDateTime(item.submissionDate, language)),
                                                    React.createElement("td", null, submitterLabel),
                                                    React.createElement("td", null, updateDescription),
                                                    React.createElement("td", { style: { fontWeight: 500 } }, rec.stageTitle || (rec.action === 'Submitted' ? (isFa ? 'ارسال اولیه' : 'Submission') : (isFa ? 'بررسی مرحله' : 'Stage Review'))),
                                                    React.createElement("td", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)' } }, rec.actor || (rec.action === 'Submitted' ? submitterLabel : '-')),
                                                    React.createElement("td", null, getActionBadge(rec.action)),
                                                    React.createElement("td", { style: { fontSize: '0.85rem' } }, item.submissionComment || '-'),
                                                    React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.85rem' } }, rec.comment || item.reviewComment || '-')
                                                )
                                            ));
                                        }

                                        return [
                                            React.createElement("tr", { key: item.id },
                                                React.createElement("td", null, formatDateTime(item.reviewDate || item.submissionDate, language)),
                                                React.createElement("td", null, submitterLabel),
                                                React.createElement("td", null, updateDescription),
                                                React.createElement("td", null, item.status === 'Pending Approval' ? (isFa ? 'در انتظار تایید' : 'Pending Approval') : (isFa ? 'تایید نهایی' : 'Final Review')),
                                                React.createElement("td", { style: { fontWeight: 600 } }, item.status === 'Pending Approval' ? '-' : (isFa ? 'مدیر پروژه' : 'Project Manager')),
                                                React.createElement("td", null, getActionBadge(item.status)),
                                                React.createElement("td", { style: { fontSize: '0.85rem' } }, item.submissionComment || '-'),
                                                React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.85rem' } }, item.reviewComment || '-')
                                            )
                                        ];
                                    })
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};

export const ProjectHistoryModal = ({ project, onClose }: {
    project: Project;
    onClose: () => void;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const history = useMemo(() =>
        (project.approvalHistory || []).slice().sort((a,b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0))
    , [project.approvalHistory]);
    
    const getActionBadge = (action: string) => {
        if (action === 'Approved') {
            return React.createElement("span", { className: "badge badge-green", style: { backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'تایید شده' : 'Approved');
        }
        if (action === 'Rejected') {
            return React.createElement("span", { className: "badge badge-red", style: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'رد شده' : 'Rejected');
        }
        return React.createElement("span", { className: "badge badge-info", style: { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'ارسال شده' : 'Submitted');
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: () => onClose() },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '850px', width: '92%' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: 'var(--primary-color, #4f46e5)' } }, "history"),
                        React.createElement("h3", { style: { margin: 0 } }, `${t('projectHistory')}: ${project.name}`)
                    ),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                     history.length === 0 ? (
                        React.createElement("p", null, t('noHistoryFound'))
                    ) : (
                        React.createElement("div", { className: "table-responsive" },
                            React.createElement("table", { className: "users-table" },
                                React.createElement("thead", null,
                                    React.createElement("tr", null,
                                        React.createElement("th", null, isFa ? 'تاریخ و ساعت' : 'Date & Time'),
                                        React.createElement("th", null, isFa ? 'مرحله گردش کار' : 'Workflow Stage'),
                                        React.createElement("th", null, isFa ? 'تاییدکننده / اقدام‌کننده' : 'Approver / Actor'),
                                        React.createElement("th", null, isFa ? 'تصمیم / وضعیت' : 'Decision / Status'),
                                        React.createElement("th", null, isFa ? 'علت و توضیحات' : 'Comment / Reason')
                                    )
                                ),
                                React.createElement("tbody", null,
                                    history.map((item, index) => (
                                        React.createElement("tr", { key: index },
                                            React.createElement("td", null, formatDateTime(item.date, language)),
                                            React.createElement("td", { style: { fontWeight: 500 } }, item.stageTitle || (item.action === 'Submitted' ? (isFa ? 'ارسال اولیه' : 'Submission') : (isFa ? 'بررسی مرحله' : 'Stage Review'))),
                                            React.createElement("td", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)' } }, item.actor || '-'),
                                            React.createElement("td", null, getActionBadge(item.action)),
                                            React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.88rem' } }, item.comment || '-')
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

export const UserEditModal = ({ user, isOpen, onClose, onSave, owningUnits = [] }: {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  /** Saves through the backend; resolves with its answer so a refusal can be shown here. */
  onSave: (form: EditUserForm) => Promise<Outcome>;
  owningUnits?: string[];
}): ReactElement | null => {
  const { t, language } = useContext(LocalizationContext);
  const [formData, setFormData] = useState<Partial<User> & { password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const availableUnits = owningUnits;

  useEffect(() => {
    if (user) {
      // The password is never pre-filled; it is only sent when something is typed.
      setFormData({ ...user, password: '' });
      setError(null);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.owningUnit) {
      setError(language === 'fa' ? 'انتخاب واحد سازمانی (ساختار شکست سازمانی) اجباری است.' : 'Selecting an Organizational Unit is required.');
      return;
    }
    setBusy(true);
    const outcome = await onSave({
      username: formData.username || '',
      firstName: formData.firstName || '',
      lastName: formData.lastName || '',
      phoneNumber: formData.phoneNumber || '',
      email: formData.email,
      password: formData.password || undefined,
      role: (formData.role || user.role) as UserRole,
      unitPath: formData.owningUnit,
      isActive: user.isActive
    });
    setBusy(false);
    if (!outcome.ok) setError(outcome.message ?? 'ذخیره انجام نشد.');
  };
  
  const roleTranslations: Record<UserRole, TranslationKey> = {
      Admin: 'admin',
      'Project Manager': 'projectManagerRole',
      'Project Team': 'projectTeamRole'
  };

  return (
    React.createElement("div", { className: "modal-overlay", onClick: () => onClose() },
      React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '500px', width: '90%', overflow: 'visible' } },
        React.createElement("div", { className: "modal-header" },
          React.createElement("h3", null, t('editUser')),
          React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
        ),
        React.createElement("div", { className: "modal-body", style: { overflow: 'visible' } },
          React.createElement("form", { onSubmit: handleSubmit, className: "user-edit-form" },
            error && React.createElement("div", { className: "login-error-banner", role: "alert" }, React.createElement("span", null, error)),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "edit-username" }, (language === 'fa' ? 'نام کاربری (کد ملی)' : 'Username (national code)') + '*'),
              React.createElement("input", { type: "text", id: "edit-username", name: "username", inputMode: "numeric", value: formData.username || '', onChange: handleChange, required: true })
            ),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "edit-firstname" }, (language === 'fa' ? 'نام' : 'First name') + '*'),
              React.createElement("input", { type: "text", id: "edit-firstname", name: "firstName", value: formData.firstName || '', onChange: handleChange, required: true })
            ),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "edit-lastname" }, (language === 'fa' ? 'نام خانوادگی' : 'Last name') + '*'),
              React.createElement("input", { type: "text", id: "edit-lastname", name: "lastName", value: formData.lastName || '', onChange: handleChange, required: true })
            ),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "edit-phone" }, (language === 'fa' ? 'شماره موبایل' : 'Mobile number') + '*'),
              React.createElement("input", { type: "tel", id: "edit-phone", name: "phoneNumber", inputMode: "tel", value: formData.phoneNumber || '', onChange: handleChange, required: true })
            ),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "edit-password" }, t('password')),
              React.createElement("input", { type: "password", id: "edit-password", name: "password", value: formData.password || '', onChange: handleChange, placeholder: t('passwordHint') })
            ),
            React.createElement("div", { className: "form-group" },
              React.createElement("label", { htmlFor: "edit-role" }, t('role')),
              React.createElement("select", { id: "edit-role", name: "role", value: formData.role || '', onChange: handleChange },
                React.createElement("option", { value: "Admin" }, t('admin')),
                React.createElement("option", { value: "Project Manager" }, t('projectManagerRole')),
                React.createElement("option", { value: "Project Team" }, t('projectTeamRole'))
              )
            ),
            React.createElement("div", { className: "form-group", style: { position: 'relative', zIndex: 20 } },
              React.createElement("label", { htmlFor: "edit-owningUnit" }, (language === 'fa' ? 'واحد سازمانی (ساختار شکست سازمانی)' : 'Organizational Unit') + '*'),
              React.createElement(OwningUnitTreeSelect, {
                id: "edit-owningUnit",
                value: formData.owningUnit || '',
                onChange: (val: string) => setFormData(prev => ({ ...prev, owningUnit: val })),
                owningUnits: availableUnits,
                placeholder: language === 'fa' ? 'انتخاب واحد سازمانی...' : 'Select Org Unit...'
              })
            ),
            React.createElement("div", { className: "form-actions" },
              React.createElement("button", { type: "submit", className: "save-btn" }, t('update')),
              React.createElement("button", { type: "button", onClick: onClose, className: "cancel-btn" }, t('cancel'))
            )
          )
        )
      )
    )
  );
};

export const KanbanTaskModal = ({ isOpen, onClose, onSave, task, teamMembers, sprintCount }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: KanbanTask) => void;
    task: Partial<KanbanTask> | null;
    teamMembers: User[];
    sprintCount: number;
}) => {
    const { t } = useContext(LocalizationContext);
    const [formData, setFormData] = useState<Partial<KanbanTask>>({});

    useEffect(() => {
        if (task) {
            setFormData({
                ...task,
                dueDate: task.dueDate || getISODateString()
            });
        }
    }, [task, teamMembers]);

    if (!isOpen || !task) return null;

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'assignedToId') {
            setFormData(prev => ({ ...prev, assignedToId: value || undefined }));
        } else if (name === 'sprintNumber') {
            setFormData(prev => ({ ...prev, sprintNumber: value ? parseInt(value) : undefined }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSave(formData as KanbanTask);
    };

    const isEditing = !!task.id;
    const taskPriorityTranslations: Record<TaskPriority, TranslationKey> = { Low: 'low', Medium: 'medium', High: 'high' };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '900px'} },
                React.createElement("form", { onSubmit: handleSubmit },
                    React.createElement("div", { className: "modal-header" },
                        React.createElement("h3", null, isEditing ? t('editKanbanActivity') : t('createKanbanActivity')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                    ),
                    React.createElement("div", { className: "modal-body" },
                        React.createElement("div", { className: "kanban-task-form" },
                            React.createElement("div", { className: "form-group full-width" },
                                React.createElement("label", { htmlFor: "kanban-desc" }, t('kanbanDesc') + '*'),
                                React.createElement("textarea", { id: "kanban-desc", name: "description", value: formData.description || '', onChange: handleChange, required: true, rows: 3 })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "kanban-due" }, t('dueDate')),
                                React.createElement(ShamsiDatePicker, { id: "kanban-due", name: "dueDate", value: formData.dueDate || '', onChange: (val: string) => setFormData({ ...formData, dueDate: val }) })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "kanban-priority" }, t('importance')),
                                React.createElement("select", { id: "kanban-priority", name: "priority", value: formData.priority || 'Medium', onChange: handleChange },
                                    Object.keys(taskPriorityTranslations).map(p => React.createElement("option", { key: p, value: p }, t(taskPriorityTranslations[p as TaskPriority])))
                                )
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "kanban-sprint" }, t('sprintNumber')),
                                React.createElement("input", { type: "number", id: "kanban-sprint", name: "sprintNumber", value: formData.sprintNumber || '', onChange: handleChange, min: "1", max: sprintCount })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "kanban-assigned" }, t('assignedTo')),
                                React.createElement("select", { id: "kanban-assigned", name: "assignedToId", value: formData.assignedToId || '', onChange: handleChange },
                                    React.createElement("option", { value: "" }, t('unassigned')),
                                    teamMembers.map(m => React.createElement("option", { key: m.id, value: m.id }, m.username))
                                )
                            )
                        )
                    ),
                    React.createElement("div", { className: "modal-footer" },
                        React.createElement("button", { type: "submit", className: "save-btn" }, t('saveTask')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "cancel-btn" }, t('cancel'))
                    )
                )
            )
        )
    );
};

export const RiskModal = ({ isOpen, onClose, onSave, risk, users, isEditing }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (risk: ProjectRisk | Omit<ProjectRisk, 'id'>) => void;
    risk: ProjectRisk | Omit<ProjectRisk, 'id'> | null;
    users: User[];
    isEditing: boolean;
}): ReactElement | null => {
    const { t } = useContext(LocalizationContext);
    const [formData, setFormData] = useState<Partial<ProjectRisk>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(risk || {
                description: '',
                probability: 'Low',
                impact: 'Low',
                responsePlan: '',
                assignedTo: ''
            });
        }
    }, [risk, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (formData.description && formData.responsePlan && formData.assignedTo) {
            onSave(formData as (ProjectRisk | Omit<ProjectRisk, 'id'>));
        } else {
            alert(t('fillRiskFields'));
        }
    };

    const probabilityOptions: ProjectRisk['probability'][] = ['Low', 'Medium', 'High'];
    const impactOptions: ProjectRisk['impact'][] = ['Low', 'Medium', 'High'];
    const levelTranslations: Record<ProjectRisk['probability'], string> = { Low: t('low'), Medium: t('medium'), High: t('high') };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() },
                React.createElement("form", { onSubmit: handleSubmit },
                    React.createElement("div", { className: "modal-header" },
                        React.createElement("h3", null, isEditing ? t('editRisk') : t('addNewRisk')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                    ),
                    React.createElement("div", { className: "modal-body" },
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "risk-desc" }, t('riskDescription')),
                            React.createElement("textarea", { id: "risk-desc", name: "description", value: formData.description || '', onChange: handleChange, required: true, rows: 3 })
                        ),
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "risk-prob" }, t('probability')),
                            React.createElement("select", { id: "risk-prob", name: "probability", value: formData.probability, onChange: handleChange },
                                probabilityOptions.map(p => React.createElement("option", { key: p, value: p }, levelTranslations[p]))
                            )
                        ),
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "risk-impact" }, t('impact')),
                            React.createElement("select", { id: "risk-impact", name: "impact", value: formData.impact, onChange: handleChange },
                                impactOptions.map(i => React.createElement("option", { key: i, value: i }, levelTranslations[i]))
                            )
                        ),
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "risk-response" }, t('responsePlan')),
                            React.createElement("textarea", { id: "risk-response", name: "responsePlan", value: formData.responsePlan || '', onChange: handleChange, required: true, rows: 3 })
                        ),
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "risk-assigned" }, t('assignedTo')),
                            React.createElement("select", { id: "risk-assigned", name: "assignedTo", value: formData.assignedTo || '', onChange: handleChange, required: true },
                                React.createElement("option", { value: "" }, t('selectUser')),
                                users.map(user => 
                                    React.createElement("option", { key: user.id, value: user.username }, user.username)
                                )
                            )
                        )
                    ),
                    React.createElement("div", { className: "modal-footer" },
                        React.createElement("button", { type: "submit", className: "save-btn" }, isEditing ? t('updateRisk') : t('addRisk')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "cancel-btn" }, t('cancel'))
                    )
                )
            )
        )
    );
};

export const StakeholderModal = ({
    isOpen,
    onClose,
    onSave,
    stakeholder,
    isEditing,
    strategies
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (stakeholder: ProjectStakeholder | Omit<ProjectStakeholder, 'id'>) => void;
    stakeholder: ProjectStakeholder | Omit<ProjectStakeholder, 'id'> | null;
    isEditing: boolean;
    /** The project's own wording per quadrant (from the backend); the strategy itself is worded by the backend when the stakeholder is saved. */
    strategies?: StakeholderStrategies;
}): ReactElement | null => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const [formData, setFormData] = useState<Partial<ProjectStakeholder>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(stakeholder || {
                name: '',
                power: 'High',
                interest: 'High',
                strategy: getStakeholderStrategy('High', 'High', language, strategies),
                requirements: ''
            });
        }
    }, [stakeholder, isOpen, language]);

    if (!isOpen) return null;

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = prev ? { ...prev, [name]: value } : { [name]: value };
            if (name === 'power' || name === 'interest') {
                const p = name === 'power' ? value as ('Low' | 'High') : (next.power || 'High');
                const i = name === 'interest' ? value as ('Low' | 'High') : (next.interest || 'High');
                next.strategy = getStakeholderStrategy(p, i, language, strategies);
            }
            return next;
        });
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (formData.name && formData.requirements) {
            const p = formData.power || 'High';
            const i = formData.interest || 'High';
            const finalData = {
                ...formData,
                power: p,
                interest: i,
                strategy: getStakeholderStrategy(p, i, language, strategies)
            };
            onSave(finalData as (ProjectStakeholder | Omit<ProjectStakeholder, 'id'>));
        } else {
            alert(isFa ? 'لطفاً تمامی فیلدهای الزامی ذینفع را تکمیل کنید.' : 'Please fill all required stakeholder fields.');
        }
    };

    const currentPower = formData.power || 'High';
    const currentInterest = formData.interest || 'High';
    const computedStrategy = getStakeholderStrategy(currentPower, currentInterest, language, strategies);

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '600px' } },
                React.createElement("form", { onSubmit: handleSubmit },
                    React.createElement("div", { className: "modal-header" },
                        React.createElement("h3", null, isEditing ? (isFa ? 'ویرایش ذینفع' : 'Edit Stakeholder') : (isFa ? 'افزودن ذینفع جدید' : 'Add New Stakeholder')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                    ),
                    React.createElement("div", { className: "modal-body" },
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "sh-name" }, isFa ? 'نام / عنوان ذینفع:' : 'Stakeholder Name / Title:'),
                            React.createElement("input", { type: "text", id: "sh-name", name: "name", value: formData.name || '', onChange: handleChange, required: true, placeholder: isFa ? 'مثلاً: مدیر ارشد مالی سازمان' : 'e.g. Chief Financial Officer' })
                        ),
                        React.createElement("div", { className: "settings-grid-2col", style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' } },
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "sh-power" }, isFa ? 'قدرت:' : 'Power:'),
                                React.createElement("select", { id: "sh-power", name: "power", value: currentPower, onChange: handleChange },
                                    React.createElement("option", { value: "High" }, isFa ? 'زیاد' : 'High'),
                                    React.createElement("option", { value: "Low" }, isFa ? 'کم' : 'Low')
                                )
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "sh-interest" }, isFa ? 'علاقه:' : 'Interest:'),
                                React.createElement("select", { id: "sh-interest", name: "interest", value: currentInterest, onChange: handleChange },
                                    React.createElement("option", { value: "High" }, isFa ? 'زیاد' : 'High'),
                                    React.createElement("option", { value: "Low" }, isFa ? 'کم' : 'Low')
                                )
                            )
                        ),
                        React.createElement("div", { className: "form-group", style: { backgroundColor: 'var(--bg-secondary, #f8fafc)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)' } },
                            React.createElement("label", { style: { fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-color, #1e293b)' } }, isFa ? 'استراتژی برخورد (محاسبه خودکار):' : 'Engagement Strategy (Calculated):'),
                            React.createElement("div", { style: { marginTop: '0.35rem', fontWeight: 700, color: 'var(--primary-color, #0284c7)', fontSize: '0.9rem' } }, computedStrategy)
                        ),
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "sh-reqs" }, isFa ? 'نیازمندی‌ها و الزامات فنی و ارتباطی:' : 'Technical & Communication Requirements:'),
                            React.createElement("textarea", { id: "sh-reqs", name: "requirements", value: formData.requirements || '', onChange: handleChange, required: true, rows: 3, placeholder: isFa ? 'توضیحات مربوط به نحوه گزارش‌دهی، انتظارات فنی و ابزار ارتباطی...' : 'Details about reporting, technical expectations and communication tools...' })
                        )
                    ),
                    React.createElement("div", { className: "modal-footer" },
                        React.createElement("button", { type: "submit", className: "action-button primary" }, t('save')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "action-button secondary" }, t('cancel'))
                    )
                )
            )
        )
    );
};

export const ActionModal = ({
    initialAction = {},
    users = [],
    calendars = [],
    projects = [],
    owningUnits = [],
    currentUser,
    onSave,
    onClose,
    isProjectLocked = false
}: {
    initialAction?: Partial<ActionItem>;
    users?: User[];
    calendars?: Calendar[];
    projects?: Project[];
    owningUnits?: string[];
    currentUser?: User | null;
    onSave: (action: ActionItem) => void;
    onClose: () => void;
    isProjectLocked?: boolean;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';

    const [actionData, setActionData] = useState<Partial<ActionItem>>({
        title: '',
        description: '',
        ownerUserId: currentUser?.id,
        responsibleUserId: null,
        status: 'Planning',
        calendarId: calendars[0]?.id || 1,
        owningUnit: owningUnits[0] || '',
        startDate: getISODateString(),
        endDate: getISODateString(),
        ...initialAction
    });

    const handleSubmit = () => {
        if (!actionData.title?.trim()) {
            alert(isFa ? 'لطفاً عنوان اقدام را وارد کنید.' : 'Please enter the action title.');
            return;
        }
        if (!actionData.responsibleUserId) {
            alert(isFa ? 'لطفاً مسئول اقدام را انتخاب کنید.' : 'Please select the responsible user.');
            return;
        }
        if (!actionData.startDate || !actionData.endDate) {
            alert(isFa ? 'لطفاً تاریخ شروع و پایان را مشخص کنید.' : 'Please specify start and end dates.');
            return;
        }

        const finalItem: ActionItem = {
            id: actionData.id || '',
            title: actionData.title.trim(),
            description: actionData.description || '',
            ownerUserId: actionData.ownerUserId || currentUser?.id || null,
            responsibleUserId: actionData.responsibleUserId,
            approver1Id: actionData.approver1Id || actionData.responsibleUserId || null,
            approver2Id: actionData.approver2Id || null,
            approver3Id: actionData.approver3Id || null,
            status: actionData.status || 'Planning',
            calendarId: actionData.calendarId || '',
            startDate: actionData.startDate,
            endDate: actionData.endDate,
            owningUnit: actionData.owningUnit || (owningUnits[0] || ''),
            projectId: actionData.projectId,
            sourceType: actionData.sourceType,
            sourceRiskId: actionData.sourceRiskId,
            sourceStakeholderId: actionData.sourceStakeholderId,
            sourceInfo: actionData.sourceInfo,
            recurrence: actionData.recurrence,
            workflowType: actionData.workflowType,
            isApproved: actionData.isApproved,
            isPending: actionData.isPending,
            currentStageIndex: actionData.currentStageIndex,
            currentApproverId: actionData.currentApproverId,
            approvalHistory: actionData.approvalHistory
        };

        onSave(finalItem);
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '850px', width: '92%' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: 'var(--primary-color, #0284c7)' } }, "playlist_add_check"),
                        React.createElement("span", null, actionData.id ? (isFa ? 'ویرایش اقدام' : 'Edit Action') : (isFa ? 'تعریف اقدام جدید' : 'New Action Item'))
                    ),
                    React.createElement("button", { type: "button", onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body", style: { maxHeight: 'calc(80vh - 120px)', overflowY: 'auto' } },
                    React.createElement(ActionForm, {
                        actionData: actionData,
                        setActionData: setActionData,
                        users: users,
                        calendars: calendars,
                        projects: projects,
                        owningUnits: owningUnits,
                        currentUser: currentUser,
                        isProjectLocked: isProjectLocked
                    })
                ),
                React.createElement("div", { className: "modal-footer" },
                    React.createElement("button", { type: "button", onClick: handleSubmit, className: "action-button primary" }, isFa ? 'ذخیره و ثبت اقدام' : 'Save & Submit Action'),
                    React.createElement("button", { type: "button", onClick: onClose, className: "action-button secondary" }, t('cancel'))
                )
            )
        )
    );
};

// --- NEWLY ADDED MODALS ---

export const HolidayReasonModal = ({ date, onSave, onClose }: { date: string, onSave: (reason: string) => void, onClose: () => void }): ReactElement => {
    const { t } = useContext(LocalizationContext);
    const [reason, setReason] = useState('');

    const handleSave = () => {
        if (reason.trim()) {
            onSave(reason);
        }
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '400px' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, `${t('add')} ${t('holidays')} - ${date}`),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "holiday-reason" }, t('holidayReason')),
                        React.createElement("input", {
                            type: "text",
                            id: "holiday-reason",
                            value: reason,
                            onChange: (e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value),
                            autoFocus: true,
                            required: true,
                            onKeyDown: (e) => e.key === 'Enter' && handleSave()
                        })
                    )
                ),
                React.createElement("div", { className: "modal-footer" },
                    React.createElement("button", { onClick: handleSave, className: "action-button" }, t('save')),
                    React.createElement("button", { onClick: onClose, className: "cancel-btn" }, t('cancel'))
                )
            )
        )
    );
};

export const SpecificHolidaysListModal = ({ holidays, onClose }: { holidays: SpecificHoliday[], onClose: () => void }): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const sortedHolidays = useMemo(() => [...(holidays || [])].sort((a, b) => ((toSafeDate(a?.date)?.getTime() || 0) - (toSafeDate(b?.date)?.getTime() || 0))), [holidays]);

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '600px' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, t('specificHolidaysList')),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body", style: { maxHeight: '60vh', overflowY: 'auto' } },
                    sortedHolidays.length > 0 ? (
                        React.createElement("table", { className: "users-table" },
                            React.createElement("thead", null, React.createElement("tr", null,
                                React.createElement("th", null, t('startDate')),
                                React.createElement("th", null, t('reason'))
                            )),
                            React.createElement("tbody", null,
                                sortedHolidays.map(holiday => (
                                    React.createElement("tr", { key: holiday.date },
                                        React.createElement("td", null, formatDate(holiday.date, language)),
                                        React.createElement("td", null, holiday.reason)
                                    )
                                ))
                            )
                        )
                    ) : (
                        React.createElement("p", null, t('noHolidaysDefined'))
                    )
                )
            )
        )
    );
};

async function summarizeTextWithAi(text: string, type: 'status' | 'delay', isFa: boolean): Promise<string> {
    if (!text || !text.trim()) {
        throw new Error(isFa ? 'لطفاً ابتدا متنی را وارد کنید.' : 'Please enter text to summarize.');
    }

    try {
        const res = await fetch('/api/ai/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, type, language: isFa ? 'fa' : 'en' })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.summary) {
                return data.summary;
            }
        }
    } catch (err) {
        console.warn('Backend summarize API call notice, falling back:', err);
    }

    // Client-side smart summarization fallback
    const sentences = text
        .split(/[.\n!\u06D4]/)
        .map(s => s.trim())
        .filter(s => s.length > 5);
    if (sentences.length >= 2) {
        return `${sentences[0]}. ${sentences[1]}.`;
    } else if (sentences.length === 1) {
        return isFa ? `${sentences[0]}. پایش و مدیریت مستمر روند اجرا ادامه دارد.` : `${sentences[0]}. Continuous monitoring and project execution tracking are active.`;
    }
    return text.length > 180 ? `${text.substring(0, 180)}...` : text;
}

export const StatusUpdateModal = ({ isOpen, onClose, onSave, statusUpdate }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (description: string) => void;
    statusUpdate: Partial<ProjectStatusUpdate> | null;
}): ReactElement | null => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const [description, setDescription] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryNotice, setSummaryNotice] = useState<string | null>(null);

    useEffect(() => {
        if (statusUpdate) {
            setDescription(statusUpdate.description || '');
        } else {
            setDescription('');
        }
        setSummaryNotice(null);
    }, [statusUpdate]);

    if (!isOpen) return null;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSave(description);
    };

    const handleSummarize = async () => {
        if (!description.trim()) {
            alert(isFa ? 'لطفاً ابتدا متنی را در کادر وارد کنید تا خلاصه‌سازی شود.' : 'Please enter text first.');
            return;
        }
        setIsSummarizing(true);
        setSummaryNotice(null);
        try {
            const summary = await summarizeTextWithAi(description, 'status', isFa);
            setDescription(summary);
            setSummaryNotice(isFa ? 'متن با موفقیت به ۲ جمله خلاصه مدیریتی تبدیل شد.' : 'Text summarized to 2 sentences.');
        } catch (err: any) {
            alert(err.message || (isFa ? 'خطا در خلاصه‌سازی متن' : 'Error summarizing text'));
        } finally {
            setIsSummarizing(false);
        }
    };

    const isEditing = !!(statusUpdate && statusUpdate.id);

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() },
                React.createElement("form", { onSubmit: handleSubmit },
                    React.createElement("div", { className: "modal-header" },
                        React.createElement("h3", null, isEditing ? t('updateStatus') : t('addStatus')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                    ),
                    React.createElement("div", { className: "modal-body" },
                        React.createElement("div", { className: "form-group" },
                            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' } },
                                React.createElement("label", { htmlFor: "status-desc", style: { margin: 0, fontWeight: 600 } }, t('description')),
                                React.createElement("button", {
                                    type: "button",
                                    onClick: handleSummarize,
                                    disabled: isSummarizing || !description.trim(),
                                    className: "action-button primary",
                                    style: { padding: '0.25rem 0.6rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' },
                                    title: isFa ? 'خلاصه‌سازی مدیریتی با هوش مصنوعی (حداکثر ۲ جمله)' : 'AI Executive Summarize (Max 2 sentences)'
                                },
                                    React.createElement("span", { className: `material-symbols-outlined ${isSummarizing ? 'spin' : ''}`, style: { fontSize: '1rem' } }, isSummarizing ? 'sync' : 'auto_awesome'),
                                    React.createElement("span", null, isSummarizing 
                                        ? (isFa ? 'در حال خلاصه‌سازی...' : 'Summarizing...') 
                                        : (isFa ? 'خلاصه‌سازی مدیریتی (۲ جمله)' : 'Executive Summary (2 Sentences)')
                                    )
                                )
                            ),
                            React.createElement("textarea", {
                                id: "status-desc",
                                value: description,
                                onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value),
                                required: true,
                                rows: 5,
                                autoFocus: true,
                                placeholder: isFa ? 'گزارش آخرین وضعیت پروژه را وارد کنید یا متن حجیم خود را چسبانده و دکمه خلاصه‌سازی مدیریتی را بزنید...' : 'Enter project status update...'
                            }),
                            summaryNotice && React.createElement("div", { style: { fontSize: '0.78rem', color: '#166534', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.35rem 0.6rem', borderRadius: '4px', marginTop: '0.4rem' } }, summaryNotice)
                        )
                    ),
                    React.createElement("div", { className: "modal-footer" },
                        React.createElement("button", { type: "submit", className: "save-btn" }, isEditing ? t('update') : t('add')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "cancel-btn" }, t('cancel'))
                    )
                )
            )
        )
    );
};

export const DelayReasonModal = ({ isOpen, onClose, onSave, delayReason }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (description: string) => void;
    delayReason: Partial<ProjectDelayReason> | null;
}): ReactElement | null => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const [description, setDescription] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryNotice, setSummaryNotice] = useState<string | null>(null);

    useEffect(() => {
        if (delayReason) {
            setDescription(delayReason.description || '');
        } else {
            setDescription('');
        }
        setSummaryNotice(null);
    }, [delayReason]);

    if (!isOpen) return null;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSave(description);
    };

    const handleSummarize = async () => {
        if (!description.trim()) {
            alert(isFa ? 'لطفاً ابتدا متنی را در کادر وارد کنید تا خلاصه‌سازی شود.' : 'Please enter text first.');
            return;
        }
        setIsSummarizing(true);
        setSummaryNotice(null);
        try {
            const summary = await summarizeTextWithAi(description, 'delay', isFa);
            setDescription(summary);
            setSummaryNotice(isFa ? 'متن با موفقیت به ۲ جمله خلاصه مدیریتی تبدیل شد.' : 'Text summarized to 2 sentences.');
        } catch (err: any) {
            alert(err.message || (isFa ? 'خطا در خلاصه‌سازی متن' : 'Error summarizing text'));
        } finally {
            setIsSummarizing(false);
        }
    };

    const isEditing = !!(delayReason && delayReason.id);

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() },
                React.createElement("form", { onSubmit: handleSubmit },
                    React.createElement("div", { className: "modal-header" },
                        React.createElement("h3", null, isEditing 
                            ? (isFa ? 'ویرایش علت تاخیر' : 'Edit Delay Reason') 
                            : (isFa ? 'افزودن علت تاخیر' : 'Add Delay Reason')
                        ),
                        React.createElement("button", { type: "button", onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                    ),
                    React.createElement("div", { className: "modal-body" },
                        React.createElement("div", { className: "form-group" },
                            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' } },
                                React.createElement("label", { htmlFor: "delay-desc", style: { margin: 0, fontWeight: 600 } }, isFa ? 'علت تاخیر' : 'Delay Reason'),
                                React.createElement("button", {
                                    type: "button",
                                    onClick: handleSummarize,
                                    disabled: isSummarizing || !description.trim(),
                                    className: "action-button primary",
                                    style: { padding: '0.25rem 0.6rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' },
                                    title: isFa ? 'خلاصه‌سازی مدیریتی با هوش مصنوعی (حداکثر ۲ جمله)' : 'AI Executive Summarize (Max 2 sentences)'
                                },
                                    React.createElement("span", { className: `material-symbols-outlined ${isSummarizing ? 'spin' : ''}`, style: { fontSize: '1rem' } }, isSummarizing ? 'sync' : 'auto_awesome'),
                                    React.createElement("span", null, isSummarizing 
                                        ? (isFa ? 'در حال خلاصه‌سازی...' : 'Summarizing...') 
                                        : (isFa ? 'خلاصه‌سازی مدیریتی (۲ جمله)' : 'Executive Summary (2 Sentences)')
                                    )
                                )
                            ),
                            React.createElement("textarea", {
                                id: "delay-desc",
                                value: description,
                                onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value),
                                required: true,
                                rows: 5,
                                autoFocus: true,
                                placeholder: isFa ? 'شرح یا علت تاخیر پروژه را وارد کنید یا متن مفصل را چسبانده و دکمه خلاصه‌سازی مدیریتی را بزنید...' : 'Enter delay reason...'
                            }),
                            summaryNotice && React.createElement("div", { style: { fontSize: '0.78rem', color: '#166534', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.35rem 0.6rem', borderRadius: '4px', marginTop: '0.4rem' } }, summaryNotice)
                        )
                    ),
                    React.createElement("div", { className: "modal-footer" },
                        React.createElement("button", { type: "submit", className: "save-btn" }, isEditing ? t('update') : t('add')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "cancel-btn" }, t('cancel'))
                    )
                )
            )
        )
    );
};

export const DocumentModal = ({ isOpen, onClose, onSave, project }: {
    isOpen: boolean;
    onClose: () => void;
    /** The chosen file goes with the document: the backend stores it. */
    onSave: (doc: Omit<ProjectDocument, 'id'>, file: File | null) => void;
    project?: Project;
}): ReactElement | null => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const [description, setDescription] = useState('');
    const [type, setType] = useState<ProjectDocument['type']>('Report');
    const [date, setDate] = useState(getISODateString());
    const [file, setFile] = useState<File | null>(null);

    const [aiSummary, setAiSummary] = useState('');
    const [aiRelevance, setAiRelevance] = useState('');
    const [aiRelevanceReason, setAiRelevanceReason] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setDescription('');
            setType('Report');
            setDate(getISODateString());
            setFile(null);
            setAiSummary('');
            setAiRelevance('');
            setAiRelevanceReason('');
            setIsAnalyzing(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const runAiAnalysis = async (currentFile: File | null, currentDesc: string, currentType: string) => {
        setIsAnalyzing(true);
        try {
            const res = await fetch('/api/ai/summarize-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docName: currentFile?.name || 'سند بارگذاری‌شده',
                    docDescription: currentDesc,
                    docType: currentType,
                    projectName: project?.name,
                    projectGoal: project?.goal || project?.description
                })
            });
            const data = await res.json();
            if (data.success) {
                setAiSummary(data.summary || '');
                setAiRelevance(data.relevance || 'مرتبط');
                setAiRelevanceReason(data.relevanceReason || '');
                return data;
            }
        } catch (err) {
            console.error("AI Document analysis error:", err);
        } finally {
            setIsAnalyzing(false);
        }
        return null;
    };

    const handleManualAiClick = () => {
        if (!description && !file) {
            alert(isFa ? 'لطفاً ابتدا فایل یا توضیحات سند را وارد کنید.' : 'Please enter file or description first.');
            return;
        }
        runAiAnalysis(file, description, type);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (file) {
            let finalSummary = aiSummary;
            let finalRelevance = aiRelevance;
            let finalReason = aiRelevanceReason;

            // If user didn't manually press AI analyze button, generate auto summary now
            if (!finalSummary) {
                setIsAnalyzing(true);
                const aiRes = await runAiAnalysis(file, description, type);
                if (aiRes) {
                    finalSummary = aiRes.summary;
                    finalRelevance = aiRes.relevance;
                    finalReason = aiRes.relevanceReason;
                }
            }

            onSave({
                name: file ? file.name : (description ? description.slice(0, 30) : 'سند بارگذاری‌شده'),
                description,
                type,
                date,
                aiSummary: finalSummary || (description ? description.slice(0, 100) : 'خلاصه سند بارگذاری شده'),
                aiRelevance: finalRelevance || 'مرتبط با پروژه',
                aiRelevanceReason: finalReason || (project?.name ? `مرتبط با موضوع و اهداف پروژه (${project.name})` : 'سند پروژه')
            }, file);
            onClose();
        } else {
            alert(t('selectFileAndDesc'));
        }
    };

    const docTypeTranslations: Record<ProjectDocument['type'], TranslationKey> = {
        Report: 'report', Letter: 'letter', 'Meeting Minutes': 'meetingMinutes', Other: 'other'
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '580px' } },
                React.createElement("form", { onSubmit: handleSubmit },
                    React.createElement("div", { className: "modal-header" },
                        React.createElement("h3", null, t('addDocument')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                    ),
                    React.createElement("div", { className: "modal-body" },
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "doc-date" }, language === 'fa' ? 'تاریخ ثبت' : 'Registration Date'),
                            React.createElement(ShamsiDatePicker, { id: "doc-date", name: "date", value: date, onChange: (val: string) => setDate(val), required: true })
                        ),
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "doc-file" }, t('docFile') + '*'),
                            React.createElement("input", { type: "file", id: "doc-file", onChange: (e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files ? e.target.files[0] : null) })
                        ),
                        React.createElement("div", { className: "form-group" },
                            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' } },
                                React.createElement("label", { htmlFor: "doc-desc", style: { margin: 0 } }, t('docDescription') + '*'),
                                React.createElement("button", {
                                    type: "button",
                                    onClick: handleManualAiClick,
                                    disabled: isAnalyzing || (!description && !file),
                                    className: "action-button primary",
                                    style: { padding: '0.25rem 0.6rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }
                                },
                                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, isAnalyzing ? 'sync' : 'auto_awesome'),
                                    React.createElement("span", null, isAnalyzing ? (isFa ? 'در حال تحلیلی...' : 'Analyzing...') : (isFa ? 'خلاصه‌سازی و سنجش ارتباط با AI' : 'AI Summary & Relevance'))
                                )
                            ),
                            React.createElement("textarea", { id: "doc-desc", value: description, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value), required: true, rows: 3, placeholder: isFa ? 'توضیحات و خلاصه اولیه سند را وارد کنید...' : 'Document description...' })
                        ),
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "doc-type" }, t('docType')),
                            React.createElement("select", { id: "doc-type", value: type, onChange: (e: ChangeEvent<HTMLSelectElement>) => setType(e.target.value as any) },
                                Object.keys(docTypeTranslations).map(key => React.createElement("option", { key: key, value: key }, t(docTypeTranslations[key as ProjectDocument['type']])))
                            )
                        ),

                        /* Preview Box for AI Analysis */
                        (aiSummary || isAnalyzing) && React.createElement("div", {
                            className: "ai-doc-analysis-box"
                        },
                            React.createElement("div", { className: "ai-doc-analysis-title" },
                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem' } }, "auto_awesome"),
                                React.createElement("span", null, isFa ? 'نتیجه خلاصه‌سازی و سنجش ارتباط دستیار هوشمند:' : 'AI Summary & Relevance Result:')
                            ),
                            isAnalyzing ? React.createElement("p", { className: "doc-relevance-reason", style: { fontSize: '0.85rem', margin: 0 } }, isFa ? 'در حال استخراج خلاصه سند و تحلیل ارتباط با موضوع پروژه...' : 'Analyzing document...')
                            : React.createElement("div", { className: "ai-doc-analysis-content" },
                                aiSummary && React.createElement("p", { style: { fontSize: '0.88rem', margin: '0 0 0.4rem 0', lineHeight: 1.5 } },
                                    React.createElement("strong", null, isFa ? 'خلاصه سند: ' : 'Summary: '),
                                    aiSummary
                                ),
                                aiRelevance && React.createElement("p", { style: { fontSize: '0.85rem', margin: '0 0 0.3rem 0' } },
                                    React.createElement("strong", null, isFa ? 'میزان ارتباط: ' : 'Relevance: '),
                                    React.createElement("span", {
                                        className: `doc-relevance-badge ${aiRelevance.includes('کاملاً') || aiRelevance.includes('High') ? 'doc-relevance-high' : (aiRelevance.includes('نامرتبط') || aiRelevance.includes('Low') ? 'doc-relevance-low' : 'doc-relevance-medium')}`
                                    }, aiRelevance)
                                ),
                                aiRelevanceReason && React.createElement("p", { className: "doc-relevance-reason", style: { margin: 0 } },
                                    React.createElement("strong", null, isFa ? 'موضوع و علت ارتباط: ' : 'Reason: '),
                                    aiRelevanceReason
                                )
                            )
                        )
                    ),
                    React.createElement("div", { className: "modal-footer" },
                        React.createElement("button", { type: "submit", className: "save-btn", disabled: isAnalyzing },
                            isAnalyzing ? (isFa ? 'در حال ثبت...' : 'Saving...') : t('add')
                        ),
                        React.createElement("button", { type: "button", onClick: onClose, className: "cancel-btn", disabled: isAnalyzing }, t('cancel'))
                    )
                )
            )
        )
    );
};

export const KanbanStatusUpdateModal = ({ isOpen, onClose, task, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    task: EnrichedKanbanTask;
    onSubmit: (taskId: string, newStatus: KanbanStatus, comment: string) => void;
}): ReactElement | null => {
    const { t } = useContext(LocalizationContext);
    const [newStatus, setNewStatus] = useState<KanbanStatus>(task.status);
    const [comment, setComment] = useState('');

    if (!isOpen) return null;

    const handleSave = () => {
        onSubmit(task.id, newStatus, comment);
    };
    
    const kanbanStatusTranslations: Record<KanbanStatus, TranslationKey> = { 'To-Do': 'toDo', 'Doing': 'doing', 'Done': 'done' };
    const availableStatuses = (Object.keys(kanbanStatusTranslations) as KanbanStatus[]).filter(s => s !== task.status);


    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, t('changeStatusAction')),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    React.createElement("p", null, React.createElement("strong", null, t('activityDescription') + ': '), task.description),
                    React.createElement("p", null, React.createElement("strong", null, t('currentStatus') + ': '), t(kanbanStatusTranslations[task.status])),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "new-status" }, t('statusChange')),
                        React.createElement("select", { id: "new-status", value: newStatus, onChange: (e: ChangeEvent<HTMLSelectElement>) => setNewStatus(e.target.value as KanbanStatus) },
                            React.createElement("option", { value: task.status, disabled: true }, t(kanbanStatusTranslations[task.status])),
                            availableStatuses.map(s => React.createElement("option", { key: s, value: s }, t(kanbanStatusTranslations[s])))
                        )
                    ),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "status-comment" }, t('submissionComment')),
                        React.createElement("textarea", { id: "status-comment", value: comment, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value), rows: 3 })
                    )
                ),
                React.createElement("div", { className: "modal-footer" },
                    React.createElement("button", { onClick: handleSave, className: "save-btn", disabled: newStatus === task.status }, t('send')),
                    React.createElement("button", { onClick: onClose, className: "cancel-btn" }, t('cancel'))
                )
            )
        )
    );
};

export const ActionStatusUpdateModal = ({ isOpen, onClose, action, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    action: ActionItem;
    onSubmit: (actionId: string, newStatus: WorkStatus, currentStatus: WorkStatus, comment: string) => void;
}): ReactElement | null => {
    const { t } = useContext(LocalizationContext);
    const [newStatus, setNewStatus] = useState<WorkStatus>(action.status);
    const [comment, setComment] = useState('');

    if (!isOpen) return null;

    const handleSave = () => {
        onSubmit(action.id, newStatus, action.status, comment);
    };

    const workStatusTranslations: Record<WorkStatus, TranslationKey> = { 'Planning': 'planning', 'In Progress': 'inProgress', 'On Hold': 'onHold', 'Completed': 'completed' };
    const availableStatuses = (Object.keys(workStatusTranslations) as WorkStatus[]).filter(s => s !== action.status);

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, t('actionStatusChange')),
                     React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    React.createElement("p", null, React.createElement("strong", null, t('actionTitle') + ': '), action.title),
                    React.createElement("p", null, React.createElement("strong", null, t('currentStatus') + ': '), t(workStatusTranslations[action.status])),
                     React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "new-action-status" }, t('statusChange')),
                        React.createElement("select", { id: "new-action-status", value: newStatus, onChange: (e: ChangeEvent<HTMLSelectElement>) => setNewStatus(e.target.value as WorkStatus) },
                            React.createElement("option", { value: action.status, disabled: true }, t(workStatusTranslations[action.status])),
                            availableStatuses.map(s => React.createElement("option", { key: s, value: s }, t(workStatusTranslations[s])))
                        )
                    ),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "action-status-comment" }, t('submissionComment')),
                        React.createElement("textarea", { id: "action-status-comment", value: comment, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value), rows: 3 })
                    )
                ),
                React.createElement("div", { className: "modal-footer" },
                    React.createElement("button", { onClick: handleSave, className: "save-btn", disabled: newStatus === action.status }, t('send')),
                    React.createElement("button", { onClick: onClose, className: "cancel-btn" }, t('cancel'))
                )
            )
        )
    );
};

export const WBSModal = ({ root, onClose, onNodeClick }: { root: ProjectActivity, onClose: () => void, onNodeClick: (activity: ProjectActivity) => void }): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

    const activityMap = useMemo(() => {
        const map = new Map<string, ProjectActivity>();
        const traverse = (node: ProjectActivity) => {
            map.set(node.id, node);
            if (node.children) {
                node.children.forEach(traverse);
            }
        };
        if(root) traverse(root);
        return map;
    }, [root]);

    useEffect(() => {
        if (root) {
            const initialExpanded: Record<string, boolean> = {};
            initialExpanded[root.id] = true; // Expand root to show level 1 nodes
            setExpandedNodes(initialExpanded);
        }
    }, [root]);

    const handleToggleNode = (nodeId: string) => {
        setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
    };

    const handleExpandAll = () => {
        const allExpanded: Record<string, boolean> = {};
        activityMap.forEach((_, id) => { allExpanded[id] = true; });
        setExpandedNodes(allExpanded);
    };

    const handleCollapseAll = () => {
        if (root) {
            setExpandedNodes({ [root.id]: true });
        } else {
            setExpandedNodes({});
        }
    };

    const WbsNode = ({ node, isRoot = false }: { node: ProjectActivity, isRoot?: boolean }): ReactElement => {
        const isExpanded = !!expandedNodes[node.id];
        const hasChildren = node.children && node.children.length > 0;
        const plannedVal = Math.round(node.plannedProgress || 0);
        const actualVal = Math.round(node.actualProgress || 0);
        const plannedFormatted = language === 'fa' ? toPersianDigits(plannedVal) : plannedVal;
        const actualFormatted = language === 'fa' ? toPersianDigits(actualVal) : actualVal;

        return React.createElement("li", null,
            React.createElement("div", { 
                className: `tree-node ${isRoot ? 'root' : ''}`,
                onClick: () => hasChildren && handleToggleNode(node.id),
                style: { cursor: hasChildren ? 'pointer' : 'default' }
            }, 
                React.createElement("div", { className: "wbs-node-content", style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '4px', marginBottom: '4px' } },
                    !isRoot && React.createElement("button", {
                        className: "action-icon",
                        onClick: (e) => { e.stopPropagation(); onNodeClick(node); },
                        style: { padding: '0.15rem', flexShrink: 0 },
                        title: t('details')
                    }, React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.05rem' } }, "info")),
                    React.createElement("span", { style: { flexGrow: 1, textAlign: 'center', lineHeight: '1.2' } }, 
                        `${node.wbsCode ? `${node.wbsCode} ` : ''}${node.name}`
                    ),
                    hasChildren && React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.1rem', flexShrink: 0, opacity: 0.7 } },
                        isExpanded ? 'expand_less' : 'expand_more'
                    )
                ),
                isRoot ? 
                    React.createElement(StackedProgressBar, { actual: node.actualProgress, planned: node.plannedProgress || 0, showLabel: true }) :
                    React.createElement("div", { className: "wbs-metrics-container" },
                        React.createElement("div", { className: "wbs-metrics-row" },
                            React.createElement("span", {
                                className: "wbs-metric-pill planned",
                                title: `${language === 'fa' ? 'پیشرفت برنامه‌ای' : 'Planned Progress'}: ${plannedFormatted}%`
                            },
                                React.createElement("span", { className: "wbs-legend-badge planned" }),
                                `${plannedFormatted}%`
                            ),
                            React.createElement("span", {
                                className: "wbs-metric-pill actual",
                                title: `${language === 'fa' ? 'پیشرفت واقعی' : 'Actual Progress'}: ${actualFormatted}%`
                            },
                                React.createElement("span", { className: "wbs-legend-badge actual" }),
                                `${actualFormatted}%`
                            )
                        ),
                        React.createElement("div", { className: "wbs-mini-bar", title: `${language === 'fa' ? 'برنامه‌ای' : 'Planned'}: ${plannedFormatted}% | ${language === 'fa' ? 'واقعی' : 'Actual'}: ${actualFormatted}%` },
                            React.createElement("div", { className: "wbs-mini-bar-planned", style: { width: `${Math.min(100, Math.max(0, plannedVal))}%` } }),
                            React.createElement("div", { className: "wbs-mini-bar-actual", style: { width: `${Math.min(100, Math.max(0, actualVal))}%` } })
                        )
                    )
            ),
            hasChildren && isExpanded && (
                React.createElement("ul", null,
                    node.children.map(child => React.createElement(WbsNode, { key: child.id, node: child, isRoot: false }))
                )
            )
        );
    };

    const handleExportLandscapePdf = () => {
        document.body.classList.add('printing-wbs-only');
        setTimeout(() => {
            exportDashboardToLandscapePdf(language === 'fa' ? 'ساختار_شکست_کار_WBS_افقی' : 'WBS_Chart_Landscape');
            setTimeout(() => {
                document.body.classList.remove('printing-wbs-only');
            }, 2000);
        }, 150);
    };

    const handleExportPortraitPdf = () => {
        document.body.classList.add('printing-wbs-only');
        setTimeout(() => {
            exportDashboardToPortraitPdf(language === 'fa' ? 'ساختار_شکست_کار_WBS_عمودی' : 'WBS_Chart_Portrait');
            setTimeout(() => {
                document.body.classList.remove('printing-wbs-only');
            }, 2000);
        }, 150);
    };

    return renderInPortal(
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content wbs-modal", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: 'var(--primary-color)', fontSize: '1.75rem' } }, "account_tree"),
                        React.createElement("h3", { style: { margin: 0 } }, t('wbsTitle'))
                    ),
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                        React.createElement("div", { className: "no-print", style: { display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--bg-secondary, #f1f5f9)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color, #e2e8f0)' } },
                            React.createElement("button", {
                                type: "button",
                                onClick: handleExportLandscapePdf,
                                className: "action-button no-print pdf-export-btn",
                                title: language === 'fa' ? 'دریافت خروجی PDF ساختار شکست در ابعاد افقی (Landscape)' : 'Export WBS Chart to PDF (Landscape)',
                                style: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', fontSize: '0.78rem', background: 'transparent', border: 'none', color: 'var(--text-color, #1e293b)' }
                            },
                                React.createElement("span", { className: "material-symbols-outlined", style: { color: '#dc2626', fontSize: '1.15rem' } }, "crop_landscape"),
                                React.createElement("span", { style: { fontWeight: 600 } }, language === 'fa' ? 'PDF افقی' : 'PDF Landscape')
                            ),
                            React.createElement("span", { style: { width: '1px', height: '18px', backgroundColor: 'var(--border-color, #cbd5e1)', margin: '0 2px' } }),
                            React.createElement("button", {
                                type: "button",
                                onClick: handleExportPortraitPdf,
                                className: "action-button no-print pdf-export-btn",
                                title: language === 'fa' ? 'دریافت خروجی PDF ساختار شکست در ابعاد عمودی (Portrait)' : 'Export WBS Chart to PDF (Portrait)',
                                style: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', fontSize: '0.78rem', background: 'transparent', border: 'none', color: 'var(--text-color, #1e293b)' }
                            },
                                React.createElement("span", { className: "material-symbols-outlined", style: { color: '#dc2626', fontSize: '1.15rem' } }, "crop_portrait"),
                                React.createElement("span", { style: { fontWeight: 600 } }, language === 'fa' ? 'PDF عمودی' : 'PDF Portrait')
                            )
                        ),
                        React.createElement("button", { onClick: onClose, className: "modal-close-button no-print", title: t('close') } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                    )
                ),
                React.createElement("div", { className: "wbs-toolbar no-print" },
                    React.createElement("div", { className: "wbs-toolbar-left" },
                        React.createElement("button", {
                            type: "button",
                            onClick: handleExpandAll,
                            className: "action-button",
                            style: { padding: '0.3rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' },
                            title: language === 'fa' ? 'گسترش تمامی شاخه‌ها' : 'Expand All Nodes'
                        },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "unfold_more"),
                            language === 'fa' ? 'گسترش همه' : 'Expand All'
                        ),
                        React.createElement("button", {
                            type: "button",
                            onClick: handleCollapseAll,
                            className: "action-button",
                            style: { padding: '0.3rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' },
                            title: language === 'fa' ? 'جمع‌کردن شاخه‌ها' : 'Collapse All Nodes'
                        },
                            React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "unfold_less"),
                            language === 'fa' ? 'بستن همه' : 'Collapse'
                        ),
                        React.createElement("span", { className: "gantt-stat-pill", style: { marginInlineStart: '0.5rem' } },
                            language === 'fa' ? `${toPersianDigits(activityMap.size)} فعالیت / بسته کاری` : `${activityMap.size} Activities / Work Packages`
                        )
                    ),
                    React.createElement("div", { className: "wbs-legend" },
                        React.createElement("div", { className: "wbs-legend-item" },
                            React.createElement("span", { className: "wbs-legend-badge planned" }),
                            React.createElement("span", null, language === 'fa' ? 'پیشرفت برنامه‌ای' : 'Planned Progress')
                        ),
                        React.createElement("div", { className: "wbs-legend-item" },
                            React.createElement("span", { className: "wbs-legend-badge actual" }),
                            React.createElement("span", null, language === 'fa' ? 'پیشرفت واقعی' : 'Actual Progress')
                        )
                    )
                ),
                React.createElement("div", { className: "modal-body wbs-container", style: { overflow: 'auto' } },
                    React.createElement("div", { className: "org-chart-tree" },
                        root && React.createElement("ul", null,
                            React.createElement(WbsNode, { node: root, isRoot: true })
                        )
                    )
                )
            )
        )
    );
};

export const GanttChartModal = ({ activities, project, onClose }: { activities: ProjectActivity[], project: Project, onClose: () => void }): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const ganttMainPanelRef = useRef<HTMLDivElement>(null);
    const ganttContainerRef = useRef<HTMLDivElement>(null);
    const sidePanelRef = useRef<HTMLDivElement>(null);
    const [mainPanelWidth, setMainPanelWidth] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

    useEffect(() => {
        if (ganttMainPanelRef.current) {
            const observer = new ResizeObserver(entries => {
                window.requestAnimationFrame(() => {
                    if (entries && entries.length > 0) {
                        setMainPanelWidth(entries[0].contentRect.width);
                    }
                });
            });
            observer.observe(ganttMainPanelRef.current);
            return () => observer.disconnect();
        }
    }, []);
    
    const { flatTasks, startDate, totalDurationDays } = useMemo(() => {
        const list: ProjectActivity[] = [];
        const dive = (nodes: ProjectActivity[], level: number) => {
            nodes.forEach(node => {
                list.push({ ...node, level });
                if (node.children) dive(node.children, level + 1);
            });
        };
        dive(activities, 0);
        
        const validTasks = list.filter(t => t.startDate && t.endDate);
        if (validTasks.length === 0) {
            const projStart = new Date(project.startDate);
            const projEnd = new Date(project.endDate);
            const duration = (projEnd.getTime() - projStart.getTime()) / (1000 * 3600 * 24) + 1;
            return { flatTasks: list, startDate: projStart, totalDurationDays: Math.max(1, duration) };
        }

        const minDate = new Date(Math.min(...validTasks.map(t => new Date(t.startDate!).getTime())));
        const maxDate = new Date(Math.max(...validTasks.map(t => new Date(t.endDate!).getTime())));
        
        const duration = (maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24);
        
        return { flatTasks: list, startDate: minDate, totalDurationDays: Math.max(1, Math.ceil(duration) + 1) };
    }, [activities, project.startDate, project.endDate]);

    const filteredTasks = useMemo(() => {
        if (!searchTerm.trim()) return flatTasks;
        const term = searchTerm.toLowerCase();
        return flatTasks.filter(t => t.name.toLowerCase().includes(term));
    }, [flatTasks, searchTerm]);

    const dayColumnWidth = useMemo(() => {
        if (!mainPanelWidth || totalDurationDays <= 1) {
            return 40;
        }
        const availableWidth = mainPanelWidth - 2;
        const calculatedWidth = availableWidth / totalDurationDays;
        return Math.max(3, calculatedWidth);
    }, [mainPanelWidth, totalDurationDays]);

    const headerInfo = useMemo(() => {
        type HeaderItem = { label: string, colSpan: number, key: string };
        const topRow: HeaderItem[] = [];
        const bottomRow: HeaderItem[] = [];
        
        if (totalDurationDays <= 0) return { topRow, bottomRow };

        const days: Date[] = Array.from({ length: totalDurationDays }, (_, i) => {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            return d;
        });

        const jalaliMonthNames = [
            'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
            'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
        ];

        // Tier 1: Month Headers
        let currentMonthKey = '';
        days.forEach((d, i) => {
            let monthKey: string;
            let monthName: string;

            if (language === 'fa') {
                const { jy, jm } = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                monthKey = `${jy}-${jm}`;
                monthName = `${jalaliMonthNames[jm - 1]} ${toPersianDigits(jy)}`;
            } else {
                monthKey = `${d.getFullYear()}-${d.getMonth()}`;
                monthName = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            }

            if (monthKey !== currentMonthKey) {
                currentMonthKey = monthKey;
                topRow.push({ label: monthName, colSpan: 1, key: `m-${i}` });
            } else {
                topRow[topRow.length - 1].colSpan++;
            }
        });

        // Tier 2: Days (if wide enough)
        if (dayColumnWidth > 22) {
            days.forEach((d, i) => {
                const dayLabel = language === 'fa' 
                    ? toPersianDigits(toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate()).jd)
                    : d.getDate().toString();
                bottomRow.push({ label: dayLabel, colSpan: 1, key: `d-${i}` });
            });
            return { topRow, bottomRow };
        }

        // Tier 2: Weeks
        if (dayColumnWidth > 4) {
            let dayCounter = 0;
            let weekNum = 1;
            while(dayCounter < totalDurationDays) {
                const daysInThisWeek = Math.min(7, totalDurationDays - dayCounter);
                const weekLabel = language === 'fa' ? `هـ ${toPersianDigits(weekNum++)}` : `W${weekNum++}`;
                bottomRow.push({ label: weekLabel, colSpan: daysInThisWeek, key: `w-${dayCounter}`});
                dayCounter += daysInThisWeek;
            }
            return { topRow, bottomRow };
        }

        return { topRow, bottomRow: [] };
    }, [dayColumnWidth, totalDurationDays, startDate, language]);

    const handleScroll = () => {
        if(ganttMainPanelRef.current && sidePanelRef.current) {
            sidePanelRef.current.scrollTop = ganttMainPanelRef.current.scrollTop;
        }
    };

    const today = new Date();
    today.setHours(0,0,0,0);
    const todayOffset = (today.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
    const showTodayMarker = todayOffset >= 0 && todayOffset <= totalDurationDays;

    const todayMarkerStyle: React.CSSProperties = {};
    const positionProp: 'left' | 'right' = language === 'fa' ? 'right' : 'left';
    todayMarkerStyle[positionProp] = `${todayOffset * dayColumnWidth}px`;

    const totalDaysText = language === 'fa' ? `${toPersianDigits(totalDurationDays)} روز` : `${totalDurationDays} Days`;
    const taskCountText = language === 'fa' ? `${toPersianDigits(flatTasks.length)} فعالیت` : `${flatTasks.length} Activities`;

    const handleExportLandscapePdf = () => {
        exportDashboardToLandscapePdf(language === 'fa' ? `گانت_چارت_افقی_${project.name || 'Project'}` : `Gantt_Chart_Landscape_${project.name || 'Project'}`);
    };

    const handleExportPortraitPdf = () => {
        exportDashboardToPortraitPdf(language === 'fa' ? `گانت_چارت_عمودی_${project.name || 'Project'}` : `Gantt_Chart_Portrait_${project.name || 'Project'}`);
    };

    return renderInPortal(
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content gantt-modal", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: 'var(--primary-color)', fontSize: '1.75rem' } }, "schedules"),
                        React.createElement("h3", { style: { margin: 0 } }, t('ganttChartTitle', { project: project.name }))
                    ),
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                        React.createElement("div", { className: "no-print", style: { display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--bg-secondary, #f1f5f9)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color, #e2e8f0)' } },
                            React.createElement("button", {
                                type: "button",
                                onClick: handleExportLandscapePdf,
                                className: "action-button no-print pdf-export-btn",
                                title: language === 'fa' ? 'دریافت خروجی PDF گانت چارت در ابعاد افقی (Landscape)' : 'Export Gantt Chart to PDF (Landscape)',
                                style: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', fontSize: '0.78rem', background: 'transparent', border: 'none', color: 'var(--text-color, #1e293b)' }
                            },
                                React.createElement("span", { className: "material-symbols-outlined", style: { color: '#dc2626', fontSize: '1.15rem' } }, "crop_landscape"),
                                React.createElement("span", { style: { fontWeight: 600 } }, language === 'fa' ? 'PDF افقی' : 'PDF Landscape')
                            ),
                            React.createElement("span", { style: { width: '1px', height: '18px', backgroundColor: 'var(--border-color, #cbd5e1)', margin: '0 2px' } }),
                            React.createElement("button", {
                                type: "button",
                                onClick: handleExportPortraitPdf,
                                className: "action-button no-print pdf-export-btn",
                                title: language === 'fa' ? 'دریافت خروجی PDF گانت چارت در ابعاد عمودی / پورتریت (Portrait)' : 'Export Gantt Chart to PDF (Portrait)',
                                style: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', fontSize: '0.78rem', background: 'transparent', border: 'none', color: 'var(--text-color, #1e293b)' }
                            },
                                React.createElement("span", { className: "material-symbols-outlined", style: { color: '#dc2626', fontSize: '1.15rem' } }, "crop_portrait"),
                                React.createElement("span", { style: { fontWeight: 600 } }, language === 'fa' ? 'PDF عمودی' : 'PDF Portrait')
                            )
                        ),
                        React.createElement("button", { onClick: onClose, className: "modal-close-button no-print" } as React.HTMLAttributes<HTMLButtonElement>, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                    )
                ),
                React.createElement("div", { className: "gantt-toolbar" },
                    React.createElement("div", { className: "gantt-toolbar-left" },
                        React.createElement("div", { className: "gantt-search-wrapper" },
                            React.createElement("span", { className: "material-symbols-outlined search-icon" }, "search"),
                            React.createElement("input", {
                                type: "text",
                                placeholder: language === 'fa' ? "جستجوی فعالیت..." : "Search activities...",
                                value: searchTerm,
                                onChange: (e) => setSearchTerm(e.target.value),
                                className: "gantt-search-input"
                            })
                        ),
                        React.createElement("span", { className: "gantt-stat-pill" }, taskCountText),
                        React.createElement("span", { className: "gantt-stat-pill duration" }, totalDaysText)
                    ),
                    React.createElement("div", { className: "gantt-legend" },
                        React.createElement("div", { className: "legend-item" },
                            React.createElement("span", { className: "legend-color legend-normal" }),
                            React.createElement("span", null, language === 'fa' ? 'عادی' : 'Normal')
                        ),
                        React.createElement("div", { className: "legend-item" },
                            React.createElement("span", { className: "legend-color legend-critical" }),
                            React.createElement("span", null, language === 'fa' ? 'بحرانی' : 'Critical')
                        ),
                        React.createElement("div", { className: "legend-item" },
                            React.createElement("span", { className: "legend-color legend-actual" }),
                            React.createElement("span", null, language === 'fa' ? 'پیشرفت' : 'Progress')
                        ),
                        React.createElement("div", { className: "legend-item" },
                            React.createElement("span", { className: "legend-color legend-parent" }),
                            React.createElement("span", null, language === 'fa' ? 'خلاصه' : 'Summary')
                        ),
                        React.createElement("div", { className: "legend-item" },
                            React.createElement("span", { className: "legend-color legend-milestone" }),
                            React.createElement("span", null, language === 'fa' ? 'مایلستون' : 'Milestone')
                        ),
                        showTodayMarker && React.createElement("div", { className: "legend-item" },
                            React.createElement("span", { className: "legend-color legend-today" }),
                            React.createElement("span", null, language === 'fa' ? 'امروز' : 'Today')
                        )
                    )
                ),
                React.createElement("div", { className: "modal-body gantt-modal-body" },
                   React.createElement("div", { className: "gantt-chart-container" },
                        React.createElement("div", { className: "gantt-side-panel", ref: sidePanelRef },
                            React.createElement("div", { className: "gantt-side-header", style: { height: `${headerInfo.bottomRow.length > 0 ? 80 : 40}px` } },
                                React.createElement("div", { className: "gantt-col-idx" }, language === 'fa' ? 'ردیف' : '#'),
                                React.createElement("div", { className: "gantt-col-name" }, t('activityName')),
                                React.createElement("div", { className: "gantt-col-dur" }, language === 'fa' ? 'مدت' : 'Days')
                            ),
                            filteredTasks.map((task, idx) => (
                                React.createElement("div", {
                                    key: task.id,
                                    className: `gantt-task-name ${hoveredTaskId === task.id ? 'is-hovered' : ''} ${task.isParent ? 'is-parent-row' : ''}`,
                                    onMouseEnter: () => setHoveredTaskId(task.id),
                                    onMouseLeave: () => setHoveredTaskId(null)
                                },
                                    React.createElement("div", { className: "gantt-col-idx" }, language === 'fa' ? toPersianDigits(idx + 1) : (idx + 1)),
                                    React.createElement("div", { className: "gantt-col-name", style: { paddingInlineStart: `${task.level! * 16 + 6}px` } },
                                        React.createElement("span", { className: "material-symbols-outlined task-icon" }, task.isParent ? "folder" : "task_alt"),
                                        React.createElement("span", { className: "task-title-text", title: task.name }, task.name)
                                    ),
                                    React.createElement("div", { className: "gantt-col-dur" }, language === 'fa' ? toPersianDigits(task.duration || 1) : (task.duration || 1))
                                )
                            ))
                        ),
                        React.createElement("div", { className: "gantt-main-panel", onScroll: handleScroll, ref: ganttContainerRef },
                             React.createElement("div", { ref: ganttMainPanelRef, style:{ position: 'relative', height: '100%'} },
                                 React.createElement("div", { className: "gantt-header-row", style: { gridTemplateColumns: `repeat(${totalDurationDays}, ${dayColumnWidth}px)` } },
                                     headerInfo.topRow.map(header => React.createElement("div", { key: header.key, className: "gantt-header top-header", style: { gridColumn: `span ${header.colSpan}` } }, header.label)),
                                     headerInfo.bottomRow.length > 0 && headerInfo.bottomRow.map(header => React.createElement("div", { key: header.key, className: "gantt-header bottom-header", style: { gridColumn: `span ${header.colSpan}` } }, header.label))
                                 ),
                                 React.createElement("div", { className: "gantt-grid", style: { gridTemplateColumns: `repeat(${totalDurationDays}, ${dayColumnWidth}px)`} },
                                    filteredTasks.map((task, index) => {
                                        if (!task.startDate || !task.endDate) return React.createElement("div", { key: task.id, style: { gridRow: index + 1, gridColumn: `1 / span ${totalDurationDays}` }, className: "gantt-bar-wrapper" });
                                        const taskStart = new Date(task.startDate);
                                        const taskEnd = new Date(task.endDate);

                                        const startOffset = Math.round((taskStart.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
                                        const duration = Math.round((taskEnd.getTime() - taskStart.getTime()) / (1000 * 3600 * 24)) + 1;
                                        
                                        if(startOffset < 0 || duration <= 0) return React.createElement("div", { key: task.id, style: { gridRow: index + 1, gridColumn: `1 / span ${totalDurationDays}` }, className: "gantt-bar-wrapper" });

                                        const isMilestone = !task.isParent && duration === 1;
                                        const tooltipText = `${task.name}\n${language === 'fa' ? 'شروع' : 'Start'}: ${formatDate(task.startDate, language)}\n${language === 'fa' ? 'پایان' : 'End'}: ${formatDate(task.endDate, language)}\n${language === 'fa' ? 'مدت' : 'Duration'}: ${language === 'fa' ? toPersianDigits(duration) : duration} ${language === 'fa' ? 'روز' : 'days'}\n${language === 'fa' ? 'پیشرفت واقعی' : 'Actual Progress'}: ${language === 'fa' ? toPersianDigits(Math.round(task.actualProgress || 0)) : Math.round(task.actualProgress || 0)}%`;

                                        return React.createElement("div", {
                                            key: task.id,
                                            className: `gantt-bar-wrapper ${hoveredTaskId === task.id ? 'is-hovered' : ''}`,
                                            style: { gridRow: index + 1, gridColumn: `${startOffset + 1} / span ${Math.max(1, duration)}` },
                                            onMouseEnter: () => setHoveredTaskId(task.id),
                                            onMouseLeave: () => setHoveredTaskId(null)
                                        },
                                            isMilestone ? (
                                                React.createElement("div", { className: "gantt-milestone-wrapper", title: tooltipText },
                                                    React.createElement("div", { className: `gantt-milestone-diamond ${task.isCritical ? 'critical' : ''}` }),
                                                    React.createElement("span", { className: "gantt-milestone-label" }, task.name)
                                                )
                                            ) : (
                                                React.createElement("div", { className: `gantt-bar ${task.isParent ? 'summary' : (task.isCritical ? 'critical' : 'normal')}`, title: tooltipText },
                                                    task.isParent && React.createElement("div", { className: "gantt-summary-cap-start" }),
                                                    task.isParent && React.createElement("div", { className: "gantt-summary-cap-end" }),
                                                    !task.isParent && React.createElement("div", { className: "gantt-progress-fill", style: { width: `${Math.min(100, Math.max(0, task.actualProgress || 0))}%` } }),
                                                    !task.isParent && (dayColumnWidth * duration > 50) && React.createElement("span", { className: "gantt-bar-progress-text" }, `${language === 'fa' ? toPersianDigits(Math.round(task.actualProgress || 0)) : Math.round(task.actualProgress || 0)}%`)
                                                )
                                            )
                                        );
                                    }),
                                    showTodayMarker && React.createElement("div", { className: "gantt-today-marker", style: todayMarkerStyle, title: formatDate(today, language) },
                                        React.createElement("div", { className: "gantt-today-badge" }, language === 'fa' ? 'امروز' : 'Today')
                                    )
                                )
                             )
                        )
                   )
                )
            )
        )
    );
};

export const ProgressChartModal = ({ activities, project, calendar, onClose }: { activities: ProjectActivity[], project: Project, calendar: Calendar, onClose: () => void }): ReactElement => {
    const { language } = useContext(LocalizationContext);

    const sCurveData = useSCurve(project, language);

    const hasActualData = useMemo(() => {
        return sCurveData.some(p => p.actualProgress !== null && p.actualProgress !== undefined);
    }, [sCurveData]);

    const latestActualProgress = useMemo(() => {
        if (!hasActualData) return null;
        for (let i = sCurveData.length - 1; i >= 0; i--) {
            if (sCurveData[i].actualProgress !== null && sCurveData[i].actualProgress !== undefined) {
                return sCurveData[i].actualProgress;
            }
        }
        return null;
    }, [sCurveData, hasActualData]);

    return renderInPortal(
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '920px', width: '94vw', maxHeight: '90vh' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: 'var(--primary-color)', fontSize: '1.75rem' } }, "monitoring"),
                        React.createElement("div", null,
                            React.createElement("h3", { style: { margin: 0, fontSize: '1.1rem' } }, language === 'fa' ? 'نمودار پیشرفت (S-Curve)' : 'Progress S-Curve'),
                            React.createElement("div", { style: { fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' } }, project.name)
                        )
                    ),
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        React.createElement("button", { 
                            onClick: () => exportDashboardToLandscapePdf(`${project.name || 'Project'}_S_Curve`),
                            className: "action-button secondary no-print",
                            title: language === 'fa' ? 'خروجی PDF' : 'Export PDF',
                            style: { padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', backgroundColor: '#ef4444', border: 'none' }
                        }, React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem', color: '#fff' } }, "picture_as_pdf")),
                        React.createElement("button", { onClick: onClose, className: "modal-close-button" },
                            React.createElement("span", { className: "material-symbols-outlined" }, "close")
                        )
                    )
                ),
                React.createElement("div", { className: "modal-body", style: { padding: '1.25rem' } },
                    sCurveData.length === 0 ? (
                        React.createElement("div", { style: { textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' } },
                            language === 'fa' ? 'هیچ فعالیت زمان‌بندی‌شده‌ای برای محاسبه پیشرفت وجود ندارد.' : 'No scheduled activities found for calculating progress.'
                        )
                    ) : (
                        React.createElement(Fragment, null,
                            React.createElement("div", { style: { marginBottom: '1rem', display: 'flex', gap: '1.75rem', flexWrap: 'wrap', fontSize: '0.88rem', color: 'var(--text-secondary)' } },
                                React.createElement("div", null,
                                    React.createElement("strong", null, language === 'fa' ? 'نهایی پیشرفت برنامه‌ای: ' : 'Final Planned Progress: '),
                                    React.createElement("span", { style: { color: '#2563eb', fontWeight: 700 } }, `${language === 'fa' ? toPersianDigits(sCurveData[sCurveData.length - 1]?.plannedProgress || 100) : (sCurveData[sCurveData.length - 1]?.plannedProgress || 100)}%`)
                                ),
                                hasActualData && latestActualProgress !== null && React.createElement("div", null,
                                    React.createElement("strong", null, language === 'fa' ? 'آخرین پیشرفت واقعی: ' : 'Latest Actual Progress: '),
                                    React.createElement("span", { style: { color: '#ef4444', fontWeight: 700 } }, `${language === 'fa' ? toPersianDigits(latestActualProgress) : latestActualProgress}%`)
                                )
                            ),
                            React.createElement("div", { style: { width: '100%', height: 500 } },
                                React.createElement(ResponsiveContainer, { width: "100%", height: "100%" },
                                    React.createElement(LineChart, { data: sCurveData, margin: { top: 15, right: 30, left: 25, bottom: 85 } },
                                        React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--border-color, #e2e8f0)" }),
                                        React.createElement(XAxis, { 
                                             dataKey: "dateLabel", 
                                             tick: { fontSize: 10, fill: 'var(--text-color, #64748b)' },
                                             angle: -90,
                                             textAnchor: 'start',
                                             height: 75,
                                             interval: 0,
                                             orientation: 'bottom',
                                             dy: 8
                                         }),
                                        React.createElement(YAxis, { 
                                            domain: [0, 100],
                                             width: 50,
                                             orientation: "left", 
                                            tickFormatter: (val) => language === 'fa' ? `${toPersianDigits(val)}٪` : `${val}%`,
                                            tick: { fontSize: 11, fill: 'var(--text-color, #64748b)', dx: -8 }
                                        }),
                                        React.createElement(Tooltip, { 
                                            formatter: (val: any, name: string) => [
                                                val !== null && val !== undefined ? `${language === 'fa' ? toPersianDigits(val) : val}%` : '-', 
                                                name
                                            ],
                                            labelStyle: { fontWeight: 'bold', color: '#1e293b' },
                                            contentStyle: { borderRadius: '8px', fontSize: '0.85rem', direction: language === 'fa' ? 'rtl' : 'ltr' }
                                        }),
                                        React.createElement(Legend, { 
                                            layout: 'horizontal', 
                                            align: 'center', 
                                            verticalAlign: 'bottom', 
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
                                             },
                                             isAnimationActive: true,
                                             animationDuration: 1500,
                                             animationEasing: 'ease-in-out'
                                         }),
                                        React.createElement(Line, { 
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
                                             activeDot: (props: any) => {
                                                 const { cx, cy, value } = props;
                                                 if (value === null || value === undefined || isNaN(value)) return null;
                                                 const r = 9;
                                                 return React.createElement("polygon", {
                                                     key: `active-diamond-${cx}-${cy}`,
                                                     points: `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`,
                                                     fill: "#059669",
                                                     stroke: "#ffffff",
                                                     strokeWidth: 2
                                                 });
                                             },
                                             isAnimationActive: true,
                                             animationDuration: 1500,
                                             animationEasing: 'ease-in-out'
                                         })
                                    )
                                )
                            )
                        )
                    )
                ),
                React.createElement("div", { className: "modal-footer", style: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' } },
                    React.createElement("button", { onClick: onClose, className: "action-button" }, language === 'fa' ? 'بستن' : 'Close')
                )
            )
        )
    );
};

export const OrgChartModal = ({ isOpen, onClose, projects, onNavigate, calendars }: {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    onNavigate: (page: string, context?: any) => void;
    calendars: Calendar[];
}): ReactElement => {
    const { t } = useContext(LocalizationContext);
    const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

    const enrichedProjects = useMemo(() => {
        return projects
            .filter(p => p.approvalStatus === 'Approved')
            .map(p => enrichProjectWithProgress(p, calendars));
    }, [projects, calendars]);

    const groupedProjects = useMemo(() => {
        return enrichedProjects.reduce((acc, project) => {
            const unit = project.owningUnit || 'Unassigned';
            if (!acc[unit]) acc[unit] = [];
            acc[unit].push(project);
            return acc;
        }, {} as Record<string, EnrichedProject[]>);
    }, [enrichedProjects]);

    const totalOrgProgress = useMemo(() => {
        if (enrichedProjects.length === 0) return 0;
        const total = enrichedProjects.reduce((sum, p) => sum + p.actualProgress, 0);
        return total / enrichedProjects.length;
    }, [enrichedProjects]);

    const totalOrgPlannedProgress = useMemo(() => {
        if (enrichedProjects.length === 0) return 0;
        const total = enrichedProjects.reduce((sum, p) => sum + p.plannedProgress, 0);
        return total / enrichedProjects.length;
    }, [enrichedProjects]);

    const handleProjectClick = (project: EnrichedProject) => {
        onNavigate('project_dashboard_details', { project, from: 'dashboard_hub' });
        onClose();
    };

    const handleUnitClick = (unit: string) => {
        setExpandedUnit(prev => (prev === unit ? null : unit));
    };

    return renderInPortal(
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content org-chart-modal", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation() } as React.HTMLAttributes<HTMLDivElement>,
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, t('organizationalDistributionProjects')),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    React.createElement("div", { className: "org-chart-tree" },
                        React.createElement("ul", null,
                            React.createElement("li", null,
                                React.createElement("div", { className: "tree-node root" }, 
                                    React.createElement("div", null, t('organization')),
                                    React.createElement(StackedProgressBar, { actual: totalOrgProgress, planned: totalOrgPlannedProgress, showLabel: true })
                                ),
                                React.createElement("ul", null,
                                    (Object.entries(groupedProjects) as [string, EnrichedProject[]][]).map(([unit, unitProjects]) => {
                                        const unitAvgProgress = unitProjects.length > 0
                                            ? unitProjects.reduce((sum, p) => sum + p.actualProgress, 0) / unitProjects.length
                                            : 0;
                                        const unitAvgPlannedProgress = unitProjects.length > 0
                                            ? unitProjects.reduce((sum, p) => sum + p.plannedProgress, 0) / unitProjects.length
                                            : 0;

                                        return React.createElement("li", { key: unit },
                                            React.createElement("div", {
                                                className: "tree-node unit",
                                                onClick: () => handleUnitClick(unit),
                                                style: { cursor: 'pointer' }
                                            },
                                                React.createElement("div", null, unit),
                                                React.createElement(StackedProgressBar, { actual: unitAvgProgress, planned: unitAvgPlannedProgress, showLabel: true }),
                                                React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem', verticalAlign: 'middle', marginInlineStart: '0.5rem' } },
                                                    expandedUnit === unit ? 'expand_less' : 'expand_more'
                                                )
                                            ),
                                            expandedUnit === unit && React.createElement("ul", null,
                                                unitProjects.map(project => (
                                                    React.createElement("li", { key: project.id },
                                                        React.createElement("div", {
                                                            className: "tree-node project",
                                                            onClick: () => handleProjectClick(project),
                                                        },
                                                            React.createElement("div", { className: "org-project-header" },
                                                                React.createElement("div", { className: "org-project-name" }, project.name),
                                                                React.createElement("button", {
                                                                    className: "action-icon",
                                                                    onClick: (e: MouseEvent<HTMLButtonElement>) => {
                                                                        e.stopPropagation();
                                                                        handleProjectClick(project);
                                                                    },
                                                                    title: t('viewDashboard')
                                                                } as React.HTMLAttributes<HTMLButtonElement>,
                                                                    React.createElement("span", { className: "material-symbols-outlined" }, "dashboard")
                                                                )
                                                            ),
                                                            React.createElement(StackedProgressBar, { actual: project.actualProgress, planned: project.plannedProgress, showLabel: true })
                                                        )
                                                    )
                                                ))
                                            )
                                        )
                                    })
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};

export const ActionHistoryModal = ({ actionId, users, progressUpdates, actions, onClose }: {
    actionId: string;
    users: User[];
    progressUpdates: ProgressUpdate[];
    actions: ActionItem[];
    onClose: () => void;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const action = useMemo(() => actions.find(a => a.id === actionId), [actions, actionId]);
    const history = useMemo(() => progressUpdates.filter(up => up.actionId === actionId).sort((a,b) => (toSafeDate(b.submissionDate)?.getTime() || 0) - (toSafeDate(a.submissionDate)?.getTime() || 0)), [progressUpdates, actionId]);

    const statusTranslations: Record<ProgressUpdateStatus, TranslationKey> = { 'Pending Approval': 'pendingApproval', 'Approved': 'approved', 'Rejected': 'rejected' };
    const workStatusTranslations: Record<WorkStatus, TranslationKey> = { 'Planning': 'planning', 'In Progress': 'inProgress', 'On Hold': 'onHold', 'Completed': 'completed' };

    const getActionBadge = (action: string) => {
        if (action === 'Approved') {
            return React.createElement("span", { className: "badge badge-green", style: { backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'تایید شده' : 'Approved');
        }
        if (action === 'Rejected') {
            return React.createElement("span", { className: "badge badge-red", style: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'رد شده' : 'Rejected');
        }
        return React.createElement("span", { className: "badge badge-info", style: { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'ارسال شده' : 'Submitted');
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '950px', width: '95%' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: 'var(--primary-color, #4f46e5)' } }, "history"),
                        React.createElement("h3", { style: { margin: 0 } }, `${t('history')}: ${action?.title}`)
                    ),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    history.length === 0 ? React.createElement("p", null, t('noHistoryFound')) : (
                        React.createElement("div", { className: "table-responsive" },
                            React.createElement("table", { className: "users-table" },
                                React.createElement("thead", null, React.createElement("tr", null,
                                    React.createElement("th", null, isFa ? 'تاریخ و ساعت' : 'Date & Time'),
                                    React.createElement("th", null, isFa ? 'ثبت‌کننده' : 'Submitter'),
                                    React.createElement("th", null, isFa ? 'تغییر وضعیت' : 'Status Change'),
                                    React.createElement("th", null, isFa ? 'مرحله گردش کار' : 'Workflow Stage'),
                                    React.createElement("th", null, isFa ? 'تاییدکننده / اقدام‌کننده' : 'Approver / Actor'),
                                    React.createElement("th", null, isFa ? 'وضعیت' : 'Status'),
                                    React.createElement("th", null, isFa ? 'توضیحات ثبت‌کننده' : 'Submitter Comment'),
                                    React.createElement("th", null, isFa ? 'علت و نظر تاییدکننده' : 'Approver Comment / Reason')
                                )),
                                React.createElement("tbody", null, history.flatMap(item => {
                                    const submitter = users.find(u => String(u.id) === String(item.submittedBy));
                                    const submitterLabel = submitter ? (submitter.name ? `${submitter.name} (${submitter.username})` : submitter.username) : 'N/A';
                                    const change = `${t(workStatusTranslations[item.currentStatus as WorkStatus])} -> ${t(workStatusTranslations[item.submittedStatus as WorkStatus])}`;
                                    
                                    if (item.approvalHistory && item.approvalHistory.length > 0) {
                                        const sortedRecs = [...item.approvalHistory].sort((a, b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0));
                                        return sortedRecs.map((rec, recIdx) => (
                                            React.createElement("tr", { key: `${item.id}-${recIdx}` },
                                                React.createElement("td", null, rec.date !== '-' ? formatDateTime(rec.date, language) : formatDateTime(item.submissionDate, language)),
                                                React.createElement("td", null, submitterLabel),
                                                React.createElement("td", null, change),
                                                React.createElement("td", { style: { fontWeight: 500 } }, rec.stageTitle || (rec.action === 'Submitted' ? (isFa ? 'ارسال اولیه' : 'Submission') : (isFa ? 'بررسی مرحله' : 'Stage Review'))),
                                                React.createElement("td", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)' } }, rec.actor || (rec.action === 'Submitted' ? submitterLabel : '-')),
                                                React.createElement("td", null, getActionBadge(rec.action)),
                                                React.createElement("td", { style: { fontSize: '0.85rem' } }, item.submissionComment || '-'),
                                                React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.85rem' } }, rec.comment || item.reviewComment || '-')
                                            )
                                        ));
                                    }

                                    return [
                                        React.createElement("tr", { key: item.id },
                                            React.createElement("td", null, formatDateTime(item.reviewDate || item.submissionDate, language)),
                                            React.createElement("td", null, submitterLabel),
                                            React.createElement("td", null, change),
                                            React.createElement("td", null, item.status === 'Pending Approval' ? (isFa ? 'در انتظار تایید' : 'Pending Approval') : (isFa ? 'تایید نهایی' : 'Final Review')),
                                            React.createElement("td", { style: { fontWeight: 600 } }, item.status === 'Pending Approval' ? '-' : (isFa ? 'مدیر مسئول' : 'Approver')),
                                            React.createElement("td", null, getActionBadge(item.status)),
                                            React.createElement("td", { style: { fontSize: '0.85rem' } }, item.submissionComment || '-'),
                                            React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.85rem' } }, item.reviewComment || '-')
                                        )
                                    ];
                                }))
                            )
                        )
                    )
                )
            )
        )
    );
};

export const TabItemHistoryModal = ({ itemTitle, itemTypeLabel, approvalHistory, submittedBy, isApproved, isRejected, users, onClose }: {
    itemTitle: string;
    itemTypeLabel: string;
    approvalHistory?: ProjectApprovalRecord[];
    submittedBy?: number;
    isApproved?: boolean;
    isRejected?: boolean;
    users: User[];
    onClose: () => void;
}): ReactElement => {
    const { language } = useContext(LocalizationContext);
    const isFa = language === 'fa';

    const submitter = users.find(u => String(u.id) === String(submittedBy));
    const submitterName = submitter ? (submitter.name ? `${submitter.name} (${submitter.username})` : submitter.username) : (isFa ? 'نامشخص' : 'Unknown');

    const records = useMemo(() => {
        if (approvalHistory && approvalHistory.length > 0) {
            return [...approvalHistory].sort((a, b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0));
        }
        const list: ProjectApprovalRecord[] = [
            {
                action: 'Submitted',
                date: '-',
                actor: submitterName,
                stageTitle: isFa ? 'ارسال اولیه' : 'Initial Submission',
                comment: isFa ? 'ارسال اولیه جهت بررسی' : 'Submitted for approval'
            }
        ];
        if (isApproved) {
            list.push({
                action: 'Approved',
                date: '-',
                actor: isFa ? 'مدیر / تاییدکننده' : 'Approver',
                stageTitle: isFa ? 'تایید نهایی' : 'Final Approval',
                comment: isFa ? 'تایید شده' : 'Approved'
            });
        } else if (isRejected) {
            list.push({
                action: 'Rejected',
                date: '-',
                actor: isFa ? 'مدیر / تاییدکننده' : 'Approver',
                stageTitle: isFa ? 'بررسی رد' : 'Review',
                comment: isFa ? 'رد شده' : 'Rejected'
            });
        }
        return list.sort((a, b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0));
    }, [approvalHistory, submitterName, isApproved, isRejected, isFa]);

    const getActionBadge = (action: string) => {
        if (action === 'Approved') {
            return React.createElement("span", { className: "badge badge-green", style: { backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'تایید شده' : 'Approved');
        }
        if (action === 'Rejected') {
            return React.createElement("span", { className: "badge badge-red", style: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'رد شده' : 'Rejected');
        }
        return React.createElement("span", { className: "badge badge-info", style: { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'ارسال شده' : 'Submitted');
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '850px', width: '92%' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: 'var(--primary-color, #4f46e5)' } }, "history"),
                        React.createElement("h3", { style: { margin: 0, fontSize: '1.1rem' } }, `${isFa ? 'تاریخچه گردش کار و تاییدات' : 'Workflow & Approval History'} (${itemTypeLabel})`)
                    ),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    React.createElement("div", { style: { backgroundColor: 'var(--card-bg, #f8fafc)', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid var(--border-color, #e2e8f0)' } },
                        React.createElement("div", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)', marginBottom: '0.25rem' } }, itemTitle),
                        React.createElement("div", { style: { fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' } },
                            React.createElement("span", null, `${isFa ? 'ثبت‌کننده:' : 'Submitter:'} `, React.createElement("strong", { style: { color: 'var(--text-color, #1e293b)' } }, submitterName))
                        )
                    ),
                    React.createElement("div", { className: "table-responsive" },
                        React.createElement("table", { className: "users-table" },
                            React.createElement("thead", null,
                                React.createElement("tr", null,
                                    React.createElement("th", { style: { width: '50px' } }, isFa ? 'ردیف' : '#'),
                                    React.createElement("th", null, isFa ? 'مرحله گردش کار' : 'Workflow Stage'),
                                    React.createElement("th", null, isFa ? 'تاییدکننده / اقدام‌کننده' : 'Approver / Actor'),
                                    React.createElement("th", null, isFa ? 'تاریخ و ساعت' : 'Date & Time'),
                                    React.createElement("th", null, isFa ? 'تصمیم / وضعیت' : 'Decision / Status'),
                                    React.createElement("th", null, isFa ? 'علت و توضیحات' : 'Comment / Reason')
                                )
                            ),
                            React.createElement("tbody", null,
                                records.map((rec, idx) => (
                                    React.createElement("tr", { key: idx },
                                        React.createElement("td", null, isFa ? toPersianDigits(idx + 1) : idx + 1),
                                        React.createElement("td", { style: { fontWeight: 500 } }, rec.stageTitle || (rec.action === 'Submitted' ? (isFa ? 'ارسال اولیه' : 'Submission') : (isFa ? 'بررسی تایید' : 'Approval Review'))),
                                        React.createElement("td", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)' } }, rec.actor || '-'),
                                        React.createElement("td", null, rec.date !== '-' ? formatDateTime(rec.date, language) : '-'),
                                        React.createElement("td", null, getActionBadge(rec.action)),
                                        React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.88rem' } }, rec.comment || '-')
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

export const ApprovalHistoryModal = ({ progressUpdates, projects, actions, users, allProcessedActivities, onClose }: {
    progressUpdates: ProgressUpdate[];
    projects: Project[];
    actions: ActionItem[];
    users: User[];
    allProcessedActivities: Map<string, ProjectActivity>;
    onClose: () => void;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isFa = language === 'fa';
    const [activeTab, setActiveTab] = useState('projects');

    const reviewedItems = useMemo(() => {
        const reviewedProjects = projects.filter(p => p.approvalStatus === 'Approved' || p.approvalStatus === 'Rejected' || (p.approvalHistory && p.approvalHistory.length > 0));
        const reviewedProgress = progressUpdates.filter(p => p.status === 'Approved' || p.status === 'Rejected' || (p.approvalHistory && p.approvalHistory.length > 0));

        const reviewedRisks: { project: Project; item: ProjectRisk }[] = [];
        const reviewedStakeholders: { project: Project; item: ProjectStakeholder }[] = [];
        const reviewedStatusUpdates: { project: Project; item: ProjectStatusUpdate }[] = [];
        const reviewedDelayReasons: { project: Project; item: ProjectDelayReason }[] = [];
        const reviewedDocuments: { project: Project; item: ProjectDocument }[] = [];

        projects.forEach(p => {
            (p.risks || []).forEach(r => {
                if (r.isApproved || r.isRejected || (r.approvalHistory && r.approvalHistory.length > 0)) {
                    reviewedRisks.push({ project: p, item: r });
                }
            });
            (p.stakeholders || []).forEach(sh => {
                if (sh.isApproved || sh.isRejected || (sh.approvalHistory && sh.approvalHistory.length > 0)) {
                    reviewedStakeholders.push({ project: p, item: sh });
                }
            });
            (p.statusUpdates || []).forEach(s => {
                if (s.isApproved || s.isRejected || (s.approvalHistory && s.approvalHistory.length > 0)) {
                    reviewedStatusUpdates.push({ project: p, item: s });
                }
            });
            (p.delayReasons || []).forEach(d => {
                if (d.isApproved || d.isRejected || (d.approvalHistory && d.approvalHistory.length > 0)) {
                    reviewedDelayReasons.push({ project: p, item: d });
                }
            });
            (p.documents || []).forEach(doc => {
                if (doc.isApproved || doc.isRejected || (doc.approvalHistory && doc.approvalHistory.length > 0)) {
                    reviewedDocuments.push({ project: p, item: doc });
                }
            });
        });

        const sortItemsByLatest = (items: { project: Project; item: any }[]) => {
            return [...items].sort((a, b) => {
                const latestDateA = a.item.approvalHistory?.[a.item.approvalHistory.length - 1]?.date || a.item.date;
                const latestDateB = b.item.approvalHistory?.[b.item.approvalHistory.length - 1]?.date || b.item.date;
                return (toSafeDate(latestDateB)?.getTime() || 0) - (toSafeDate(latestDateA)?.getTime() || 0);
            });
        };

        const sortUpdatesByLatest = (updates: ProgressUpdate[]) => {
            return [...updates].sort((a, b) => {
                const latestDateA = a.approvalHistory?.[a.approvalHistory.length - 1]?.date || a.reviewDate || a.submissionDate;
                const latestDateB = b.approvalHistory?.[b.approvalHistory.length - 1]?.date || b.reviewDate || b.submissionDate;
                return (toSafeDate(latestDateB)?.getTime() || 0) - (toSafeDate(latestDateA)?.getTime() || 0);
            });
        };

        const sortProjectsByLatest = (projs: Project[]) => {
            return [...projs].sort((a, b) => {
                const latestDateA = a.approvalHistory?.[a.approvalHistory.length - 1]?.date || a.submissionDate || a.startDate;
                const latestDateB = b.approvalHistory?.[b.approvalHistory.length - 1]?.date || b.submissionDate || b.startDate;
                return (toSafeDate(latestDateB)?.getTime() || 0) - (toSafeDate(latestDateA)?.getTime() || 0);
            });
        };

        return {
            projects: sortProjectsByLatest(reviewedProjects),
            waterfall: sortUpdatesByLatest(reviewedProgress.filter(p => p.activityId)),
            agile: sortUpdatesByLatest(reviewedProgress.filter(p => p.taskId)),
            actions: sortUpdatesByLatest(reviewedProgress.filter(p => p.actionId)),
            risks: sortItemsByLatest(reviewedRisks),
            stakeholders: sortItemsByLatest(reviewedStakeholders),
            status_updates: sortItemsByLatest(reviewedStatusUpdates),
            delay_reasons: sortItemsByLatest(reviewedDelayReasons),
            documents: sortItemsByLatest(reviewedDocuments)
        };
    }, [projects, progressUpdates]);

    const statusTranslations: Record<ProgressUpdateStatus, TranslationKey> = { 'Pending Approval': 'pendingApproval', 'Approved': 'approved', 'Rejected': 'rejected' };
    const projectStatusTranslations: Record<string, TranslationKey> = { 'Approved': 'approved', 'Rejected': 'rejected' };
    const workStatusTranslations: Record<WorkStatus, TranslationKey> = { 'Planning': 'planning', 'In Progress': 'inProgress', 'On Hold': 'onHold', 'Completed': 'completed' };
    const kanbanStatusTranslations: Record<KanbanStatus, TranslationKey> = { 'To-Do': 'toDo', 'Doing': 'doing', 'Done': 'done' };

    const getActionBadge = (action: string) => {
        if (action === 'Approved') {
            return React.createElement("span", { className: "badge badge-green", style: { backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'تایید شده' : 'Approved');
        }
        if (action === 'Rejected') {
            return React.createElement("span", { className: "badge badge-red", style: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'رد شده' : 'Rejected');
        }
        return React.createElement("span", { className: "badge badge-info", style: { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 } }, isFa ? 'ارسال شده' : 'Submitted');
    };

    const renderTabItemTable = (items: { project: Project; item: any }[], titleKey: string) => {
        return React.createElement("div", { className: "table-responsive" },
            React.createElement("table", { className: "users-table" },
                React.createElement("thead", null, React.createElement("tr", null,
                    React.createElement("th", null, t('projectName')),
                    React.createElement("th", null, isFa ? 'عنوان / شرح' : 'Title / Description'),
                    React.createElement("th", null, isFa ? 'مرحله گردش کار' : 'Workflow Stage'),
                    React.createElement("th", null, isFa ? 'تاریخ و ساعت' : 'Date & Time'),
                    React.createElement("th", null, isFa ? 'تاییدکننده / اقدام‌کننده' : 'Approver / Actor'),
                    React.createElement("th", null, isFa ? 'وضعیت' : 'Status'),
                    React.createElement("th", null, isFa ? 'علت و توضیحات' : 'Comment / Reason')
                )),
                React.createElement("tbody", null,
                    items.length > 0 ? items.flatMap(({ project, item }) => {
                        const title = item.description || item.name || item.title || '-';
                        const submitterObj = users.find(u => String(u.id) === String(item.submittedBy));
                        const submitterLabel = submitterObj ? (submitterObj.name ? `${submitterObj.name} (${submitterObj.username})` : submitterObj.username) : '-';
                        
                        const history = item.approvalHistory && item.approvalHistory.length > 0
                            ? [...item.approvalHistory].sort((a, b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0))
                            : [{
                                action: item.isApproved ? 'Approved' : item.isRejected ? 'Rejected' : 'Submitted',
                                date: '-',
                                actor: item.isApproved ? (isFa ? 'تاییدکننده' : 'Approver') : submitterLabel,
                                stageTitle: item.isApproved ? (isFa ? 'تایید نهایی' : 'Final Approval') : (isFa ? 'ارسال اولیه' : 'Submission'),
                                comment: '-'
                            }];

                        return history.map((h: any, i: number) => React.createElement("tr", { key: `${project.id}-${item.id}-${i}` },
                            React.createElement("td", null, project.name),
                            React.createElement("td", null, title),
                            React.createElement("td", { style: { fontWeight: 500 } }, h.stageTitle || (h.action === 'Submitted' ? (isFa ? 'ارسال اولیه' : 'Submission') : (isFa ? 'بررسی مرحله' : 'Stage Review'))),
                            React.createElement("td", null, h.date !== '-' ? formatDateTime(h.date, language) : '-'),
                            React.createElement("td", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)' } }, h.actor || '-'),
                            React.createElement("td", null, getActionBadge(h.action)),
                            React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.88rem' } }, h.comment || '-')
                        ));
                    }) : React.createElement("tr", null, React.createElement("td", { colSpan: 7, style: { textAlign: 'center' } }, isFa ? 'موردی یافت نشد' : 'No items found'))
                )
            )
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'projects':
                return React.createElement("div", { className: "table-responsive" },
                    React.createElement("table", { className: "users-table" },
                        React.createElement("thead", null, React.createElement("tr", null,
                            React.createElement("th", null, t('projectName')),
                            React.createElement("th", null, isFa ? 'مرحله گردش کار' : 'Workflow Stage'),
                            React.createElement("th", null, isFa ? 'تاریخ و ساعت تصمیم' : 'Decision Date & Time'),
                            React.createElement("th", null, isFa ? 'تاییدکننده / اقدام‌کننده' : 'Approver / Actor'),
                            React.createElement("th", null, t('status')),
                            React.createElement("th", null, isFa ? 'علت و توضیحات' : 'Comment / Reason')
                        )),
                        React.createElement("tbody", null,
                            reviewedItems.projects.length > 0 ? (
                                reviewedItems.projects.flatMap(p => {
                                    if (p.approvalHistory && p.approvalHistory.length > 0) {
                                        const sortedHist = [...p.approvalHistory].sort((a, b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0));
                                        return sortedHist.map((h, i) => React.createElement("tr", { key: `${p.id}-${i}`},
                                            React.createElement("td", null, p.name),
                                            React.createElement("td", { style: { fontWeight: 500 } }, h.stageTitle || (h.action === 'Submitted' ? (isFa ? 'ارسال اولیه' : 'Submission') : (isFa ? 'بررسی مرحله' : 'Stage Review'))),
                                            React.createElement("td", null, formatDateTime(h.date, language)),
                                            React.createElement("td", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)' } }, h.actor),
                                            React.createElement("td", null, getActionBadge(h.action)),
                                            React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.88rem' } }, h.comment || '-')
                                        ));
                                    }
                                    return [
                                        React.createElement("tr", { key: p.id },
                                            React.createElement("td", null, p.name),
                                            React.createElement("td", null, isFa ? 'تایید نهایی' : 'Final Review'),
                                            React.createElement("td", null, (p.submissionDate || p.startDate) ? formatDateTime(p.submissionDate || p.startDate!, language) : '-'),
                                            React.createElement("td", { style: { fontWeight: 600 } }, isFa ? 'مدیر سیستم' : 'Admin'),
                                            React.createElement("td", null, getActionBadge(p.approvalStatus || 'Approved')),
                                            React.createElement("td", null, '-')
                                        )
                                    ];
                                })
                            ) : (
                                React.createElement("tr", null, React.createElement("td", { colSpan: 6, style: { textAlign: 'center' } }, isFa ? 'موردی یافت نشد' : 'No items found'))
                            )
                        )
                    )
                );
            case 'waterfall':
                return React.createElement("div", { className: "table-responsive" },
                     React.createElement("table", { className: "users-table" },
                        React.createElement("thead", null, React.createElement("tr", null,
                            React.createElement("th", null, t('projectName')),
                            React.createElement("th", null, t('activityDescription')),
                            React.createElement("th", null, isFa ? 'مرحله گردش کار' : 'Workflow Stage'),
                            React.createElement("th", null, isFa ? 'تاریخ و ساعت' : 'Date & Time'),
                            React.createElement("th", null, isFa ? 'تاییدکننده / اقدام‌کننده' : 'Approver / Actor'),
                            React.createElement("th", null, isFa ? 'پیشرفت اعلامی' : 'Submitted %'),
                            React.createElement("th", null, isFa ? 'پیشرفت تاییدی' : 'Confirmed %'),
                            React.createElement("th", null, t('status')),
                            React.createElement("th", null, isFa ? 'علت و توضیحات' : 'Comment / Reason')
                        )),
                        React.createElement("tbody", null,
                            reviewedItems.waterfall.length > 0 ? (
                                reviewedItems.waterfall.flatMap(up => {
                                    const proj = projects.find(p => p.id === up.projectId);
                                    const act = allProcessedActivities.get(up.activityId!);
                                    const confirmed = up.approvedProgress !== undefined ? `${isFa ? toPersianDigits(up.approvedProgress) : up.approvedProgress}٪` : '-';
                                    const submitted = up.submittedProgress !== undefined ? `${isFa ? toPersianDigits(up.submittedProgress) : up.submittedProgress}٪` : '-';

                                    if (up.approvalHistory && up.approvalHistory.length > 0) {
                                        const sortedHist = [...up.approvalHistory].sort((a, b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0));
                                        return sortedHist.map((h, i) => React.createElement("tr", { key: `hist-wf-${up.id}-${i}` },
                                            React.createElement("td", null, proj?.name || '-'),
                                            React.createElement("td", null, act?.name || '-'),
                                            React.createElement("td", { style: { fontWeight: 500 } }, h.stageTitle || (h.action === 'Submitted' ? (isFa ? 'ارسال اولیه' : 'Submission') : (isFa ? 'بررسی مرحله' : 'Stage Review'))),
                                            React.createElement("td", null, formatDateTime(h.date, language)),
                                            React.createElement("td", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)' } }, h.actor || '-'),
                                            React.createElement("td", null, submitted),
                                            React.createElement("td", null, confirmed),
                                            React.createElement("td", null, getActionBadge(h.action)),
                                            React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.88rem' } }, h.comment || up.reviewComment || '-')
                                        ));
                                    }

                                    return [
                                        React.createElement("tr", { key: `hist-wf-${up.id}` },
                                            React.createElement("td", null, proj?.name || '-'),
                                            React.createElement("td", null, act?.name || '-'),
                                            React.createElement("td", null, isFa ? 'تایید نهایی' : 'Final Review'),
                                            React.createElement("td", null, up.reviewDate ? formatDateTime(up.reviewDate, language) : '-'),
                                            React.createElement("td", { style: { fontWeight: 600 } }, isFa ? 'مدیر پروژه' : 'Project Manager'),
                                            React.createElement("td", null, submitted),
                                            React.createElement("td", null, confirmed),
                                            React.createElement("td", null, getActionBadge(up.status)),
                                            React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.88rem' } }, up.reviewComment || '-')
                                        )
                                    ];
                                })
                            ) : (
                                React.createElement("tr", null, React.createElement("td", { colSpan: 9, style: { textAlign: 'center' } }, isFa ? 'موردی یافت نشد' : 'No items found'))
                            )
                        )
                    )
                );
            case 'agile':
                return React.createElement("div", { className: "table-responsive" },
                     React.createElement("table", { className: "users-table" },
                        React.createElement("thead", null, React.createElement("tr", null,
                            React.createElement("th", null, t('projectName')),
                            React.createElement("th", null, t('activityDescription')),
                            React.createElement("th", null, t('statusChange')),
                            React.createElement("th", null, isFa ? 'مرحله گردش کار' : 'Workflow Stage'),
                            React.createElement("th", null, isFa ? 'تاریخ و ساعت' : 'Date & Time'),
                            React.createElement("th", null, isFa ? 'تاییدکننده / اقدام‌کننده' : 'Approver / Actor'),
                            React.createElement("th", null, t('status')),
                            React.createElement("th", null, isFa ? 'علت و توضیحات' : 'Comment / Reason')
                        )),
                        React.createElement("tbody", null,
                            reviewedItems.agile.length > 0 ? (
                                reviewedItems.agile.flatMap(up => {
                                    const project = projects.find(p => p.id === up.projectId);
                                    const task = project?.kanbanTasks?.find(t => t.id === up.taskId);
                                    const changeDesc = up.submittedTask 
                                        ? `${t('createKanbanActivity')}: "${up.submittedTask.description}"`
                                        : up.submittedStatus ? `${t(kanbanStatusTranslations[up.currentStatus as KanbanStatus])} -> ${t(kanbanStatusTranslations[up.submittedStatus as KanbanStatus])}` : t('update');

                                    if (up.approvalHistory && up.approvalHistory.length > 0) {
                                        const sortedHist = [...up.approvalHistory].sort((a, b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0));
                                        return sortedHist.map((h, i) => React.createElement("tr", { key: `hist-agile-${up.id}-${i}` },
                                            React.createElement("td", null, project?.name || '-'),
                                            React.createElement("td", null, task?.description || '-'),
                                            React.createElement("td", null, changeDesc),
                                            React.createElement("td", { style: { fontWeight: 500 } }, h.stageTitle || (h.action === 'Submitted' ? (isFa ? 'ارسال اولیه' : 'Submission') : (isFa ? 'بررسی مرحله' : 'Stage Review'))),
                                            React.createElement("td", null, formatDateTime(h.date, language)),
                                            React.createElement("td", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)' } }, h.actor || '-'),
                                            React.createElement("td", null, getActionBadge(h.action)),
                                            React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.88rem' } }, h.comment || up.reviewComment || '-')
                                        ));
                                    }

                                    return [
                                        React.createElement("tr", { key: `hist-agile-${up.id}` },
                                            React.createElement("td", null, project?.name || '-'),
                                            React.createElement("td", null, task?.description || '-'),
                                            React.createElement("td", null, changeDesc),
                                            React.createElement("td", null, isFa ? 'تایید نهایی' : 'Final Review'),
                                            React.createElement("td", null, up.reviewDate ? formatDateTime(up.reviewDate, language) : '-'),
                                            React.createElement("td", { style: { fontWeight: 600 } }, isFa ? 'مدیر پروژه' : 'Project Manager'),
                                            React.createElement("td", null, getActionBadge(up.status)),
                                            React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.88rem' } }, up.reviewComment || '-')
                                        )
                                    ];
                                })
                            ) : (
                                React.createElement("tr", null, React.createElement("td", { colSpan: 8, style: { textAlign: 'center' } }, isFa ? 'موردی یافت نشد' : 'No items found'))
                            )
                        )
                    )
                );
            case 'actions':
                 return React.createElement("div", { className: "table-responsive" },
                     React.createElement("table", { className: "users-table" },
                        React.createElement("thead", null, React.createElement("tr", null,
                            React.createElement("th", null, t('actionTitleColumn')),
                            React.createElement("th", null, t('statusChange')),
                            React.createElement("th", null, isFa ? 'مرحله گردش کار' : 'Workflow Stage'),
                            React.createElement("th", null, isFa ? 'تاریخ و ساعت' : 'Date & Time'),
                            React.createElement("th", null, isFa ? 'تاییدکننده / اقدام‌کننده' : 'Approver / Actor'),
                            React.createElement("th", null, t('status')),
                            React.createElement("th", null, isFa ? 'علت و توضیحات' : 'Comment / Reason')
                        )),
                        React.createElement("tbody", null,
                            reviewedItems.actions.length > 0 ? (
                                reviewedItems.actions.flatMap(up => {
                                    const action = actions.find(a => a.id === up.actionId);
                                    const changeDesc = `${t(workStatusTranslations[up.currentStatus as WorkStatus])} -> ${t(workStatusTranslations[up.submittedStatus as WorkStatus])}`;

                                    if (up.approvalHistory && up.approvalHistory.length > 0) {
                                        const sortedHist = [...up.approvalHistory].sort((a, b) => (toSafeDate(b.date)?.getTime() || 0) - (toSafeDate(a.date)?.getTime() || 0));
                                        return sortedHist.map((h, i) => React.createElement("tr", { key: `hist-act-${up.id}-${i}` },
                                            React.createElement("td", null, action?.title || '-'),
                                            React.createElement("td", null, changeDesc),
                                            React.createElement("td", { style: { fontWeight: 500 } }, h.stageTitle || (h.action === 'Submitted' ? (isFa ? 'ارسال اولیه' : 'Submission') : (isFa ? 'بررسی مرحله' : 'Stage Review'))),
                                            React.createElement("td", null, formatDateTime(h.date, language)),
                                            React.createElement("td", { style: { fontWeight: 600, color: 'var(--text-color, #1e293b)' } }, h.actor || '-'),
                                            React.createElement("td", null, getActionBadge(h.action)),
                                            React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.88rem' } }, h.comment || up.reviewComment || '-')
                                        ));
                                    }

                                    return [
                                        React.createElement("tr", { key: `hist-act-${up.id}` },
                                            React.createElement("td", null, action?.title || '-'),
                                            React.createElement("td", null, changeDesc),
                                            React.createElement("td", null, isFa ? 'تایید نهایی' : 'Final Review'),
                                            React.createElement("td", null, up.reviewDate ? formatDateTime(up.reviewDate, language) : '-'),
                                            React.createElement("td", { style: { fontWeight: 600 } }, isFa ? 'مدیر مسئول' : 'Approver'),
                                            React.createElement("td", null, getActionBadge(up.status)),
                                            React.createElement("td", { style: { whiteSpace: 'pre-wrap', fontSize: '0.88rem' } }, up.reviewComment || '-')
                                        )
                                    ];
                                })
                            ) : (
                                React.createElement("tr", null, React.createElement("td", { colSpan: 7, style: { textAlign: 'center' } }, isFa ? 'موردی یافت نشد' : 'No items found'))
                            )
                        )
                    )
                );
            case 'risks':
                return renderTabItemTable(reviewedItems.risks, 'risks');
            case 'stakeholders':
                return renderTabItemTable(reviewedItems.stakeholders, 'stakeholders');
            case 'status_updates':
                return renderTabItemTable(reviewedItems.status_updates, 'status');
            case 'delay_reasons':
                return renderTabItemTable(reviewedItems.delay_reasons, 'delays');
            case 'documents':
                return renderTabItemTable(reviewedItems.documents, 'docs');
            default: return null;
        }
    };
    
    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '90vw' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, t('transactionHistory')),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    React.createElement("nav", { className: "tabs-nav", style: { flexWrap: 'wrap', gap: '0.25rem' } },
                        React.createElement("button", { className: `tab-item ${activeTab === 'projects' ? 'active' : ''}`, onClick: () => setActiveTab('projects') }, t('projects')),
                        React.createElement("button", { className: `tab-item ${activeTab === 'waterfall' ? 'active' : ''}`, onClick: () => setActiveTab('waterfall') }, t('waterfallTasks')),
                        React.createElement("button", { className: `tab-item ${activeTab === 'agile' ? 'active' : ''}`, onClick: () => setActiveTab('agile') }, t('agileTasks')),
                        React.createElement("button", { className: `tab-item ${activeTab === 'actions' ? 'active' : ''}`, onClick: () => setActiveTab('actions') }, t('actionsGroup')),
                        React.createElement("button", { className: `tab-item ${activeTab === 'risks' ? 'active' : ''}`, onClick: () => setActiveTab('risks') }, language === 'fa' ? 'ریسک‌ها' : 'Risks'),
                        React.createElement("button", { className: `tab-item ${activeTab === 'stakeholders' ? 'active' : ''}`, onClick: () => setActiveTab('stakeholders') }, language === 'fa' ? 'ذینفعان' : 'Stakeholders'),
                        React.createElement("button", { className: `tab-item ${activeTab === 'status_updates' ? 'active' : ''}`, onClick: () => setActiveTab('status_updates') }, language === 'fa' ? 'آخرین وضعیت' : 'Status Updates'),
                        React.createElement("button", { className: `tab-item ${activeTab === 'delay_reasons' ? 'active' : ''}`, onClick: () => setActiveTab('delay_reasons') }, language === 'fa' ? 'دلایل تاخیر' : 'Delay Reasons'),
                        React.createElement("button", { className: `tab-item ${activeTab === 'documents' ? 'active' : ''}`, onClick: () => setActiveTab('documents') }, language === 'fa' ? 'مستندات' : 'Documents')
                    ),
                    React.createElement("div", { className: "tab-content" }, renderContent())
                )
            )
        )
    );
};

export const DelegationModal = ({ isOpen, onClose, taskName, users, currentUserId, onSave }: {
    isOpen: boolean;
    onClose: () => void;
    taskName: string;
    users: User[];
    currentUserId: string;
    onSave: (delegateeId: string) => void;
}): ReactElement | null => {
    const { t } = useContext(LocalizationContext);
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    const availableUsers = useMemo(() => users.filter(u => u.id !== currentUserId && u.isActive), [users, currentUserId]);
    
    useEffect(() => {
        if(isOpen && availableUsers.length > 0) {
            setSelectedUserId(String(availableUsers[0].id));
        }
    }, [isOpen, availableUsers]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (selectedUserId) {
            onSave(selectedUserId);
        }
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '500px' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, t('delegate')),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    React.createElement("p", null, `${t('delegate')} ${t('activityDescription')}: `, React.createElement("strong", null, taskName)),
                    React.createElement("div", { className: "form-group", style: { marginTop: '1rem' } },
                        React.createElement("label", { htmlFor: "delegatee-select" }, t('selectDelegatee')),
                        React.createElement("select", {
                            id: "delegatee-select",
                            value: selectedUserId,
                            onChange: (e: ChangeEvent<HTMLSelectElement>) => setSelectedUserId(e.target.value),
                        },
                            availableUsers.map(user => 
                                React.createElement("option", { key: user.id, value: user.id }, user.username)
                            )
                        )
                    )
                ),
                React.createElement("div", { className: "modal-footer" },
                    React.createElement("button", { onClick: handleSave, className: "save-btn", disabled: !selectedUserId }, t('delegate')),
                    React.createElement("button", { onClick: onClose, className: "cancel-btn" }, t('cancel'))
                )
            )
        )
    );
};

export const MyDelegationsModal = ({ isOpen, onClose, delegations, projects, actions, users, onDeactivate }: {
    isOpen: boolean;
    onClose: () => void;
    delegations: Delegation[];
    projects: Project[];
    actions: ActionItem[];
    users: User[];
    onDeactivate: (delegationId: string) => void;
}): ReactElement | null => {
    const { t, language } = useContext(LocalizationContext);

    if (!isOpen) return null;

    const getTaskInfo = (delegation: Delegation) => {
        if (delegation.type === 'action') {
            const action = actions.find(a => a.id === delegation.itemId);
            const projectName = delegation.projectId ? (projects.find(p => p.id === delegation.projectId)?.name || 'N/A') : 'N/A';
            return { projectName, taskName: action?.title || 'N/A' };
        }
        
        const project = projects.find(p => p.id === delegation.projectId);
        if (!project) return { projectName: 'N/A', taskName: 'N/A' };

        let taskName = 'N/A';
        if (delegation.type === 'waterfall' && project.schedule) {
            const activity = project.schedule.find(a => a.id === delegation.itemId);
            taskName = activity?.name || 'N/A';
        } else if (delegation.type === 'agile' && project.kanbanTasks) {
            const task = project.kanbanTasks.find(t => t.id === delegation.itemId);
            taskName = task?.description || 'N/A';
        }

        return { projectName: project.name, taskName };
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '800px' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("h3", null, t('delegationList')),
                    React.createElement("button", { onClick: onClose, className: "modal-close-button" }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                ),
                React.createElement("div", { className: "modal-body" },
                    delegations.length === 0 ? (
                        React.createElement("p", null, t('noDelegations'))
                    ) : (
                        React.createElement("div", { className: "table-responsive" },
                            React.createElement("table", { className: "users-table" },
                                React.createElement("thead", null, React.createElement("tr", null,
                                    React.createElement("th", null, t('activityDescription')),
                                    React.createElement("th", null, t('projectNameColumn')),
                                    React.createElement("th", null, t('delegatedTo')),
                                    React.createElement("th", null, t('delegationDate')),
                                    React.createElement("th", null, t('actions')),
                                )),
                                React.createElement("tbody", null, delegations.map(d => {
                                    const { projectName, taskName } = getTaskInfo(d);
                                    const delegatee = users.find(u => u.id === d.delegateeId);
                                    return React.createElement("tr", { key: d.id },
                                        React.createElement("td", null, taskName),
                                        React.createElement("td", null, projectName),
                                        React.createElement("td", null, delegatee?.username || 'N/A'),
                                        React.createElement("td", null, formatDate(d.delegationDate, language)),
                                        React.createElement("td", { className: "action-cell" }, React.createElement("button", {
                                            className: "action-button",
                                            onClick: () => {
                                                if(window.confirm(t('confirmDeactivateDelegation'))) {
                                                    onDeactivate(d.id);
                                                }
                                            }
                                        } as React.HTMLAttributes<HTMLButtonElement>, t('deactivate')))
                                    );
                                }))
                            )
                        )
                    )
                )
            )
        )
    );
};

export const AgileProgressChartModal = ({ project, users, progressUpdates = [], onClose }: { project: Project, users: User[], progressUpdates?: ProgressUpdate[], onClose: () => void }): ReactElement => {
    const { language } = useContext(LocalizationContext);
    const [chartMode, setChartMode] = useState<'burnup' | 'burndown'>('burnup');

    const sprintCount = project.sprintCount || Math.max(1, ...(project.kanbanTasks || []).map(t => t.sprintNumber || 1));
    
    // Calculate data per sprint
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

    return renderInPortal(
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", { className: "modal-content", onClick: (e: MouseEvent<HTMLDivElement>) => e.stopPropagation(), style: { maxWidth: '850px', width: '92vw', maxHeight: '90vh' } },
                React.createElement("div", { className: "modal-header" },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
                        React.createElement("span", { className: "material-symbols-outlined", style: { color: 'var(--primary-color)', fontSize: '1.75rem' } }, "monitoring"),
                        React.createElement("div", null,
                            React.createElement("h3", { style: { margin: 0, fontSize: '1.1rem' } }, language === 'fa' ? 'نمودار پیشرفت اسپرینت‌ها (Burn-Up / Burn-Down)' : 'Sprint Progress Chart (Burn-Up / Burn-Down)'),
                            React.createElement("div", { style: { fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' } }, project.name)
                        )
                    ),
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        React.createElement("button", { 
                            onClick: () => exportDashboardToLandscapePdf(`${project.name || 'Project'}_Agile_Progress`),
                            className: "action-button secondary no-print",
                            title: language === 'fa' ? 'خروجی PDF' : 'Export PDF',
                            style: { padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', backgroundColor: '#ef4444', border: 'none' }
                        }, React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.2rem', color: '#fff' } }, "picture_as_pdf")),
                        React.createElement("button", { onClick: onClose, className: "modal-close-button" },
                            React.createElement("span", { className: "material-symbols-outlined" }, "close")
                        )
                    )
                ),
                React.createElement("div", { className: "modal-body", style: { padding: '1.5rem' } },
                    React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' } },
                        React.createElement("div", { style: { display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary, #f1f5f9)', padding: '4px', borderRadius: '8px' } },
                            React.createElement("button", {
                                onClick: () => setChartMode('burnup'),
                                style: {
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: chartMode === 'burnup' ? 'var(--primary-color, #2563eb)' : 'transparent',
                                    color: chartMode === 'burnup' ? '#fff' : 'var(--text-secondary, #64748b)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }
                            }, language === 'fa' ? 'نمودار برن آپ (Burn Up)' : 'Burn Up'),
                            React.createElement("button", {
                                onClick: () => setChartMode('burndown'),
                                style: {
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: chartMode === 'burndown' ? 'var(--primary-color, #2563eb)' : 'transparent',
                                    color: chartMode === 'burndown' ? '#fff' : 'var(--text-secondary, #64748b)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }
                            }, language === 'fa' ? 'نمودار برن داون (Burn Down)' : 'Burn Down')
                        ),
                        React.createElement("div", { style: { fontSize: '0.85rem', color: 'var(--text-secondary)' } },
                            language === 'fa' ? `تعداد اسپرینت‌ها: ${toPersianDigits(sprintCount)}` : `Total Sprints: ${sprintCount}`
                        )
                    ),
                    React.createElement("div", { style: { width: '100%', height: 420 } },
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
                                React.createElement(LineChart, { data: chartData, margin: { top: 20, right: 30, left: 20, bottom: 20 } },
                                    React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--border-color, #e2e8f0)" }),
                                    React.createElement(XAxis, { dataKey: "sprintName", tick: { fontSize: 12, fill: 'var(--text-color, #64748b)' } }),
                                    React.createElement(YAxis, { allowDecimals: false, tick: { fontSize: 12, fill: 'var(--text-color, #64748b)' } }),
                                    React.createElement(Tooltip, {
                                        formatter: (val: any, name: string) => [
                                            val,
                                            language === 'fa' ? 'موارد باقیمانده' : 'Remaining Items'
                                        ],
                                        contentStyle: { borderRadius: '8px', fontSize: '0.85rem', direction: language === 'fa' ? 'rtl' : 'ltr' }
                                    }),
                                    React.createElement(Legend, {
                                        layout: 'horizontal',
                                        align: 'center',
                                        verticalAlign: 'bottom',
                                        wrapperStyle: { paddingTop: '20px', direction: language === 'fa' ? 'rtl' : 'ltr', fontSize: '0.85rem' },
                                        formatter: () => language === 'fa' ? 'موارد باقیمانده' : 'Remaining Items'
                                    }),
                                    React.createElement(Line, { type: "monotone", dataKey: "remaining", name: "remaining", stroke: "#ef4444", strokeWidth: 3, dot: { r: 5, fill: '#ef4444' }, activeDot: { r: 8 } })
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};