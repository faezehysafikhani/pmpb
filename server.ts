import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

function normalizeWbsItems(items: any[], charterStartDate?: string, charterEndDate?: string, isWaterfall: boolean = true) {
  if (!Array.isArray(items) || items.length === 0) return [];

  // Helper to recursively sanitize nodes across any depth
  function cleanNodeRecursive(rawNode: any, parentCode: string | null, indexInParent: number, level: number, charterStart?: string, charterEnd?: string): any {
    const code = String(rawNode.code || (parentCode ? `${parentCode}.${indexInParent + 1}` : `${indexInParent + 1}`));
    const title = rawNode.title || (level === 1 ? `فاز ${code}` : `فعالیت ${code}`);
    
    let rawSubs = Array.isArray(rawNode.subActivities) ? rawNode.subActivities : [];
    
    // If Level 1 has no subs, provide 2 default sub-activities
    if (level === 1 && rawSubs.length === 0) {
      rawSubs = [
        {
          code: `${code}.1`,
          title: `آماده‌سازی و اقدامات اولیه ${title}`,
          durationDays: Math.max(1, Math.round((Number(rawNode.durationDays) || 10) * 0.4)),
          weight: Math.max(1, Math.round((Number(rawNode.weight) || 20) * 0.4)),
          prerequisites: indexInParent === 0 ? "" : `${indexInParent}.2`,
          deliverable: rawNode.deliverable || ""
        },
        {
          code: `${code}.2`,
          title: `تکمیل و تحویل ${title}`,
          durationDays: Math.max(1, Math.round((Number(rawNode.durationDays) || 10) * 0.6)),
          weight: Math.max(1, Math.round((Number(rawNode.weight) || 20) * 0.6)),
          prerequisites: `${code}.1`,
          deliverable: rawNode.deliverable || ""
        }
      ];
    }

    const cleanSubs = rawSubs.map((sub: any, sIdx: number) =>
      cleanNodeRecursive(sub, code, sIdx, level + 1, charterStart, charterEnd)
    );

    return {
      code,
      title,
      deliverable: rawNode.deliverable || "",
      description: rawNode.description || "",
      weight: Math.max(1, Number(rawNode.weight) || 10),
      durationDays: Math.max(1, Number(rawNode.durationDays) || 5),
      startDate: rawNode.startDate || charterStart || "",
      endDate: rawNode.endDate || charterEnd || "",
      prerequisites: rawNode.prerequisites !== undefined && rawNode.prerequisites !== null ? String(rawNode.prerequisites).trim() : "",
      sprint: Number(rawNode.sprint) || (indexInParent + 1),
      status: rawNode.status || "To-Do",
      subActivities: cleanSubs.length > 0 ? cleanSubs : undefined
    };
  }

  function collectLeafNodes(node: any, leafs: any[]) {
    if (!node.subActivities || node.subActivities.length === 0) {
      leafs.push(node);
    } else {
      node.subActivities.forEach((child: any) => collectLeafNodes(child, leafs));
    }
  }

  function rollupTree(node: any) {
    if (!node.subActivities || node.subActivities.length === 0) {
      return;
    }
    node.subActivities.forEach((child: any) => rollupTree(child));
    node.weight = node.subActivities.reduce((sum: number, c: any) => sum + (c.weight || 0), 0);
    node.durationDays = node.subActivities.reduce((sum: number, c: any) => sum + (c.durationDays || 0), 0);
    const starts = node.subActivities.map((c: any) => c.startDate).filter(Boolean);
    const ends = node.subActivities.map((c: any) => c.endDate).filter(Boolean);
    if (starts.length > 0) node.startDate = starts.sort()[0];
    if (ends.length > 0) node.endDate = ends.sort().reverse()[0];
  }

  const phases = items.map((phase: any, pIdx: number) =>
    cleanNodeRecursive(phase, null, pIdx, 1, charterStartDate, charterEndDate)
  );

  const allLeafs: any[] = [];
  phases.forEach((p) => collectLeafNodes(p, allLeafs));

  // 1.5. Ensure complete, realistic prerequisite chaining across all leaf activities if missing
  let previousSubCode = "";
  allLeafs.forEach((leaf, idx) => {
    if (!leaf.prerequisites && idx > 0) {
      leaf.prerequisites = previousSubCode;
    }
    previousSubCode = leaf.code;
  });

  // 2. Normalize weights so that the sum of all leaf activities equals EXACTLY 100%

  if (allLeafs.length > 0) {
    const rawTotalWeight = allLeafs.reduce((sum, leaf) => sum + (leaf.weight || 0), 0);
    if (rawTotalWeight > 0) {
      let scaledSum = 0;
      allLeafs.forEach((leaf) => {
        leaf.weight = Math.max(1, Math.round((leaf.weight / rawTotalWeight) * 100));
        scaledSum += leaf.weight;
      });

      // Fix rounding error on the largest weight item so total = 100
      const diff = 100 - scaledSum;
      if (diff !== 0) {
        let maxLeaf = allLeafs[0];
        allLeafs.forEach((leaf) => {
          if (leaf.weight > maxLeaf.weight) maxLeaf = leaf;
        });
        maxLeaf.weight = Math.max(1, maxLeaf.weight + diff);
      }
    }
  }

  // 3. Ensure activity dates strictly conform to Project Charter start and end dates and respect prerequisites
  if (isWaterfall && charterStartDate && charterEndDate) {
    const cStart = new Date(charterStartDate);
    const cEnd = new Date(charterEndDate);

    if (!isNaN(cStart.getTime()) && !isNaN(cEnd.getTime()) && cEnd >= cStart) {
      const totalCharterDays = Math.max(1, Math.ceil((cEnd.getTime() - cStart.getTime()) / (1000 * 3600 * 24)));
      const subActivityMap = new Map<string, any>();
      allLeafs.forEach(leaf => subActivityMap.set(leaf.code, leaf));

      let currentDayOffset = 0;
      allLeafs.forEach((sub: any, idx: number) => {
        let subStart: Date;
        if (sub.prerequisites && subActivityMap.has(sub.prerequisites)) {
          const prereq = subActivityMap.get(sub.prerequisites);
          const prereqEndDate = prereq.endDate ? new Date(prereq.endDate) : null;
          if (prereqEndDate && !isNaN(prereqEndDate.getTime())) {
            // Successor starts day after predecessor finishes
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

      // Guarantee last item matches charterEndDate exactly
      if (allLeafs.length > 0) {
        allLeafs[allLeafs.length - 1].endDate = cEnd.toISOString().split("T")[0];
      }
    }
  }

  // 4. Rollup bottom-up to all parent nodes!
  phases.forEach(p => rollupTree(p));

  return phases;
}

async function generateWithGeminiFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    preferredModel?: string;
  }
) {
  const modelsToTry = [
    params.preferredModel,
    "gemini-3.7-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro"
  ].filter(Boolean) as string[];

  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: any = null;

  for (const model of uniqueModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config
        });
        if (response && response.text !== undefined) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errStr = typeof err === 'object' ? JSON.stringify(err) : String(err?.message || err);
        console.warn(`Gemini call attempt ${attempt + 1} with ${model} failed:`, errStr);

        const isTransient = errStr.includes("503") || 
                            errStr.includes("UNAVAILABLE") || 
                            errStr.includes("high demand") || 
                            errStr.includes("429") || 
                            errStr.includes("RESOURCE_EXHAUSTED") || 
                            errStr.includes("500") || 
                            errStr.includes("502") || 
                            errStr.includes("504") ||
                            errStr.includes("overloaded");

        if (isTransient && attempt < 2) {
          const backoffMs = (attempt + 1) * 1200;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error("سرویس هوش مصنوعی به طور موقت در دسترس نیست.");
}

function generateFallbackWbs(title: string, isWaterfall: boolean, startDate?: string, endDate?: string, language: string = "fa") {
  const isFa = language === "fa";
  const pName = title || (isFa ? "پروژه" : "Project");
  if (!isWaterfall) {
    if (!isFa) {
      return [
        { code: "1", title: `Requirements Analysis & Scope Definition for ${pName}`, description: "Comprehensive stakeholder requirements analysis and backlog prioritization", sprint: 1, priority: "High", status: "To-Do" },
        { code: "2", title: `Architecture Design & Core Foundations of ${pName}`, description: "Technical specifications, user journeys, and architectural standards", sprint: 1, priority: "High", status: "To-Do" },
        { code: "3", title: `Core Module Development & Infrastructure`, description: "Implementing baseline services, data pipelines, and Sprint 1 deliverables", sprint: 2, priority: "Medium", status: "To-Do" },
        { code: "4", title: `Quality Assurance, Testing & Optimization`, description: "Integration testing, performance benchmarking, and bug fixes", sprint: 3, priority: "Medium", status: "To-Do" },
        { code: "5", title: `Deployment, User Training & Handover`, description: "Release deployment, end-user documentation, and knowledge transfer", sprint: 4, priority: "Low", status: "To-Do" }
      ];
    }
    return [
      { code: "1", title: `تحلیل نیازمندی‌ها و تعریف اهداف ${pName}`, description: "تحلیل جامع درخواست ذینفعان و اولویت‌بندی فعالیت‌ها", sprint: 1, priority: "High", status: "To-Do" },
      { code: "2", title: `طراحی معماری و مفاهیم اصلی ${pName}`, description: "طراحی سناریوهای کاربردی و استانداردهای اجرایی", sprint: 1, priority: "High", status: "To-Do" },
      { code: "3", title: `توسعه ماژول‌های پایه و ساختار عملیاتی`, description: "پیاده‌سازی بخش‌های کلیدی و زیرساخت فاز ۱", sprint: 2, priority: "Medium", status: "To-Do" },
      { code: "4", title: `تست، کنترل کیفیت و رفع اشکالات`, description: "ارزیابی کیفی، سنجش کارایی و بهینه‌سازی سیستم", sprint: 3, priority: "Medium", status: "To-Do" },
      { code: "5", title: `استقرار، آموزش و تحویل نهایی`, description: "مستندسازی، برگزاری دوره آموزشی و استقرار در محیط عملیاتی", sprint: 4, priority: "Low", status: "To-Do" }
    ];
  }

  const rawPhases = isFa ? [
    {
      code: "1",
      title: "فاز ۱: برنامه‌ریزی، امکان‌سنجی و منشور پروژه",
      deliverable: "منشور تاییدشده و اسناد اولیه",
      weight: 15,
      durationDays: 15,
      subActivities: [
        { code: "1.1", title: `شناسایی ذینفعان و تحلیل نیازمندی‌های ${pName}`, weight: 7, durationDays: 7, prerequisites: "", deliverable: "سند نیازمندی‌ها" },
        { code: "1.2", title: "تدوین برنامه مدیریت پروژه و منشور نهایی", weight: 8, durationDays: 8, prerequisites: "1.1", deliverable: "منشور رسمی" }
      ]
    },
    {
      code: "2",
      title: "فاز ۲: طراحی مهندسی و الزامات فنی",
      deliverable: "نقشه‌ها و اسناد طراحی",
      weight: 25,
      durationDays: 25,
      subActivities: [
        { code: "2.1", title: "طراحی مفهومی و معماری اجرایی", weight: 12, durationDays: 12, prerequisites: "1.2", deliverable: "طرح مفهومی" },
        { code: "2.2", title: "بررسی الزامات استانداردی و مجوزهای قانونی", weight: 13, durationDays: 13, prerequisites: "2.1", deliverable: "اخذ تاییدیه اولیه" }
      ]
    },
    {
      code: "3",
      title: "فاز ۳: اجرای عملیاتی و پیاده‌سازی اصلی",
      deliverable: "محصول / خروجی اصلی پروژه",
      weight: 35,
      durationDays: 40,
      subActivities: [
        { code: "3.1", title: "تامین تجهیزات و آماده‌سازی زیرساخت اجرایی", weight: 15, durationDays: 18, prerequisites: "2.2", deliverable: "تجهیزات و زیرساخت" },
        { code: "3.2", title: `پیاده‌سازی و اجرای بخش‌های کلیدی ${pName}`, weight: 20, durationDays: 22, prerequisites: "3.1", deliverable: "خروجی‌های اصلی" }
      ]
    },
    {
      code: "4",
      title: "فاز ۴: کنترل کیفیت، تست و ممیزی",
      deliverable: "گزارشات تست و کنترل کیفیت",
      weight: 15,
      durationDays: 15,
      subActivities: [
        { code: "4.1", title: "تست عملکردی و ارزیابی استانداردهای کیفی", weight: 8, durationDays: 8, prerequisites: "3.2", deliverable: "تست عملکردی" },
        { code: "4.2", title: "ممیزی، عدم انطباق‌ها و بهینه‌سازی نهایی", weight: 7, durationDays: 7, prerequisites: "4.1", deliverable: "اصلاح مغایرت‌ها" }
      ]
    },
    {
      code: "5",
      title: "فاز ۵: تحویل، آموزش کاربران و اختتام",
      deliverable: "صورتجلسه تحویل نهایی",
      weight: 10,
      durationDays: 10,
      subActivities: [
        { code: "5.1", title: "برگزاری دوره‌های آموزشی و تحویل موقت", weight: 5, durationDays: 5, prerequisites: "4.2", deliverable: "گواهی آموزش" },
        { code: "5.2", title: "تکمیل مستندات، اختتام و تحویل قطعی", weight: 5, durationDays: 5, prerequisites: "5.1", deliverable: "مستندات اختتام" }
      ]
    }
  ] : [
    {
      code: "1",
      title: "Phase 1: Project Planning & Charter Initiation",
      deliverable: "Approved Project Charter and Scope Baseline",
      weight: 15,
      durationDays: 15,
      subActivities: [
        { code: "1.1", title: `Stakeholder Identification & Requirements Analysis for ${pName}`, weight: 7, durationDays: 7, prerequisites: "", deliverable: "Requirements Document" },
        { code: "1.2", title: "Finalizing Project Management Plan & Charter", weight: 8, durationDays: 8, prerequisites: "1.1", deliverable: "Official Charter" }
      ]
    },
    {
      code: "2",
      title: "Phase 2: Architectural & Engineering Design",
      deliverable: "Technical Design Documents & Schematics",
      weight: 25,
      durationDays: 25,
      subActivities: [
        { code: "2.1", title: "System Architecture and Detailed Design", weight: 12, durationDays: 12, prerequisites: "1.2", deliverable: "Conceptual & Detailed Design" },
        { code: "2.2", title: "Regulatory Compliance & Standards Review", weight: 13, durationDays: 13, prerequisites: "2.1", deliverable: "Compliance Approvals" }
      ]
    },
    {
      code: "3",
      title: "Phase 3: Execution & Core Implementation",
      deliverable: "Primary Deliverables & Functional System",
      weight: 35,
      durationDays: 40,
      subActivities: [
        { code: "3.1", title: "Procurement & Infrastructure Readiness", weight: 15, durationDays: 18, prerequisites: "2.2", deliverable: "Procured Assets & Infra" },
        { code: "3.2", title: `Core Implementation & Construction of ${pName}`, weight: 20, durationDays: 22, prerequisites: "3.1", deliverable: "Major Deliverables" }
      ]
    },
    {
      code: "4",
      title: "Phase 4: Quality Control, Testing & Verification",
      deliverable: "Testing & QA Sign-off Reports",
      weight: 15,
      durationDays: 15,
      subActivities: [
        { code: "4.1", title: "Functional & Acceptance Testing", weight: 8, durationDays: 8, prerequisites: "3.2", deliverable: "Test Results Report" },
        { code: "4.2", title: "Quality Audit, Defect Remediation & Optimization", weight: 7, durationDays: 7, prerequisites: "4.1", deliverable: "Audit Rectification Sign-off" }
      ]
    },
    {
      code: "5",
      title: "Phase 5: Deployment, Training & Project Closeout",
      deliverable: "Final Handover Sign-off & Closeout Dossier",
      weight: 10,
      durationDays: 10,
      subActivities: [
        { code: "5.1", title: "User Training & Operational Handover", weight: 5, durationDays: 5, prerequisites: "4.2", deliverable: "Training Completion" },
        { code: "5.2", title: "Final Documentation & Project Closeout", weight: 5, durationDays: 5, prerequisites: "5.1", deliverable: "Closeout Report" }
      ]
    }
  ];

  return normalizeWbsItems(rawPhases, startDate, endDate, true);
}

function generateFallbackRisks(title: string, language: string = "fa") {
  const isFa = language === "fa";
  const pName = title || (isFa ? "پروژه" : "Project");
  if (!isFa) {
    return [
      {
        description: `Budget overrun and cost inflation during execution of "${pName}" beyond approved limits`,
        probability: "High",
        impact: "High",
        responsePlan: "Establish contingency reserves and establish formal Change Control Board (CCB) budget review protocols",
        assignedTo: "Financial Manager"
      },
      {
        description: `Procurement delays or supply chain disruptions for critical materials and equipment`,
        probability: "Medium",
        impact: "High",
        responsePlan: "Identify secondary vendors, place early long-lead purchase orders, and enforce contractual SLA penalties",
        assignedTo: "Procurement Lead"
      },
      {
        description: `Scope creep or unapproved requirement changes requested by stakeholders without budget/schedule adjustment`,
        probability: "High",
        impact: "Medium",
        responsePlan: "Enforce strict scope change management and baseline contract amendments",
        assignedTo: "Project Manager"
      },
      {
        description: `Resource constraints or attrition of key specialized personnel during critical project phases`,
        probability: "Medium",
        impact: "Medium",
        responsePlan: "Standardize process documentation, institute cross-training, and provide performance-based retention incentives",
        assignedTo: "HR / Resource Manager"
      },
      {
        description: `Regulatory delays and extended approval cycles from governing authorities`,
        probability: "Medium",
        impact: "High",
        responsePlan: "Engage regulatory liaisons early and submit pre-audit compliance documentation during initiation",
        assignedTo: "Compliance / Legal Advisor"
      }
    ];
  }

  return [
    {
      description: `نوسانات قیمت‌ها و افزایش هزینه‌های اجرایی پروژه "${pName}" بیش از سقف بودجه مصوب`,
      probability: "High",
      impact: "High",
      responsePlan: "پیش‌بینی ذخیره احتیاطی مالی و درخواست تعدیل یا اصلاحیه بودجه در فرآیند CCB",
      assignedTo: "مدیر مالی"
    },
    {
      description: `تاخیر در تأمین تجهیزات، مصالح یا زیرساخت‌های کلیدی مورد نیاز پروژه`,
      probability: "Medium",
      impact: "High",
      responsePlan: "شناسایی تأمین‌کنندگان جایگزین، ثبت سفارش زودهنگام و عقد قراردادهای محکم با جریمه دیرکرد",
      assignedTo: "مدیر تدارکات"
    },
    {
      description: `تغییر در محدوده پروژه یا درخواست افزودن بخش‌های جدید توسط ذینفعان بدون افزایش زمان و بودجه`,
      probability: "High",
      impact: "Medium",
      responsePlan: "اجرای سخت‌گیرانه فرآیند مدیریت تغییرات (Change Control) و ثبت اسناد الحاقیه",
      assignedTo: "مدیر پروژه"
    },
    {
      description: `کمبود یا ریزش نیروهای متخصص و کلیدی تیم پروژه حین فازهای حساس`,
      probability: "Medium",
      impact: "Medium",
      responsePlan: "مستندسازی دانش فنی، جانشین‌پروری و ایجاد انگیزه‌های مالی و حرفه‌ای برای حفظ نیروها",
      assignedTo: "مدیر منابع انسانی"
    },
    {
      description: `طولانی شدن فرآیند اخذ مجوزها، استعلامات و تاییده‌های قانونی از سازمان‌های بالادستی`,
      probability: "Medium",
      impact: "High",
      responsePlan: "پیگیری مستمر حضور میدانی، موازنه مدارک طبق آیین‌نامه‌ها و شروع استعلامات در فازهای اولیه",
      assignedTo: "مشاور حقوقی / پروژه"
    }
  ];
}

function generateFallbackStakeholders(title: string, language: string = "fa") {
  const isFa = language === "fa";
  if (!isFa) {
    return [
      {
        name: "Project Client / Sponsor",
        power: "High",
        interest: "High",
        requirements: "Regular progress reports, phase milestone sign-offs, and strict schedule/budget variance control."
      },
      {
        name: "Executive Leadership & Board",
        power: "High",
        interest: "Low",
        requirements: "Strategic milestone alignment, monthly executive summaries, and governance compliance."
      },
      {
        name: "End Users & Operational Beneficiaries",
        power: "Low",
        interest: "High",
        requirements: "High usability, clear training documentation, responsive feedback loops, and meeting operational functional specs."
      },
      {
        name: "Project Core Delivery Team",
        power: "Low",
        interest: "High",
        requirements: "Clear task specifications, timely resource allocation, psychological safety, and clear escalation pathways."
      },
      {
        name: "Regulatory & Quality Compliance Bodies",
        power: "High",
        interest: "Low",
        requirements: "Full adherence to industry safety, HSE standards, legal compliance, and verifiable audit trails."
      }
    ];
  }

  return [
    {
      name: "کارفرما و اسپانسر پروژه",
      power: "High",
      interest: "High",
      requirements: "دریافت گزارش‌های هفتگی پیشرفت کار، تایید تحویل‌شدنی‌های فازهای مختلف و کنترل انحرافات بودجه و زمان."
    },
    {
      name: "مدیر ارشد سازمان / هیئت مدیره",
      power: "High",
      interest: "Low",
      requirements: "اطلاع از تحقق اهداف استراتژیک، گزارش‌های تحلیلی ماهیانه و عدم تجاوز از سقف اعتبارات مصوب."
    },
    {
      name: "کاربران نهایی و بهره‌برداران",
      power: "Low",
      interest: "High",
      requirements: "سهولت کاربری، کیفیت بالای خروجی‌ها، برگزاری جلسات آموزشی و برآورده شدن انتظارات عملیاتی."
    },
    {
      name: "تیم اجرایی و مجریان پروژه",
      power: "Low",
      interest: "High",
      requirements: "شفافیت در شرح وظایف، تامین به موقع ابزارها و تجهیزات لازم، پاداش‌های انگیزشی و پاسخگویی سریع به ابهامات فنی."
    },
    {
      name: "نهادهای نظارتی، بازرسی و استاندارد",
      power: "High",
      interest: "Low",
      requirements: "رعایت کامل ضوابط و آیین‌نامه‌ها، ارائه مدارک و اسناد فنی جهت اخذ مجوزها و تمهیدات ایمنی و HSE."
    }
  ];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // AI WBS Generation endpoint
  app.post("/api/ai/suggest-wbs", async (req, res) => {
    const { projectType = "waterfall", title, charterData = {}, customPrompt = "", language = "fa" } = req.body || {};
    const isWaterfall = projectType === "waterfall";
    const isFa = language === "fa";
    const startDate = charterData.startDate || "1403/01/01";
    const endDate = charterData.endDate || "1403/12/29";

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({ 
          success: true, 
          items: generateFallbackWbs(title || charterData.title, isWaterfall, startDate, endDate, language),
          isFallback: true 
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      const systemInstruction = isFa ? (isWaterfall ? `شما یک دستیار هوشمند و ارشد مدیریت پروژه (PMP/PMI) هستید. 
وظیفه شما ایجاد یک ساختار شکست کار (WBS) دو سطحی استاندارد، دقیق و کاملاً متناسب با اطلاعات منشور پروژه به زبان فارسی است.
تمامی عناوین، خروجی‌ها و شرح فعالیت‌ها را منحصراً و کاملاً به زبان فارسی رسمی و استاندارد مدیریت پروژه بنویسید.

مشخصات منشور پروژه:
- عنوان پروژه: ${title || charterData.title || "پروژه عمومی"}
- هدف پروژه: ${charterData.objective || charterData.goal || "مشخص نشده"}
- محدوده و شرح پروژه: ${charterData.scope || charterData.description || "مشخص نشده"}
- الزامات و نیازمندی‌ها: ${charterData.requirements || "مشخص نشده"}
- واحد متولی: ${charterData.owningUnit || "مشخص نشده"}
- بودجه / هزینه: ${charterData.cost ? `${charterData.cost}` : "مشخص نشده"}
- تاریخ شروع منشور پروژه: ${startDate}
- تاریخ پایان منشور پروژه: ${endDate}
${customPrompt ? `- دستورات تکمیلی کاربر: ${customPrompt}` : ""}

الزامات و قوانین حیاتی تولید WBS آبشاری:
۱. **سطوح ساختار شکست (WBS Levels)**:
   - **حالت پیش‌فرض**: ساختار شکست کار دارای **۲ سطح** استاندارد است (سطح ۱: بین ۳ تا ۶ فاز یا تحویلی اصلی، سطح ۲: بین ۲ تا ۴ فعالیت زیرمجموعه یا بسته کاری تحت هر فاز).
   - **پشتیبانی از سطوح بیشتر در صورت درخواست کاربر**: اگر کاربر در بخش «دستورات تکمیلی / الزامات خاص کاربر» درخواست سطوح بیشتر (مانند ۳ سطحی، ۴ سطحی، شکست بسته‌های کاری به فعالیت‌های تفصیلی و ...) کرده باشد، ساختار شکست کار را دقیقاً بر اساس همان تعداد سطوح درخواستی کاربر تولید کنید و فعالیت‌های سطح ۲ را به فعالیت‌های سطح ۳ (با کدهایی مانند 1.1.1 و 1.1.2) و در صورت لزوم سطح ۴ تفکیک کنید.
   
۲. **رعایت دقیق روابط پیش‌نیازی (Prerequisites)**:
   - تمام فعالیت‌های انتهایی (برگ‌ها) باید دارای روابط پیش‌نیازی متوالی، منطقی و به هم پیوسته باشند (مثلاً اولین فعالیت پروژه بدون پیش‌نیاز، فعالیت بعدی دارای پیش‌نیاز قبلی و ...).
   - در فیلد prerequisites کد فعالیت پیش‌نیاز درج شود و برای نخستین فعالیت پروژه رشته خالی "" قرار گیرد.

۳. **برآورد دقیق مدت زمان فعالیت‌ها (durationDays)**:
   - برای تمامی فعالیت‌های پایانی، برآورد دقیق و واقعی مدت زمان اجرای فعالیت بر حسب روز کاری (durationDays) بر اساس حجم و پیچیدگی کار برآورد شود.
   - برای سطوح بالاتر نیز مدت زمان متناسب با زیرمجموعه‌های آن باشد.

۴. **مجموع اوزان (weight) دقیقا برابر با ۱۰۰**:
   - مجموع وزن تمام فعالیت‌های پایانی (برگ‌ها) باید **دقیقاً برابر با ۱۰۰ درصد** باشد.

۵. **هماهنگی کامل با منشور پروژه**:
   - تمامی فازها و فعالیت‌ها باید کاملاً مبتنی و متناسب با اهداف، محدوده، الزامات و تحویلی‌های درج شده در منشور پروژه فوق تنظیم شوند.

۶. **رعایت دقیق تاریخ شروع و پایان منشور پروژه**:
   - تاریخ شروع نخستین فعالیت منشور باید با تاریخ شروع پروژه (${startDate}) مطابقت داشته باشد.
   - تاریخ پایان آخرین فعالیت نباید از تاریخ پایان پروژه (${endDate}) فراتر رود.
` : `شما یک دستیار هوشمند مدیریت پروژه چابک (Agile) هستید.
وظیفه شما تعریف یک لیست مسطح (بدون ساختار شکست کار) از فعالیت‌ها و داستان‌های کاربر برای پروژه چابک به زبان فارسی است.

مشخصات منشور پروژه:
- عنوان پروژه: ${title || charterData.title || "پروژه عمومی"}
- هدف پروژه: ${charterData.objective || charterData.goal || "مشخص نشده"}
- محدوده و شرح پروژه: ${charterData.scope || charterData.description || "مشخص نشده"}
- تعداد اسپیرینت‌ها: ${charterData.sprintCount || 4}
${customPrompt ? `- دستورات تکمیلی کاربر: ${customPrompt}` : ""}

قوانین حیاتی پروژه چابک:
۱. **عدم داشتن ساختار شکست کار (WBS)**: تمام فعالیت‌ها باید کاملاً مسطح و بدون هیچ‌گونه فازبندی یا سطح‌بندی باشند.
۲. **تعریف صرفاً در ستون To-Do**: تمام فعالیت‌های تولیدشده باید دارای وضعیت اولیه status: 'To-Do' باشند.
۳. برای هر فعالیت عنوان شفاف، توضیحات مختصر، شماره اسپیرینت و اولویت (High, Medium, Low) تعیین شود.
`) : (isWaterfall ? `You are a Senior Project Management Professional (PMP/PMI).
Your task is to generate a comprehensive Work Breakdown Structure (WBS) aligned with the project charter in English.
All phase titles, sub-activity names, deliverables, and descriptions MUST be in professional English following PMI/PMBOK standards.

Project Charter Specifications:
- Title: ${title || charterData.title || "General Project"}
- Objective: ${charterData.objective || charterData.goal || "Not specified"}
- Scope: ${charterData.scope || charterData.description || "Not specified"}
- Requirements: ${charterData.requirements || "Not specified"}
- Owning Unit: ${charterData.owningUnit || "Not specified"}
- Budget/Cost: ${charterData.cost ? `${charterData.cost}` : "Not specified"}
- Start Date: ${startDate}
- End Date: ${endDate}
${customPrompt ? `- Additional user prompt: ${customPrompt}` : ""}

WBS Rules:
1. WBS Levels: Default to 2 levels (Level 1: 3-6 Phases, Level 2: 2-4 Sub-activities per phase). If the user explicitly requested more levels (e.g. 3 levels, 4 levels) in the custom prompt, generate the structure matching the requested depth.
2. Logical sequential prerequisite chaining across leaf activities.
3. Realistic duration estimates in days (durationDays).
4. Sum of all leaf activity weights MUST equal exactly 100%.
` : `You are an Agile Project Management Expert.
Your task is to generate a flat list of user stories / tasks for an agile project in English.
All titles and descriptions MUST be in professional English.

Charter Specifications:
- Title: ${title || charterData.title || "Project"}
- Goal: ${charterData.objective || charterData.goal || "Not specified"}
- Scope: ${charterData.scope || charterData.description || "Not specified"}
- Sprints: ${charterData.sprintCount || 4}
${customPrompt ? `- Additional prompt: ${customPrompt}` : ""}

Agile Rules:
1. Flat list (No WBS hierarchy).
2. All items start in status: 'To-Do'.
3. Assign sprint number, priority (High, Medium, Low), and concise description.
`);

      const subActivityLevel4Schema = {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING, description: "Sub-activity code e.g. 1.1.1.1" },
          title: { type: Type.STRING, description: "Sub-activity title" },
          durationDays: { type: Type.NUMBER, description: "Duration in days" },
          startDate: { type: Type.STRING, description: "Start date" },
          endDate: { type: Type.STRING, description: "End date" },
          weight: { type: Type.NUMBER, description: "Weight percentage" },
          prerequisites: { type: Type.STRING, description: "Prerequisites code" },
          deliverable: { type: Type.STRING, description: "Deliverable" }
        },
        required: ["code", "title", "durationDays", "weight"]
      };

      const subActivityLevel3Schema = {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING, description: "Sub-activity code e.g. 1.1.1" },
          title: { type: Type.STRING, description: "Sub-activity title" },
          durationDays: { type: Type.NUMBER, description: "Duration in days" },
          startDate: { type: Type.STRING, description: "Start date" },
          endDate: { type: Type.STRING, description: "End date" },
          weight: { type: Type.NUMBER, description: "Weight percentage" },
          prerequisites: { type: Type.STRING, description: "Prerequisites code" },
          deliverable: { type: Type.STRING, description: "Deliverable" },
          subActivities: {
            type: Type.ARRAY,
            description: "Level 4 sub-activities if requested",
            items: subActivityLevel4Schema
          }
        },
        required: ["code", "title", "durationDays", "weight"]
      };

      const subActivityLevel2Schema = {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING, description: "Sub-activity code e.g. 1.1" },
          title: { type: Type.STRING, description: "Sub-activity title" },
          durationDays: { type: Type.NUMBER, description: "Duration in days" },
          startDate: { type: Type.STRING, description: "Start date" },
          endDate: { type: Type.STRING, description: "End date" },
          weight: { type: Type.NUMBER, description: "Weight percentage" },
          prerequisites: { type: Type.STRING, description: "Prerequisites code" },
          deliverable: { type: Type.STRING, description: "Deliverable" },
          subActivities: {
            type: Type.ARRAY,
            description: "Level 3 sub-activities if requested by user in special requirements",
            items: subActivityLevel3Schema
          }
        },
        required: ["code", "title", "durationDays", "weight"]
      };

      const responseSchema = isWaterfall ? {
        type: Type.ARRAY,
        description: isFa ? "لیست فازهای اصلی ساختار شکست کار با فعالیت‌های زیرمجموعه (پیش‌فرض ۲ سطح یا سطوح بیشتر در صورت درخواست)" : "WBS Phases with Sub-activities (2-level default or multi-level if requested)",
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING, description: "Phase code e.g. 1 or 2" },
            title: { type: Type.STRING, description: "Phase title" },
            deliverable: { type: Type.STRING, description: "Phase deliverable" },
            durationDays: { type: Type.NUMBER, description: "Phase duration in days" },
            weight: { type: Type.NUMBER, description: "Phase weight percentage" },
            startDate: { type: Type.STRING, description: "Phase start date" },
            endDate: { type: Type.STRING, description: "Phase end date" },
            subActivities: {
              type: Type.ARRAY,
              description: "Level 2 sub-activities (and Level 3/4 if requested)",
              items: subActivityLevel2Schema
            }
          },
          required: ["code", "title", "durationDays", "subActivities"]
        }
      } : {
        type: Type.ARRAY,
        description: isFa ? "لیست مسطح فعالیت‌های چابک صرفاً جهت قرارگیری در ستون To-Do بدون ساختار شکست" : "Flat Agile tasks list for To-Do column",
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING, description: "Task code" },
            title: { type: Type.STRING, description: "Task title" },
            description: { type: Type.STRING, description: "Task description" },
            sprint: { type: Type.NUMBER, description: "Sprint number" },
            priority: { type: Type.STRING, description: "High | Medium | Low" },
            status: { type: Type.STRING, description: "Always To-Do" }
          },
          required: ["title", "sprint"]
        }
      };

      const response = await generateWithGeminiFallback(ai, {
        preferredModel: "gemini-2.5-flash",
        contents: isFa 
          ? (isWaterfall 
              ? `لطفاً ساختار شکست کار (WBS) متناسب با منشور پروژه "${title || charterData.title || "پروژه"}" به زبان فارسی تولید کنید (پیش‌فرض ۲ سطح یا بر اساس سطوح درخواستی کاربر).`
              : `لطفاً لیست مسطح فعالیت‌های چابک در ستون To-Do بدون ساختار شکست کار را برای پروژه "${title || charterData.title || "پروژه"}" به زبان فارسی تولید کنید.`)
          : (isWaterfall
              ? `Please generate a WBS with weights summing to 100% for the project "${title || charterData.title || "Project"}" in English (2 levels default or multi-level if requested).`
              : `Please generate a flat list of Agile tasks for the To-Do column for "${title || charterData.title || "Project"}" in English.`),
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema
        }
      });

      const text = response.text || "[]";
      let items = JSON.parse(text);

      if (isWaterfall) {
        items = normalizeWbsItems(items, startDate, endDate, isWaterfall);
      } else {
        items = (Array.isArray(items) ? items : []).map((item: any, idx: number) => ({
          code: item.code || String(idx + 1),
          title: item.title || (isFa ? `فعالیت ${idx + 1}` : `Task ${idx + 1}`),
          description: item.description || "",
          sprint: Number(item.sprint) || 1,
          priority: ["High", "Medium", "Low"].includes(item.priority) ? item.priority : "Medium",
          status: "To-Do"
        }));
      }

      return res.json({ success: true, items });
    } catch (error: any) {
      console.warn("Notice in AI WBS endpoint, fallback active:", error?.message || error);
      const title = req.body?.title || req.body?.charterData?.title || (language === "fa" ? "پروژه" : "Project");
      const isWaterfall = (req.body?.projectType || "waterfall") === "waterfall";
      const startDate = req.body?.charterData?.startDate;
      const endDate = req.body?.charterData?.endDate;
      const fallbackItems = generateFallbackWbs(title, isWaterfall, startDate, endDate, language);
      return res.json({ success: true, items: fallbackItems, isFallback: true });
    }
  });

  // AI Risk Generation endpoint
  app.post("/api/ai/suggest-risks", async (req, res) => {
    const { title, charterData = {}, scheduleActivities = [], kanbanTasks = [], customPrompt = "", language = "fa" } = req.body || {};
    const isFa = language === "fa";

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({ 
          success: true, 
          risks: generateFallbackRisks(title || charterData.title, language),
          isFallback: true 
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      // Extract high-level summary of WBS / Activities
      let wbsSummary = "";
      if (scheduleActivities.length > 0) {
        wbsSummary = scheduleActivities.slice(0, 15).map((a: any) => `- ${a.name} (${isFa ? `مدت: ${a.duration} روز` : `Duration: ${a.duration} days`})`).join("\n");
      } else if (kanbanTasks.length > 0) {
        wbsSummary = kanbanTasks.slice(0, 15).map((t: any) => `- ${t.description}`).join("\n");
      }

      const systemInstruction = isFa ? `شما یک متخصص ارشد مدیریت ریسک پروژه (PMI-RMP) هستید.
وظیفه شما تحلیل منشور پروژه و ساختار شکست کار (WBS / لیست فعالیت‌ها) و پیشنهاد لیست ریسک‌های کاربردی منحصراً و کاملاً به زبان فارسی رسمی و استاندارد مدیریت پروژه است.

مشخصات منشور پروژه:
- عنوان: ${title || charterData.title || "پروژه عمومی"}
- هدف: ${charterData.objective || charterData.goal || "مشخص نشده"}
- محدوده: ${charterData.scope || charterData.description || "مشخص نشده"}
- بودجه / هزینه: ${charterData.cost ? `${charterData.cost}` : "مشخص نشده"}
- تاریخ شروع و پایان: ${charterData.startDate || "نامشخص"} تا ${charterData.endDate || "نامشخص"}

${wbsSummary ? `خلاصه فعالیت‌ها و ساختار شکست کار (WBS):\n${wbsSummary}\n` : ""}
${customPrompt ? `دستورات تکمیلی کاربر:\n${customPrompt}\n` : ""}

الزامات خروجی:
بین ۴ تا ۸ ریسک کلیدی و واقع‌بینانه پیشنهاد دهید.
هر ریسک باید شامل موارد زیر به زبان فارسی باشد:
۱. description: شرح شفاف و کامل ریسک و علت آن
۲. probability: احتمال وقوع دقیقاً یکی از مقادیر 'High'، 'Medium' یا 'Low'
۳. impact: میزان اثر بر اهداف پروژه دقیقاً یکی از مقادیر 'High'، 'Medium' یا 'Low'
۴. responsePlan: برنامه پاسخ اجرایی به ریسک (استراتژی اجتناب، کاهش، انتقال یا پذیرش)
۵. assignedTo: عنوان یا سمت مسئول مدیریت و پایش این ریسک
` : `You are a Senior Project Risk Management Expert (PMI-RMP).
Your task is to analyze the project charter and WBS and propose realistic project risks in professional English.
All descriptions, response plans, and assigned roles MUST be in clear English following PMBOK standards.

Project Charter Specifications:
- Title: ${title || charterData.title || "General Project"}
- Objective: ${charterData.objective || charterData.goal || "Not specified"}
- Scope: ${charterData.scope || charterData.description || "Not specified"}
- Budget/Cost: ${charterData.cost ? `${charterData.cost}` : "Not specified"}
- Start & End Dates: ${charterData.startDate || "N/A"} to ${charterData.endDate || "N/A"}

${wbsSummary ? `WBS Summary:\n${wbsSummary}\n` : ""}
${customPrompt ? `Additional Prompt:\n${customPrompt}\n` : ""}

Requirements:
Propose 4 to 8 realistic key project risks.
Each risk must contain:
1. description: Clear description of the risk event and cause in English
2. probability: Exactly 'High', 'Medium', or 'Low'
3. impact: Exactly 'High', 'Medium', or 'Low'
4. responsePlan: Actionable mitigation/response strategy in English
5. assignedTo: Responsible role title in English
`;

      const responseSchema = {
        type: Type.ARRAY,
        description: isFa ? "لیست ریسک‌های پیشنهادی پروژه با احتمال، اثر و برنامه پاسخ" : "List of suggested project risks with probability, impact, and response plan",
        items: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: isFa ? "شرح ریسک" : "Risk description" },
            probability: { type: Type.STRING, description: "High | Medium | Low" },
            impact: { type: Type.STRING, description: "High | Medium | Low" },
            responsePlan: { type: Type.STRING, description: isFa ? "برنامه پاسخ به ریسک" : "Risk response plan" },
            assignedTo: { type: Type.STRING, description: isFa ? "پاسخگو / مسئول" : "Assigned role" }
          },
          required: ["description", "probability", "impact", "responsePlan"]
        }
      };

      const response = await generateWithGeminiFallback(ai, {
        preferredModel: "gemini-2.5-flash",
        contents: isFa 
          ? `لطفاً لیست ریسک‌های پیشنهادی پروژه "${title || charterData.title || "پروژه"}" را همراه با احتمال، اثر و برنامه پاسخ بر اساس منشور و WBS به زبان فارسی تولید کنید.`
          : `Please generate the list of project risks for "${title || charterData.title || "Project"}" based on the charter and WBS in English.`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema
        }
      });

      const text = response.text || "[]";
      const rawRisks = JSON.parse(text);

      const risks = (Array.isArray(rawRisks) ? rawRisks : []).map((r: any) => ({
        description: r.description || (isFa ? "ریسک عمومی پروژه" : "General Project Risk"),
        probability: ["High", "Medium", "Low"].includes(r.probability) ? r.probability : "Medium",
        impact: ["High", "Medium", "Low"].includes(r.impact) ? r.impact : "Medium",
        responsePlan: r.responsePlan || (isFa ? "پایش مستمر و تعریف اقدامات اصلاحی" : "Continuous monitoring and corrective actions"),
        assignedTo: r.assignedTo || (isFa ? "مدیر پروژه" : "Project Manager")
      }));

      return res.json({ success: true, risks });
    } catch (error: any) {
      console.warn("Notice in AI Risks endpoint, fallback active:", error?.message || error);
      const title = req.body?.title || req.body?.charterData?.title || (language === "fa" ? "پروژه" : "Project");
      const fallbackRisks = generateFallbackRisks(title, language);
      return res.json({ success: true, risks: fallbackRisks, isFallback: true });
    }
  });

  // AI Stakeholder Generation endpoint
  app.post("/api/ai/suggest-stakeholders", async (req, res) => {
    const { title, charterData = {}, scheduleActivities = [], kanbanTasks = [], customPrompt = "", language = "fa" } = req.body || {};
    const isFa = language === "fa";

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({ 
          success: true, 
          stakeholders: generateFallbackStakeholders(title || charterData.title, language),
          isFallback: true 
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      let wbsSummary = "";
      if (scheduleActivities.length > 0) {
        wbsSummary = scheduleActivities.slice(0, 15).map((a: any) => `- ${a.name} (${isFa ? `مدت: ${a.duration} روز` : `Duration: ${a.duration} days`})`).join("\n");
      } else if (kanbanTasks.length > 0) {
        wbsSummary = kanbanTasks.slice(0, 15).map((t: any) => `- ${t.description}`).join("\n");
      }

      const systemInstruction = isFa ? `شما یک متخصص ارشد مدیریت ذینفعان پروژه (PMI-PMP) هستید.
وظیفه شما تحلیل منشور پروژه و ساختار شکست کار (WBS / لیست فعالیت‌ها) و پیشنهاد لیست ذینفعان اصلی پروژه منحصراً و کاملاً به زبان فارسی است.

مشخصات منشور پروژه:
- عنوان: ${title || charterData.title || "پروژه عمومی"}
- هدف: ${charterData.objective || charterData.goal || "مشخص نشده"}
- محدوده: ${charterData.scope || charterData.description || "مشخص نشده"}
- بودجه / هزینه: ${charterData.cost ? `${charterData.cost}` : "مشخص نشده"}
- تاریخ شروع و پایان: ${charterData.startDate || "نامشخص"} تا ${charterData.endDate || "نامشخص"}

${wbsSummary ? `خلاصه فعالیت‌ها و ساختار شکست کار (WBS):\n${wbsSummary}\n` : ""}
${customPrompt ? `دستورات تکمیلی کاربر:\n${customPrompt}\n` : ""}

الزامات خروجی:
بین ۴ تا ۷ ذینفع کلیدی و واقع‌بینانه پیشنهاد دهید.
هر ذینفع باید شامل موارد زیر باشد:
۱. name: عنوان یا سمت ذینفع به زبان فارسی (مانند: کارفرما، اسپانسر، مدیر مالی سازمان، کاربران نهایی، نهاد نظارتی، پیمانکار فرعی)
۲. power: قدرت ذینفع در پروژه دقیقاً یکی از مقادیر 'High' یا 'Low'
۳. interest: میزان علاقه ذینفع دقیقاً یکی از مقادیر 'High' یا 'Low'
۴. requirements: نیازمندی‌ها و الزامات فنی و ارتباطی ذینفع به زبان فارسی (نحوه تعامل، نحوه گزارش‌دهی، ابزار ارتباطی و انتظارات کیفی)
` : `You are a Senior Project Stakeholder Management Expert (PMI-PMP).
Your task is to analyze the project charter and WBS and propose the key project stakeholders in English.
All stakeholder names/roles and communication requirements MUST be in clear English following PMBOK standards.

Project Charter Specifications:
- Title: ${title || charterData.title || "General Project"}
- Objective: ${charterData.objective || charterData.goal || "Not specified"}
- Scope: ${charterData.scope || charterData.description || "Not specified"}
- Budget/Cost: ${charterData.cost ? `${charterData.cost}` : "Not specified"}
- Start & End Dates: ${charterData.startDate || "N/A"} to ${charterData.endDate || "N/A"}

${wbsSummary ? `WBS Summary:\n${wbsSummary}\n` : ""}
${customPrompt ? `Additional Prompt:\n${customPrompt}\n` : ""}

Requirements:
Propose 4 to 7 key stakeholders.
Each stakeholder must contain:
1. name: Role or entity name in English (e.g. Project Sponsor, Finance Director, End Users, Regulatory Body)
2. power: Exactly 'High' or 'Low'
3. interest: Exactly 'High' or 'Low'
4. requirements: Engagement, reporting and technical expectations in English
`;

      const responseSchema = {
        type: Type.ARRAY,
        description: isFa ? "لیست ذینفعان پیشنهادی پروژه با قدرت، علاقه و نیازمندی‌های فنی و ارتباطی" : "List of suggested project stakeholders with power, interest, and requirements",
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: isFa ? "عنوان یا نام ذینفع" : "Stakeholder role name" },
            power: { type: Type.STRING, description: "High | Low" },
            interest: { type: Type.STRING, description: "High | Low" },
            requirements: { type: Type.STRING, description: isFa ? "نیازمندی‌ها و الزامات فنی و ارتباطی" : "Requirements and engagement expectations" }
          },
          required: ["name", "power", "interest", "requirements"]
        }
      };

      const response = await generateWithGeminiFallback(ai, {
        preferredModel: "gemini-2.5-flash",
        contents: isFa
          ? `لطفاً لیست ذینفعان پیشنهادی پروژه "${title || charterData.title || "پروژه"}" را بر اساس منشور و WBS به زبان فارسی تولید کنید.`
          : `Please generate the list of project stakeholders for "${title || charterData.title || "Project"}" based on the charter and WBS in English.`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema
        }
      });

      const text = response.text || "[]";
      const rawStakeholders = JSON.parse(text);

      const stakeholders = (Array.isArray(rawStakeholders) ? rawStakeholders : []).map((s: any) => ({
        name: s.name || (isFa ? "ذینفع پروژه" : "Stakeholder"),
        power: ["High", "Low"].includes(s.power) ? s.power : "High",
        interest: ["High", "Low"].includes(s.interest) ? s.interest : "High",
        requirements: s.requirements || (isFa ? "اطلاع‌رسانی منظم و پیگیری انتظارات فنی" : "Regular communication and technical expectation tracking")
      }));

      return res.json({ success: true, stakeholders });
    } catch (error: any) {
      console.warn("Notice in AI Stakeholders endpoint, fallback active:", error?.message || error);
      const title = req.body?.title || req.body?.charterData?.title || (language === "fa" ? "پروژه" : "Project");
      const fallbackStakeholders = generateFallbackStakeholders(title, language);
      return res.json({ success: true, stakeholders: fallbackStakeholders, isFallback: true });
    }
  });

  // AI Text Summarization endpoint (Max 2 sentences)
  app.post("/api/ai/summarize", async (req, res) => {
    const { text, type = "status", language = "fa" } = req.body || {};
    const isFa = language === "fa";
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: isFa ? "متن جهت خلاصه‌سازی ارسال نشده است." : "No text provided for summarization." });
    }

    const contextLabel = isFa 
      ? (type === "delay" ? "دلایل تاخیر پروژه" : "گزارش آخرین وضعیت پروژه")
      : (type === "delay" ? "Project Delay Reasons" : "Project Status Report");

    const generateSmartFallback = (rawText: string) => {
      const clean = rawText.trim();
      const sentences = clean
        .split(/[.\n!\u06D4]/)
        .map(s => s.trim())
        .filter(s => s.length > 5);
      if (sentences.length >= 2) {
        return `${sentences[0]}. ${sentences[1]}.`;
      } else if (sentences.length === 1) {
        return isFa 
          ? `${sentences[0]}. پایش مستمر و پیگیری اقدامات تکمیلی در دستور کار قرار دارد.`
          : `${sentences[0]}. Continuous monitoring and corrective action follow-ups are underway.`;
      }
      return clean.length > 180 ? `${clean.substring(0, 180)}...` : clean;
    };

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({ success: true, summary: generateSmartFallback(text), isFallback: true });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      const systemInstruction = isFa ? `شما یک دستیار هوشمند و ارشد مدیریت پروژه (PMP) هستید.
وظیفه شما خلاصه‌سازی مدیریتی، دقیق و روان متن زیر (که مربوط به ${contextLabel} است) منحصراً به زبان فارسی است.

الزامات حیاتی خلاصه‌سازی:
۱. متن خلاصه شده باید **دقیقاً و نهایتاً شامل ۲ جمله** (مجموعاً حداکثر ۲ جمله کامل و پرمحتوا) باشد.
۲. تمام نکات کلیدی و ریشه‌ای مدیریتی حفظ شده و جزئیات غیرضروری حذف شوند.
۳. از هرگونه عنوان، شماره‌گذاری، بولت‌پوینت، مقدمه یا توضیح اضافه پرهیز کرده و صرفاً ۲ جمله متن نهایی را خروجی دهید.`
      : `You are a Senior Project Management Consultant (PMP).
Your task is to provide an executive summary of the following text (regarding ${contextLabel}) strictly in English.

Critical Summarization Rules:
1. The summary MUST consist of **at most 2 clear, impactful sentences**.
2. Preserve key project insights and root causes while eliminating non-essential noise.
3. Output ONLY the 2 summary sentences without any prefixes, bullet points, numbering, or introductory filler.`;

      const response = await generateWithGeminiFallback(ai, {
        preferredModel: "gemini-2.5-flash",
        contents: isFa 
          ? `لطفاً متن زیر را حداکثر در ۲ جمله خلاصه مدیریتی کنید:\n\n${text}`
          : `Please summarize the following text in at most 2 executive sentences in English:\n\n${text}`,
        config: {
          systemInstruction,
          temperature: 0.2
        }
      });

      const summary = (response.text || "").trim();
      return res.json({ success: true, summary: summary || generateSmartFallback(text) });
    } catch (error: any) {
      console.warn("Notice in summarize endpoint, using fallback:", error?.message || error);
      return res.json({ success: true, summary: generateSmartFallback(text), isFallback: true });
    }
  });

  // AI Document Summarization & Relevance Analysis Endpoint
  app.post("/api/ai/summarize-document", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { docName, docDescription, docType, projectName, projectGoal, language = "fa" } = req.body || {};
      const isFa = language === "fa";

      if (!docName && !docDescription) {
        return res.status(400).json({ error: isFa ? "اطلاعات سند جهت خلاصه سازی ارسال نشده است." : "Document details missing." });
      }

      if (!apiKey) {
        return res.json({
          success: true,
          summary: docDescription 
            ? (isFa ? `خلاصه سند (${docName || 'مدرک'}): ${docDescription.slice(0, 120)}` : `Document summary (${docName || 'Doc'}): ${docDescription.slice(0, 120)}`)
            : (isFa ? `سند ${docName} مربوط به پروژه ثبت شد.` : `Document ${docName} registered for the project.`),
          relevance: isFa ? "مرتبط" : "Relevant",
          relevanceReason: projectName 
            ? (isFa ? `این سند مربوط به پروژه "${projectName}" می‌باشد.` : `This document is associated with "${projectName}".`) 
            : (isFa ? "سند پروژه" : "Project document")
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });

      const promptText = isFa ? `اطلاعات سند بارگذاری شده:
- عنوان/نام فایل: ${docName || 'مشخص نشده'}
- نوع سند: ${docType || 'نامشخص'}
- شرح و توضیحات سند: ${docDescription || 'بدون توضیحات'}

اطلاعات پروژه مربوطه:
- نام پروژه: ${projectName || 'نامشخص'}
- هدف و موضوع پروژه: ${projectGoal || 'نامشخص'}`
      : `Uploaded Document Information:
- Document/File Name: ${docName || 'Not specified'}
- Document Type: ${docType || 'Unknown'}
- Description: ${docDescription || 'None'}

Associated Project:
- Project Name: ${projectName || 'Unknown'}
- Project Goal/Scope: ${projectGoal || 'Unknown'}`;

      const responseSchema = {
        type: Type.OBJECT,
        description: isFa ? "خلاصه مدیریتی سند و تحلیل ارتباط آن با موضوع پروژه" : "Document summary and project relevance analysis",
        properties: {
          summary: { type: Type.STRING, description: isFa ? "خلاصه مدیریتی، روان و دقیق از محتوای این سند به زبان فارسی (حداکثر ۲ جمله)" : "Executive summary in English (maximum 2 sentences)" },
          relevance: { type: Type.STRING, description: isFa ? "سطح مرتبط بودن با پروژه (مثلا: کاملاً مرتبط، مرتبط، ارتباط نسبی، نامرتبط)" : "Relevance rating (Highly Relevant | Relevant | Moderately Relevant | Irrelevant)" },
          relevanceReason: { type: Type.STRING, description: isFa ? "دلیل و توضیح ارتباط یا عدم ارتباط سند با پروژه" : "Explanation of relevance to project" }
        },
        required: ["summary", "relevance", "relevanceReason"]
      };

      const systemInstruction = isFa 
        ? "شما یک دستیار هوشمند و ارشد مدیریت پروژه (PMP) هستید. وظیفه شما خلاصه‌سازی مدیریتی و حرفه‌ای شرح/محتوای سند بارگذاری شده به زبان فارسی در حداکثر ۲ جمله است."
        : "You are a Senior Project Management Consultant (PMP). Your task is to provide an executive summary and relevance analysis of the uploaded document strictly in English in at most 2 sentences.";

      const response = await generateWithGeminiFallback(ai, {
        preferredModel: "gemini-2.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2
        }
      });

      const result = JSON.parse(response.text || "{}");
      return res.json({
        success: true,
        summary: result.summary || (docDescription ? docDescription.slice(0, 120) : (isFa ? 'خلاصه ثبت شد.' : 'Summary recorded.')),
        relevance: result.relevance || (isFa ? 'مرتبط' : 'Relevant'),
        relevanceReason: result.relevanceReason || ''
      });
    } catch (error: any) {
      console.error("Error in summarize-document:", error);
      return res.status(500).json({ error: error.message || "خطا در خلاصه‌سازی سند" });
    }
  });

  // AI Feasibility Analysis Endpoint
  app.post("/api/ai/feasibility-analysis", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { name, goal, description, requirements, constraints, cost, safeCostStr, language = "fa" } = req.body || {};
      const isFa = language === "fa";

      const numCostVal = typeof cost === 'number' ? cost : parseFloat(String(cost).replace(/[^\d.]/g, '')) || 0;
      const hasDetails = !!((goal && goal.length > 5) || (description && description.length > 10) || (requirements && requirements.length > 5));
      const isCostOk = numCostVal >= 1000000;
      const isOverallOk = hasDetails && isCostOk;

      const buildFallbackResult = () => {
        if (isFa) {
          return {
            success: true,
            isJustified: isOverallOk,
            technicalFeasibility: hasDetails 
              ? ("امکان‌سنجی فنی پروژه «" + (name || 'پروژه') + "»: الزامات و مشخصات فنی ثبت گردیده و در چارچوب فنی قابل برنامه‌ریزی و اجراست.")
              : ("امکان‌سنجی فنی پروژه «" + (name || 'پروژه') + "»: به دلیل عدم ثبت کامل اهداف و الزامات یا وجود عبارات مبهم، پروژه نیازمند تکمیل اطلاعات فنی می‌باشد."),
            economicFeasibility: isCostOk
              ? ("امکان‌سنجی اقتصادی: برآورد مالی برابر با " + (safeCostStr || cost || 'معتبر') + " ثبت گردیده است.")
              : ("امکان‌سنجی اقتصادی: برآورد مالی ثبت‌شده بسیار ناچیز/غیرواقعی بوده و دارای انحراف با عرف صنعت می‌باشد."),
            overallAnalysis: isOverallOk
              ? "نتیجه‌گیری: کلیات پروژه دارای توجیه اولیه بوده و با اعمال اصلاحات پیشنهادی قابلیت اجرا دارد."
              : ("نتیجه‌گیری: پروژه «" + (name || 'پروژه') + "» به دلیل نقص منشور یا انحراف در برآورد زمان و هزینه، فاقد توجیه‌پذیری اجرایی تشخیص داده شد."),
            proposedRevisions: isOverallOk
              ? ["تعیین دقیق‌تر شاخص‌های کلیدی عملکرد (KPI)", "فازبندی پروژه و تدوین جدول زمان‌بندی تفصیلی"]
              : ["تکمیل اهداف و شرح منشور پروژه", "تعدیل و ثبت برآورد واقعی بودجه بر اساس عرف صنعت", "تعیین زمان‌بندی اجرایی شفاف"],
            formattedResponseComment: isOverallOk
              ? ("پروژه «" + (name || 'پروژه') + "» ارزیابی شد و دارای توجیه اولیه تشخیص داده شد.")
              : ("پروژه «" + (name || 'پروژه') + "» به دلیل انحراف در برآورد زمان/هزینه یا نقص منشور، فاقد توجیه‌پذیری تشخیص داده شد و نیازمند اصلاح است.")
          };
        } else {
          return {
            success: true,
            isJustified: isOverallOk,
            technicalFeasibility: hasDetails
              ? `Technical Feasibility for "${name || 'Project'}": Defined technical requirements and objectives are feasible within standard engineering practice.`
              : `Technical Feasibility for "${name || 'Project'}": Charter requires more comprehensive technical scope and specification details.`,
            economicFeasibility: isCostOk
              ? `Economic Feasibility: Estimated budget of ${safeCostStr || cost || 'valid'} aligns with initial industrial benchmarks.`
              : `Economic Feasibility: Cost estimation requires adjustment to match realistic operational requirements.`,
            overallAnalysis: isOverallOk
              ? `Conclusion: The project charter demonstrates viable technical and economic justification.`
              : `Conclusion: Project "${name || 'Project'}" requires further scope and budget refinements prior to formal approval.`,
            proposedRevisions: isOverallOk
              ? ["Define measurable Key Performance Indicators (KPIs)", "Establish detailed WBS milestone schedule"]
              : ["Refine detailed project objective and charter scope", "Calibrate cost estimation to realistic industry benchmarks", "Establish clear schedule baseline"],
            formattedResponseComment: isOverallOk
              ? `Feasibility evaluation for "${name || 'Project'}" completed successfully: Project is viable and recommended for approval.`
              : `Feasibility evaluation for "${name || 'Project'}": Modifications required regarding scope and budget baseline.`
          };
        }
      };

      if (!apiKey) {
        return res.json(buildFallbackResult());
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });

      const promptText = isFa ? `اطلاعات امکان‌سنجی پروژه:
- عنوان پروژه: ${name || 'نامشخص'}
- هدف: ${goal || 'نامشخص'}
- شرح: ${description || 'خالی'}
- الزامات: ${requirements || 'خالی'}
- برآورد هزینه: ${safeCostStr || cost || 'نامشخص'}`
      : `Project Feasibility Information:
- Project Title: ${name || 'Unknown'}
- Goal/Objective: ${goal || 'Unknown'}
- Description: ${description || 'None'}
- Requirements: ${requirements || 'None'}
- Estimated Cost: ${safeCostStr || cost || 'Unknown'}`;

      const responseSchema = {
        type: Type.OBJECT,
        description: isFa ? "نتیجه امکان‌سنجی هوشمند پروژه" : "Project feasibility evaluation result",
        properties: {
          isJustified: { type: Type.BOOLEAN, description: isFa ? "آیا پروژه دارای توجیه اقتصادی و فنی است؟" : "Is the project economically and technically viable?" },
          technicalFeasibility: { type: Type.STRING, description: isFa ? "تحلیل امکان‌سنجی فنی" : "Technical feasibility analysis" },
          economicFeasibility: { type: Type.STRING, description: isFa ? "تحلیل امکان‌سنجی اقتصادی" : "Economic feasibility analysis" },
          overallAnalysis: { type: Type.STRING, description: isFa ? "جمع‌بندی و نتیجه‌گیری نهایی" : "Executive summary and conclusion" },
          proposedRevisions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: isFa ? "پیشنهادات اصلاحی" : "Recommended revisions"
          },
          formattedResponseComment: { type: Type.STRING, description: isFa ? "پاسخ ساختاریافته خلاصه" : "Structured summary comment" }
        },
        required: ["isJustified", "technicalFeasibility", "economicFeasibility", "overallAnalysis", "proposedRevisions", "formattedResponseComment"]
      };

      const systemInstruction = isFa 
        ? "شما کارشناس ارشد ارزیابی امکان‌سنجی پروژه‌ها (PMP) هستید. با تحلیل اطلاعات، پاسخ را منحصراً و کاملاً به زبان فارسی رسمی و تخصصی در قالب ساختار مشخص‌شده تولید کنید."
        : "You are a Senior Project Feasibility Expert (PMP). Analyze the project charter information and generate the complete assessment strictly in professional English according to the specified schema.";

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: promptText,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema
          }
        });
        const result = JSON.parse(response.text || '{}');
        return res.json({
          success: true,
          isJustified: result.isJustified ?? false,
          technicalFeasibility: result.technicalFeasibility || '',
          economicFeasibility: result.economicFeasibility || '',
          overallAnalysis: result.overallAnalysis || '',
          proposedRevisions: Array.isArray(result.proposedRevisions) ? result.proposedRevisions : [],
          formattedResponseComment: result.formattedResponseComment || ''
        });
      } catch (geminiErr: any) {
        console.error("Gemini call error in feasibility-analysis, generating rule-based analysis:", geminiErr);
        return res.json(buildFallbackResult());
      }

    } catch (error: any) {
      console.error("Error in feasibility-analysis endpoint:", error);
      return res.status(200).json({
        success: false,
        error: `Error in feasibility analysis: ${error?.message || String(error)}`
      });
    }
  });

  // AI Chatbot endpoint with database query & chart/report generation
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "GEMINI_API_KEY تنظیم نشده است." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      const { message, history = [], dbSummary = {} } = req.body;
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "پیام کاربر دریافت نشد." });
      }

      const systemInstruction = `شما یک "دستیار هوشمند مدیریت پروژه" (AI PM Assistant) هوشمند، بسیار دقیق و حرفه‌ای هستید.
شما دسترسی کامل و مستقیم به بانک اطلاعاتی زنده سیستم مدیریت پروژه دارید.

اطلاعات بانک داده زنده پروژه به شرح زیر است:
=== داده‌های پروژه‌ها (${(dbSummary.projects || []).length} پروژه) ===
${JSON.stringify(dbSummary.projects || [], null, 2)}

=== داده‌های اقدامات اجرایی (${(dbSummary.actions || []).length} اقدام) ===
${JSON.stringify(dbSummary.actions || [], null, 2)}

=== کاربران سیستم (${(dbSummary.users || []).length} کاربر) ===
${JSON.stringify(dbSummary.users || [], null, 2)}

راهنمای تطبیق و درک دقیق فیلدهای کلیدی و انواع اقلام:
۱. **انواع موجود در گزارش‌گیری و تفکیک بر اساس «نوع» (Type)**:
   دستیار هوشمند در گزارش‌گیری، آمارها و نمودارهای تفکیک بر اساس «نوع» (Type) حتماً و الزماً ۳ دسته زیر را مد نظر دارد:
   - **آبشاری (Waterfall)**: پروژه‌های با متدولوژی آبشاری
   - **چابک (Agile)**: پروژه‌های با متدولوژی چابک
   - **اقدام (Action)**: اقدامات اجرایی و کارهای پیگیری (از لیست اقدامات dbSummary.actions)
   هنگام درخواست گزارش، آمار یا نمودار بر اساس «نوع» (Type)، آمار هر ۳ دسته (آبشاری، چابک و اقدام) محاسبه شده و در پاسخ متنی، نمودار و جدول ارائه می‌گردد.
۲. **واحد مالک / متولی (owningUnit)**: واحد سازمانی مسئول پروژه یا اقدام (مانند "فناوری اطلاعات"، "توسعه"، "مالی"، "عملیات" و...).
۳. **وضعیت پروژه و اقدام (status و statusFa)**:
   - 'In Progress' یا 'در حال اجرا' = اقلام در حال اجرا / فعال / جاری
   - 'Completed' یا 'تکمیل شده' = اقلام تکمیل شده / خاتمه یافته / پایان یافته / انجام شده
   - 'Planning' یا 'در حال برنامه‌ریزی' = اقلام در حال برنامه‌ریزی / اولیه
   - 'On Hold' یا 'معلق' = اقلام معلق / متوقف / توقیف شده
۴. **وضعیت تایید پروژه (approvalStatus و approvalStatusFa)**:
   - 'Approved' یا 'تایید شده' / 'تایید' = پروژه‌های تایید شده و مصوب
   - 'Pending Approval' یا 'در انتظار تایید' = پروژه‌های منتظر بررسی و تایید
   - 'Draft' یا 'پیش‌نویس' = پیش‌نویس‌های اولیه
   - 'Rejected' یا 'رد شده' = پروژه‌های رد شده
۵. **مدیر / مسئول (managerName یا responsibleUserName)**: نام یا شناسه مسئول یا مدیر پروژه / اقدام.
۶. **تاریخ‌های شمسی (startDateShamsi, endDateShamsi)**: تاریخ‌های پروژه / اقدام به شمسی.
۷. **درصد پیشرفت واقعی (actualProgress)**: عدد ۰ تا ۱۰۰ نشان‌دهنده درصد پیشرفت پروژه‌ها.
۸. **بودجه / هزینه (cost)**: میزان اعتبار یا هزینه تخصیص‌یافته.

قواعد حیاتی پردازش درخواست کاربر:
۱. **قاعده حیاتی لیست پروژه‌ها (نمایش منحصراً پروژه‌های تایید شده)**:
   - در ارائه «لیست پروژه‌ها» (شامل لیست تمام پروژه‌ها، لیست پروژه‌های آبشاری، لیست پروژه‌های چابک، یا فیلترهای واحد و مدیر)، **صرفاً و منحصراً مواردی نمایش داده شوند که وضعیت تایید آن‌ها برابر با «تایید» یا «Approved» باشد (approvalStatus === 'Approved')**.
   - پروژه‌های با وضعیت تایید پیش‌نویس (Draft)، در انتظار تایید (Pending Approval) یا رد شده (Rejected) در لیست پروژه‌ها نمایش داده نشوند مگر آنکه کاربر صریحاً و مشخصاً درخواست «پروژه‌های در انتظار تایید» یا «پروژه‌های پیش‌نویس/رد شده» را داشته باشد.
۲. **قاعده حیاتی لیست اقدامات (نمایش منحصراً ۳ ستون: ردیف، عنوان اقدام، و جزییات)**:
   - زمانی که کاربر درخواست «لیست اقدامات» (یا اقدامات، کارهای اجرایی، یا مواردی که نوع آن‌ها اقدام است) را مطرح می‌کند، حتماً و فقط مواردی که **نوع آن‌ها اقدام است** (داده‌های dbSummary.actions) در لیست و جدول نمایش داده شوند.
   - برای لیست اقدامات (دقیقاً مانند لیست پروژه‌ها)، headers **حتماً و دقیقاً** سه ستون زیر باشد و هیچ ستون دیگری نباید باشد:
     headers: ["#", "عنوان اقدام", "جزییات"]
   - در سطرهای جدول اقدامات: ستون اول شماره ردیف (۱، ۲، ۳...)، ستون دوم عنوان اقدام، و ستون سوم شناسه اقدام با فرمت ACTION_ID:<id> (مثلاً ACTION_ID:201) باشد. هیچ ستون بیشتری (مانند مسئول، واحد، وضعیت، مهلت و...) نباید آورده شود.
۳. **تفکیک کامل لیست و نمودار**:
   - اگر پیام کاربر شامل کلمه "لیست" باشد و کلمه "نمودار" در آن **نباشد**: **صرفاً جدول** ارائه گردد. chartType را برابر 'none' بگذارید و chartData را خالی ارسال نمایید.
   - اگر پیام کاربر شامل کلمه "نمودار" باشد و کلمه "لیست" در آن **نباشد**: **صرفاً نمودار** ارائه گردد و tableData را برابر null بگذارید.
   - اگر کاربر هر دو را خواسته بود، هم جدول و هم نمودار را ارسال کنید.
۴. **تنظیم نوع نمودار (پای و میله‌ای افقی)**:
   - برای درخواست "نمودار پای" یا "پای": chartType را برابر 'pie' قرار دهید.
   - برای درخواست "نمودار میله‌ای" یا "میله ای" یا "بار": chartType را برابر 'bar' قرار دهید (که به صورت میله‌ای افقی نمایش می‌یابد).
۵. **ساختار ستون‌های جدول برای نمایش لیست پروژه‌ها**:
   - برای لیست پروژه‌ها، headers **حتماً و دقیقاً** سه ستون زیر باشد:
     headers: ["#", "نام پروژه", "داشبورد"]
   - در سطرها (rows): ستون اول شماره ردیف (۱، ۲، ۳...)، ستون دوم نام پروژه، و ستون سوم شناسه پروژه با فرمت PROJECT_ID:<id> (مثلاً PROJECT_ID:101).
۶. **الزامی بودن تاریخ‌های شمسی (Shamsi/Jalali Dates) و اعداد فارسی**:
   - تمام تاریخ‌های ذکر شده در متن پاسخ **حتماً باید به صورت تاریخ شمسی (هجری خورشیدی مانند ۱۴۰۳/۰۵/۲۰ یا ۱۴۰۴/۱۲/۲۹)** باشند.
   - تمامی اعداد و ارقام در متن پاسخ، جداول، عناوین، نمودارها، آمار و توضیحات **حتماً باید با فونت و ارقام فارسی (۰، ۱، ۲، ۳، ۴، ۵، ۶، ۷، ۸، ۹)** نوشته شوند.
۷. **درک کامل جمله و ترکیب شروط فیلترینگ (AND منطقی)**:
   - اگر کاربر چند شرط همزمان (نوع، وضعیت، واحد، مدیر) ذکر کرد، تمام شروط را با هم اعمال نموده و فقط اقلام واجد شرایط را نمایش دهید.
   - اگر با فیلترهای مشخص‌شده موردی پیدا نشد، صریحاً اعلام کنید "موردی مطابق با فیلترهای مشخص‌شده یافت نشد".
۸. **ایجاد و ثبت موجودیت‌ها (actionToPerform & actionData)**:
   - در صورت دستور تعریف پروژه جدید، اقدام جدید، WBS یا ریسک/تاخیر، اکشن مناسب همراه با actionData تولید شود.
`;

      const responseSchema = {
        type: Type.OBJECT,
        description: "پاسخ دستیار هوشمند شامل متن، نمودار، جدول داده و عملیات ایجاد/به‌روزرسانی",
        properties: {
          reply: { type: Type.STRING, description: "پاسخ متنی و خلاصه‌سازی مدیریتی به زبان فارسی" },
          chartType: { type: Type.STRING, description: "pie | bar | none" },
          chartTitle: { type: Type.STRING, description: "عنوان نمودار به فارسی" },
          chartData: {
            type: Type.ARRAY,
            description: "داده‌های نمودار شامل name و value و fill اختیاری",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.NUMBER },
                fill: { type: Type.STRING }
              },
              required: ["name", "value"]
            }
          },
          tableData: {
            type: Type.OBJECT,
            description: "جدول یا لیست اقلام پیدا شده مرتبط",
            properties: {
              headers: { type: Type.ARRAY, items: { type: Type.STRING } },
              rows: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            }
          },
          actionToPerform: { type: Type.STRING, description: "NONE | CREATE_PROJECT | CREATE_ACTION | ADD_ACTIVITIES | ADD_PROJECT_DETAILS" },
          actionData: { type: Type.OBJECT, description: "داده‌های استخراج شده جهت ایجاد یا تغییر پروژه/اقدام/فعالیت/ریسک/تیم/تاخیر" }
        },
        required: ["reply", "chartType"]
      };

      // Construct prompt with chat history context
      let promptText = "";
      if (Array.isArray(history) && history.length > 0) {
        promptText += "تاریخچه گفتگوهای اخیر:\n";
        history.slice(-6).forEach((h: any) => {
          promptText += `${h.role === 'user' ? 'کاربر' : 'دستیار'}: ${h.content}\n`;
        });
        promptText += "\n";
      }
      promptText += `سوال جدید کاربر: ${message}`;

      const response = await generateWithGeminiFallback(ai, {
        preferredModel: "gemini-2.5-flash",
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2
        }
      });

      const text = response.text || "{}";
      const result = JSON.parse(text);

      return res.json({
        success: true,
        reply: result.reply || "پاسخی دریافت نشد.",
        chartType: ["pie", "bar", "none"].includes(result.chartType) ? result.chartType : "none",
        chartTitle: result.chartTitle || "",
        chartData: Array.isArray(result.chartData) ? result.chartData : [],
        tableData: result.tableData || null,
        actionToPerform: result.actionToPerform || "NONE",
        actionData: result.actionData || null
      });

    } catch (error: any) {
      console.warn("Notice in AI Chat endpoint, fallback active:", error?.message || error);
      
      const errMessageStr = String(error?.message || error);
      const isHighDemand = errMessageStr.includes("503") || errMessageStr.includes("UNAVAILABLE") || errMessageStr.includes("high demand");

      return res.status(200).json({
        success: true,
        reply: isHighDemand 
          ? "سرویس هوش مصنوعی در حال حاضر دارای ترافیک بالایی است. اطلاعات از بانک داده زنده پروژه استخراج شد."
          : "متأسفانه در پردازش هوش مصنوعی مشکلی رخ داد. می‌توانید پاسخ مستقیم را از داده‌های بانک اطلاعاتی دریافت کنید.",
        chartType: "none",
        chartTitle: "",
        chartData: [],
        tableData: null,
        actionToPerform: "NONE",
        actionData: null
      });
    }
  });

  // AI routes are answered above by this server only; an AI route that does not exist here is not the backend's business.
  app.use("/api/ai", (_req, res) => res.status(404).json({ error: "Unknown AI route" }));

  // Everything under /api that is not an AI route belongs to the .NET backend: this server only forwards it.
  // (The browser always talks to this origin, so there are no CORS problems and the backend address stays server-side.)
  const BACKEND_TARGET = (process.env.BACKEND_URL || "http://localhost:5251").replace(/\/+$/, "");
  app.use("/api", async (req, res) => {
    const target = `${BACKEND_TARGET}/api${req.url}`;
    try {
      const headers: Record<string, string> = {};
      if (req.headers["authorization"]) headers["Authorization"] = String(req.headers["authorization"]);
      if (req.headers["content-type"]) headers["Content-Type"] = String(req.headers["content-type"]);
      if (req.headers["accept-language"]) headers["Accept-Language"] = String(req.headers["accept-language"]);
      // JSON bodies were already parsed above; anything else (a multipart document upload, for instance) is passed through byte for byte.
      let body: BodyInit | undefined;
      if (!["GET", "HEAD"].includes(req.method)) {
        if (String(req.headers["content-type"] || "").includes("application/json")) {
          if (req.body && Object.keys(req.body).length > 0) body = JSON.stringify(req.body);
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          if (chunks.length) body = Buffer.concat(chunks);
        }
      }
      const backendResponse = await fetch(target, { method: req.method, headers, body });
      res.status(backendResponse.status);
      const contentType = backendResponse.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      const disposition = backendResponse.headers.get("content-disposition");
      if (disposition) res.setHeader("Content-Disposition", disposition);
      res.send(Buffer.from(await backendResponse.arrayBuffer()));
    } catch (err: any) {
      res.status(502).json({ title: "backend.unreachable", detail: `The backend (${BACKEND_TARGET}) could not be reached: ${err?.message || err}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
