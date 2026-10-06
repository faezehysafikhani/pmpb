import React, { useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Project, ProjectActivity, KanbanTask } from '../types';
import { LocalizationContext } from '../context';
import { formatDate } from '../utils';
import { GoogleGenAI, Type } from '@google/genai';

interface AiWbsModalProps {
  project: Project;
  projectType: 'waterfall' | 'agile';
  isOpen: boolean;
  onClose: () => void;
  onApplyWaterfallSchedule?: (activities: ProjectActivity[], replace: boolean) => void;
  onApplyAgileTasks?: (tasks: KanbanTask[], replace: boolean) => void;
}

export const AiWbsModal: React.FC<AiWbsModalProps> = ({
  project,
  projectType,
  isOpen,
  onClose,
  onApplyWaterfallSchedule,
  onApplyAgileTasks
}) => {
  const { language } = useContext(LocalizationContext);
  const isFa = language === 'fa';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedItems, setGeneratedItems] = useState<any[] | null>(null);

  if (!isOpen) return null;

  const normalizeClientWbs = (items: any[], charterStart?: string, charterEnd?: string) => {
    if (!Array.isArray(items) || items.length === 0) return [];

    const phases = items.map((phase: any, pIdx: number) => {
      const pCode = String(phase.code || pIdx + 1);
      const pTitle = phase.title || phase.phaseTitle || `فاز ${pIdx + 1}`;
      let subActs = Array.isArray(phase.subActivities) ? phase.subActivities : [];

      if (subActs.length === 0) {
        if (phase.durationDays || phase.startDate) {
          subActs = [
            {
              code: `${pCode}.1`,
              title: `آماده‌سازی و اقدامات اولیه ${pTitle}`,
              durationDays: Math.max(1, Math.round((phase.durationDays || 10) * 0.4)),
              weight: Math.max(1, Math.round((phase.weight || 20) * 0.4)),
              prerequisites: pIdx === 0 ? "" : `${pIdx}.2`,
              deliverable: phase.deliverable || ""
            },
            {
              code: `${pCode}.2`,
              title: `تکمیل و تحویل ${pTitle}`,
              durationDays: Math.max(1, Math.round((phase.durationDays || 10) * 0.6)),
              weight: Math.max(1, Math.round((phase.weight || 20) * 0.6)),
              prerequisites: `${pCode}.1`,
              deliverable: phase.deliverable || ""
            }
          ];
        } else {
          subActs = [
            {
              code: `${pCode}.1`,
              title: `اقدام ۱ تحت ${pTitle}`,
              durationDays: 5,
              weight: 10,
              prerequisites: pIdx === 0 ? "" : `${pIdx}.2`,
              deliverable: ""
            },
            {
              code: `${pCode}.2`,
              title: `اقدام ۲ تحت ${pTitle}`,
              durationDays: 5,
              weight: 10,
              prerequisites: `${pCode}.1`,
              deliverable: ""
            }
          ];
        }
      }

      const cleanSubActs = subActs.map((sub: any, sIdx: number) => ({
        code: String(sub.code || `${pCode}.${sIdx + 1}`),
        title: sub.title || `فعالیت ${pCode}.${sIdx + 1}`,
        durationDays: Math.max(1, Number(sub.durationDays) || Number(sub.duration) || 5),
        startDate: sub.startDate || charterStart || "",
        endDate: sub.endDate || charterEnd || "",
        weight: Math.max(1, Number(sub.weight) || 10),
        prerequisites: sub.prerequisites !== undefined && sub.prerequisites !== null ? String(sub.prerequisites).trim() : "",
        deliverable: sub.deliverable || "",
        description: sub.description || "",
        sprint: Number(sub.sprint) || (pIdx + 1),
        status: sub.status || "To-Do"
      }));

      const phaseSubDurationSum = cleanSubActs.reduce((sum: number, s: any) => sum + (s.durationDays || 0), 0);

      return {
        code: pCode,
        title: pTitle,
        deliverable: phase.deliverable || "",
        description: phase.description || "",
        weight: Number(phase.weight) || 20,
        durationDays: Number(phase.durationDays) || phaseSubDurationSum || 10,
        startDate: phase.startDate || charterStart || "",
        endDate: phase.endDate || charterEnd || "",
        sprint: Number(phase.sprint) || (pIdx + 1),
        subActivities: cleanSubActs
      };
    });

    // Ensure prerequisite chaining across all subactivities
    let previousSubCode = "";
    phases.forEach((p, pIdx) => {
      p.subActivities.forEach((sub: any, sIdx: number) => {
        if (!sub.prerequisites) {
          if (pIdx === 0 && sIdx === 0) {
            sub.prerequisites = "";
          } else {
            sub.prerequisites = previousSubCode;
          }
        }
        previousSubCode = sub.code;
      });
    });

    const allLeafs: any[] = [];
    phases.forEach((p) => {
      p.subActivities.forEach((sub: any) => allLeafs.push(sub));
    });

    if (allLeafs.length > 0) {
      const rawTotalWeight = allLeafs.reduce((sum, leaf) => sum + (leaf.weight || 0), 0);
      if (rawTotalWeight > 0) {
        let scaledSum = 0;
        allLeafs.forEach((leaf) => {
          leaf.weight = Math.max(1, Math.round((leaf.weight / rawTotalWeight) * 100));
          scaledSum += leaf.weight;
        });

        const diff = 100 - scaledSum;
        if (diff !== 0) {
          let maxLeaf = allLeafs[0];
          allLeafs.forEach((leaf) => {
            if (leaf.weight > maxLeaf.weight) maxLeaf = leaf;
          });
          maxLeaf.weight = Math.max(1, maxLeaf.weight + diff);
        }
      }

      phases.forEach((p) => {
        p.weight = p.subActivities.reduce((sum: number, sub: any) => sum + sub.weight, 0);
      });
    }

    if (charterStart && charterEnd) {
      const cStart = new Date(charterStart);
      const cEnd = new Date(charterEnd);

      if (!isNaN(cStart.getTime()) && !isNaN(cEnd.getTime()) && cEnd >= cStart) {
        const subActivityMap = new Map<string, any>();
        allLeafs.forEach(leaf => subActivityMap.set(leaf.code, leaf));

        let currentDayOffset = 0;
        allLeafs.forEach((sub: any, idx: number) => {
          let subStart: Date;
          if (sub.prerequisites && subActivityMap.has(sub.prerequisites)) {
            const prereq = subActivityMap.get(sub.prerequisites);
            const prereqEndDate = prereq.endDate ? new Date(prereq.endDate) : null;
            if (prereqEndDate && !isNaN(prereqEndDate.getTime())) {
              subStart = new Date(prereqEndDate.getTime() + 24 * 3600 * 1000);
            } else {
              subStart = new Date(cStart.getTime() + currentDayOffset * 24 * 3600 * 1000);
            }
          } else {
            subStart = new Date(cStart.getTime() + (idx === 0 ? 0 : currentDayOffset) * 24 * 3600 * 1000);
          }

          if (subStart < cStart) subStart = new Date(cStart.getTime());
          if (subStart > cEnd) subStart = new Date(cEnd.getTime());

          const subDays = Math.max(1, sub.durationDays || 5);
          let subEnd = new Date(subStart.getTime() + (subDays - 1) * 24 * 3600 * 1000);
          if (subEnd > cEnd) subEnd = new Date(cEnd.getTime());

          sub.startDate = subStart.toISOString().split("T")[0];
          sub.endDate = subEnd.toISOString().split("T")[0];
          sub.durationDays = subDays;

          currentDayOffset = Math.ceil((subEnd.getTime() - cStart.getTime()) / (24 * 3600 * 1000)) + 1;
        });

        // Roll up phase dates
        phases.forEach(p => {
          const starts = p.subActivities.map((s: any) => s.startDate).filter(Boolean);
          const ends = p.subActivities.map((s: any) => s.endDate).filter(Boolean);
          if (starts.length > 0) p.startDate = starts.sort()[0];
          if (ends.length > 0) p.endDate = ends.sort().reverse()[0];
          p.durationDays = p.subActivities.reduce((sum: number, s: any) => sum + (s.durationDays || 1), 0);
        });

        if (phases.length > 0) {
          const lastPhase = phases[phases.length - 1];
          lastPhase.endDate = cEnd.toISOString().split("T")[0];
          if (lastPhase.subActivities.length > 0) {
            const lastSub = lastPhase.subActivities[lastPhase.subActivities.length - 1];
            lastSub.endDate = cEnd.toISOString().split("T")[0];
          }
        }
      }
    }

    return phases;
  };

  const generateClientSideFallback = async () => {
    const apiKey = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).process?.env?.GEMINI_API_KEY);
    if (!apiKey) {
      throw new Error(isFa ? 'کلید GEMINI_API_KEY یافت نشد. لطفاً آن را در متغیرهای محیطی یا Vercel تنظیم کنید.' : 'GEMINI_API_KEY not found.');
    }

    const ai = new GoogleGenAI({ apiKey });
    const isWaterfall = projectType === 'waterfall';
    const startDate = project.startDate || (isFa ? '1403/01/01' : '2024-01-01');
    const endDate = project.endDate || (isFa ? '1403/12/29' : '2024-12-31');

    const systemInstruction = isFa
      ? `شما یک دستیار هوشمند ارشد مدیریت پروژه (PMP) هستید.
وظیفه شما تولید ساختار شکست کار (WBS) ۲ سطحی و دقیق متناسب با منشور پروژه به زبان فارسی است:
- عنوان پروژه: ${project.name || 'پروژه'}
- هدف پروژه: ${project.goal || 'مشخص نشده'}
- محدوده: ${project.description || 'مشخص نشده'}
- واحد متولی: ${project.owningUnit || 'مشخص نشده'}
- تاریخ شروع منشور: ${startDate}
- تاریخ پایان منشور: ${endDate}
${customPrompt ? `- دستورات تکمیلی کاربر: ${customPrompt}` : ''}

الزامات حتمی:
۱. WBS حتماً حداقل دارای ۲ سطح باشد (فازهای اصلی سطح ۱ و فعالیت‌های زیرمجموعه سطح ۲).
۲. رعایت دقیق روابط پیش‌نیازی (Prerequisites): تمام فعالیت‌های سطح ۲ باید دارای روابط پیش‌نیازی متوالی، منطقی و به هم پیوسته باشند (مثلاً فعالیت 1.1 بدون پیش‌نیاز، فعالیت 1.2 دارای پیش‌نیاز 1.1، فعالیت 2.1 دارای پیش‌نیاز 1.2 یا پایان فاز ۱، فعالیت 2.2 دارای پیش‌نیاز 2.1 و ...). در فیلد prerequisites کد فعالیت پیش‌نیاز درج شود.
۳. برآورد دقیق و واقعی مدت زمان به روز (durationDays) برای تک‌تک فعالیت‌های سطح ۲ بر اساس حجم و ماهیت کار انجام شود.
۴. مجموع وزنی تمام فعالیت‌های سطح ۲ دقیقا برابر با ۱۰۰ درصد باشد.
۵. تمام فازها و فعالیت‌ها باید کاملا منطبق بر منشور پروژه فوق باشند.
۶. تاریخ شروع نخستین فعالیت و پایان آخرین فعالیت دقیقاً در بازه منشور پروژه (${startDate} تا ${endDate}) تعیین شوند.
`
      : `You are a Senior Project Management Professional (PMP).
Your task is to generate a comprehensive, 2-level Work Breakdown Structure (WBS) aligned with the project charter in English:
- Project Title: ${project.name || 'Project'}
- Objective: ${project.goal || 'Not specified'}
- Scope: ${project.description || 'Not specified'}
- Owning Unit: ${project.owningUnit || 'Not specified'}
- Charter Start Date: ${startDate}
- Charter End Date: ${endDate}
${customPrompt ? `- Additional user instructions: ${customPrompt}` : ''}

Mandatory requirements:
1. WBS must strictly have 2 levels (Level 1 Phases/Epics and Level 2 Sub-activities/User stories).
2. Prerequisites: Level 2 activities must include logical sequence prerequisites (e.g. 1.1 has none, 1.2 requires 1.1, 2.1 requires 1.2, etc.).
3. Realistic duration estimate in days (durationDays) for every Level 2 activity.
4. Total sum of all Level 2 activity weights must equal 100%.
5. All dates must fit within charter timeline (${startDate} to ${endDate}).
`;

    const responseSchema = isWaterfall ? {
      type: Type.ARRAY,
      description: "لیست فازهای سطح ۱ و فعالیت‌های زیرمجموعه سطح ۲ به همراه برآورد مدت زمان فعالیت‌ها و پیش‌نیازها",
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING },
          title: { type: Type.STRING },
          deliverable: { type: Type.STRING },
          durationDays: { type: Type.NUMBER, description: "مجموع مدت زمان برآوردی فاز به روز" },
          weight: { type: Type.NUMBER },
          startDate: { type: Type.STRING },
          endDate: { type: Type.STRING },
          subActivities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING },
                title: { type: Type.STRING },
                durationDays: { type: Type.NUMBER, description: "برآورد مدت زمان اجرا به روز" },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                weight: { type: Type.NUMBER },
                prerequisites: { type: Type.STRING, description: "کد فعالیت پیش‌نیاز مانند 1.1 یا خالی برای اولین فعالیت" },
                deliverable: { type: Type.STRING }
              },
              required: ["code", "title", "durationDays", "weight"]
            }
          }
        },
        required: ["code", "title", "durationDays", "subActivities"]
      }
    } : {
      type: Type.ARRAY,
      description: "لیست اپیک‌های سطح ۱ و داستان‌های کاربر سطح ۲",
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          weight: { type: Type.NUMBER },
          sprint: { type: Type.NUMBER },
          subActivities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                weight: { type: Type.NUMBER },
                sprint: { type: Type.NUMBER },
                status: { type: Type.STRING }
              },
              required: ["code", "title", "weight", "sprint"]
            }
          }
        },
        required: ["code", "title", "subActivities"]
      }
    };

    const models = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: `ساختار شکست کار (WBS) با ۲ سطح، پیش‌نیازهای دقیق و مجموع اوزان ۱۰۰ را برای پروژه "${project.name || 'پروژه'}" بسازید.`,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema
            }
          });

          const text = response.text || '[]';
          const rawItems = JSON.parse(text);
          if (Array.isArray(rawItems) && rawItems.length > 0) {
            return normalizeClientWbs(rawItems, startDate, endDate);
          }
        } catch (err) {
          console.warn(`Client WBS fallback with ${model} attempt ${attempt + 1} failed:`, err);
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
    }

    // Default template fallback if all AI models fail
    const pName = project.name || 'پروژه';
    const rawDefaultPhases = [
      {
        code: "1",
        title: "فاز ۱: برنامه‌ریزی، امکان‌سنجی و منشور پروژه",
        deliverable: "منشور و اسناد اولیه",
        weight: 15,
        durationDays: 15,
        subActivities: [
          { code: "1.1", title: `شناسایی ذینفعان و نیازمندی‌های ${pName}`, weight: 7, durationDays: 7, prerequisites: "", deliverable: "سند نیازمندی‌ها" },
          { code: "1.2", title: "تدوین و تصویب منشور پروژه", weight: 8, durationDays: 8, prerequisites: "1.1", deliverable: "منشور رسمی" }
        ]
      },
      {
        code: "2",
        title: "فاز ۲: طراحی مفهومی و معماری فنی",
        deliverable: "اسناد و طرح‌های اجرایی",
        weight: 25,
        durationDays: 25,
        subActivities: [
          { code: "2.1", title: "طراحی معماری اولیه و الزامات استاندارد", weight: 12, durationDays: 12, prerequisites: "1.2", deliverable: "نقشه معماری" },
          { code: "2.2", title: "امکان‌سنجی فنی و دریافت تاییدیه اولیه", weight: 13, durationDays: 13, prerequisites: "2.1", deliverable: "تاییدیه فنی" }
        ]
      },
      {
        code: "3",
        title: "فاز ۳: اجرای عملیاتی و پیاده‌سازی اصلی",
        deliverable: "خروجی‌های کلیدی پروژه",
        weight: 35,
        durationDays: 40,
        subActivities: [
          { code: "3.1", title: "تامین زیرساخت‌ها و تجهیز بستر اجرای پروژه", weight: 15, durationDays: 18, prerequisites: "2.2", deliverable: "آماده‌سازی بستر" },
          { code: "3.2", title: `پیاده‌سازی و اجرای ماژول‌های اصلی ${pName}`, weight: 20, durationDays: 22, prerequisites: "3.1", deliverable: "محصول / خروجی اصلی" }
        ]
      },
      {
        code: "4",
        title: "فاز ۴: کنترل کیفیت و تست‌های عملکردی",
        deliverable: "گزارشات ممیزی و کیفیت",
        weight: 15,
        durationDays: 15,
        subActivities: [
          { code: "4.1", title: "اجرای تست‌های کیفی و سنجش انطباق", weight: 8, durationDays: 8, prerequisites: "3.2", deliverable: "تست عملکرد" },
          { code: "4.2", title: "رفع عدم انطباق‌ها و بهینه‌سازی نهایی", weight: 7, durationDays: 7, prerequisites: "4.1", deliverable: "اصلاح مغایرت‌ها" }
        ]
      },
      {
        code: "5",
        title: "فاز ۵: استقرار، آموزش و اختتام پروژه",
        deliverable: "صورتجلسه تحویل قطعی",
        weight: 10,
        durationDays: 10,
        subActivities: [
          { code: "5.1", title: "برگزاری جلسات آموزش ذینفعان و تحویل موقت", weight: 5, durationDays: 5, prerequisites: "4.2", deliverable: "گواهی تحویل موقت" },
          { code: "5.2", title: "تکمیل مستندسازی و اختتام رسمی پروژه", weight: 5, durationDays: 5, prerequisites: "5.1", deliverable: "مستندات اختتام" }
        ]
      }
    ];

    return normalizeClientWbs(rawDefaultPhases, startDate, endDate);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGeneratedItems(null);

    try {
      let items: any[] = [];
      let success = false;

      // Try server API first
      try {
        const response = await fetch('/api/ai/suggest-wbs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectType,
            title: project.name,
            language: language || 'fa',
            charterData: {
              title: project.name,
              objective: project.goal,
              scope: project.description,
              startDate: project.startDate,
              endDate: project.endDate,
              sprintCount: project.sprintCount || 4,
              owningUnit: project.owningUnit,
              cost: project.cost
            },
            customPrompt
          })
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (response.ok && data.success) {
            items = data.items || [];
            success = true;
          } else if (data.error) {
            throw new Error(data.error);
          }
        }
      } catch (backendErr: any) {
        console.warn('Backend API fetch failed, attempting client-side fallback:', backendErr.message);
      }

      // If backend failed or wasn't available, attempt client-side generation
      if (!success) {
        items = await generateClientSideFallback();
      }

      if (projectType === 'waterfall') {
        const normalized = normalizeClientWbs(items, project.startDate, project.endDate);
        setGeneratedItems(normalized);
      } else {
        setGeneratedItems(Array.isArray(items) ? items : []);
      }
    } catch (err: any) {
      console.error('WBS/Task Generation error:', err);
      setError(err.message || (isFa ? 'خطایی در تولید اطلاعات رخ داد' : 'An error occurred during generation'));
    } finally {
      setLoading(false);
    }
  };

  interface FlatWbsItem {
    code: string;
    title: string;
    deliverable?: string;
    description?: string;
    durationDays: number;
    weight: number;
    prerequisites?: string;
    startDate?: string;
    endDate?: string;
    level: number;
    isParent: boolean;
    parentId: string | null;
  }

  const flattenWbsTree = (nodes: any[], parentCode: string | null = null, level: number = 1): FlatWbsItem[] => {
    const result: FlatWbsItem[] = [];
    (nodes || []).forEach((node: any, idx: number) => {
      const code = String(node.code || (parentCode ? `${parentCode}.${idx + 1}` : `${idx + 1}`));
      const hasChildren = Array.isArray(node.subActivities) && node.subActivities.length > 0;
      result.push({
        code,
        title: node.title || node.name || (level === 1 ? `فاز ${code}` : `فعالیت ${code}`),
        deliverable: node.deliverable,
        description: node.description,
        durationDays: Number(node.durationDays) || Number(node.duration) || 5,
        weight: Number(node.weight) || 0,
        prerequisites: node.prerequisites !== undefined && node.prerequisites !== null ? String(node.prerequisites).trim() : '',
        startDate: node.startDate,
        endDate: node.endDate,
        level,
        isParent: hasChildren,
        parentId: parentCode
      });
      if (hasChildren) {
        result.push(...flattenWbsTree(node.subActivities, code, level + 1));
      }
    });
    return result;
  };

  const handleApply = (replace: boolean) => {
    if (!generatedItems || generatedItems.length === 0) return;

    if (projectType === 'waterfall' && onApplyWaterfallSchedule) {
      const flatList = flattenWbsTree(generatedItems);
      const activities: ProjectActivity[] = flatList.map((item) => ({
        id: item.code,
        name: item.title,
        duration: item.durationDays,
        prerequisiteId: item.prerequisites ? item.prerequisites : null,
        weight: item.weight,
        assignedToId: null,
        actualProgress: 0,
        parentId: item.parentId,
        level: item.level,
        isParent: item.isParent,
        startDate: item.startDate ? new Date(item.startDate) : (project.startDate ? new Date(project.startDate) : undefined),
        endDate: item.endDate ? new Date(item.endDate) : (project.endDate ? new Date(project.endDate) : undefined)
      }));

      onApplyWaterfallSchedule(activities, replace);
    } else if (projectType === 'agile' && onApplyAgileTasks) {
      const tasks: KanbanTask[] = generatedItems.map((item: any, idx: number) => ({
        id: Date.now() + idx + 1,
        description: item.description ? `${item.title}: ${item.description}` : (item.title || `فعالیت ${idx + 1}`),
        dueDate: project.endDate || new Date().toISOString().split('T')[0],
        priority: (['High', 'Medium', 'Low'].includes(item.priority) ? item.priority : 'Medium') as any,
        assignedToId: null,
        status: 'To-Do',
        sprintNumber: Number(item.sprint) || 1
      }));

      onApplyAgileTasks(tasks, replace);
    }

    onClose();
  };

  const flatWaterfallItems = projectType === 'waterfall' && generatedItems ? flattenWbsTree(generatedItems) : [];
  const maxDetectedLevel = flatWaterfallItems.reduce((max, item) => Math.max(max, item.level), 1);
  const totalLeafCount = projectType === 'waterfall'
    ? flatWaterfallItems.filter((item) => !item.isParent).length
    : (generatedItems ? generatedItems.length : 0);
  const totalLeafWeight = projectType === 'waterfall'
    ? flatWaterfallItems.filter((item) => !item.isParent).reduce((sum, item) => sum + item.weight, 0)
    : (generatedItems ? generatedItems.reduce((acc, p) => acc + (p.weight || 0), 0) : 0);
  const totalDurationSum = generatedItems && projectType === 'waterfall'
    ? generatedItems.reduce((acc, p) => acc + (p.durationDays || (p.subActivities || []).reduce((sum: number, s: any) => sum + (s.durationDays || 0), 0)), 0)
    : 0;

  const modalElement = (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div className="modal-content card shadow-lg" style={{
        maxWidth: '850px', width: '100%', maxHeight: '92vh', overflowY: 'auto',
        backgroundColor: 'var(--card-bg-color, #ffffff)', borderRadius: '16px', padding: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary-color, #2563eb)', fontSize: '1.75rem' }}>auto_awesome</span>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
              {isFa ? `دستیار هوش مصنوعی ساختار شکست کار (WBS ${projectType === 'waterfall' ? 'آبشاری' : 'چابک'})` : `AI WBS Assistant (${projectType === 'waterfall' ? 'Waterfall' : 'Agile'})`}
            </h3>
          </div>
          <button onClick={onClose} className="modal-close-button" style={{ border: 'none', cursor: 'pointer' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Project Charter Info Card */}
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
                    : (isFa ? 'هنوز WBS تعریف نشده است (بر اساس منشور و الزامات تولید می‌شود)' : 'No WBS defined yet (Will generate from charter)'))}
              </span>
            </div>
          </div>
        </div>

        {/* Custom Prompt / Special Requirements Section */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.45rem', color: 'var(--text-color, #0f172a)' }}>
            {isFa ? 'دستورالعمل و الزامات خاص کاربر (اختیاری):' : 'Custom Prompt / Focus Area (Optional):'}
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={isFa ? 'مثلاً: ساختار شکست به صورت ۳ سطحی تولید شود و فازهای طراحی، توسعه و آزمون با جزئیات شکسته شوند...' : 'e.g. Generate a 3-level WBS breaking down work packages into detailed sub-tasks...'}
            rows={2}
            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-color, #0f172a)', backgroundColor: 'var(--card-bg-color, #ffffff)', fontFamily: 'inherit' }}
          />
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}

        {!generatedItems && (
          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="action-button primary"
              style={{ padding: '0.65rem 1.75rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              <span className={`material-symbols-outlined ${loading ? 'spin' : ''}`}>{loading ? 'sync' : 'auto_awesome'}</span>
              {loading ? (isFa ? 'در حال تولید ساختار شکست کار...' : 'Generating WBS...') : (isFa ? 'تولید ساختار شکست کار (WBS)' : 'Generate WBS')}
            </button>
          </div>
        )}

        {generatedItems && (
          <div style={{ marginTop: '1rem' }}>
            {/* Validation Summary Banner */}
            {projectType === 'waterfall' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>{isFa ? 'سطوح WBS' : 'WBS Levels'}</div>
                  <div style={{ fontWeight: 700, color: 'var(--primary-color, #2563eb)', fontSize: '0.9rem' }}>
                    {isFa ? `${maxDetectedLevel} سطح ${maxDetectedLevel > 2 ? `(${maxDetectedLevel} سطحی تفصیلی)` : '(فاز + فعالیت)'}` : `${maxDetectedLevel} Levels`}
                  </div>
                </div>
                <div style={{ background: 'var(--success-box-bg, #f0fdf4)', border: '1px solid var(--success-box-border, #bbf7d0)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-color, #166534)' }}>{isFa ? 'مجموع اوزان WBS' : 'Total Weight Sum'}</div>
                  <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>{totalLeafWeight}٪ {totalLeafWeight === 100 ? '✅' : ''}</div>
                </div>
                <div style={{ background: 'var(--warning-box-bg, #fefce8)', border: '1px solid var(--warning-box-border, #fef08a)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--warning-box-title, #854d0e)' }}>{isFa ? 'تعداد فاز و فعالیت' : 'Phases & Activities'}</div>
                  <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.9rem' }}>{generatedItems.length} فاز | {totalLeafCount} فعالیت نهایی</div>
                </div>
                <div style={{ background: 'var(--teal-box-bg, #f0fdfa)', border: '1px solid var(--teal-box-border, #99f6e4)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-color, #115e59)' }}>{isFa ? 'مجموع برآورد مدت' : 'Total Duration'}</div>
                  <div style={{ fontWeight: 700, color: '#14b8a6', fontSize: '0.9rem' }}>{totalDurationSum} روز</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>{isFa ? 'نوع فعالیت‌ها' : 'Activity Format'}</div>
                  <div style={{ fontWeight: 700, color: 'var(--primary-color, #2563eb)', fontSize: '0.95rem' }}>مسطح (بدون WBS)</div>
                </div>
                <div style={{ background: 'var(--success-box-bg, #f0fdf4)', border: '1px solid var(--success-box-border, #bbf7d0)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-color, #166534)' }}>{isFa ? 'ستون مقصود' : 'Destination Column'}</div>
                  <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.95rem' }}>To-Do</div>
                </div>
                <div style={{ background: 'var(--warning-box-bg, #fefce8)', border: '1px solid var(--warning-box-border, #fef08a)', borderRadius: '8px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--warning-box-title, #854d0e)' }}>{isFa ? 'تعداد فعالیت‌های چابک' : 'Task Count'}</div>
                  <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.95rem' }}>{generatedItems.length} فعالیت</div>
                </div>
              </div>
            )}

            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--primary-color, #2563eb)' }}>
              {isFa ? (projectType === 'waterfall' ? `ساختار شکست پیشنهاد شده (${maxDetectedLevel} سطحی):` : 'لیست فعالیت‌های چابک پیشنهادی (ستون To-Do):') : 'Suggested Output:'}
            </h4>

            <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
              <table className="tab-table" style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-color, #334155)' }}>
                    <th style={{ width: '60px', padding: '0.5rem' }}>#</th>
                    <th style={{ padding: '0.5rem' }}>{isFa ? 'عنوان / شرح فعالیت' : 'Title / Description'}</th>
                    {projectType === 'waterfall' ? (
                      <>
                        <th style={{ width: '75px', padding: '0.5rem' }}>{isFa ? 'مدت (روز)' : 'Duration'}</th>
                        <th style={{ width: '65px', padding: '0.5rem' }}>{isFa ? 'وزن %' : 'Weight'}</th>
                        <th style={{ width: '70px', padding: '0.5rem' }}>{isFa ? 'پیش‌نیاز' : 'Prereq'}</th>
                        <th style={{ width: '150px', padding: '0.5rem' }}>{isFa ? 'بازه زمانی' : 'Dates'}</th>
                      </>
                    ) : (
                      <>
                        <th style={{ width: '80px', padding: '0.5rem' }}>{isFa ? 'اسپیرینت' : 'Sprint'}</th>
                        <th style={{ width: '80px', padding: '0.5rem' }}>{isFa ? 'اولویت' : 'Priority'}</th>
                        <th style={{ width: '80px', padding: '0.5rem' }}>{isFa ? 'وضعیت' : 'Status'}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {projectType === 'waterfall' ? (
                    flatWaterfallItems.map((item, idx) => {
                      const isL1 = item.level === 1;
                      const isL2 = item.level === 2;
                      const isL3 = item.level === 3;
                      const indentPadding = item.level === 1 ? '0.5rem' : `${(item.level - 1) * 1.25 + 0.5}rem`;

                      return (
                        <tr
                          key={`wbs-row-${item.code}-${idx}`}
                          style={{
                            background: isL1
                              ? 'var(--phase-row-bg, #eff6ff)'
                              : idx % 2 === 0
                              ? 'var(--card-bg-color, #ffffff)'
                              : 'var(--bg-secondary, #f8fafc)',
                            fontWeight: isL1 ? 700 : (item.isParent ? 600 : 500),
                            color: isL1 ? 'var(--phase-row-color, #1e40af)' : 'var(--text-color, #1e293b)',
                            borderTop: isL1 ? '2px solid var(--border-color, #cbd5e1)' : '1px solid var(--border-color, #f1f5f9)'
                          }}
                        >
                          <td style={{ padding: '0.45rem 0.5rem', color: isL1 ? 'inherit' : 'var(--text-muted, #64748b)', fontSize: '0.78rem' }}>
                            {item.code}
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', paddingInlineStart: indentPadding }}>
                            {isL1 ? (
                              <span style={{ background: 'var(--primary-color, #2563eb)', color: '#ffffff', padding: '0.12rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', marginInlineEnd: '0.45rem' }}>
                                سطح ۱ (فاز اصلی)
                              </span>
                            ) : isL2 ? (
                              <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.68rem', marginInlineEnd: '0.45rem' }}>
                                سطح ۲
                              </span>
                            ) : isL3 ? (
                              <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.68rem', marginInlineEnd: '0.45rem' }}>
                                سطح ۳
                              </span>
                            ) : (
                              <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.68rem', marginInlineEnd: '0.45rem' }}>
                                سطح {item.level}
                              </span>
                            )}
                            {!isL1 && <span style={{ color: 'var(--text-muted, #94a3b8)', marginInlineEnd: '0.3rem' }}>↳</span>}
                            {item.title}
                            {item.deliverable && (
                              <div style={{ fontSize: '0.72rem', color: isL1 ? 'var(--text-muted, #3b82f6)' : 'var(--text-muted, #64748b)', fontWeight: 400 }}>
                                تحویلی: {item.deliverable}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', fontWeight: isL1 ? 700 : 500 }}>
                            {item.durationDays} روز
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: isL1 ? 'inherit' : '#10b981' }}>
                            {item.weight}٪
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted, #64748b)' }}>
                            {item.prerequisites || '-'}
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted, #475569)' }}>
                            {item.startDate && item.endDate ? `${formatDate(item.startDate, language)} تا ${formatDate(item.endDate, language)}` : '-'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    generatedItems.map((item: any, idx: number) => (
                      <tr key={`task-${idx}`} style={{ background: idx % 2 === 0 ? 'var(--card-bg-color, #ffffff)' : 'var(--bg-secondary, #f8fafc)', borderBottom: '1px solid var(--border-color, #f1f5f9)', color: 'var(--text-color, #1e293b)' }}>
                        <td style={{ padding: '0.5rem', color: 'var(--text-muted, #64748b)' }}>{item.code || (idx + 1)}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <div style={{ fontWeight: 600 }}>{item.title}</div>
                          {item.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>{item.description}</div>}
                        </td>
                        <td style={{ padding: '0.5rem' }}>اسپیرینت {item.sprint || 1}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
                            backgroundColor: item.priority === 'High' ? '#fee2e2' : item.priority === 'Low' ? '#f3f4f6' : '#fef3c7',
                            color: item.priority === 'High' ? '#dc2626' : item.priority === 'Low' ? '#4b5563' : '#d97706'
                          }}>
                            {item.priority === 'High' ? 'بالا' : item.priority === 'Low' ? 'پایین' : 'متوسط'}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <span className="badge badge-blue" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                            To-Do
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="action-button secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                {isFa ? 'تولید مجدد' : 'Regenerate'}
              </button>
              <button
                onClick={() => handleApply(false)}
                className="action-button"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                {isFa ? 'افزودن به جدول فعلی' : 'Append to Table'}
              </button>
              <button
                onClick={() => handleApply(true)}
                className="action-button primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                {isFa ? 'جایگزینی در جدول' : 'Replace Table Items'}
              </button>
            </div>
          </div>
        )}

        {!generatedItems && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button onClick={onClose} className="action-button secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
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

