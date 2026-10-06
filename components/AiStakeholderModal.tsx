import React, { useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Project, ProjectStakeholder, getStakeholderStrategy, DynamicWorkflowSettings, DEFAULT_DYNAMIC_WORKFLOW_SETTINGS, resolveWorkflowApproverId, User, ProjectApprovalRecord } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { LocalizationContext } from '../context';
import { getISODateString, getISODateTimeString, formatDate } from '../utils';

interface AiStakeholderModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onApplyStakeholders: (newStakeholders: ProjectStakeholder[], replace: boolean) => void;
  isPMOrAdmin?: boolean;
  currentUserId?: number;
  requiresWorkflow?: boolean;
  dynamicWorkflowSettings?: DynamicWorkflowSettings;
  users?: User[];
}

export const AiStakeholderModal: React.FC<AiStakeholderModalProps> = ({
  project,
  isOpen,
  onClose,
  onApplyStakeholders,
  isPMOrAdmin = false,
  currentUserId,
  requiresWorkflow = true,
  dynamicWorkflowSettings,
  users
}) => {
  const { language } = useContext(LocalizationContext);
  const isFa = language === 'fa';

  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedStakeholders, setGeneratedStakeholders] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const generateClientSideFallback = async () => {
    const apiKey = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).process?.env?.GEMINI_API_KEY);
    if (!apiKey) {
      throw new Error(isFa ? 'کلید GEMINI_API_KEY یافت نشد. لطفاً آن را در تنظیمات وارد کنید.' : 'GEMINI_API_KEY not found.');
    }

    const ai = new GoogleGenAI({ apiKey });

    let wbsSummary = '';
    if (project.activities && project.activities.length > 0) {
      wbsSummary = project.activities.slice(0, 15).map(a => `- ${a.name} (مدت: ${a.duration} روز)`).join('\n');
    } else if (project.kanbanTasks && project.kanbanTasks.length > 0) {
      wbsSummary = project.kanbanTasks.slice(0, 15).map(t => `- ${t.description}`).join('\n');
    }

    const systemInstruction = isFa
      ? `شما یک متخصص ارشد مدیریت ذینفعان پروژه (PMI-PMP) هستید.
وظیفه شما تحلیل منشور پروژه و ساختار شکست کار (WBS / لیست فعالیت‌ها) و پیشنهاد لیست ذینفعان کلیدی پروژه به زبان فارسی است:
- عنوان پروژه: ${project.name || 'پروژه عمومی'}
- هدف: ${project.goal || 'مشخص نشده'}
- محدوده: ${project.description || 'مشخص نشده'}
- تاریخ شروع و پایان: ${project.startDate || 'نامشخص'} تا ${project.endDate || 'نامشخص'}
${wbsSummary ? `\nخلاصه فعالیت‌ها و WBS:\n${wbsSummary}\n` : ''}
${customPrompt ? `دستورات تکمیلی کاربر:\n${customPrompt}\n` : ''}

الزامات:
بین ۴ تا ۷ ذینفع کلیدی پیشنهاد دهید.
هر ذینفع شامل:
۱. name: عنوان یا سمت ذینفع
۲. power: قدرت ذینفع دقیقاً یکی از مقادیر 'High' یا 'Low'
۳. interest: میزان علاقه ذینفع دقیقاً یکی از مقادیر 'High' یا 'Low'
۴. requirements: نیازمندی‌ها و الزامات فنی و ارتباطی ذینفع
`
      : `You are a Senior Project Stakeholder Management Professional (PMI-PMP).
Your task is to analyze the project charter and WBS and propose key project stakeholders in English:
- Project Title: ${project.name || 'General Project'}
- Objective: ${project.goal || 'Not specified'}
- Scope: ${project.description || 'Not specified'}
- Timeline: ${project.startDate || 'N/A'} to ${project.endDate || 'N/A'}
${wbsSummary ? `\nWBS / Activities Summary:\n${wbsSummary}\n` : ''}
${customPrompt ? `Additional user instructions:\n${customPrompt}\n` : ''}

Requirements:
Propose between 4 to 7 key stakeholders.
Each stakeholder must contain:
1. name: Title / role / name of stakeholder
2. power: Exactly 'High' or 'Low'
3. interest: Exactly 'High' or 'Low'
4. requirements: Technical and communication expectations
`;

    const responseSchema = {
      type: Type.ARRAY,
      description: isFa ? "لیست ذینفعان پیشنهادی پروژه" : "List of proposed project stakeholders",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          power: { type: Type.STRING },
          interest: { type: Type.STRING },
          requirements: { type: Type.STRING }
        },
        required: ["name", "power", "interest", "requirements"]
      }
    };

    const models = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: isFa
              ? `لطفاً لیست ذینفعان پیشنهادی پروژه "${project.name || 'پروژه'}" را بر اساس منشور و WBS تولید کنید.`
              : `Please generate the list of proposed stakeholders for project "${project.name || 'Project'}" based on the charter and WBS.`,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema
            }
          });

          const text = response.text || '[]';
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (err) {
          console.warn(`Client stakeholder fallback with ${model} attempt ${attempt + 1} failed:`, err);
        }
      }
    }

    const pName = project.name || (isFa ? 'پروژه' : 'Project');
    return isFa ? [
      {
        name: "کارفرما و حامی مالی پروژه",
        power: "High",
        interest: "High",
        requirements: `دریافت گزارش‌های پیشرفت ماهانه و صورت وضعیت‌های مالی پروژه ${pName}`
      },
      {
        name: "مدیر ارشد فناوری و زیرساخت",
        power: "High",
        interest: "Low",
        requirements: "انطباق با استانداردهای امنیتی و سازمانی و پایداری سرویس‌ها"
      },
      {
        name: "تیم اجرایی و توسعه‌دهندگان",
        power: "Low",
        interest: "High",
        requirements: "شفافیت شرح وظایف، تامین تجهیزات و دسترسی‌های لازم"
      },
      {
        name: "کاربران نهایی و بهره‌برداران",
        power: "Low",
        interest: "High",
        requirements: "سهولت کاربری، برگزاری دوره‌های آموزشی و پشتیبانی موثر"
      }
    ] : [
      {
        name: "Project Sponsor / Client",
        power: "High",
        interest: "High",
        requirements: `Monthly milestone progress reports and budget status for ${pName}`
      },
      {
        name: "Chief Technology Officer / Infrastructure Lead",
        power: "High",
        interest: "Low",
        requirements: "Compliance with security standards and enterprise architecture"
      },
      {
        name: "Core Project Execution Team",
        power: "Low",
        interest: "High",
        requirements: "Clear task specifications, environment access and tooling"
      },
      {
        name: "End Users / Operations Team",
        power: "Low",
        interest: "High",
        requirements: "User-friendly interface, comprehensive training and operational support"
      }
    ];
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    const payload = {
      title: project.name,
      language: language || 'fa',
      charterData: {
        title: project.name,
        goal: project.goal,
        objective: project.goal,
        description: project.description,
        scope: project.description,
        cost: project.cost,
        startDate: project.startDate,
        endDate: project.endDate
      },
      scheduleActivities: project.activities || [],
      kanbanTasks: project.kanbanTasks || [],
      customPrompt
    };

    try {
      const res = await fetch('/api/ai/suggest-stakeholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.stakeholders) && data.stakeholders.length > 0) {
        setGeneratedStakeholders(data.stakeholders);
      } else {
        throw new Error(data.error || 'پاسخ نامعتبر از سرور');
      }
    } catch (err: any) {
      console.warn('API call to /api/ai/suggest-stakeholders failed, trying client side SDK:', err);
      try {
        const clientStakeholders = await generateClientSideFallback();
        setGeneratedStakeholders(clientStakeholders);
      } catch (clientErr: any) {
        console.error('Client side stakeholder generation also failed:', clientErr);
        setError(clientErr.message || (isFa ? 'خطا در ارتباط با هوش مصنوعی' : 'AI connection error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (replace: boolean) => {
    if (!generatedStakeholders || generatedStakeholders.length === 0) return;

    const isOwnerOrPMOrAdmin = Boolean(
      isPMOrAdmin ||
      (currentUserId && (
        Number(project.projectManagerId) === Number(currentUserId) ||
        Number(project.ownerId || 1) === Number(currentUserId) ||
        users?.find(u => Number(u.id) === Number(currentUserId))?.role === 'Admin'
      ))
    );

    const shouldAutoApprove = isOwnerOrPMOrAdmin || requiresWorkflow === false;

    let initialApproverId: number | undefined = undefined;
    if (!shouldAutoApprove) {
      const stages = dynamicWorkflowSettings?.stakeholders || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS.stakeholders;
      if (stages && stages[0]) {
        initialApproverId = resolveWorkflowApproverId(stages[0].approverId, project, currentUserId);
      } else {
        initialApproverId = project.projectManagerId;
      }
    }

    const currentUserObj = users?.find(u => Number(u.id) === Number(currentUserId));
    const actorName = currentUserObj ? (currentUserObj.name ? `${currentUserObj.name} (${currentUserObj.username})` : currentUserObj.username) : (isFa ? 'کاربر' : 'User');

    const newStakeholders: ProjectStakeholder[] = generatedStakeholders.map((s, idx) => ({
      id: Date.now() + idx,
      name: s.name || (isFa ? 'ذینفع پروژه' : 'Stakeholder'),
      power: s.power === 'Low' ? 'Low' : 'High',
      interest: s.interest === 'Low' ? 'Low' : 'High',
      strategy: getStakeholderStrategy(s.power === 'Low' ? 'Low' : 'High', s.interest === 'Low' ? 'Low' : 'High', language),
      requirements: s.requirements || '',
      isApproved: shouldAutoApprove,
      isRejected: false,
      submittedBy: currentUserId,
      currentStageIndex: 0,
      currentApproverId: shouldAutoApprove ? undefined : initialApproverId,
      approvalHistory: [
        {
          action: shouldAutoApprove ? ('Approved' as const) : ('Submitted' as const),
          date: getISODateTimeString(),
          actor: actorName,
          stageTitle: shouldAutoApprove ? (isFa ? 'تایید مستقیم (پیشنهاد هوش مصنوعی)' : 'Direct Approval (AI Suggested)') : (isFa ? 'ارسال اولیه (پیشنهاد هوش مصنوعی)' : 'Initial Submission (AI Suggested)'),
          comment: shouldAutoApprove ? (isFa ? 'تولید شده توسط هوش مصنوعی و تایید مستقیم' : 'AI Generated & Approved') : (isFa ? 'تولید شده توسط هوش مصنوعی - در انتظار تایید' : 'AI Generated - Pending Approval')
        }
      ]
    }));

    onApplyStakeholders(newStakeholders, replace);
    onClose();
  };

  const modalElement = (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem'
    }}>
      <div className="modal-content card shadow-lg" style={{
        maxWidth: '850px', width: '100%', maxHeight: '92vh', overflowY: 'auto',
        backgroundColor: 'var(--card-bg-color, #ffffff)', borderRadius: '16px', padding: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" style={{ color: '#0284c7', fontSize: '1.5rem' }}>groups</span>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-color, #1e293b)' }}>
              {isFa ? 'دستیار هوش مصنوعی تحلیل و شناسایی ذینفعان پروژه' : 'AI Stakeholder Analysis Assistant'}
            </h3>
          </div>
          <button onClick={onClose} className="modal-close-button" style={{ border: 'none', cursor: 'pointer' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Project Context Summary */}
        <div className="ai-modal-context-box" style={{ fontSize: '0.95rem', lineHeight: '1.7', padding: '0.9rem 1.15rem', borderRadius: '10px', marginBottom: '1rem', backgroundColor: 'var(--warning-box-bg, #f0f9ff)', border: '1px solid var(--warning-box-border, #7dd3fc)', color: 'var(--text-color, #0369a1)' }}>
          <div className="ai-modal-context-title" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--warning-box-title, #0369a1)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>info</span>
            <span>{isFa ? 'اطلاعات ورودی هوش مصنوعی از منشور و WBS پروژه:' : 'AI Input Context:'}</span>
          </div>
          <div className="ai-modal-context-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
            <div className="ai-modal-context-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.75rem 2rem', fontSize: '0.95rem' }}>
              <div className="ai-modal-context-item" style={{ fontSize: '0.95rem', lineHeight: '1.65' }}>
                <span className="ai-modal-context-label" style={{ fontWeight: 700, fontSize: '0.95rem', marginInlineEnd: '0.45rem', color: 'var(--text-color, #0f172a)' }}>{isFa ? 'نام پروژه:' : 'Project Name:'}</span>
                <span className="ai-modal-context-value" style={{ fontWeight: 400, fontSize: '0.95rem', color: 'var(--text-color, #334155)' }}>{project.name || (isFa ? 'بدون عنوان' : 'Untitled')}</span>
              </div>
              <div className="ai-modal-context-item" style={{ fontSize: '0.95rem', lineHeight: '1.65' }}>
                <span className="ai-modal-context-label" style={{ fontWeight: 700, fontSize: '0.95rem', marginInlineEnd: '0.45rem', color: 'var(--text-color, #0f172a)' }}>{isFa ? 'تاریخ پروژه:' : 'Dates:'}</span>
                <span className="ai-modal-context-value" style={{ fontWeight: 400, fontSize: '0.95rem', color: 'var(--text-color, #334155)' }}>
                  {project.startDate && project.endDate 
                    ? `${formatDate(project.startDate, language)} تا ${formatDate(project.endDate, language)}` 
                    : (formatDate(project.startDate, language) || '-')}
                </span>
              </div>
            </div>
            {project.goal && (
              <div className="ai-modal-context-item full-width" style={{ width: '100%', fontSize: '0.95rem', lineHeight: '1.65' }}>
                <span className="ai-modal-context-label" style={{ fontWeight: 700, fontSize: '0.95rem', marginInlineEnd: '0.45rem', color: 'var(--text-color, #0f172a)' }}>{isFa ? 'هدف پروژه:' : 'Goal:'}</span>
                <span className="ai-modal-context-value" style={{ fontWeight: 400, fontSize: '0.95rem', color: 'var(--text-color, #334155)' }}>{project.goal}</span>
              </div>
            )}
            {project.description && (
              <div className="ai-modal-context-item full-width" style={{ width: '100%', fontSize: '0.95rem', lineHeight: '1.65' }}>
                <span className="ai-modal-context-label" style={{ fontWeight: 700, fontSize: '0.95rem', marginInlineEnd: '0.45rem', color: 'var(--text-color, #0f172a)' }}>{isFa ? 'محدوده پروژه:' : 'Scope:'}</span>
                <span className="ai-modal-context-value" style={{ fontWeight: 400, fontSize: '0.95rem', color: 'var(--text-color, #334155)' }}>{project.description}</span>
              </div>
            )}
            <div className="ai-modal-context-item full-width" style={{ width: '100%', fontSize: '0.95rem', lineHeight: '1.65' }}>
              <span className="ai-modal-context-label" style={{ fontWeight: 700, fontSize: '0.95rem', marginInlineEnd: '0.45rem', color: 'var(--text-color, #0f172a)' }}>{isFa ? 'وضعیت WBS / فعالیت‌ها:' : 'WBS Context:'}</span>
              <span className="ai-modal-context-value" style={{ fontWeight: 400, fontSize: '0.95rem', color: 'var(--text-color, #334155)' }}>
                {project.activities && project.activities.length > 0 
                  ? (isFa ? `${project.activities.length} فعالیت در ساختار شکست کار (WBS)` : `${project.activities.length} WBS Activities`)
                  : (project.kanbanTasks && project.kanbanTasks.length > 0 
                    ? (isFa ? `${project.kanbanTasks.length} فعالیت چابک` : `${project.kanbanTasks.length} Agile Tasks`)
                    : (isFa ? 'هنوز WBS تعریف نشده است (صرفاً بر اساس منشور تولید می‌شود)' : 'No WBS defined yet (Will generate from charter)'))}
              </span>
            </div>
          </div>
        </div>

        {/* Custom Prompt Textarea */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.45rem', color: 'var(--text-color, #0f172a)' }}>
            {isFa ? 'دستورالعمل و الزامات خاص کاربر (اختیاری):' : 'Custom Prompt / Focus Area (Optional):'}
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={isFa ? 'مثلاً: بر ذینفعان مالی، کاربران سامانه و نهادهای قانون‌گذار تمرکز شود...' : 'e.g. Focus on financial stakeholders and end users...'}
            rows={2}
            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-color, #0f172a)', backgroundColor: 'var(--card-bg-color, #ffffff)', fontFamily: 'inherit' }}
          />
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '0.55rem', borderRadius: '6px', marginBottom: '0.85rem', fontSize: '0.7rem' }}>
            {error}
          </div>
        )}

        {!generatedStakeholders && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="action-button primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.76rem' }}
            >
              <span className={`material-symbols-outlined ${loading ? 'spin' : ''}`} style={{ fontSize: '1rem' }}>{loading ? 'sync' : 'auto_awesome'}</span>
              {loading ? (isFa ? 'در حال تحلیل منشور و شناسایی ذینفعان...' : 'Analyzing & Generating Stakeholders...') : (isFa ? 'تولید ذینفعان پیشنهادی با هوش مصنوعی' : 'Generate Suggested Stakeholders')}
            </button>
          </div>
        )}

        {generatedStakeholders && (
          <div style={{ marginTop: '0.85rem' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: '#0284c7' }}>
              {isFa ? 'ذینفعان پیشنهادی هوش مصنوعی بر اساس منشور و WBS:' : 'AI Suggested Stakeholders Output:'}
            </h4>

            <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '0.85rem', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
              <table className="tab-table" style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-color, #334155)' }}>
                    <th style={{ width: '35px', padding: '0.4rem' }}>#</th>
                    <th style={{ padding: '0.4rem', width: '180px' }}>{isFa ? 'عنوان / نام ذینفع' : 'Stakeholder Name'}</th>
                    <th style={{ width: '75px', padding: '0.4rem' }}>{isFa ? 'قدرت' : 'Power'}</th>
                    <th style={{ width: '75px', padding: '0.4rem' }}>{isFa ? 'علاقه' : 'Interest'}</th>
                    <th style={{ padding: '0.4rem', width: '170px' }}>{isFa ? 'استراتژی برخورد' : 'Strategy'}</th>
                    <th style={{ padding: '0.4rem' }}>{isFa ? 'نیازمندی‌ها و الزامات فنی و ارتباطی' : 'Technical & Comm. Requirements'}</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedStakeholders.map((sh, idx) => {
                    const pVal = sh.power === 'Low' ? 'Low' : 'High';
                    const iVal = sh.interest === 'Low' ? 'Low' : 'High';
                    const strategyText = getStakeholderStrategy(pVal, iVal, language);

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

                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? 'var(--card-bg-color, #ffffff)' : 'var(--bg-secondary, #f8fafc)', borderBottom: '1px solid var(--border-color, #f1f5f9)', color: 'var(--text-color, #1e293b)' }}>
                        <td style={{ padding: '0.4rem', color: 'var(--text-muted, #64748b)' }}>{idx + 1}</td>
                        <td style={{ padding: '0.4rem', fontWeight: 600 }}>{sh.name}</td>
                        <td style={{ padding: '0.4rem' }}>
                          <span className={pBadgeClass} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                            {pBadgeLabel}
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <span className={iBadgeClass} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                            {iBadgeLabel}
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <span className={`stakeholder-strategy-badge ${strategyClass}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                            {strategyText}
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem', color: 'var(--text-color, #334155)', lineHeight: 1.4 }}>{sh.requirements}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.85rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="action-button secondary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.76rem' }}
              >
                {isFa ? 'تولید مجدد' : 'Regenerate'}
              </button>
              <button
                onClick={() => handleApply(false)}
                className="action-button"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.76rem' }}
              >
                {isFa ? 'افزودن به ذینفعان' : 'Append Stakeholders'}
              </button>
              <button
                onClick={() => handleApply(true)}
                className="action-button primary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.76rem' }}
              >
                {isFa ? 'جایگزینی در لیست ذینفعان' : 'Replace Stakeholders'}
              </button>
            </div>
          </div>
        )}

        {!generatedStakeholders && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
            <button onClick={onClose} className="action-button secondary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.76rem' }}>
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalElement;
  return createPortal(modalElement, document.body);
};
