import { ActionItem, Calendar, Delegation, KnowledgeDocument, OwningUnitTreeNode, ProjectStrategyAlignment, Strategy, User } from './types';

export const initialCalendars: Calendar[] = [
    { id: '1', name: 'تقویم رسمی ۱۴۰۳', isDefault: true, workingDays: [0, 1, 2, 3, 4], workHoursPerDay: 8 },
    { id: '2', name: 'تقویم نوبتی کارگاهی (۷ روز هفته)', isDefault: false, workingDays: [0, 1, 2, 3, 4, 5, 6], workHoursPerDay: 10 }
];

export const initialUsers: User[] = [
  { id: '1', username: 'admin', password: 'admin', role: 'Admin', isActive: true, owningUnit: 'سازمان > مدیریت ارشد' },
  { id: '2', username: 'user1', password: 'user1', role: 'Project Manager', isActive: true, owningUnit: 'سازمان > واحد اجرایی' },
  { id: '3', username: 'user2', password: 'user2', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد اجرایی > اداره ۲' },
  { id: '4', username: 'user3', password: 'user3', role: 'Project Manager', isActive: true, owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار' },
  { id: '5', username: 'user4', password: 'user4', role: 'Project Manager', isActive: true, owningUnit: 'سازمان > واحد ساختمان' },
  { id: '6', username: 'user5', password: 'user5', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد پشتیبانی' },
  { id: '7', username: 'user6', password: 'user6', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد انفورماتیک > اداره زیرساخت و شبکه' },
  { id: '8', username: 'user7', password: 'user7', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد پشتیبانی > اداره امور عمومی' }
];

export const initialStrategies: Strategy[] = [
    { id: 's1', name: 'افزایش سهم بازار', description: 'افزایش سهم بازار در صنایع کلیدی', weight: 60, parentId: null },
    { id: 's1-1', name: 'ورود به بازارهای جدید', description: 'ورود به بازارهای صادراتی منطقه', weight: 20, parentId: 's1' },
    { id: 's1-2', name: 'افزایش فروش در بازارهای فعلی', description: 'افزایش ۳۰ درصدی فروش محصولات فعلی', weight: 40, parentId: 's1' },
    { id: 's2', name: 'نوآوری در محصول', description: 'ارائه محصولات و خدمات جدید', weight: 40, parentId: null },
];

export const initialAlignments: ProjectStrategyAlignment[] = [
    { projectId: '102', strategyId: 's1-2', level: 'High' },
    { projectId: '104', strategyId: 's2', level: 'High' },
    { projectId: '101', strategyId: 's1-2', level: 'Medium' },
    { projectId: '107', strategyId: 's2', level: 'Medium' },
    { projectId: '109', strategyId: 's2', level: 'High' },
    { projectId: '111', strategyId: 's2', level: 'High' },
    { projectId: '113', strategyId: 's2', level: 'High' },
    { projectId: '114', strategyId: 's1-2', level: 'Medium' },
    { projectId: '115', strategyId: 's1', level: 'High' },
];

export const initialKnowledgeDocuments: KnowledgeDocument[] = [
    { id: 1, name: 'راهنمای مدیریت پروژه PMBOK', description: 'کتاب راهنمای استاندارد مدیریت پروژه', type: 'Book' },
    { id: 2, name: 'نرم‌افزار Primavera P6', description: 'نرم‌افزار تخصصی کنترل پروژه', type: 'Software' },
];

export const initialActions: ActionItem[] = [
    {
        id: 1,
        title: 'برگزاری دوره آموزشی مدیریت ریسک',
        description: 'برگزاری یک دوره آموزشی دو روزه برای مدیران پروژه و تیم‌هایشان.',
        ownerUserId: '1',
        responsibleUserId: '2',
        approver1Id: '1',
        status: 'Planning',
        calendarId: '1',
        startDate: '2024-09-01',
        endDate: '2024-09-15',
        owningUnit: 'سازمان > واحد انفورماتیک'
    },
    {
        id: 2,
        title: 'بازبینی و تایید نهایی نقشه‌های فاز ۲',
        description: 'جلسه بازبینی نهایی نقشه‌های معماری و سازه فاز دوم ساختمان مرکزی و اخذ تاییدیه از کمیته فنی.',
        ownerUserId: '1',
        responsibleUserId: '3',
        approver1Id: '2',
        status: 'In Progress',
        calendarId: '1',
        startDate: '2024-07-20',
        endDate: '2024-07-25',
        owningUnit: 'سازمان > واحد ساختمان > اداره معماری و عمران',
        projectId: '101'
    },
    {
        id: 3,
        title: 'به‌روزرسانی دستورالعمل‌های ایمنی کارگاه‌ها',
        description: 'مرور و به‌روزرسانی کلیه دستورالعمل‌های ایمنی کارگاه‌های ساختمانی بر اساس آخرین استانداردها.',
        ownerUserId: '1',
        responsibleUserId: '4',
        approver1Id: '1',
        status: 'In Progress',
        calendarId: '1',
        startDate: '2024-10-01',
        endDate: '2024-10-30',
        owningUnit: 'سازمان > واحد اجرایی'
    },
    {
        id: 4,
        title: 'برگزاری جلسه دمو اپلیکیشن خدمات مشتریان',
        description: 'برگزاری جلسه نمایش نسخه اولیه اپلیکیشن خدمات مشتریان برای سهامداران اصلی و دریافت بازخورد.',
        ownerUserId: '1',
        responsibleUserId: '5',
        approver1Id: '4',
        status: 'Completed',
        calendarId: '1',
        startDate: '2024-06-20',
        endDate: '2024-06-22',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار',
        projectId: '104'
    },
    {
        id: 5,
        title: 'تدوین سند معماری کلان زیرساخت شبکه',
        description: 'استخراج و مستندسازی دقیق استانداردهای جدید شبکه برای تمام شعب استان‌ها.',
        ownerUserId: '1',
        responsibleUserId: '7',
        approver1Id: '2',
        status: 'In Progress',
        calendarId: '1',
        startDate: '2024-06-15',
        endDate: '2024-07-10',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره زیرساخت و شبکه',
        projectId: '103'
    },
    {
        id: 6,
        title: 'استعلام قیمت و انتخاب تامین‌کننده سرورها',
        description: 'تهیه اسناد مناقصه و دریافت استعلام قیمت برای سه دستگاه سرور پردازشی مرکزی.',
        ownerUserId: '1',
        responsibleUserId: '6',
        approver1Id: '1',
        status: 'Planning',
        calendarId: '1',
        startDate: '2024-08-01',
        endDate: '2024-08-20',
        owningUnit: 'سازمان > واحد پشتیبانی > اداره تدارکات'
    },
    {
        id: 7,
        title: 'ممیزی ایمنی و بهداشت تاسیسات برج اداری',
        description: 'بازرسی جامع از موتورخانه و سیستم‌های اطفاء حریق و ثبت گزارش عدم انطباق‌ها.',
        ownerUserId: '1',
        responsibleUserId: '5',
        approver1Id: '2',
        status: 'Completed',
        calendarId: '1',
        startDate: '2024-05-20',
        endDate: '2024-05-30',
        owningUnit: 'سازمان > واحد ساختمان > اداره تاسیسات',
        projectId: '108'
    },
    {
        id: 8,
        title: 'تهیه گزارش ارزیابی تاثیرات زیست‌محیطی',
        description: 'تکمیل فرم‌های سازمان حفاظت محیط زیست و ارسال مدارک جهت دریافت مجوز نهایی سد.',
        ownerUserId: '1',
        responsibleUserId: '3',
        approver1Id: '2',
        status: 'In Progress',
        calendarId: '1',
        startDate: '2024-08-10',
        endDate: '2024-09-05',
        owningUnit: 'سازمان > واحد ساختمان',
        projectId: '105'
    },
    {
        id: 9,
        title: 'سازماندهی تیم تست نفوذ و امنیت داده',
        description: 'هماهنگی با آزمایشگاه معتمد برای انجام ارزیابی‌های امنیتی درگاه پرداخت.',
        ownerUserId: '1',
        responsibleUserId: '4',
        approver1Id: '1',
        status: 'Planning',
        calendarId: '1',
        startDate: '2024-09-10',
        endDate: '2024-09-25',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار',
        projectId: '111'
    },
    {
        id: 10,
        title: 'تحویل و انبارگردانی تجهیزات نظارت تصویری',
        description: 'بررسی سلامت فیزیکی و تطبیق سریال دوربین‌های خریداری‌شده در انبار مرکزی.',
        ownerUserId: '1',
        responsibleUserId: '8',
        approver1Id: '6',
        status: 'Completed',
        calendarId: '1',
        startDate: '2024-04-15',
        endDate: '2024-04-25',
        owningUnit: 'سازمان > واحد پشتیبانی > اداره امور عمومی',
        projectId: '114'
    }
];

export const initialDelegations: Delegation[] = [];

export const initialOwningUnitsFlat: string[] = [
  'سازمان',
  'سازمان > مدیریت ارشد',
  'سازمان > واحد اجرایی',
  'سازمان > واحد اجرایی > اداره ۱',
  'سازمان > واحد اجرایی > اداره ۲',
  'سازمان > واحد انفورماتیک',
  'سازمان > واحد انفورماتیک > اداره نرم‌افزار',
  'سازمان > واحد انفورماتیک > اداره زیرساخت و شبکه',
  'سازمان > واحد ساختمان',
  'سازمان > واحد ساختمان > اداره معماری و عمران',
  'سازمان > واحد ساختمان > اداره تاسیسات',
  'سازمان > واحد پشتیبانی',
  'سازمان > واحد پشتیبانی > اداره تدارکات',
  'سازمان > واحد پشتیبانی > اداره امور عمومی'
];

export const initialOwningUnitsTree: OwningUnitTreeNode[] = [
  { id: 'u1', name: 'سازمان', parentId: null },
  { id: 'u2', name: 'مدیریت ارشد', parentId: 'u1' },
  { id: 'u3', name: 'واحد اجرایی', parentId: 'u1' },
  { id: 'u4', name: 'اداره ۱', parentId: 'u3' },
  { id: 'u5', name: 'اداره ۲', parentId: 'u3' },
  { id: 'u6', name: 'واحد انفورماتیک', parentId: 'u1' },
  { id: 'u7', name: 'اداره نرم‌افزار', parentId: 'u6' },
  { id: 'u8', name: 'اداره زیرساخت و شبکه', parentId: 'u6' },
  { id: 'u9', name: 'واحد ساختمان', parentId: 'u1' },
  { id: 'u10', name: 'اداره معماری و عمران', parentId: 'u9' },
  { id: 'u11', name: 'اداره تاسیسات', parentId: 'u9' },
  { id: 'u12', name: 'واحد پشتیبانی', parentId: 'u1' },
  { id: 'u13', name: 'اداره تدارکات', parentId: 'u12' },
  { id: 'u14', name: 'اداره امور عمومی', parentId: 'u12' }
];
