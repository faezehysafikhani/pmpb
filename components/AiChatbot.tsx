import React, { useState, useRef, useEffect, useContext } from 'react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { Project, ActionItem, User, ProjectActivity, KanbanTask, ProjectRisk, ProjectStatusUpdate, ProjectDelayReason } from '../types';
import { ThemeContext } from '../context';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { toPersianDigits, toEnglishDigits } from '../utils';

interface AiChatbotProps {
  projects: Project[];
  actions: ActionItem[];
  users: User[];
  owningUnits?: string[];
  projectStatuses?: string[];
  onAddProject?: (project: Project) => void;
  onUpdateProject?: (project: Project) => void;
  onAddAction?: (action: ActionItem) => void;
  onNavigate?: (page: string, context?: any) => void;
  currentUser?: User | null;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  chartType?: 'pie' | 'bar' | 'none';
  chartTitle?: string;
  chartData?: Array<{ name: string; value: number; fill?: string }>;
  tableData?: {
    headers: string[];
    rows: string[][];
  } | null;
  createdEntity?: {
    type: 'project' | 'action' | 'activities' | 'project_details';
    name: string;
    details: string;
    linkPage?: string;
    linkContext?: any;
  };
  timestamp: string;
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];

export const formatToJalali = (dateInput?: string | Date | null): string => {
  if (!dateInput) return '-';
  const str = String(dateInput).trim();
  if (!str || str === 'null' || str === 'undefined') return '-';

  if (/^(13|14|۱۳|۱۴)/.test(str)) {
    return toPersianDigits(str.replace(/-/g, '/'));
  }

  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return toPersianDigits(str);

    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return toPersianDigits(formatter.format(d));
  } catch {
    return toPersianDigits(str);
  }
};

const getISODateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AiChatbot: React.FC<AiChatbotProps> = ({
  projects,
  actions,
  users,
  owningUnits = [],
  projectStatuses = [],
  onAddProject,
  onUpdateProject,
  onAddAction,
  onNavigate,
  currentUser
}) => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'ai',
      text: 'سلام! من دستیار هوشمند مدیریت پروژه (AI PM) هستم. چطور می‌توانم در تعریف پروژه‌ها، گزارش‌گیری (با لحاظ انواع: آبشاری، چابک و اقدام)، ساختار شکست (WBS)، ریسک‌ها و ثبت وضعیت به شما کمک کنم؟',
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Quick Action Modal States inside Chatbot
  const [activeModal, setActiveModal] = useState<'none' | 'project' | 'action' | 'activities' | 'project_details'>('none');

  // Quick Project Form State
  const [projName, setProjName] = useState('');
  const [projType, setProjType] = useState<'waterfall' | 'agile'>('waterfall');
  const [projUnit, setProjUnit] = useState(owningUnits[0] || 'فناوری اطلاعات');
  const [projManagerId, setProjManagerId] = useState<string>(String(currentUser?.id || users[0]?.id || ''));
  const [projStartDate, setProjStartDate] = useState(getISODateString());
  const [projEndDate, setProjEndDate] = useState(getISODateString());
  const [projCost, setProjCost] = useState('');
  const [projGoal, setProjGoal] = useState('');
  const [projDescription, setProjDescription] = useState('');
  const [projWeightingType, setProjWeightingType] = useState<'manual' | 'time-based' | 'cost-based' | 'complexity-based' | 'combined'>('manual');

  // Quick Action Form State
  const [actTitle, setActTitle] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actUser, setActUser] = useState<string>(String(currentUser?.id || users[0]?.id || ''));
  const [actUnit, setActUnit] = useState(owningUnits[0] || 'سازمانی');
  const [actStart, setActStart] = useState(getISODateString());
  const [actEnd, setActEnd] = useState(getISODateString());
  const [actProjectId, setActProjectId] = useState<string | undefined>(undefined);
  const [actStatus, setActStatus] = useState<'Planning' | 'In Progress' | 'On Hold' | 'Completed'>('Planning');

  // Quick WBS/Activities Form State
  const [wbsProjectId, setWbsProjectId] = useState<string>(projects[0]?.id || '');
  const [wbsName, setWbsName] = useState('');
  const [wbsDuration, setWbsDuration] = useState('7');
  const [wbsWeight, setWbsWeight] = useState('20');
  const [wbsAssigned, setWbsAssigned] = useState<string>(String(currentUser?.id || users[0]?.id || ''));

  // Quick Project Details Form State (Team, Risk, Status, Delay)
  const [detProjectId, setDetProjectId] = useState<string>(projects[0]?.id || '');
  const [detTab, setDetTab] = useState<'team' | 'risk' | 'status' | 'delay'>('team');
  const [detSelectedTeam, setDetSelectedTeam] = useState<number[]>([]);
  const [detRiskDesc, setDetRiskDesc] = useState('');
  const [detRiskProb, setDetRiskProb] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [detRiskImpact, setDetRiskImpact] = useState<'Low' | 'Medium' | 'High'>('High');
  const [detRiskPlan, setDetRiskPlan] = useState('');
  const [detStatusDesc, setDetStatusDesc] = useState('');
  const [detStatusDate, setDetStatusDate] = useState(getISODateString());
  const [detDelayDesc, setDetDelayDesc] = useState('');
  const [detDelayDate, setDetDelayDate] = useState(getISODateString());

  // Draggable Floating Icon State
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ pageX: 0, pageY: 0, initialX: 0, initialY: 0 });
  const hasMovedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const pageX = 'touches' in e ? e.touches[0].pageX : (e as MouseEvent).pageX;
      const pageY = 'touches' in e ? e.touches[0].pageY : (e as MouseEvent).pageY;

      const dx = pageX - dragStartRef.current.pageX;
      const dy = pageY - dragStartRef.current.pageY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true;
        setIsDragging(true);
      }

      const btnWidth = 180;
      const btnHeight = 50;
      const newX = Math.max(10, Math.min(window.innerWidth - btnWidth, dragStartRef.current.initialX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - btnHeight, dragStartRef.current.initialY + dy));

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setFabPos({ x: newX, y: newY });
      });
    };

    const handlePointerUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        setIsDragging(false);
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, []);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  useEffect(() => {
    if (projects.length > 0) {
      if (!wbsProjectId) setWbsProjectId(projects[0].id);
      if (!detProjectId) setDetProjectId(projects[0].id);
    }
  }, [projects]);

  // Helper functions
  const getManagerName = (id: string | null | undefined) => {
    if (!id) return 'تعیین نشده';
    const u = users.find(user => String(user.id) === String(id));
    return u ? u.username : `کاربر ${id}`;
  };

  const getStatusFa = (status: string) => {
    switch (status) {
      case 'In Progress': return 'در حال اجرا';
      case 'Planning': return 'در حال برنامه‌ریزی';
      case 'On Hold': return 'معلق';
      case 'Completed': return 'تکمیل شده';
      default: return status || 'نامشخص';
    }
  };

  // Suggested Prompts
  const suggestedPrompts = [
    "📊 گزارش تفکیک نوع (آبشاری / چابک / اقدام)",
    "➕ تعریف پروژه آبشاری جدید",
    "⚡ تعریف پروژه چابک جدید",
    "📝 ایجاد اقدام اجرایی جدید",
    "📋 تعریف WBS و فعالیت‌ها",
    "🛡️ ثبت تیم، ریسک و تاخیر پروژه"
  ];

  // Helper to execute Project Creation from actionData
  const executeProjectCreation = (actionData: any) => {
    const pType: 'waterfall' | 'agile' = actionData.type === 'agile' ? 'agile' : 'waterfall';
    const newProj: Project = {
      id: String(Date.now()),
      type: pType,
      approvalStatus: 'Approved',
      name: actionData.name || 'پروژه جدید',
      owningUnit: actionData.owningUnit || owningUnits[0] || 'فناوری اطلاعات',
      projectManagerId: actionData.projectManagerId ? String(actionData.projectManagerId) : (currentUser?.id || users[0]?.id || 1),
      startDate: actionData.startDate || getISODateString(),
      endDate: actionData.endDate || getISODateString(),
      status: 'In Progress',
      description: actionData.description || actionData.name || 'پروژه ثبت شده توسط هوش مصنوعی',
      goal: actionData.goal || actionData.name || '',
      requirements: actionData.requirements || 'الزامات اولیه پروژه',
      cost: Number(toEnglishDigits(actionData.cost)) || 0,
      calendarId: '1',
      weightingType: actionData.weightingType || 'manual',
      teamMemberIds: Array.isArray(actionData.teamMemberIds) ? actionData.teamMemberIds.map(String) : [currentUser?.id || 1],
      risks: Array.isArray(actionData.risks) ? actionData.risks.map((r: any, idx: number) => ({
        id: Date.now() + idx,
        description: typeof r === 'string' ? r : (r.description || 'ریسک شناسایی شده'),
        probability: r.probability || 'Medium',
        impact: r.impact || 'High',
        responsePlan: r.responsePlan || 'مدیریت و پایش مستمر',
        assignedTo: r.assignedTo || 'مدیر پروژه'
      })) : [],
      statusUpdates: Array.isArray(actionData.statusUpdates) ? actionData.statusUpdates.map((s: any, idx: number) => ({
        id: Date.now() + idx,
        description: typeof s === 'string' ? s : (s.description || 'شروع فاز اجرایی پروژه'),
        date: s.date || getISODateString()
      })) : [],
      delayReasons: Array.isArray(actionData.delayReasons) ? actionData.delayReasons.map((d: any, idx: number) => ({
        id: Date.now() + idx,
        description: typeof d === 'string' ? d : (d.description || 'تاخیر در تامین منابع'),
        date: d.date || getISODateString()
      })) : [],
      documents: [],
      schedule: pType === 'waterfall' ? (Array.isArray(actionData.schedule) && actionData.schedule.length > 0 ? actionData.schedule.map((act: any, idx: number) => ({
        id: `act-${Date.now()}-${idx}`,
        name: act.name || 'فعالیت WBS',
        duration: Number(act.duration) || 5,
        weight: Number(act.weight) || 20,
        assignedToId: act.assignedToId ? String(act.assignedToId) : (currentUser?.id || 1),
        actualProgress: 0,
        parentId: act.parentId || null,
        prerequisiteId: act.prerequisiteId || null
      })) : [
        { id: `act-${Date.now()}-1`, name: 'امکان‌سنجی و منشور پروژه', duration: 5, weight: 20, assignedToId: currentUser?.id || 1, actualProgress: 0, parentId: null, prerequisiteId: null },
        { id: `act-${Date.now()}-2`, name: 'طراحی و پیاده‌سازی زیرساخت', duration: 10, weight: 50, assignedToId: currentUser?.id || 1, actualProgress: 0, parentId: null, prerequisiteId: null },
        { id: `act-${Date.now()}-3`, name: 'تست، تحویل و راه‌اندازی', duration: 5, weight: 30, assignedToId: currentUser?.id || 1, actualProgress: 0, parentId: null, prerequisiteId: null }
      ]) : [],
      kanbanTasks: pType === 'agile' ? (Array.isArray(actionData.kanbanTasks) && actionData.kanbanTasks.length > 0 ? actionData.kanbanTasks.map((kt: any, idx: number) => ({
        id: Date.now() + idx,
        description: kt.description || kt.title || 'تسک چابک',
        status: kt.status || 'To-Do',
        priority: kt.priority || 'Medium',
        assignedToId: kt.assignedToId ? String(kt.assignedToId) : (currentUser?.id || 1),
        dueDate: kt.dueDate || getISODateString()
      })) : [
        { id: Date.now() + 1, description: 'تحلیل استوری‌ها و نیازمندی‌های اسپرینت', status: 'To-Do', priority: 'High', assignedToId: currentUser?.id || 1, dueDate: getISODateString() },
        { id: Date.now() + 2, description: 'توسعه فاز ۱ اسپرینت', status: 'To-Do', priority: 'Medium', assignedToId: currentUser?.id || 1, dueDate: getISODateString() }
      ]) : []
    };

    if (onAddProject) {
      onAddProject(newProj);
    }
    return newProj;
  };

  // Helper to execute Action Item creation
  const executeActionCreation = (actionData: any) => {
    const newAct: ActionItem = {
      id: Date.now(),
      title: actionData.title || 'اقدام جدید',
      description: actionData.description || actionData.title || 'اقدام ثبت شده توسط دستیار هوشمند',
      responsibleUserId: actionData.responsibleUserId ? String(actionData.responsibleUserId) : (currentUser?.id || users[0]?.id || 1),
      approver1Id: '1',
      status: actionData.status || 'Planning',
      calendarId: '1',
      startDate: actionData.startDate || getISODateString(),
      endDate: actionData.endDate || getISODateString(),
      owningUnit: actionData.owningUnit || owningUnits[0] || 'سازمانی',
      projectId: actionData.projectId ? String(actionData.projectId) : undefined
    };

    if (onAddAction) {
      onAddAction(newAct);
    }
    return newAct;
  };

  // Local fallback parser with comprehensive multi-attribute filtering, grouping, and sorting
  const generateLocalFallbackResponse = (query: string): ChatMessage => {
    const q = query.trim().toLowerCase();
    const nowStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    // Check if user requested creation locally
    if (q.includes('پروژه') && (q.includes('بساز') || q.includes('تعریف') || q.includes('ایجاد'))) {
      const isAgile = q.includes('چابک') || q.includes('agile');
      const nameMatch = query.match(/به نام ["'«](.*?)["'»]/) || query.match(/نام ["'«](.*?)["'»]/) || query.match(/پروژه (.*?) (بساز|ایجاد|تعریف)/);
      const projTitle = nameMatch ? nameMatch[1] : 'پروژه هوشمند جدید';

      const createdProj = executeProjectCreation({
        name: projTitle,
        type: isAgile ? 'agile' : 'waterfall',
        owningUnit: owningUnits[0] || 'فناوری اطلاعات',
        goal: `هدف پروژه ${projTitle}`,
        description: `شرح منشور پروژه ${projTitle}`
      });

      return {
        id: Date.now().toString(),
        sender: 'ai',
        text: `✅ **پروژه ${isAgile ? 'چابک (Agile)' : 'آبشاری (Waterfall)'} با عنوان "${createdProj.name}" با موفقیت تعریف گردید.**`,
        createdEntity: {
          type: 'project',
          name: createdProj.name,
          details: `نوع: ${isAgile ? 'چابک' : 'آبشاری'} | متولی: ${createdProj.owningUnit} | مدیر: ${getManagerName(createdProj.projectManagerId)}`,
          linkPage: `create_${createdProj.type}_details`,
          linkContext: { project: createdProj, type: createdProj.type }
        },
        timestamp: nowStr
      };
    }

    if (q.includes('اقدام') && (q.includes('بساز') || q.includes('تعریف') || q.includes('ایجاد') || q.includes('ثبت'))) {
      const nameMatch = query.match(/با عنوان ["'«](.*?)["'»]/) || query.match(/عنوان ["'«](.*?)["'»]/) || query.match(/اقدام (.*?) (بساز|ایجاد|تعریف|ثبت)/);
      const actTitleText = nameMatch ? nameMatch[1] : 'اقدام جدید سیستم';

      const createdAct = executeActionCreation({
        title: actTitleText,
        description: `شرح اقدام ${actTitleText}`
      });

      return {
        id: Date.now().toString(),
        sender: 'ai',
        text: `✅ **اقدام اجرایی جدید با عنوان "${createdAct.title}" با موفقیت در سیستم ثبت شد.**`,
        createdEntity: {
          type: 'action',
          name: createdAct.title,
          details: `مسئول: ${getManagerName(createdAct.responsibleUserId)} | واحد: ${createdAct.owningUnit} | مهلت: ${createdAct.endDate}`,
          linkPage: 'main'
        },
        timestamp: nowStr
      };
    }

    // Comprehensive Filtering Engine
    let typeFilter: 'waterfall' | 'agile' | 'action' | null = null;
    if (q.includes('آبشاری') || q.includes('waterfall')) typeFilter = 'waterfall';
    else if (q.includes('چابک') || q.includes('agile')) typeFilter = 'agile';
    else if (q.includes('اقدام') || q.includes('action')) typeFilter = 'action';

    let statusFilter: string | null = null;
    if (q.includes('در حال اجرا') || q.includes('اجرا') || q.includes('فعال') || q.includes('جاری')) statusFilter = 'In Progress';
    else if (q.includes('تکمیل') || q.includes('پایان') || q.includes('انجام شده') || q.includes('خاتمه')) statusFilter = 'Completed';
    else if (q.includes('برنامه‌ریزی') || q.includes('برنامه ریزی')) statusFilter = 'Planning';
    else if (q.includes('معلق') || q.includes('متوقف')) statusFilter = 'On Hold';

    let unitFilter: string | null = null;
    for (const u of owningUnits) {
      if (u && q.includes(u.toLowerCase())) {
        unitFilter = u;
        break;
      }
    }
    if (!unitFilter) {
      for (const p of projects) {
        if (p.owningUnit && q.includes(p.owningUnit.toLowerCase())) {
          unitFilter = p.owningUnit;
          break;
        }
      }
    }

    let managerFilter: string | null = null;
    for (const u of users) {
      if (u.username && q.includes(u.username.toLowerCase())) {
        managerFilter = u.username;
        break;
      }
    }

    // Check if query is explicitly asking for Actions List
    const isActionListQuery = (typeFilter === 'action' || q.includes('اقدام') || q.includes('action') || q.includes('کارهای اجرایی')) && (q.includes('لیست') || q.includes('فهرست') || q.includes('جدول') || q.includes('اقدامات'));

    if (isActionListQuery) {
      let filteredActions = actions.filter(a => {
        if (statusFilter && a.status !== statusFilter) return false;
        if (unitFilter && !(a.owningUnit || '').toLowerCase().includes(unitFilter.toLowerCase())) return false;
        if (managerFilter) {
          const mgr = getManagerName(a.responsibleUserId).toLowerCase();
          if (!mgr.includes(managerFilter.toLowerCase())) return false;
        }
        return true;
      });

      const actionAppliedFilters: string[] = [];
      if (statusFilter) actionAppliedFilters.push(`وضعیت: ${getStatusFa(statusFilter)}`);
      if (unitFilter) actionAppliedFilters.push(`واحد: ${unitFilter}`);
      if (managerFilter) actionAppliedFilters.push(`مسئول: ${managerFilter}`);

      const actionFilterText = actionAppliedFilters.length > 0
        ? ` (بر اساس فیلترهای: **${actionAppliedFilters.join(' | ')}**)`
        : '';

      const actionTable = filteredActions.length > 0 ? {
        headers: ['#', 'عنوان اقدام', 'مسئول', 'واحد متولی', 'وضعیت', 'مهلت', 'مشاهده'],
        rows: filteredActions.map((a, idx) => [
          String(idx + 1),
          a.title,
          getManagerName(a.responsibleUserId),
          a.owningUnit || 'سازمانی',
          getStatusFa(a.status),
          formatToJalali(a.endDate),
          `ACTION_ID:${a.id}`
        ])
      } : null;

      const summaryText = filteredActions.length > 0
        ? `تعداد **${filteredActions.length}** اقدام اجرایی پیدا شد${actionFilterText}:`
        : `هیچ اقدام اجرایی با شرایط درخواستی شما یافت نشد${actionFilterText}.`;

      return {
        id: Date.now().toString(),
        sender: 'ai',
        text: summaryText,
        chartType: 'none',
        chartTitle: '',
        chartData: [],
        tableData: actionTable,
        timestamp: nowStr
      };
    }

    // Perform Filter on Projects (only approved projects unless explicit unapproved requested)
    const isExplicitUnapproved = q.includes('در انتظار تایید') || q.includes('پیش‌نویس') || q.includes('تایید نشده') || q.includes('رد شده');
    let filtered = projects.filter(p => {
      if (!isExplicitUnapproved && p.approvalStatus && p.approvalStatus !== 'Approved') return false;
      if (typeFilter && typeFilter !== 'action' && p.type !== typeFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (unitFilter && !(p.owningUnit || '').toLowerCase().includes(unitFilter.toLowerCase())) return false;
      if (managerFilter) {
        const mgr = getManagerName(p.projectManagerId).toLowerCase();
        if (!mgr.includes(managerFilter.toLowerCase())) return false;
      }
      return true;
    });

    // Check Sorting
    if (q.includes('پیشرفت')) {
      filtered.sort((a, b) => (b.actualProgress || 0) - (a.actualProgress || 0));
    } else if (q.includes('تاریخ شروع') || q.includes('شروع')) {
      filtered.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    } else if (q.includes('هزینه') || q.includes('بودجه')) {
      filtered.sort((a, b) => (b.cost || 0) - (a.cost || 0));
    }

    // Check Grouping
    const isGroupType = q.includes('نوع') || q.includes('متدولوژی') || q.includes('آبشاری') || q.includes('چابک') || (typeFilter === 'action' && !q.includes('لیست اقدامات'));
    const isGroupUnit = q.includes('واحد') || q.includes('متولی');
    const isGroupStatus = q.includes('وضعیت');
    const isGroupManager = q.includes('مدیر');

    // Check Intent: List vs Chart
    const hasListWord = q.includes('لیست') || q.includes('فهرست') || q.includes('جدول');
    const hasChartWord = q.includes('نمودار') || q.includes('چارت') || q.includes('گراف') || q.includes('پای') || q.includes('میله');

    const isOnlyList = hasListWord && !hasChartWord;
    const isOnlyChart = hasChartWord && !hasListWord;

    let chartType: 'pie' | 'bar' | 'none' = 'pie';
    if (q.includes('میله') || q.includes('بار') || q.includes('bar')) {
      chartType = 'bar';
    } else if (q.includes('پای') || q.includes('دایره') || q.includes('pie')) {
      chartType = 'pie';
    }

    let chartTitle = 'گزارش پروژه‌ها';
    let chartData: Array<{ name: string; value: number; fill?: string }> = [];

    if (isGroupType) {
      chartTitle = 'توزیع اقلام بر اساس نوع (آبشاری / چابک / اقدام)';
      const waterfallCount = projects.filter(p => p.type === 'waterfall').length;
      const agileCount = projects.filter(p => p.type === 'agile').length;
      const actionCount = actions.length;
      chartData = [
        { name: 'آبشاری', value: waterfallCount, fill: '#3b82f6' },
        { name: 'چابک', value: agileCount, fill: '#10b981' },
        { name: 'اقدام', value: actionCount, fill: '#f59e0b' }
       ].filter(item => item.value > 0);
    } else if (isGroupUnit) {
      chartTitle = 'توزیع پروژه‌ها بر اساس واحد متولی';
      const counts: Record<string, number> = {};
      filtered.forEach(p => {
        const u = p.owningUnit || 'سایر';
        counts[u] = (counts[u] || 0) + 1;
      });
      chartData = Object.entries(counts).map(([name, value], i) => ({
        name,
        value,
        fill: DEFAULT_COLORS[i % DEFAULT_COLORS.length]
      }));
    } else if (isGroupManager) {
      chartTitle = 'توزیع پروژه‌ها بر اساس مدیر پروژه';
      const counts: Record<string, number> = {};
      filtered.forEach(p => {
        const m = getManagerName(p.projectManagerId);
        counts[m] = (counts[m] || 0) + 1;
      });
      chartData = Object.entries(counts).map(([name, value], i) => ({
        name,
        value,
        fill: DEFAULT_COLORS[i % DEFAULT_COLORS.length]
      }));
    } else {
      chartTitle = 'توزیع پروژه‌ها بر اساس وضعیت';
      chartData = [
        { name: 'در حال اجرا', value: filtered.filter(p => p.status === 'In Progress').length, fill: '#3b82f6' },
        { name: 'تکمیل شده', value: filtered.filter(p => p.status === 'Completed').length, fill: '#10b981' },
        { name: 'برنامه‌ریزی', value: filtered.filter(p => p.status === 'Planning').length, fill: '#f59e0b' },
        { name: 'معلق', value: filtered.filter(p => p.status === 'On Hold').length, fill: '#8b5cf6' }
      ].filter(item => item.value > 0);
    }

    const appliedFiltersDesc: string[] = [];
    if (typeFilter) appliedFiltersDesc.push(`نوع: ${typeFilter === 'agile' ? 'چابک' : (typeFilter === 'waterfall' ? 'آبشاری' : 'اقدام')}`);
    if (statusFilter) appliedFiltersDesc.push(`وضعیت: ${getStatusFa(statusFilter)}`);
    if (unitFilter) appliedFiltersDesc.push(`واحد: ${unitFilter}`);
    if (managerFilter) appliedFiltersDesc.push(`مدیر: ${managerFilter}`);

    const filterInfoText = appliedFiltersDesc.length > 0 
      ? ` (بر اساس فیلترهای: **${appliedFiltersDesc.join(' | ')}**)` 
      : '';

    let summaryText = '';
    if (isGroupType) {
      const wCount = projects.filter(p => p.type === 'waterfall').length;
      const aCount = projects.filter(p => p.type === 'agile').length;
      const actCount = actions.length;
      summaryText = `گزارش کلی اقلام به تفکیک نوع شامل **${wCount}** پروژه آبشاری، **${aCount}** پروژه چابک و **${actCount}** اقدام اجرایی است${filterInfoText}:`;
    } else {
      summaryText = filtered.length > 0
        ? `تعداد **${filtered.length}** پروژه پیدا شد${filterInfoText}:`
        : `هیچ پروژه‌ای مطابق با شرایط درخواستی شما یافت نشد${filterInfoText}.`;
    }

    const projectTable = filtered.length > 0 ? {
      headers: ['#', 'نام پروژه', 'داشبورد'],
      rows: filtered.map((p, idx) => [
        String(idx + 1),
        p.name,
        `PROJECT_ID:${p.id}`
      ])
    } : null;

    return {
      id: Date.now().toString(),
      sender: 'ai',
      text: summaryText,
      chartType: (filtered.length > 0 && !isOnlyList) ? chartType : 'none',
      chartTitle: (filtered.length > 0 && !isOnlyList) ? chartTitle : '',
      chartData: (filtered.length > 0 && !isOnlyList) ? chartData : [],
      tableData: isOnlyChart ? null : projectTable,
      timestamp: nowStr
    };

  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query) return;

    // Check if user pressed prompt for opening modal forms directly
    if (query === '➕ تعریف پروژه آبشاری جدید' || query === '➕ تعریف پروژه (آبشاری / چابک)') {
      setProjType('waterfall');
      setActiveModal('project');
      setInputMessage('');
      return;
    }
    if (query === '⚡ تعریف پروژه چابک جدید') {
      setProjType('agile');
      setActiveModal('project');
      setInputMessage('');
      return;
    }
    if (query === '📝 ایجاد اقدام اجرایی جدید' || query === '📝 تعریف اقدام اجرایی') {
      setActiveModal('action');
      setInputMessage('');
      return;
    }
    if (query === '📋 تعریف WBS و فعالیت‌ها' || query === '📋 تعریف WBS / فعالیت') {
      setActiveModal('activities');
      setInputMessage('');
      return;
    }
    if (query === '🛡️ ثبت تیم، ریسک و تاخیر پروژه' || query === '👥 تیم، ریسک، وضعیت و تاخیر') {
      setActiveModal('project_details');
      setInputMessage('');
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    const dbSummary = {
      projects: projects.map(p => {
        const mgrName = getManagerName(p.projectManagerId);
        const statusFaMap: Record<string, string> = {
          'In Progress': 'در حال اجرا',
          'Completed': 'تکمیل شده',
          'Planning': 'در حال برنامه‌ریزی',
          'On Hold': 'معلق'
        };
        const typeFaMap: Record<string, string> = {
          'waterfall': 'آبشاری',
          'agile': 'چابک'
        };
        const approvalFaMap: Record<string, string> = {
          'Approved': 'تایید شده',
          'Pending Approval': 'در انتظار تایید',
          'Draft': 'پیش‌نویس',
          'Rejected': 'رد شده'
        };
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          typeFa: typeFaMap[p.type] || p.type,
          status: p.status,
          statusFa: statusFaMap[p.status] || p.status,
          approvalStatus: p.approvalStatus || 'Approved',
          approvalStatusFa: approvalFaMap[p.approvalStatus || 'Approved'] || 'تایید شده',
          owningUnit: p.owningUnit || 'تعیین نشده',
          projectManagerId: p.projectManagerId,
          managerName: mgrName,
          startDate: p.startDate,
          startDateShamsi: formatToJalali(p.startDate),
          endDate: p.endDate,
          endDateShamsi: formatToJalali(p.endDate),
          cost: p.cost || 0,
          actualProgress: p.actualProgress || 0,
          goal: p.goal || '',
          description: p.description || '',
          teamMembersCount: (p.teamMemberIds || []).length,
          risksCount: (p.risks || []).length,
          delayReasonsCount: (p.delayReasons || []).length,
          statusUpdatesCount: (p.statusUpdates || []).length,
          activitiesCount: p.type === 'waterfall' ? (p.schedule || []).length : (p.kanbanTasks || []).length
        };
      }),
      actions: actions.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        status: a.status,
        statusFa: a.status === 'Completed' ? 'تکمیل شده' : (a.status === 'In Progress' ? 'در حال اجرا' : (a.status === 'On Hold' ? 'معلق' : 'برنامه‌ریزی')),
        owningUnit: a.owningUnit || 'سازمانی',
        responsibleUserId: a.responsibleUserId,
        responsibleUserName: getManagerName(a.responsibleUserId),
        startDate: a.startDate,
        startDateShamsi: formatToJalali(a.startDate),
        endDate: a.endDate,
        endDateShamsi: formatToJalali(a.endDate),
        projectId: a.projectId
      })),
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role
      }))
    };

    try {
      const historyForApi = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        content: m.text
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyForApi,
          dbSummary
        })
      });

      if (!res.ok) throw new Error('Network response not ok');

      const data = await res.json();
      if (data.success) {
        let createdEntity: ChatMessage['createdEntity'] = undefined;

        // Perform entity creation actions if requested by AI
        if (data.actionToPerform === 'CREATE_PROJECT' && data.actionData) {
          const createdProj = executeProjectCreation(data.actionData);
          createdEntity = {
            type: 'project',
            name: createdProj.name,
            details: `نوع: ${createdProj.type === 'agile' ? 'چابک' : 'آبشاری'} | متولی: ${createdProj.owningUnit} | مدیر: ${getManagerName(createdProj.projectManagerId)}`,
            linkPage: `create_${createdProj.type}_details`,
            linkContext: { project: createdProj, type: createdProj.type }
          };
        } else if (data.actionToPerform === 'CREATE_ACTION' && data.actionData) {
          const createdAct = executeActionCreation(data.actionData);
          createdEntity = {
            type: 'action',
            name: createdAct.title,
            details: `مسئول: ${getManagerName(createdAct.responsibleUserId)} | واحد: ${createdAct.owningUnit} | مهلت: ${createdAct.endDate}`,
            linkPage: 'main'
          };
        } else if (data.actionToPerform === 'ADD_ACTIVITIES' && data.actionData) {
          const targetProj = projects.find(p => String(p.id) === String(data.actionData.projectId)) || projects.find(p => p.name.includes(data.actionData.projectName || ''));
          if (targetProj && onUpdateProject) {
            let updatedProj = { ...targetProj };
            if (targetProj.type === 'waterfall' && Array.isArray(data.actionData.schedule)) {
              const newActivities: ProjectActivity[] = data.actionData.schedule.map((act: any, idx: number) => ({
                id: `act-${Date.now()}-${idx}`,
                name: act.name || 'فعالیت WBS',
                duration: Number(act.duration) || 5,
                weight: Number(act.weight) || 10,
                assignedToId: act.assignedToId ? String(act.assignedToId) : (currentUser?.id || 1),
                actualProgress: 0,
                parentId: null,
                prerequisiteId: null
              }));
              updatedProj.schedule = [...(updatedProj.schedule || []), ...newActivities];
            } else if (targetProj.type === 'agile' && Array.isArray(data.actionData.kanbanTasks)) {
              const newTasks: KanbanTask[] = data.actionData.kanbanTasks.map((kt: any, idx: number) => ({
                id: Date.now() + idx,
                description: kt.description || kt.title || 'تسک چابک',
                status: kt.status || 'To-Do',
                priority: kt.priority || 'Medium',
                assignedToId: kt.assignedToId ? String(kt.assignedToId) : (currentUser?.id || 1),
                dueDate: kt.dueDate || getISODateString()
              }));
              updatedProj.kanbanTasks = [...(updatedProj.kanbanTasks || []), ...newTasks];
            }
            onUpdateProject(updatedProj);
            createdEntity = {
              type: 'activities',
              name: targetProj.name,
              details: `فعالیت‌های جدید با موفقیت به ساختار شکست پروژه اضافه گردید.`,
              linkPage: `create_${targetProj.type}_details`,
              linkContext: { project: updatedProj, type: targetProj.type }
            };
          }
        } else if (data.actionToPerform === 'ADD_PROJECT_DETAILS' && data.actionData) {
          const targetProj = projects.find(p => String(p.id) === String(data.actionData.projectId)) || projects[0];
          if (targetProj && onUpdateProject) {
            let updatedProj = { ...targetProj };
            if (Array.isArray(data.actionData.teamMemberIds)) {
              updatedProj.teamMemberIds = Array.from(new Set([...updatedProj.teamMemberIds, ...data.actionData.teamMemberIds.map(String)]));
            }
            if (Array.isArray(data.actionData.risks)) {
              const newRisks: ProjectRisk[] = data.actionData.risks.map((r: any, idx: number) => ({
                id: Date.now() + idx,
                description: typeof r === 'string' ? r : r.description,
                probability: r.probability || 'Medium',
                impact: r.impact || 'High',
                responsePlan: r.responsePlan || 'پایش',
                assignedTo: 'مدیر پروژه'
              }));
              updatedProj.risks = [...(updatedProj.risks || []), ...newRisks];
            }
            if (Array.isArray(data.actionData.statusUpdates)) {
              const newStatus: ProjectStatusUpdate[] = data.actionData.statusUpdates.map((s: any, idx: number) => ({
                id: Date.now() + idx,
                description: typeof s === 'string' ? s : s.description,
                date: s.date || getISODateString()
              }));
              updatedProj.statusUpdates = [...(updatedProj.statusUpdates || []), ...newStatus];
            }
            if (Array.isArray(data.actionData.delayReasons)) {
              const newDelays: ProjectDelayReason[] = data.actionData.delayReasons.map((d: any, idx: number) => ({
                id: Date.now() + idx,
                description: typeof d === 'string' ? d : d.description,
                date: d.date || getISODateString()
              }));
              updatedProj.delayReasons = [...(updatedProj.delayReasons || []), ...newDelays];
            }
            onUpdateProject(updatedProj);
            createdEntity = {
              type: 'project_details',
              name: targetProj.name,
              details: `اطلاعات جدید (تیم/ریسک/وضعیت/تاخیر) به پروژه افزوده شد.`,
              linkPage: `create_${targetProj.type}_details`,
              linkContext: { project: updatedProj, type: targetProj.type }
            };
          }
        }

        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: data.reply || 'پاسخ هوش مصنوعی دریافت شد.',
          chartType: data.chartType || 'none',
          chartTitle: data.chartTitle || '',
          chartData: data.chartData || [],
          tableData: data.tableData || null,
          createdEntity,
          timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || 'خطا در هوش مصنوعی');
      }
    } catch (err) {
      console.warn('AI chat error, using local fallback:', err);
      setTimeout(() => {
        const fallbackMsg = generateLocalFallbackResponse(query);
        setMessages(prev => [...prev, fallbackMsg]);
      }, 300);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Submit Handlers for Interactive Chatbot Forms
  const handleSaveProjectForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;

    const createdProj = executeProjectCreation({
      name: projName,
      type: projType,
      owningUnit: projUnit,
      projectManagerId: projManagerId,
      startDate: projStartDate,
      endDate: projEndDate,
      cost: projCost,
      goal: projGoal,
      description: projDescription,
      weightingType: projWeightingType
    });

    setActiveModal('none');
    setProjName('');
    setProjGoal('');
    setProjDescription('');

    const nowStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'ai',
      text: `🎉 **پروژه جدید ${projType === 'agile' ? 'چابک' : 'آبشاری'} با موفقیت تعریف گردید.**`,
      createdEntity: {
        type: 'project',
        name: createdProj.name,
        details: `مدیر پروژه: ${getManagerName(createdProj.projectManagerId)} | واحد: ${createdProj.owningUnit} | بودجه: ${createdProj.cost || 0}`,
        linkPage: `create_${createdProj.type}_details`,
        linkContext: { project: createdProj, type: createdProj.type }
      },
      timestamp: nowStr
    }]);
  };

  const handleSaveActionForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim()) return;

    const createdAct = executeActionCreation({
      title: actTitle,
      description: actDesc,
      responsibleUserId: actUser,
      owningUnit: actUnit,
      startDate: actStart,
      endDate: actEnd,
      projectId: actProjectId,
      status: actStatus
    });

    setActiveModal('none');
    setActTitle('');
    setActDesc('');

    const nowStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'ai',
      text: `🎉 **اقدام اجرایی جدید با موفقیت ثبت گردید.**`,
      createdEntity: {
        type: 'action',
        name: createdAct.title,
        details: `مسئول: ${getManagerName(createdAct.responsibleUserId)} | مهلت: ${createdAct.endDate} | واحد: ${createdAct.owningUnit}`,
        linkPage: 'define_action',
        linkContext: { action: createdAct }
      },
      timestamp: nowStr
    }]);
  };

  const handleSaveWbsForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wbsName.trim() || !wbsProjectId) return;

    const targetProj = projects.find(p => p.id === wbsProjectId);
    if (!targetProj || !onUpdateProject) return;

    let updatedProj = { ...targetProj };
    if (targetProj.type === 'waterfall') {
      const newAct: ProjectActivity = {
        id: `act-${Date.now()}`,
        name: wbsName,
        duration: Number(toEnglishDigits(wbsDuration)) || 5,
        weight: Number(toEnglishDigits(wbsWeight)) || 10,
        assignedToId: wbsAssigned,
        actualProgress: 0,
        parentId: null,
        prerequisiteId: null
      };
      updatedProj.schedule = [...(updatedProj.schedule || []), newAct];
    } else {
      const newTask: KanbanTask = {
        id: Date.now(),
        description: wbsName,
        status: 'To-Do',
        priority: 'Medium',
        assignedToId: wbsAssigned,
        dueDate: getISODateString()
      };
      updatedProj.kanbanTasks = [...(updatedProj.kanbanTasks || []), newTask];
    }

    onUpdateProject(updatedProj);
    setActiveModal('none');
    setWbsName('');

    const nowStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'ai',
      text: `📋 **فعالیت/WBS جدید به پروژه "${targetProj.name}" اضافه شد.**`,
      createdEntity: {
        type: 'activities',
        name: wbsName,
        details: `پروژه: ${targetProj.name} | مسئول: ${getManagerName(wbsAssigned)}`,
        linkPage: `create_${targetProj.type}_details`,
        linkContext: { project: updatedProj, type: targetProj.type }
      },
      timestamp: nowStr
    }]);
  };

  const handleSaveDetailsForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detProjectId) return;

    const targetProj = projects.find(p => p.id === detProjectId);
    if (!targetProj || !onUpdateProject) return;

    let updatedProj = { ...targetProj };
    let summaryText = '';

    if (detTab === 'team') {
      updatedProj.teamMemberIds = Array.from(new Set([...updatedProj.teamMemberIds, ...detSelectedTeam]));
      summaryText = `اعضای جدید تیم به پروژه ${targetProj.name} افزوده شدند.`;
    } else if (detTab === 'risk') {
      if (!detRiskDesc.trim()) return;
      const newRisk: ProjectRisk = {
        id: String(Date.now()),
        description: detRiskDesc,
        probability: detRiskProb,
        impact: detRiskImpact,
        responsePlan: detRiskPlan || 'پایش مستمر',
        assignedTo: 'مدیر پروژه'
      };
      updatedProj.risks = [...(updatedProj.risks || []), newRisk];
      summaryText = `ریسک جدید "${detRiskDesc}" ثبت شد.`;
      setDetRiskDesc('');
      setDetRiskPlan('');
    } else if (detTab === 'status') {
      if (!detStatusDesc.trim()) return;
      const newStatus: ProjectStatusUpdate = {
        id: String(Date.now()),
        description: detStatusDesc,
        date: detStatusDate
      };
      updatedProj.statusUpdates = [...(updatedProj.statusUpdates || []), newStatus];
      summaryText = `آخرین وضعیت پروژه ثبت شد: "${detStatusDesc}"`;
      setDetStatusDesc('');
    } else if (detTab === 'delay') {
      if (!detDelayDesc.trim()) return;
      const newDelay: ProjectDelayReason = {
        id: String(Date.now()),
        description: detDelayDesc,
        date: detDelayDate
      };
      updatedProj.delayReasons = [...(updatedProj.delayReasons || []), newDelay];
      summaryText = `علت تاخیر ثبت شد: "${detDelayDesc}"`;
      setDetDelayDesc('');
    }

    onUpdateProject(updatedProj);
    setActiveModal('none');

    const nowStr = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'ai',
      text: `🛡️ **اطلاعات پروژه با موفقیت به روز گردید.**`,
      createdEntity: {
        type: 'project_details',
        name: targetProj.name,
        details: summaryText,
        linkPage: `create_${targetProj.type}_details`,
        linkContext: { project: updatedProj, type: targetProj.type }
      },
      timestamp: nowStr
    }]);
  };

  const renderChart = (msg: ChatMessage) => {
    if (!msg.chartData || msg.chartData.length === 0 || msg.chartType === 'none') return null;

    return (
      <div style={{
        marginTop: '0.75rem',
        padding: '0.75rem',
        background: isDark ? '#0f172a' : '#ffffff',
        borderRadius: '10px',
        border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {msg.chartTitle && (
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: isDark ? '#f1f5f9' : '#1e293b',
            marginBottom: '0.5rem',
            textAlign: 'center',
            borderBottom: isDark ? '1px solid #334155' : '1px solid #f1f5f9',
            paddingBottom: '0.4rem'
          }}>
            {msg.chartTitle}
          </div>
        )}

        <div style={{ width: '100%', height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            {msg.chartType === 'pie' ? (
              <PieChart>
                <Pie
                  data={msg.chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={65}
                  innerRadius={22}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ value }) => toPersianDigits(value)}
                  labelLine={false}
                >
                  {msg.chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.fill || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`${toPersianDigits(val)} مورد`, 'تعداد']} contentStyle={{ borderRadius: '8px', fontSize: '0.8rem', direction: 'rtl', backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '6px', color: isDark ? '#cbd5e1' : '#475569' }} />
              </PieChart>
            ) : (
              <BarChart layout="vertical" data={msg.chartData} margin={{ top: 10, right: 35, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis type="number" tickFormatter={(val: any) => toPersianDigits(val)} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} width={80} interval={0} />
                <Tooltip formatter={(val: any) => [`${toPersianDigits(val)} مورد`, 'تعداد']} contentStyle={{ borderRadius: '8px', fontSize: '0.8rem', direction: 'rtl', backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '6px', color: isDark ? '#cbd5e1' : '#475569' }} />
                <Bar dataKey="value" name="تعداد" radius={[0, 6, 6, 0]} barSize={18} label={{ position: 'right', fill: isDark ? '#e2e8f0' : '#334155', fontSize: 11, fontWeight: 600, formatter: (val: any) => toPersianDigits(val) }}>
                  {msg.chartData.map((entry, index) => (
                    <Cell key={`cell-bar-${index}`} fill={entry.fill || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderTable = (msg: ChatMessage) => {
    if (!msg.tableData || !msg.tableData.headers || msg.tableData.rows.length === 0) return null;

    // Detect if this table is an action list table
    const isActionTable = msg.tableData.headers.some(h => h.includes('عنوان اقدام') || h.includes('نام اقدام') || h === 'اقدام') ||
      msg.tableData.rows.some(r => r.some(c => String(c).startsWith('ACTION_ID:')));

    let headers = msg.tableData.headers;
    let rows = msg.tableData.rows;

    if (isActionTable) {
      headers = ["#", "عنوان اقدام", "جزییات"];
      const titleColIdx = msg.tableData.headers.findIndex(h => h.includes('عنوان') || h.includes('اقدام') || h.includes('نام'));
      
      rows = msg.tableData.rows.map((row, rIdx) => {
        const actionIdCell = row.find(c => String(c).startsWith('ACTION_ID:'));
        let actionTitle = titleColIdx >= 0 && row[titleColIdx] && !String(row[titleColIdx]).startsWith('ACTION_ID:') 
          ? String(row[titleColIdx]) 
          : (row[1] && !String(row[1]).startsWith('ACTION_ID:') ? String(row[1]) : String(row[0]));
        
        let actionIdVal = actionIdCell ? String(actionIdCell) : '';
        if (!actionIdVal) {
          const matchedAct = actions.find(a => a.title === actionTitle);
          actionIdVal = matchedAct ? `ACTION_ID:${matchedAct.id}` : 'ACTION_ID:1';
        }
        return [String(rIdx + 1), actionTitle, actionIdVal];
      });
    }

    return (
      <div style={{
        marginTop: '0.75rem',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        borderRadius: '10px',
        border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
        background: isDark ? '#0f172a' : '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        maxWidth: '100%'
      }}>
        <table style={{
          width: '100%',
          fontSize: '0.78rem',
          borderCollapse: 'collapse',
          textAlign: 'right'
        }}>
          <thead>
            <tr style={{ background: isDark ? '#1e293b' : '#f1f5f9', borderBottom: isDark ? '2px solid #334155' : '2px solid #cbd5e1' }}>
              {headers.map((h, i) => {
                const isCenter = h === '#' || h === 'ردیف' || h === 'داشبورد' || h === 'مشاهده' || h === 'جزییات';
                return (
                  <th key={i} style={{
                    padding: '0.55rem 0.6rem',
                    color: isDark ? '#cbd5e1' : '#334155',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    textAlign: isCenter ? 'center' : 'right',
                    width: (h === '#' || h === 'ردیف') ? '36px' : (h === 'داشبورد' || h === 'مشاهده' || h === 'جزییات') ? '80px' : 'auto'
                  }}>
                    {toPersianDigits(h)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} style={{
                borderBottom: rIdx === rows.length - 1 ? 'none' : (isDark ? '1px solid #334155' : '1px solid #f1f5f9'),
                backgroundColor: rIdx % 2 === 1 ? (isDark ? '#141e2e' : '#fafafa') : (isDark ? '#0f172a' : '#ffffff')
              }}>
                {row.map((cell, cIdx) => {
                  const val = String(cell || '');
                  const headerName = headers[cIdx] || '';
                  let cellContent: React.ReactNode = typeof cell === 'string' || typeof cell === 'number' ? toPersianDigits(cell) : val;

                  const isActionCol = (headerName === 'مشاهده' || headerName === 'جزییات' || val.startsWith('ACTION_ID:')) && !val.startsWith('PROJECT_ID:');
                  const isDashboardCol = headerName === 'داشبورد' || val.startsWith('PROJECT_ID:');

                  if (isActionCol) {
                    const rawId = val.replace('ACTION_ID:', '').trim();
                    const act = actions.find(a => String(a.id) === rawId || a.title === row[1] || a.title === val);

                    cellContent = (
                      <button
                        title={act ? `باز کردن فرم و جزییات اقدام: ${act.title}` : 'مشاهده جزییات فرم اقدام'}
                        onClick={() => {
                          if (act && onNavigate) {
                            onNavigate('define_action', { action: act, from: 'chatbot' });
                            setIsMinimized(true);
                          } else if (onNavigate) {
                            onNavigate('define_action');
                            setIsMinimized(true);
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          padding: '0',
                          borderRadius: '6px',
                          backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
                          color: isDark ? '#34d399' : '#059669',
                          border: isDark ? '1px solid #059669' : '1px solid #a7f3d0',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>edit_note</span>
                      </button>
                    );
                  } else if (isDashboardCol) {
                    const rawId = val.replace('PROJECT_ID:', '').trim();
                    const proj = projects.find(p => String(p.id) === rawId || p.name === row[1] || p.name === val);

                    cellContent = (
                      <button
                        title={proj ? `مشاهده داشبورد پروژه ${proj.name}` : 'مشاهده داشبورد پروژه'}
                        onClick={() => {
                          if (proj && onNavigate) {
                            onNavigate('project_dashboard_details', { project: proj, from: 'chatbot' });
                            setIsMinimized(true);
                          } else if (onNavigate) {
                            onNavigate('portfolio');
                            setIsMinimized(true);
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          padding: '0',
                          borderRadius: '6px',
                          backgroundColor: isDark ? '#1e3a8a' : '#eff6ff',
                          color: isDark ? '#93c5fd' : '#2563eb',
                          border: isDark ? '1px solid #3b82f6' : '1px solid #bfdbfe',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>dashboard</span>
                      </button>
                    );
                  } else if (val === 'در حال اجرا' || val === 'In Progress') {
                    cellContent = <span style={{ background: isDark ? '#1e3a8a' : '#dbeafe', color: isDark ? '#93c5fd' : '#1e40af', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>در حال اجرا</span>;
                  } else if (val === 'تکمیل شده' || val === 'Completed') {
                    cellContent = <span style={{ background: isDark ? '#064e3b' : '#dcfce7', color: isDark ? '#6ee7b7' : '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>تکمیل شده</span>;
                  } else if (val === 'در حال برنامه‌ریزی' || val === 'Planning') {
                    cellContent = <span style={{ background: isDark ? '#78350f' : '#fef3c7', color: isDark ? '#fcd34d' : '#92400e', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>برنامه‌ریزی</span>;
                  } else if (val === 'معلق' || val === 'On Hold') {
                    cellContent = <span style={{ background: isDark ? '#581c87' : '#f3e8ff', color: isDark ? '#d8b4fe' : '#6b21a8', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>معلق</span>;
                  } else if (val === 'آبشاری') {
                    cellContent = <span style={{ background: isDark ? '#075985' : '#e0f2fe', color: isDark ? '#7dd3fc' : '#0369a1', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>آبشاری</span>;
                  } else if (val === 'چابک') {
                    cellContent = <span style={{ background: isDark ? '#065f46' : '#d1fae5', color: isDark ? '#6ee7b7' : '#065f46', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>چابک</span>;
                  } else if (val === 'اقدام') {
                    cellContent = <span style={{ background: isDark ? '#78350f' : '#fef3c7', color: isDark ? '#fcd34d' : '#b45309', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>اقدام</span>;
                  }

                  const isCenter = headerName === '#' || headerName === 'ردیف' || headerName === 'جزییات' || headerName === 'مشاهده' || isDashboardCol || isActionCol;

                  return (
                    <td key={cIdx} style={{
                      padding: '0.5rem 0.6rem',
                      color: isDark ? '#f1f5f9' : '#1e293b',
                      whiteSpace: 'nowrap',
                      textAlign: isCenter ? 'center' : 'right'
                    }}>
                      {cellContent}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCreatedEntityCard = (msg: ChatMessage) => {
    if (!msg.createdEntity) return null;
    const ent = msg.createdEntity;

    return (
      <div style={{
        marginTop: '0.65rem',
        padding: '0.75rem',
        borderRadius: '10px',
        backgroundColor: isDark ? '#064e3b' : '#f0fdf4',
        border: isDark ? '1px solid #059669' : '1px solid #bbf7d0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isDark ? '#34d399' : '#15803d', fontWeight: 700, fontSize: '0.85rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>check_circle</span>
          <span>{ent.name}</span>
        </div>
        <div style={{ fontSize: '0.78rem', color: isDark ? '#e2e8f0' : '#374151', lineHeight: '1.4' }}>
          {toPersianDigits(ent.details)}
        </div>
        {ent.linkPage && onNavigate && (
          <button
            onClick={() => onNavigate(ent.linkPage!, ent.linkContext)}
            style={{
              marginTop: '0.3rem',
              alignSelf: 'flex-start',
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              borderRadius: '6px',
              backgroundColor: isDark ? '#059669' : '#16a34a',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontWeight: 600
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>open_in_new</span>
            <span>مشاهده و مدیریت در سامانه</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          className="no-print ai-chatbot-launcher"
          onMouseDown={(e) => {
            const pageX = e.pageX;
            const pageY = e.pageY;
            const rect = e.currentTarget.getBoundingClientRect();
            draggingRef.current = true;
            hasMovedRef.current = false;
            dragStartRef.current = { pageX, pageY, initialX: rect.left, initialY: rect.top };
          }}
          onTouchStart={(e) => {
            const pageX = e.touches[0].pageX;
            const pageY = e.touches[0].pageY;
            const rect = e.currentTarget.getBoundingClientRect();
            draggingRef.current = true;
            hasMovedRef.current = false;
            dragStartRef.current = { pageX, pageY, initialX: rect.left, initialY: rect.top };
          }}
          onClick={() => {
            if (!hasMovedRef.current) {
              setIsOpen(true);
            }
          }}
          style={{
            position: 'fixed',
            left: fabPos ? `${fabPos.x}px` : '24px',
            top: fabPos ? `${fabPos.y}px` : 'auto',
            bottom: fabPos ? 'auto' : '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.75rem 1.2rem',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #4f46e5 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '9999px',
            boxShadow: isDragging 
              ? '0 16px 36px -6px rgba(37, 99, 235, 0.65), 0 8px 20px -2px rgba(0, 0, 0, 0.25)' 
              : '0 8px 25px -4px rgba(37, 99, 235, 0.45), 0 4px 10px -2px rgba(0, 0, 0, 0.1)',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            fontWeight: 600,
            fontSize: '0.88rem',
            direction: 'rtl',
            touchAction: 'none',
            transform: isDragging ? 'scale(1.06) translateY(-2px)' : 'scale(1)',
            transition: isDragging ? 'transform 0.05s ease, box-shadow 0.15s ease' : 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            animation: !isOpen && !fabPos && !isDragging ? 'softFloat 3.5s ease-in-out infinite' : 'none'
          }}
          title="دستیار هوشمند AI (قابل جابه‌جایی)"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', opacity: 0.8 }}>drag_indicator</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '50%'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a9.96 9.96 0 0 1-4.587-1.112l-3.826 1.07a1 1 0 0 1-1.229-1.229l1.07-3.826A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2z"/>
              <path d="M8 12h.01"/>
              <path d="M12 12h.01"/>
              <path d="M16 12h.01"/>
            </svg>
          </div>
          <span>دستیار هوشمند AI</span>
          <span style={{
            background: '#22c55e',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            display: 'inline-block',
            boxShadow: '0 0 8px #22c55e'
          }} />
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div
          className="no-print ai-chat-window"
          style={{
            position: 'fixed',
            bottom: isMinimized ? '24px' : '20px',
            left: fabPos ? `${Math.min(fabPos.x, Math.max(10, window.innerWidth - 420))}px` : '24px',
            zIndex: 9999,
            width: isMinimized ? '320px' : '400px',
            maxWidth: 'calc(100vw - 24px)',
            height: isMinimized ? '56px' : '640px',
            maxHeight: 'calc(100vh - 40px)',
            background: isDark ? '#1e293b' : '#ffffff',
            borderRadius: '16px',
            boxShadow: isDark 
              ? '0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px #334155' 
              : '0 20px 40px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            direction: 'rtl',
            fontFamily: 'inherit',
            color: isDark ? '#f1f5f9' : '#1e293b'
          }}
        >
          {/* Header */}
          <div
            style={{
              background: isDark 
                ? 'linear-gradient(135deg, #0f172a 0%, #020617 100%)' 
                : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#ffffff',
              padding: '0.85rem 1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              borderBottom: isDark ? '1px solid #334155' : 'none'
            }}
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2">
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a9.96 9.96 0 0 1-4.587-1.112l-3.826 1.07a1 1 0 0 1-1.229-1.229l1.07-3.826A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2, color: '#ffffff' }}>
                  دستیار هوشمند پروژه (AI PM)
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  تعریف پروژه، اقدام، WBS، ریسک و گزارش‌گیری
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                title={isMinimized ? 'بزرگ‌نمایی' : 'کوچک‌نمایی'}
              >
                {isMinimized ? '▲' : '▼'}
              </button>
              <button
                onClick={() => setMessages([{
                  id: 'welcome',
                  sender: 'ai',
                  text: 'گفتگوی جدید آغاز شد. چطور می‌توانم کمک کنم؟',
                  timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                }])}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px 6px', fontSize: '0.75rem' }}
                title="پاکسازی چت"
              >
                🗑️
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', fontSize: '1rem', fontWeight: 'bold' }}
                title="بستن"
              >
                ✕
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Quick Action Toolbar inside Chatbot Header */}
              <div style={{
                background: isDark ? '#0f172a' : '#1e293b',
                padding: '0.4rem 0.75rem',
                borderTop: isDark ? '1px solid #1e293b' : '1px solid #334155',
                display: 'flex',
                gap: '0.35rem',
                overflowX: 'auto',
                scrollbarWidth: 'none'
              }}>
                <button
                  onClick={() => setActiveModal('project')}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.73rem',
                    borderRadius: '6px',
                    border: '1px solid #3b82f6',
                    backgroundColor: '#1d4ed8',
                    color: '#ffffff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <span>➕ پروژه جدید</span>
                </button>
                <button
                  onClick={() => setActiveModal('action')}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.73rem',
                    borderRadius: '6px',
                    border: '1px solid #10b981',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <span>⚡ اقدام جدید</span>
                </button>
                <button
                  onClick={() => setActiveModal('activities')}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.73rem',
                    borderRadius: '6px',
                    border: '1px solid #8b5cf6',
                    backgroundColor: '#6d28d9',
                    color: '#ffffff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <span>📋 WBS / فعالیت</span>
                </button>
                <button
                  onClick={() => setActiveModal('project_details')}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.73rem',
                    borderRadius: '6px',
                    border: '1px solid #f59e0b',
                    backgroundColor: '#b45309',
                    color: '#ffffff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <span>👥 تیم/ریسک/تاخیر</span>
                </button>
              </div>

              {/* Suggested Prompts Carousel */}
              <div style={{
                background: isDark ? '#0f172a' : '#f8fafc',
                padding: '0.45rem 0.75rem',
                borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                display: 'flex',
                gap: '0.35rem',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                scrollbarWidth: 'none'
              }}>
                {suggestedPrompts.map((prompt, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => handleSendMessage(prompt)}
                    disabled={isLoading}
                    style={{
                      background: isDark ? '#1e293b' : '#ffffff',
                      border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                      borderRadius: '9999px',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.72rem',
                      color: isDark ? '#cbd5e1' : '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: 500
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Chat Messages Body */}
              <div style={{
                flex: 1,
                padding: '0.85rem',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                background: isDark ? '#0b1329' : '#f1f5f9'
              }}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.sender === 'user' ? 'flex-start' : 'flex-end',
                      maxWidth: (msg.tableData || (msg.chartData && msg.chartData.length > 0)) ? '100%' : '92%',
                      width: (msg.tableData || (msg.chartData && msg.chartData.length > 0)) ? '100%' : 'auto',
                      alignSelf: msg.sender === 'user' ? 'flex-start' : 'flex-end'
                    }}
                  >
                    <div
                      className={`ai-message-bubble ${msg.sender === 'user' ? 'ai-user-bubble' : 'ai-assistant-bubble'}`}
                      style={{
                        background: msg.sender === 'user'
                          ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                          : (isDark ? '#1e293b' : '#ffffff'),
                        color: msg.sender === 'user'
                          ? '#ffffff'
                          : (isDark ? '#f1f5f9' : '#1e293b'),
                        borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        padding: '0.75rem 0.95rem',
                        boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                        fontSize: '0.83rem',
                        lineHeight: '1.5',
                        border: msg.sender === 'user' ? 'none' : (isDark ? '1px solid #334155' : '1px solid #e2e8f0'),
                        wordBreak: 'break-word',
                        direction: 'rtl'
                      }}
                    >
                      <div className="ai-message-content-text" style={{ whiteSpace: 'pre-wrap', color: msg.sender === 'user' ? '#ffffff' : (isDark ? '#f1f5f9' : '#1e293b') }}>{toPersianDigits(msg.text)}</div>

                      {/* Created Entity Notification Card */}
                      {renderCreatedEntityCard(msg)}

                      {/* Render Charts if present */}
                      {renderChart(msg)}

                      {/* Render Tables if present */}
                      {renderTable(msg)}
                    </div>

                    <div style={{ fontSize: '0.65rem', color: isDark ? '#64748b' : '#94a3b8', marginTop: '3px', paddingLeft: '4px', paddingRight: '4px' }}>
                      {toPersianDigits(msg.timestamp)}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    background: isDark ? '#1e293b' : '#ffffff',
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '0.65rem 0.95rem',
                    maxWidth: '220px',
                    alignSelf: 'flex-end',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                  }}>
                    <svg
                      className="spin"
                      style={{
                        width: '20px',
                        height: '20px',
                        color: '#2563eb',
                        flexShrink: 0
                      }}
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
                      <path style={{ opacity: 0.9 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <div style={{ fontSize: '0.82rem', color: isDark ? '#cbd5e1' : '#334155', fontWeight: 600 }}>
                      در حال پردازش هوش مصنوعی...
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Interactive Modals inside Chatbot */}
              {activeModal === 'project' && (
                <div style={{ background: isDark ? '#1e293b' : '#ffffff', padding: '0.85rem', borderTop: '2px solid #2563eb', overflowY: 'auto', maxHeight: '380px', fontSize: '0.82rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b' }}>
                    <span>➕ فرم تعریف پروژه جدید</span>
                    <button onClick={() => setActiveModal('none')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b' }}>✕</button>
                  </div>
                  <form onSubmit={handleSaveProjectForm} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>عنوان پروژه *</label>
                      <input type="text" value={projName} onChange={e => setProjName(e.target.value)} required placeholder="نام پروژه..." style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>متدولوژی پروژه</label>
                        <select value={projType} onChange={e => setProjType(e.target.value as any)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                          <option value="waterfall">آبشاری (Waterfall)</option>
                          <option value="agile">چابک (Agile)</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>واحد متولی / مالک</label>
                        <select value={projUnit} onChange={e => setProjUnit(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                          {owningUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>مدیر پروژه</label>
                        <select value={projManagerId} onChange={e => setProjManagerId(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                          {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>هزینه / بودجه (ریال)</label>
                        <input type="text" inputMode="numeric" value={toPersianDigits(projCost)} onChange={e => setProjCost(toEnglishDigits(e.target.value))} placeholder="مثلاً ۵,۰۰۰,۰۰۰" style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b', fontFamily: 'Vazirmatn, Tahoma, sans-serif', fontFeatureSettings: '"ss01" 1, "pnum" 1, "tnmr" 1', direction: 'rtl' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>تاریخ شروع</label>
                        <ShamsiDatePicker value={projStartDate} onChange={setProjStartDate} placeholder="تاریخ شروع" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>تاریخ پایان</label>
                        <ShamsiDatePicker value={projEndDate} onChange={setProjEndDate} placeholder="تاریخ پایان" />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>هدف و منشور پروژه</label>
                      <textarea value={projGoal} onChange={e => setProjGoal(e.target.value)} rows={2} placeholder="هدف اصلی پروژه..." style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <button type="submit" style={{ flex: 1, padding: '0.45rem', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>ثبت و فعال‌سازی پروژه</button>
                      <button type="button" onClick={() => setActiveModal('none')} style={{ padding: '0.45rem 0.8rem', backgroundColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#cbd5e1' : '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>انصراف</button>
                    </div>
                  </form>
                </div>
              )}

              {activeModal === 'action' && (
                <div style={{ background: isDark ? '#1e293b' : '#ffffff', padding: '0.85rem', borderTop: '2px solid #10b981', overflowY: 'auto', maxHeight: '380px', fontSize: '0.82rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b' }}>
                    <span>📝 فرم تعریف اقدام اجرایی با تمام فیلدها</span>
                    <button onClick={() => setActiveModal('none')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b' }}>✕</button>
                  </div>
                  <form onSubmit={handleSaveActionForm} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>عنوان اقدام *</label>
                      <input type="text" value={actTitle} onChange={e => setActTitle(e.target.value)} required placeholder="عنوان دقیق اقدام..." style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>مسئول اقدام</label>
                        <select value={actUser} onChange={e => setActUser(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                          {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>واحد متولی</label>
                        <select value={actUnit} onChange={e => setActUnit(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                          {owningUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>تاریخ شروع</label>
                        <ShamsiDatePicker value={actStart} onChange={setActStart} placeholder="تاریخ شروع" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>تاریخ پایان</label>
                        <ShamsiDatePicker value={actEnd} onChange={setActEnd} placeholder="تاریخ پایان" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>پروژه مرتبط (اختیاری)</label>
                        <select value={actProjectId || ''} onChange={e => setActProjectId(e.target.value || undefined)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                          <option value="">بدون ارتباط به پروژه خاص</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>وضعیت اولیه</label>
                        <select value={actStatus} onChange={e => setActStatus(e.target.value as any)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                          <option value="Planning">برنامه‌ریزی</option>
                          <option value="In Progress">در حال اجرا</option>
                          <option value="Completed">تکمیل شده</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>شرح و خروجی مورد انتظار</label>
                      <textarea value={actDesc} onChange={e => setActDesc(e.target.value)} rows={2} placeholder="توضیحات خروجی تحویلی..." style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <button type="submit" style={{ flex: 1, padding: '0.45rem', backgroundColor: '#059669', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>ثبت و ابلاغ اقدام</button>
                      <button type="button" onClick={() => setActiveModal('none')} style={{ padding: '0.45rem 0.8rem', backgroundColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#cbd5e1' : '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>انصراف</button>
                    </div>
                  </form>
                </div>
              )}

              {activeModal === 'activities' && (
                <div style={{ background: isDark ? '#1e293b' : '#ffffff', padding: '0.85rem', borderTop: '2px solid #8b5cf6', overflowY: 'auto', maxHeight: '380px', fontSize: '0.82rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b' }}>
                    <span>📋 تعریف ساختار شکست (WBS) / فعالیت جدید</span>
                    <button onClick={() => setActiveModal('none')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b' }}>✕</button>
                  </div>
                  <form onSubmit={handleSaveWbsForm} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>انتخاب پروژه *</label>
                      <select value={wbsProjectId} onChange={e => setWbsProjectId(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type === 'agile' ? 'چابک' : 'آبشاری'})</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>عنوان فعالیت / WBS *</label>
                      <input type="text" value={wbsName} onChange={e => setWbsName(e.target.value)} required placeholder="عنوان فعالیت..." style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>مدت (روز)</label>
                        <input type="text" inputMode="numeric" value={toPersianDigits(wbsDuration)} onChange={e => setWbsDuration(toEnglishDigits(e.target.value))} placeholder="مثلاً ۳۰" style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b', fontFamily: 'Vazirmatn, Tahoma, sans-serif', fontFeatureSettings: '"ss01" 1, "pnum" 1, "tnmr" 1', direction: 'rtl' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>وزن (%)</label>
                        <input type="text" inputMode="numeric" value={toPersianDigits(wbsWeight)} onChange={e => setWbsWeight(toEnglishDigits(e.target.value))} placeholder="مثلاً ۱۰" style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b', fontFamily: 'Vazirmatn, Tahoma, sans-serif', fontFeatureSettings: '"ss01" 1, "pnum" 1, "tnmr" 1', direction: 'rtl' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>مسئول</label>
                        <select value={wbsAssigned} onChange={e => setWbsAssigned(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                          {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <button type="submit" style={{ flex: 1, padding: '0.45rem', backgroundColor: '#7c3aed', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>ثبت و افزودن به WBS</button>
                      <button type="button" onClick={() => setActiveModal('none')} style={{ padding: '0.45rem 0.8rem', backgroundColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#cbd5e1' : '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>انصراف</button>
                    </div>
                  </form>
                </div>
              )}

              {activeModal === 'project_details' && (
                <div style={{ background: isDark ? '#1e293b' : '#ffffff', padding: '0.85rem', borderTop: '2px solid #f59e0b', overflowY: 'auto', maxHeight: '380px', fontSize: '0.82rem', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b' }}>
                    <span>🛡️ سایر اطلاعات پروژه (تیم/ریسک/وضعیت/تاخیر)</span>
                    <button onClick={() => setActiveModal('none')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b' }}>✕</button>
                  </div>

                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>انتخاب پروژه *</label>
                    <select value={detProjectId} onChange={e => setDetProjectId(e.target.value)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '0.6rem', borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>
                    <button type="button" onClick={() => setDetTab('team')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: 'none', backgroundColor: detTab === 'team' ? '#d97706' : (isDark ? '#334155' : '#f1f5f9'), color: detTab === 'team' ? '#fff' : (isDark ? '#cbd5e1' : '#334155'), cursor: 'pointer' }}>اعضای تیم</button>
                    <button type="button" onClick={() => setDetTab('risk')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: 'none', backgroundColor: detTab === 'risk' ? '#d97706' : (isDark ? '#334155' : '#f1f5f9'), color: detTab === 'risk' ? '#fff' : (isDark ? '#cbd5e1' : '#334155'), cursor: 'pointer' }}>افزودن ریسک</button>
                    <button type="button" onClick={() => setDetTab('status')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: 'none', backgroundColor: detTab === 'status' ? '#d97706' : (isDark ? '#334155' : '#f1f5f9'), color: detTab === 'status' ? '#fff' : (isDark ? '#cbd5e1' : '#334155'), cursor: 'pointer' }}>ثبت وضعیت</button>
                    <button type="button" onClick={() => setDetTab('delay')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: 'none', backgroundColor: detTab === 'delay' ? '#d97706' : (isDark ? '#334155' : '#f1f5f9'), color: detTab === 'delay' ? '#fff' : (isDark ? '#cbd5e1' : '#334155'), cursor: 'pointer' }}>علت تاخیر</button>
                  </div>

                  <form onSubmit={handleSaveDetailsForm} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {detTab === 'team' && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>انتخاب اعضای جدید تیم پروژه:</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '120px', overflowY: 'auto' }}>
                          {users.map(u => (
                            <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                              <input
                                type="checkbox"
                                checked={detSelectedTeam.includes(u.id)}
                                onChange={e => {
                                  if (e.target.checked) setDetSelectedTeam(prev => [...prev, u.id]);
                                  else setDetSelectedTeam(prev => prev.filter(id => id !== u.id));
                                }}
                              />
                              <span>{u.username} ({u.role})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {detTab === 'risk' && (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>شرح ریسک *</label>
                          <input type="text" value={detRiskDesc} onChange={e => setDetRiskDesc(e.target.value)} required placeholder="عنوان و شرح ریسک..." style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>احتمال وقوع</label>
                            <select value={detRiskProb} onChange={e => setDetRiskProb(e.target.value as any)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                              <option value="Low">کم</option>
                              <option value="Medium">متوسط</option>
                              <option value="High">زیاد</option>
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>میزان اثرگذاری</label>
                            <select value={detRiskImpact} onChange={e => setDetRiskImpact(e.target.value as any)} style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                              <option value="Low">کم</option>
                              <option value="Medium">متوسط</option>
                              <option value="High">زیاد</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>برنامه پاسخ به ریسک</label>
                          <input type="text" value={detRiskPlan} onChange={e => setDetRiskPlan(e.target.value)} placeholder="استراتژی مواجهه..." style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                        </div>
                      </>
                    )}

                    {detTab === 'status' && (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>شرح آخرین وضعیت پروژه *</label>
                          <textarea value={detStatusDesc} onChange={e => setDetStatusDesc(e.target.value)} required rows={2} placeholder="خلاصه پیشرفت و آخرین وضعیت اجرایی..." style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>تاریخ ثبت</label>
                          <ShamsiDatePicker value={detStatusDate} onChange={setDetStatusDate} placeholder="تاریخ ثبت" />
                        </div>
                      </>
                    )}

                    {detTab === 'delay' && (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>علت و شرح تاخیر *</label>
                          <textarea value={detDelayDesc} onChange={e => setDetDelayDesc(e.target.value)} required rows={2} placeholder="توضیح دلایل عدم تحقق برنامه و تاخیر..." style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: isDark ? '1px solid #334155' : '1px solid #cbd5e1', backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '2px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#1e293b' }}>تاریخ وقوع / ثبت</label>
                          <ShamsiDatePicker value={detDelayDate} onChange={setDetDelayDate} placeholder="تاریخ وقوع/ثبت" />
                        </div>
                      </>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <button type="submit" style={{ flex: 1, padding: '0.45rem', backgroundColor: '#d97706', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>ثبت اطلاعات در پروژه</button>
                      <button type="button" onClick={() => setActiveModal('none')} style={{ padding: '0.45rem 0.8rem', backgroundColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#cbd5e1' : '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>انصراف</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Input Area */}
              <div style={{
                padding: '0.75rem',
                background: isDark ? '#1e293b' : '#ffffff',
                borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="سوال خود یا درخواست تعریف پروژه/اقدام را تایپ کنید..."
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.85rem',
                    borderRadius: '10px',
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    color: isDark ? '#f1f5f9' : '#1e293b',
                    fontSize: '0.82rem',
                    outline: 'none',
                    direction: 'rtl'
                  }}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputMessage.trim()}
                  style={{
                    background: !inputMessage.trim() || isLoading
                      ? (isDark ? '#334155' : '#cbd5e1')
                      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.6rem 0.95rem',
                    cursor: !inputMessage.trim() || isLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>ارسال</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
