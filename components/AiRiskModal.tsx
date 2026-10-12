import React, { useState, useContext } from 'react';
import { Project, ProjectRisk, DynamicWorkflowSettings, DEFAULT_DYNAMIC_WORKFLOW_SETTINGS, resolveWorkflowApproverId, User, ProjectApprovalRecord } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { LocalizationContext } from '../context';
import { getISODateString, getISODateTimeString, formatDate } from '../utils';

interface AiRiskModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onApplyRisks: (newRisks: ProjectRisk[], replace: boolean) => void;
  isPMOrAdmin?: boolean;
  currentUserId?: number;
  requiresWorkflow?: boolean;
  dynamicWorkflowSettings?: DynamicWorkflowSettings;
  users?: User[];
}

export const AiRiskModal: React.FC<AiRiskModalProps> = ({
  project,
  isOpen,
  onClose,
  onApplyRisks,
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
  const [generatedRisks, setGeneratedRisks] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const generateClientSideFallback = async () => {
    const apiKey = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).process?.env?.GEMINI_API_KEY);
    if (!apiKey) {
      throw new Error(isFa ? 'کلید GEMINI_API_KEY یافت نشد. لطفاً آن را در تنظیمات وارد کنید.' : 'GEMINI_API_KEY not found.');
    }

    const ai = new GoogleGenAI({ apiKey });

    // WBS Summary
    let wbsSummary = '';
    if (project.activities && project.activities.length > 0) {
      wbsSummary = project.activities.slice(0, 15).map(a => `- ${a.name} (مدت: ${a.duration} روز)`).join('\n');
    } else if (project.kanbanTasks && project.kanbanTasks.length > 0) {
      wbsSummary = project.kanbanTasks.slice(0, 15).map(t => `- ${t.description}`).join('\n');
    }

    const systemInstruction = isFa
      ? `شما یک متخصص ارشد مدیریت ریسک پروژه (PMI-RMP) هستید.
وظیفه شما تحلیل منشور پروژه و ساختار شکست کار (WBS / لیست فعالیت‌ها) و پیشنهاد لیست ریسک‌های کلیدی پروژه به زبان فارسی است:
- عنوان پروژه: ${project.name || 'پروژه عمومی'}
- هدف: ${project.goal || 'مشخص نشده'}
- محدوده: ${project.description || 'مشخص نشده'}
- تاریخ شروع و پایان: ${project.startDate || 'نامشخص'} تا ${project.endDate || 'نامشخص'}
${wbsSummary ? `\nخلاصه فعالیت‌ها و WBS:\n${wbsSummary}\n` : ''}
${customPrompt ? `دستورات تکمیلی کاربر:\n${customPrompt}\n` : ''}

الزامات:
بین ۴ تا ۸ ریسک کلیدی پیشنهاد دهید.
هر ریسک شامل:
۱. description: شرح شفاف و کامل ریسک
۲. probability: احتمال وقوع دقیقا یکی از مقادیر 'High'، 'Medium' یا 'Low'
۳. impact: میزان اثر دقیقا یکی از مقادیر 'High'، 'Medium' یا 'Low'
۴. responsePlan: برنامه پاسخ اجرایی به ریسک
۵. assignedTo: عنوان مسئول مدیریت این ریسک
`
      : `You are a Senior Project Risk Management Professional (PMI-RMP).
Your task is to analyze the project charter and WBS and propose a list of key project risks in English:
- Project Title: ${project.name || 'General Project'}
- Objective: ${project.goal || 'Not specified'}
- Scope: ${project.description || 'Not specified'}
- Timeline: ${project.startDate || 'N/A'} to ${project.endDate || 'N/A'}
${wbsSummary ? `\nWBS / Activities Summary:\n${wbsSummary}\n` : ''}
${customPrompt ? `Additional user instructions:\n${customPrompt}\n` : ''}

Requirements:
Propose between 4 to 8 key risks.
Each risk must contain:
1. description: Clear and concise risk description
2. probability: Exactly one of 'High', 'Medium', or 'Low'
3. impact: Exactly one of 'High', 'Medium', or 'Low'
4. responsePlan: Concrete action plan to mitigate or respond to the risk
5. assignedTo: Role / title responsible for managing this risk
`;

    const responseSchema = {
      type: Type.ARRAY,
      description: isFa ? "لیست ریسک‌های پیشنهادی پروژه" : "List of proposed project risks",
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          probability: { type: Type.STRING },
          impact: { type: Type.STRING },
          responsePlan: { type: Type.STRING },
          assignedTo: { type: Type.STRING }
        },
        required: ["description", "probability", "impact", "responsePlan"]
      }
    };

    const models = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: isFa
              ? `لطفاً لیست ریسک‌های پیشنهادی پروژه "${project.name || 'پروژه'}" را بر اساس منشور و WBS تولید کنید.`
              : `Please generate the list of proposed risks for project "${project.name || 'Project'}" based on the charter and WBS.`,
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
          console.warn(`Client risk fallback with ${model} attempt ${attempt + 1} failed:`, err);
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
    }

    // Default template fallback if all AI models fail
    const pName = project.name || (isFa ? 'پروژه' : 'Project');
    return isFa ? [
      {
        description: `نوسانات قیمتی و تورم تجهیزات/خدمات در پروژه ${pName}`,
        probability: "High",
        impact: "High",
        responsePlan: "پیش‌بینی ذخیره مالی و اخذ مصوبه تغییرات قبل از وقوع",
        assignedTo: "مدیر مالی"
      },
      {
        description: `تاخیر در تامین یا تحویل اقلام کلیدی پروژه`,
        probability: "Medium",
        impact: "High",
        responsePlan: "شناسایی تامین‌کنندگان جایگزین و ثبت سفارشات زودهنگام",
        assignedTo: "مدیر تدارکات"
      },
      {
        description: `تغییرات در محدوده یا الزامات پروژه توسط ذینفعان`,
        probability: "High",
        impact: "Medium",
        responsePlan: "اعمال کمیته کنترل تغییرات (CCB) و تنظیم الحاقیه رسمی",
        assignedTo: "مدیر پروژه"
      },
      {
        description: `کمبود منابع انسانی متخصص در فازهای بحرانی`,
        probability: "Medium",
        impact: "Medium",
        responsePlan: "مستندسازی فرآیندها، جانشین‌پروری و ایجاد انگیزه‌های شغلی",
        assignedTo: "مدیر منابع انسانی"
      }
    ] : [
      {
        description: `Cost fluctuations and inflation on equipment/services in ${pName}`,
        probability: "High",
        impact: "High",
        responsePlan: "Establish contingency reserves and pre-approve change requests",
        assignedTo: "Finance Manager"
      },
      {
        description: `Delays in procurement and delivery of critical project components`,
        probability: "Medium",
        impact: "High",
        responsePlan: "Identify backup suppliers and initiate early purchase orders",
        assignedTo: "Procurement Manager"
      },
      {
        description: `Scope creep or shifting requirements from key stakeholders`,
        probability: "High",
        impact: "Medium",
        responsePlan: "Enforce Change Control Board (CCB) and formal change amendments",
        assignedTo: "Project Manager"
      },
      {
        description: `Shortage of specialized technical staff during critical phases`,
        probability: "Medium",
        impact: "Medium",
        responsePlan: "Process documentation, cross-training and resource backup planning",
        assignedTo: "HR Manager"
      }
    ];
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      let risks: any[] = [];
      let success = false;

      try {
        const res = await fetch('/api/ai/suggest-risks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: project.name,
            language: language || 'fa',
            charterData: {
              title: project.name,
              objective: project.goal,
              scope: project.description,
              startDate: project.startDate,
              endDate: project.endDate,
              cost: project.budget,
              owningUnit: project.owningUnit
            },
            scheduleActivities: project.activities || [],
            kanbanTasks: project.kanbanTasks || [],
            customPrompt
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.risks)) {
            risks = data.risks;
            success = true;
          }
        }
      } catch (backendErr) {
        console.warn('Backend risk API call failed, trying fallback:', backendErr);
      }

      if (!success) {
        risks = await generateClientSideFallback();
      }

      const formatted = (Array.isArray(risks) ? risks : []).map((r: any) => ({
        description: r.description || "ریسک عمومی پروژه",
        probability: ["High", "Medium", "Low"].includes(r.probability) ? r.probability : "Medium",
        impact: ["High", "Medium", "Low"].includes(r.impact) ? r.impact : "Medium",
        responsePlan: r.responsePlan || "پایش مستمر و تعریف اقدامات اصلاحی",
        assignedTo: r.assignedTo || "مدیر پروژه"
      }));

      setGeneratedRisks(formatted);
    } catch (err: any) {
      console.error('Risk generation error:', err);
      setError(err.message || (isFa ? 'خطایی در تولید ریسک‌ها رخ داد' : 'An error occurred during risk generation'));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (replace: boolean) => {
    if (!generatedRisks || generatedRisks.length === 0) return;

    const isOwnerOrPMOrAdmin = Boolean(
      isPMOrAdmin ||
      (currentUserId && (
        String(project.projectManagerId) === String(currentUserId) ||
        String(project.ownerId || 1) === String(currentUserId) ||
        users?.find(u => String(u.id) === String(currentUserId))?.role === 'Admin'
      ))
    );

    const shouldAutoApprove = isOwnerOrPMOrAdmin || requiresWorkflow === false;

    let initialApproverId: string | undefined = undefined;
    if (!shouldAutoApprove) {
      const stages = dynamicWorkflowSettings?.risks || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS.risks;
      if (stages && stages[0]) {
        initialApproverId = resolveWorkflowApproverId(stages[0].approverId, project, currentUserId);
      } else {
        initialApproverId = project.projectManagerId;
      }
    }

    const currentUserObj = users?.find(u => String(u.id) === String(currentUserId));
    const actorName = currentUserObj ? (currentUserObj.name ? `${currentUserObj.name} (${currentUserObj.username})` : currentUserObj.username) : (isFa ? 'کاربر' : 'User');

    const newRisks: ProjectRisk[] = generatedRisks.map((r, idx) => ({
      id: Date.now() + idx + 1,
      description: r.description,
      probability: r.probability as any,
      impact: r.impact as any,
      responsePlan: r.responsePlan,
      assignedTo: r.assignedTo,
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

    onApplyRisks(newRisks, replace);
    onClose();
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div className="modal-content card shadow-lg" style={{
        maxWidth: '850px', width: '100%', maxHeight: '92vh', overflowY: 'auto',
        backgroundColor: 'var(--card-bg-color, #ffffff)', borderRadius: '12px', padding: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: '1.5rem' }}>auto_awesome</span>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-color, #1e293b)' }}>
              {isFa ? 'دستیار هوش مصنوعی تحلیل و پیشنهاد ریسک‌های پروژه' : 'AI Risk Analysis Assistant'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
          </button>
        </div>

        {/* Project Context Summary */}
        <div className="ai-modal-context-box" style={{ fontSize: '0.95rem', lineHeight: '1.7', padding: '0.9rem 1.15rem', borderRadius: '10px', marginBottom: '1rem', backgroundColor: 'var(--warning-box-bg, #fffbeb)', border: '1px solid var(--warning-box-border, #fcd34d)', color: 'var(--text-color, #78350f)' }}>
          <div className="ai-modal-context-title" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--warning-box-title, #b45309)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
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
            placeholder={isFa ? 'مثلاً: بر ریسک‌های مالی، تأمین تجهیزات و کمبود نیروی متخصص تمرکز شود...' : 'e.g. Focus on financial and supply chain risks...'}
            rows={2}
            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-color, #0f172a)', backgroundColor: 'var(--card-bg-color, #ffffff)', fontFamily: 'inherit' }}
          />
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '0.55rem', borderRadius: '6px', marginBottom: '0.85rem', fontSize: '0.7rem' }}>
            {error}
          </div>
        )}

        {!generatedRisks && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="action-button primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.76rem' }}
            >
              <span className={`material-symbols-outlined ${loading ? 'spin' : ''}`} style={{ fontSize: '1rem' }}>{loading ? 'sync' : 'auto_awesome'}</span>
              {loading ? (isFa ? 'در حال تحلیل منشور و تولید ریسک‌ها...' : 'Analyzing & Generating Risks...') : (isFa ? 'تولید ریسک‌های پیشنهادی با هوش مصنوعی' : 'Generate Suggested Risks')}
            </button>
          </div>
        )}

        {generatedRisks && (
          <div style={{ marginTop: '0.85rem' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: '#d97706' }}>
              {isFa ? 'ریسک‌های پیشنهادی هوش مصنوعی بر اساس منشور و WBS:' : 'AI Suggested Risks Output:'}
            </h4>

            <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '0.85rem', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
              <table className="tab-table" style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-color, #334155)' }}>
                    <th style={{ width: '35px', padding: '0.4rem' }}>#</th>
                    <th style={{ padding: '0.4rem' }}>{isFa ? 'عنوان ریسک' : 'Risk Title'}</th>
                    <th style={{ width: '80px', padding: '0.4rem' }}>{isFa ? 'احتمال' : 'Probability'}</th>
                    <th style={{ width: '80px', padding: '0.4rem' }}>{isFa ? 'اثر' : 'Impact'}</th>
                    <th style={{ padding: '0.4rem' }}>{isFa ? 'برنامه پاسخ به ریسک' : 'Response Plan'}</th>
                    <th style={{ width: '90px', padding: '0.4rem' }}>{isFa ? 'مسئول' : 'Assigned To'}</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedRisks.map((risk, idx) => {
                    const probBadge = risk.probability === 'High'
                      ? { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', icon: 'warning', label: isFa ? 'بالا' : 'High' }
                      : risk.probability === 'Low'
                        ? { bg: '#dcfce7', color: '#15803d', border: '#86efac', icon: 'arrow_downward', label: isFa ? 'پایین' : 'Low' }
                        : { bg: '#fef3c7', color: '#b45309', border: '#fde68a', icon: 'drag_handle', label: isFa ? 'متوسط' : 'Medium' };

                    const impactBadge = risk.impact === 'High'
                      ? { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', icon: 'warning', label: isFa ? 'بالا' : 'High' }
                      : risk.impact === 'Low'
                        ? { bg: '#dcfce7', color: '#15803d', border: '#86efac', icon: 'arrow_downward', label: isFa ? 'پایین' : 'Low' }
                        : { bg: '#fef3c7', color: '#b45309', border: '#fde68a', icon: 'drag_handle', label: isFa ? 'متوسط' : 'Medium' };

                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? 'var(--card-bg-color, #ffffff)' : 'var(--bg-secondary, #f8fafc)', borderBottom: '1px solid var(--border-color, #f1f5f9)', color: 'var(--text-color, #1e293b)' }}>
                        <td style={{ padding: '0.4rem', color: 'var(--text-muted, #64748b)' }}>{idx + 1}</td>
                        <td style={{ padding: '0.4rem', fontWeight: 500 }}>{risk.description}</td>
                        <td style={{ padding: '0.4rem' }}>
                          <span className="risk-level-badge risk-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '20px', fontWeight: 700, backgroundColor: probBadge.bg, color: probBadge.color, border: `1px solid ${probBadge.border}`, whiteSpace: 'nowrap' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '0.78rem', lineHeight: 1 }}>{probBadge.icon}</span>
                            <span>{probBadge.label}</span>
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <span className="risk-level-badge risk-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '20px', fontWeight: 700, backgroundColor: impactBadge.bg, color: impactBadge.color, border: `1px solid ${impactBadge.border}`, whiteSpace: 'nowrap' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '0.78rem', lineHeight: 1 }}>{impactBadge.icon}</span>
                            <span>{impactBadge.label}</span>
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem', color: 'var(--text-color, #334155)' }}>{risk.responsePlan}</td>
                        <td style={{ padding: '0.4rem', color: 'var(--text-muted, #475569)' }}>{risk.assignedTo}</td>
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
                {isFa ? 'افزودن به دفترچه ریسک' : 'Append Risks'}
              </button>
              <button
                onClick={() => handleApply(true)}
                className="action-button primary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.76rem' }}
              >
                {isFa ? 'جایگزینی در دفترچه ریسک' : 'Replace Risk Register'}
              </button>
            </div>
          </div>
        )}

        {!generatedRisks && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
            <button onClick={onClose} className="action-button secondary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.76rem' }}>
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
