import { ActionItem, Calendar, Delegation, KnowledgeDocument, OwningUnitTreeNode, Project, ProjectStrategyAlignment, Strategy, User } from './types';

export const initialCalendars: Calendar[] = [
    { id: 1, name: 'تقویم رسمی ۱۴۰۳', isDefault: true, workingDays: [0, 1, 2, 3, 4], workHoursPerDay: 8 },
    { id: 2, name: 'تقویم نوبتی کارگاهی (۷ روز هفته)', isDefault: false, workingDays: [0, 1, 2, 3, 4, 5, 6], workHoursPerDay: 10 }
];

export const initialUsers: User[] = [
  { id: 1, username: 'admin', password: 'admin', role: 'Admin', isActive: true, owningUnit: 'سازمان > مدیریت ارشد' },
  { id: 2, username: 'user1', password: 'user1', role: 'Project Manager', isActive: true, owningUnit: 'سازمان > واحد اجرایی' },
  { id: 3, username: 'user2', password: 'user2', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد اجرایی > اداره ۲' },
  { id: 4, username: 'user3', password: 'user3', role: 'Project Manager', isActive: true, owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار' },
  { id: 5, username: 'user4', password: 'user4', role: 'Project Manager', isActive: true, owningUnit: 'سازمان > واحد ساختمان' },
  { id: 6, username: 'user5', password: 'user5', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد پشتیبانی' },
  { id: 7, username: 'user6', password: 'user6', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد انفورماتیک > اداره زیرساخت و شبکه' },
  { id: 8, username: 'user7', password: 'user7', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد پشتیبانی > اداره امور عمومی' }
];

export const initialProjects: Project[] = [
    {
        id: 101,
        type: 'waterfall',
        name: 'ساختمان مرکزی جدید',
        projectManagerId: 2,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد ساختمان > اداره معماری و عمران',
        cost: 15000000,
        description: 'پروژه ساخت و تجهیز احداث مجتمع مرکزی اداری سازمان شامل ۱۲ طبقه و پارکینگ طبقاتی.',
        goal: 'تجمعات متمرکز اداری و بهبود راندمان کاری پرسنل.',
        requirements: 'تاسیسات مدرن، سیستم اعلام حریق هوشمند، اسکلت بتنی مقاوم.',
        calendarId: 1,
        teamMemberIds: [2, 3, 5],
        risks: [
            { id: 301, description: 'تاخیر در تامین مصالح ساختمانی پایه (سیمان و میلگرد)', probability: 'Medium', impact: 'High', responsePlan: 'پیش‌خرید مصالح از بورس کالا', assignedTo: 'مدیر تدارکات' },
            { id: 302, description: 'افزایش تورمی هزینه‌ها بیش از سقف بودجه', probability: 'High', impact: 'High', responsePlan: 'درخواست تعدیل پیمان از مدیریت ارشد', assignedTo: 'مدیر مالی' }
        ],
        statusUpdates: [
            { id: 401, description: 'تکمیل عملیات گودبرداری و اجرای فونداسیون طبق برنامه.', date: '2024-02-15' },
            { id: 402, description: 'اتمام بتن‌ریزی طبقات ۱ تا ۴ و نصب اسکلت فلزی.', date: '2024-05-10' }
        ],
        documents: [],
        schedule: [
            { id: '101-1', name: 'گودبرداری و فونداسیون', duration: 45, prerequisiteId: null, weight: 20, assignedToId: 3, actualProgress: 100, parentId: null, approver1Id: 2 },
            { id: '101-2', name: 'اسکلت‌سازی و سقف‌ها', duration: 90, prerequisiteId: '101-1', weight: 40, assignedToId: 3, actualProgress: 75, parentId: null, approver1Id: 2 },
            { id: '101-3', name: 'نازک‌کاری و تاسیسات', duration: 120, prerequisiteId: '101-2', weight: 40, assignedToId: 5, actualProgress: 20, parentId: null, approver1Id: 2 }
        ],
        kanbanTasks: [],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 102,
        type: 'waterfall',
        name: 'توسعه خط تولید شماره ۲',
        projectManagerId: 2,
        startDate: '2024-03-01',
        endDate: '2024-09-30',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد اجرایی > اداره ۱',
        cost: 8500000,
        description: 'نصب و راه‌اندازی ماشین‌آلات جدید برای افزایش ۵۰ درصدی ظرفیت تولید محصولات.',
        goal: 'افزایش سهم بازار و پاسخگویی به تقاضای مشتریان.',
        requirements: 'تامین برق صنعتی، زیرسازی سالن تولید، ماشین‌آلات CNC.',
        calendarId: 1,
        teamMemberIds: [2, 3],
        risks: [
            { id: 303, description: 'تاخیر در ترخیص ماشین‌آلات از گمرک', probability: 'High', impact: 'Medium', responsePlan: 'پیگیری ویژه از طریق ترخیص‌کار اختصاصی', assignedTo: 'بازرگانی' }
        ],
        statusUpdates: [
            { id: 403, description: 'آماده‌سازی فونداسیون ماشین‌آلات و کابل‌کشی فشار قوی.', date: '2024-04-20' }
        ],
        documents: [],
        schedule: [
            { id: '102-1', name: 'آماده‌سازی سالن و زیرسازی', duration: 30, prerequisiteId: null, weight: 30, assignedToId: 3, actualProgress: 100, parentId: null, approver1Id: 2 },
            { id: '102-2', name: 'نصب خطوط و خط مونتاژ', duration: 60, prerequisiteId: '102-1', weight: 50, assignedToId: 3, actualProgress: 40, parentId: null, approver1Id: 2 },
            { id: '102-3', name: 'تست گرم و بهره‌برداری اولیه', duration: 20, prerequisiteId: '102-2', weight: 20, assignedToId: 2, actualProgress: 0, parentId: null, approver1Id: 2 }
        ],
        kanbanTasks: [],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 103,
        type: 'waterfall',
        name: 'ارتقا شبکه و زیرساخت سراسری',
        projectManagerId: 4,
        startDate: '2024-02-01',
        endDate: '2024-07-31',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره زیرساخت و شبکه',
        cost: 3200000,
        description: 'به‌روزرسانی سرورها، سوئیچ‌ها و دیتاسنتر مرکزی و پیاده‌سازی مکانیزم‌های پشتیبان‌گیری دوزمانه.',
        goal: 'بهبود پایداری شبکه و افزایش امنیت اطلاعات تا ۹۹٫۹٪ uptime.',
        requirements: 'تجهیزات سیسکو، سرورهای HPE، لایسنس‌های دیواره آتش.',
        calendarId: 1,
        teamMemberIds: [4, 7],
        risks: [
            { id: 304, description: 'قطعی ناخواسته سرویس‌های اداری حین سوئیچینگ دیتاسنتر', probability: 'Low', impact: 'High', responsePlan: 'اجرای فاز قطعی در تعطیلات آخر هفته', assignedTo: 'راهبر شبکه' }
        ],
        statusUpdates: [
            { id: 404, description: 'نصب رک‌های جدید و پیکربندی اولیه فایروال‌ها انجام شد.', date: '2024-03-15' }
        ],
        documents: [],
        schedule: [
            { id: '103-1', name: 'خرید و تحویل سرورها', duration: 40, prerequisiteId: null, weight: 40, assignedToId: 7, actualProgress: 100, parentId: null, approver1Id: 4 },
            { id: '103-2', name: 'پیکربندی دیتاسنتر و مجازی‌سازی', duration: 30, prerequisiteId: '103-1', weight: 40, assignedToId: 7, actualProgress: 80, parentId: null, approver1Id: 4 },
            { id: '103-3', name: 'انتقال سرویس‌ها و تست نهایی', duration: 15, prerequisiteId: '103-2', weight: 20, assignedToId: 4, actualProgress: 10, parentId: null, approver1Id: 4 }
        ],
        kanbanTasks: [],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 104,
        type: 'agile',
        name: 'سامانه همراه خدمات مشتریان',
        projectManagerId: 4,
        startDate: '2024-01-15',
        endDate: '2024-08-30',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار',
        cost: 2100000,
        description: 'طراحی و توسعه اپلیکیشن موبایل iOS و Android برای مشتریان سازمان.',
        goal: 'تسهیل ثبت سفارش، پیگیری درخواست‌ها و پشتیبانی ۲۴/۷ آنلاین.',
        requirements: 'تیم توسعه Flutter، سرویس‌های REST API، درگاه پرداخت.',
        calendarId: 1,
        teamMemberIds: [4, 3, 7],
        risks: [
            { id: 305, description: 'عدم تایید اپلیکیشن در استورهای رسمی به دلیل قوانین جدید', probability: 'Medium', impact: 'Medium', responsePlan: 'استفاده از نسخه PWA در کنار اپلیکیشن نیتیو', assignedTo: 'توسعه‌دهنده ارشد' }
        ],
        statusUpdates: [
            { id: 405, description: 'انتشار نسخه بتا (Beta) برای ۵۰۰ کاربر آزمایشی.', date: '2024-04-10' }
        ],
        documents: [],
        schedule: [],
        kanbanTasks: [
            { id: 201, description: 'طراحی UI/UX صفحات اصلی و کیف پول', dueDate: '2024-02-10', priority: 'High', assignedToId: 3, status: 'Done', sprintNumber: 1, approver1Id: 4 },
            { id: 202, description: 'اتصال به وب‌سرویس‌های شاهکار و احراز هویت', dueDate: '2024-03-20', priority: 'High', assignedToId: 7, status: 'Done', sprintNumber: 1, approver1Id: 4 },
            { id: 203, description: 'پیاده‌سازی نوتیفیکیشن‌های آنی (Push)', dueDate: '2024-05-15', priority: 'Medium', assignedToId: 3, status: 'Doing', sprintNumber: 2, approver1Id: 4 },
            { id: 204, description: 'تست نفوذ و امنیت داده‌های کاربران', dueDate: '2024-07-01', priority: 'High', assignedToId: 4, status: 'To-Do', sprintNumber: 2, approver1Id: 4 }
        ],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 105,
        type: 'waterfall',
        name: 'پروژه احداث سد مخزنی',
        projectManagerId: 2,
        startDate: '2023-06-01',
        endDate: '2025-12-30',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد ساختمان',
        cost: 45000000,
        description: 'احداث سد خاکی با هسته رس جهت ذخیره‌سازی آب کشاورزی و شرب منطقه.',
        goal: 'تامین سالانه ۴۰ میلیون متر مکعب آب و مهار سیلاب‌های فصلی.',
        requirements: 'تجهیزات سنگین راهسازی، مطالعات ژئوتکنیک، بتن‌ریزی حجیم.',
        calendarId: 2,
        teamMemberIds: [2, 3, 5],
        risks: [
            { id: 306, description: 'بارندگی‌های شدید خارج از فصل و طغیان رودخانه حین اجرای فراز بند', probability: 'High', impact: 'High', responsePlan: 'احداث کانال انحراف آب اضطراری', assignedTo: 'سرپرست کارگاه' }
        ],
        statusUpdates: [
            { id: 406, description: 'تکمیلی تونل انحراف آب و شروع خاک‌ریزی بدنه سد.', date: '2024-01-20' }
        ],
        documents: [],
        schedule: [
            { id: '105-1', name: 'حفر تونل انحراف آب', duration: 180, prerequisiteId: null, weight: 25, assignedToId: 3, actualProgress: 100, parentId: null, approver1Id: 2 },
            { id: '105-2', name: 'خاک‌ریزی و تزریق هسته رس', duration: 360, prerequisiteId: '105-1', weight: 50, assignedToId: 5, actualProgress: 45, parentId: null, approver1Id: 2 },
            { id: '105-3', name: 'نصب تجهیزات هیدرومکانیک و آبگیری', duration: 120, prerequisiteId: '105-2', weight: 25, assignedToId: 3, actualProgress: 0, parentId: null, approver1Id: 2 }
        ],
        kanbanTasks: [],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 106,
        type: 'waterfall',
        name: 'تکمیل خط ریلی شمال-جنوب',
        projectManagerId: 5,
        startDate: '2024-01-01',
        endDate: '2024-11-30',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد اجرایی',
        cost: 28000000,
        description: 'زیرسازی، ریل‌گذاری و علائم‌گذاری ۴۵ کیلومتر مسیر ریلی حمل بار.',
        goal: 'اتصال کارخانجات به شبکه سراسری راه آهن کشور.',
        requirements: 'ریل UIC60، تراورس بتنی، سوزن‌های برقی.',
        calendarId: 1,
        teamMemberIds: [5, 3],
        risks: [
            { id: 307, description: 'تزریق قطره‌چکانی اعتبارات دولتی', probability: 'High', impact: 'High', responsePlan: 'استفاده از اوراق مشارکتی و فاینانس داخلی', assignedTo: 'تامین سرمایه' }
        ],
        statusUpdates: [],
        documents: [],
        schedule: [
            { id: '106-1', name: 'زیرسازی و احداث پل‌ها', duration: 120, prerequisiteId: null, weight: 40, assignedToId: 3, actualProgress: 90, parentId: null, approver1Id: 5 },
            { id: '106-2', name: 'روسازی و ریل‌گذاری', duration: 90, prerequisiteId: '106-1', weight: 40, assignedToId: 5, actualProgress: 30, parentId: null, approver1Id: 5 },
            { id: '106-3', name: 'نصب سیستم‌های سیگنالینگ', duration: 45, prerequisiteId: '106-2', weight: 20, assignedToId: 3, actualProgress: 0, parentId: null, approver1Id: 5 }
        ],
        kanbanTasks: [],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 107,
        type: 'agile',
        name: 'سامانه هوشمند مدیریت منابع انسانی (HRM)',
        projectManagerId: 4,
        startDate: '2024-02-10',
        endDate: '2024-08-15',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار',
        cost: 1600000,
        description: 'اتوماسیون کامل فرآیندهای جذب، ارزیابی عملکرد، حضور و غیاب و صدور احکام پرسنلی.',
        goal: 'حذف کاغذبازی و ارتقای شفافیت ارزیابی پرسنل.',
        requirements: 'ماژول ارزیابی ۳۶۰ درجه، داشبورد مدیریت، موتور فرآیندساز (BPMN).',
        calendarId: 1,
        teamMemberIds: [4, 7],
        risks: [
            { id: 308, description: 'مقاومت سازمانی برخی مدیران در برابر شفاف‌سازی داده‌های پرسنلی', probability: 'Medium', impact: 'Medium', responsePlan: 'برگزاری کارگاه‌های توجیهی و آموزش فرهنگ سازمانی', assignedTo: 'مدیر HR' }
        ],
        statusUpdates: [
            { id: 407, description: 'ماژول مرخصی‌ها و ماموریت‌ها زیر بار عملیاتی رفت.', date: '2024-05-01' }
        ],
        documents: [],
        schedule: [],
        kanbanTasks: [
            { id: 210, description: 'پیاده‌سازی الگوریتم محاسبه کارکرد و اضافه‌کاری', dueDate: '2024-03-15', priority: 'High', assignedToId: 7, status: 'Done', sprintNumber: 1, approver1Id: 4 },
            { id: 211, description: 'توسعه فرم‌های الکترونیکی ارزیابی عملکرد', dueDate: '2024-04-30', priority: 'Medium', assignedToId: 4, status: 'Done', sprintNumber: 1, approver1Id: 4 },
            { id: 212, description: 'اتصال به سامانه فیش حقوقی و بیمه', dueDate: '2024-06-20', priority: 'High', assignedToId: 7, status: 'Doing', sprintNumber: 2, approver1Id: 4 }
        ],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 108,
        type: 'waterfall',
        name: 'بهینه‌سازی سیستم‌های تاسیساتی برج اداری',
        projectManagerId: 5,
        startDate: '2024-04-01',
        endDate: '2024-08-31',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد ساختمان > اداره تاسیسات',
        cost: 2900000,
        description: 'تعویض چیلرهای قدیمی با سیستم‌های کم‌مصرف اینورتر و هوشمندسازی موتورخانه.',
        goal: 'کاهش ۳۵ درصدی مصرف برق و گاز مجموعه در فصل تابستان و زمستان.',
        requirements: 'چیلرهای جذبی جدید، سنسورهای دما و رطوبت IoT.',
        calendarId: 1,
        teamMemberIds: [5, 6],
        risks: [
            { id: 309, description: 'افزایش دمای ساختمان حین تعویض تجهیزات در فصل گرم', probability: 'Medium', impact: 'High', responsePlan: 'استفاده از سیستم‌های سرمایشی موقت در ساعات اداری', assignedTo: 'سرپرست تاسیسات' }
        ],
        statusUpdates: [],
        documents: [],
        schedule: [
            { id: '108-1', name: 'دمونتاژ چیلرها و بویلرهای قدیمی', duration: 15, prerequisiteId: null, weight: 20, assignedToId: 6, actualProgress: 100, parentId: null, approver1Id: 5 },
            { id: '108-2', name: 'نصب و لوله‌کشی چیلرهای جدید', duration: 40, prerequisiteId: '108-1', weight: 50, assignedToId: 6, actualProgress: 70, parentId: null, approver1Id: 5 },
            { id: '108-3', name: 'اتصال سیستم BMS و راه‌اندازی', duration: 25, prerequisiteId: '108-2', weight: 30, assignedToId: 5, actualProgress: 10, parentId: null, approver1Id: 5 }
        ],
        kanbanTasks: [],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 109,
        type: 'agile',
        name: 'پلتفرم پردازش داده و داشبورد مدیریتی',
        projectManagerId: 4,
        startDate: '2024-03-01',
        endDate: '2024-09-15',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد انفورماتیک',
        cost: 2400000,
        description: 'توسعه انبار داده (Data Warehouse) و تجسم داده‌های فروش، مالی و پروژه‌ها در یک نگاه.',
        goal: 'پشتیبانی از تصمیم‌گیری داده‌محور مدیران ارشد با نمودارهای واقعی.',
        requirements: 'ابزارهای ETL، پایگاه داده PostgreSQL، داشبوردهای Apache Superset/PowerBI.',
        calendarId: 1,
        teamMemberIds: [4, 7, 3],
        risks: [
            { id: 310, description: 'مغایرت در فرمت داده‌های سامانه‌های قدیمی با داتامارت جدید', probability: 'High', impact: 'Medium', responsePlan: 'طراحی خطول استانداردسازی و پاکسازی داده‌ها (Data Cleansing)', assignedTo: 'معمار داده' }
        ],
        statusUpdates: [
            { id: 408, description: 'اتصال ۶ پایگاه داده عملیاتی به خط لوله ETL با موفقیت صورت پذیرفت.', date: '2024-05-20' }
        ],
        documents: [],
        schedule: [],
        kanbanTasks: [
            { id: 220, description: 'طراحی مدل داده ستاره‌ای انبار داده', dueDate: '2024-04-10', priority: 'High', assignedToId: 4, status: 'Done', sprintNumber: 1, approver1Id: 4 },
            { id: 221, description: 'توسعه اسکریپت‌های ETL استخراج فروش و مالی', dueDate: '2024-05-30', priority: 'High', assignedToId: 7, status: 'Done', sprintNumber: 1, approver1Id: 4 },
            { id: 222, description: 'طراحی نمودارهای پیش‌بینی بودجه و تاخیرات پروژه‌ها', dueDate: '2024-07-15', priority: 'Medium', assignedToId: 3, status: 'Doing', sprintNumber: 2, approver1Id: 4 }
        ],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 110,
        type: 'waterfall',
        name: 'تجهیز و نوسازی انبار مرکزی پشتیبانی',
        projectManagerId: 2,
        startDate: '2024-05-01',
        endDate: '2024-10-15',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد پشتیبانی > اداره تدارکات',
        cost: 4100000,
        description: 'مکانیزاسیون قفسه‌بندی‌ها، خرید لیفتراک‌های برقی و تجهیز انبار به سامانه بارکد خوانی RFID.',
        goal: 'کاهش زمان تحویل کالا و صفر کردن خطاهای انبارگردانی.',
        requirements: 'قفسه‌بندی راک سنگین، تگ‌های RFID، لیفتراک ۲ تنی.',
        calendarId: 1,
        teamMemberIds: [2, 6, 8],
        risks: [
            { id: 311, description: 'کاهش سرعت پاسخگویی به درخواست‌ها حین نصب قفسه‌ها', probability: 'Medium', impact: 'Medium', responsePlan: 'اجرای فازبندی‌شده پروژه در ۳ بلوک مجزا', assignedTo: 'مدیر انبار' }
        ],
        statusUpdates: [],
        documents: [],
        schedule: [
            { id: '110-1', name: 'تخلیه بلوک A و کف‌سازی اپکسی', duration: 20, prerequisiteId: null, weight: 25, assignedToId: 8, actualProgress: 100, parentId: null, approver1Id: 2 },
            { id: '110-2', name: 'نصب قفسه‌های سنگین طبقاتی', duration: 35, prerequisiteId: '110-1', weight: 45, assignedToId: 6, actualProgress: 30, parentId: null, approver1Id: 2 },
            { id: '110-3', name: 'استقرار سیستم RFID و تحویل لیفتراک‌ها', duration: 20, prerequisiteId: '110-2', weight: 30, assignedToId: 8, actualProgress: 0, parentId: null, approver1Id: 2 }
        ],
        kanbanTasks: [],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 111,
        type: 'agile',
        name: 'پیاده‌سازی درگاه امن پرداخت و کیف پول',
        projectManagerId: 4,
        startDate: '2024-04-15',
        endDate: '2024-09-30',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار',
        cost: 1900000,
        description: 'ایجاد زیرساخت پرداختی با استانداردهای امنیتی بالا و کیف پول اعتباری پرسنل.',
        goal: 'افزایش سرعت تراکنش‌های درون‌سازمانی و رفاهی.',
        requirements: 'گواهی‌های SSL اختصاصی، اتصال به شاپرک، توکن‌سازی امن.',
        calendarId: 1,
        teamMemberIds: [4, 7],
        risks: [
            { id: 312, description: 'مخاطرات امنیتی و حملات سایبری به درگاه پرداخت', probability: 'High', impact: 'High', responsePlan: 'تست‌های نفوذ مداوم (PenTest) و رمزنگاری دو لایه', assignedTo: 'مسئول امنیت' }
        ],
        statusUpdates: [],
        documents: [],
        schedule: [],
        kanbanTasks: [
            { id: 230, description: 'پیاده‌سازی پروتکل‌های رمزنگاری کیف پول', dueDate: '2024-05-25', priority: 'High', assignedToId: 4, status: 'Done', sprintNumber: 1, approver1Id: 4 },
            { id: 231, description: 'تست سوئیچینگ با بانک‌های عامل', dueDate: '2024-07-10', priority: 'High', assignedToId: 7, status: 'Doing', sprintNumber: 2, approver1Id: 4 },
            { id: 232, description: 'دریافت تاییدیه امنیتی شاپرک', dueDate: '2024-08-30', priority: 'High', assignedToId: 4, status: 'To-Do', sprintNumber: 2, approver1Id: 4 }
        ],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 112,
        type: 'waterfall',
        name: 'طراحی و احداث مجتمع انبارهای مکانیزه',
        projectManagerId: 2,
        startDate: '2024-06-01',
        endDate: '2025-05-31',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد ساختمان',
        cost: 18500000,
        description: 'احداث ۳ سوله صنعتی با استانداردهای ضد حریق و اتوماسیون خنک‌کننده جهت نگهداری مواد اولیه.',
        goal: 'تامین فضای انباشت استاندارد برای تولید ۲ سال آینده.',
        requirements: 'سازه سوله سقف شیب‌دار، سیستم‌های تهویه صنعتی، اعلام حریق آدرس‌پذیر.',
        calendarId: 1,
        teamMemberIds: [2, 5, 6],
        risks: [
            { id: 313, description: 'تاخیر در دریافت مجوزهای آتش‌نشانی و محیط زیست', probability: 'Medium', impact: 'High', responsePlan: 'تطبیق نقشه‌ها با آخرین آئین‌نامه‌های ملی قبل از ساخت', assignedTo: 'مشاور پروژه' }
        ],
        statusUpdates: [],
        documents: [],
        schedule: [
            { id: '112-1', name: 'تسویه‌نهایی زمین و تسطیح', duration: 30, prerequisiteId: null, weight: 15, assignedToId: 5, actualProgress: 100, parentId: null, approver1Id: 2 },
            { id: '112-2', name: 'ساخت و نصب اسکلت فلزی سوله‌ها', duration: 90, prerequisiteId: '112-1', weight: 45, assignedToId: 5, actualProgress: 20, parentId: null, approver1Id: 2 },
            { id: '112-3', name: 'پوشش سقف و کف‌سازی بتنی', duration: 60, prerequisiteId: '112-2', weight: 40, assignedToId: 6, actualProgress: 0, parentId: null, approver1Id: 2 }
        ],
        kanbanTasks: [],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 113,
        type: 'agile',
        name: 'توسعه موتور هوش مصنوعی و تحلیل پیش‌بینانه',
        projectManagerId: 4,
        startDate: '2024-05-01',
        endDate: '2024-11-30',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار',
        cost: 3500000,
        description: 'پیاده‌سازی مدل‌های یادگیری ماشین جهت تحلیل الگوی خرید مشتریان و پیش‌بینی تقاضا.',
        goal: 'کاهش عدم قطعیت در برنامه‌ریزی تولید و بهینه‌سازی زنجیره تامین.',
        requirements: 'پایتون، فریم‌ورک PyTorch/TensorFlow، پردازنده گرافیکی GPU.',
        calendarId: 1,
        teamMemberIds: [4, 7],
        risks: [
            { id: 314, description: 'کمبود داده‌های برچسب‌گذاری شده با کیفیت', probability: 'Medium', impact: 'High', responsePlan: 'استفاده از الگوریتم‌های نیمه‌نظارت‌شده', assignedTo: 'دانشمند داده' }
        ],
        statusUpdates: [
            { id: 409, description: 'مدل اولیه تحلیل پیش‌بینانه با دقت ۸۲٪ پیاده‌سازی شد.', date: '2024-06-25' }
        ],
        documents: [],
        schedule: [],
        kanbanTasks: [
            { id: 240, description: 'آماده‌سازی و پیش‌پردازش مجموعه‌داده آموزشي', dueDate: '2024-06-01', priority: 'High', assignedToId: 7, status: 'Done', sprintNumber: 1, approver1Id: 4 },
            { id: 241, description: 'آموزش و بهینه‌سازی هایپرپارامترهای مدل', dueDate: '2024-07-20', priority: 'High', assignedToId: 4, status: 'Doing', sprintNumber: 2, approver1Id: 4 }
        ],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 114,
        type: 'waterfall',
        name: 'تجهیز سالن همایش‌ها و مرکز نوآوری',
        projectManagerId: 2,
        startDate: '2024-07-01',
        endDate: '2024-12-15',
        status: 'Planning',
        owningUnit: 'سازمان > واحد پشتیبانی > اداره امور عمومی',
        cost: 5200000,
        description: 'بازسازی و تجهیز سالن ۵۰۰ نفره به ویدئو وال، سیستم صوتی پیشرفته و اتاق‌های جلسه هوشمند.',
        goal: 'برگزاری رویدادهای علمی، آموزشی و نمایشگاهی بین‌المللی.',
        requirements: 'ویدئو وال LED، سیستم اکوستیک حرفه‌ای، مبلمان ارگونومیک.',
        calendarId: 1,
        teamMemberIds: [2, 6, 8],
        risks: [
            { id: 315, description: 'تاخیر در تامین تجهیزات صوتی و تصویری وارداتی', probability: 'High', impact: 'Medium', responsePlan: 'ثبت سفارش زودهنگام و اخذ ضمانت‌نامه تحویل', assignedTo: 'مدیر پشتیبانی' }
        ],
        statusUpdates: [],
        documents: [],
        schedule: [
            { id: '114-1', name: 'طراحی معماری داخلی و اکوستیک', duration: 30, prerequisiteId: null, weight: 20, assignedToId: 6, actualProgress: 50, parentId: null, approver1Id: 2 },
            { id: '114-2', name: 'اجرای دکوراسیون و آکوستیک‌سازی', duration: 60, prerequisiteId: '114-1', weight: 45, assignedToId: 8, actualProgress: 0, parentId: null, approver1Id: 2 },
            { id: '114-3', name: 'نصب سیستم صوتی و ویدئووال', duration: 30, prerequisiteId: '114-2', weight: 35, assignedToId: 6, actualProgress: 0, parentId: null, approver1Id: 2 }
        ],
        kanbanTasks: [],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    },
    {
        id: 115,
        type: 'waterfall',
        name: 'احداث نیروگاه خورشیدی کارخانه',
        projectManagerId: 5,
        startDate: '2024-04-01',
        endDate: '2024-11-15',
        status: 'In Progress',
        owningUnit: 'سازمان > واحد ساختمان > اداره تاسیسات',
        cost: 9800000,
        description: 'نصب پانل‌های خورشیدی ۱ مگاواتی روی سقف سوله‌ها جهت تامین انرژی پاک و پایدار.',
        goal: 'کاهش هزینه‌های انرژی برق کارخانه و حرکت به سمت صنعت سبز.',
        requirements: 'پنل‌های فتوولتائیک ۵۵۰ وات، اینورترهای سانترال، استراکچر گالوانیزه.',
        calendarId: 1,
        teamMemberIds: [5, 3],
        risks: [
            { id: 316, description: 'افت راندمان پنل‌ها در فصول گرد و غبار', probability: 'Medium', impact: 'Low', responsePlan: 'پیش‌بینی سیستم شستشوی اتوماتیک پنل‌ها', assignedTo: 'تیم نگهداری' }
        ],
        statusUpdates: [
            { id: 410, description: 'سازه نگهدارنده ۵۰٪ پنل‌ها بر روی سقف سوله‌ها نصب گردید.', date: '2024-06-10' }
        ],
        documents: [],
        schedule: [
            { id: '115-1', name: 'زیرسازی و نصب استراکچر فلزی', duration: 40, prerequisiteId: null, weight: 30, assignedToId: 3, actualProgress: 80, parentId: null, approver1Id: 5 },
            { id: '115-2', name: 'نصب پنل‌های فتوولتائیک و اینورترها', duration: 50, prerequisiteId: '115-1', weight: 50, assignedToId: 5, actualProgress: 20, parentId: null, approver1Id: 5 },
            { id: '115-3', name: 'اتصال به شبکه سراسری برق و تست', duration: 20, prerequisiteId: '115-2', weight: 20, assignedToId: 3, actualProgress: 0, parentId: null, approver1Id: 5 }
        ],
        kanbanTasks: [],
        approvalStatus: 'Approved',
        plannedProgressType: 'continuous',
        tabWorkflows: { charter: true, schedule: true, team: true, risks: true, status: true, delays: true, docs: true, actions: true },
    }
];

export const initialStrategies: Strategy[] = [
    { id: 's1', name: 'افزایش سهم بازار', description: 'افزایش سهم بازار در صنایع کلیدی', weight: 60, parentId: null },
    { id: 's1-1', name: 'ورود به بازارهای جدید', description: 'ورود به بازارهای صادراتی منطقه', weight: 20, parentId: 's1' },
    { id: 's1-2', name: 'افزایش فروش در بازارهای فعلی', description: 'افزایش ۳۰ درصدی فروش محصولات فعلی', weight: 40, parentId: 's1' },
    { id: 's2', name: 'نوآوری در محصول', description: 'ارائه محصولات و خدمات جدید', weight: 40, parentId: null },
];

export const initialAlignments: ProjectStrategyAlignment[] = [
    { projectId: 102, strategyId: 's1-2', level: 'High' },
    { projectId: 104, strategyId: 's2', level: 'High' },
    { projectId: 101, strategyId: 's1-2', level: 'Medium' },
    { projectId: 107, strategyId: 's2', level: 'Medium' },
    { projectId: 109, strategyId: 's2', level: 'High' },
    { projectId: 111, strategyId: 's2', level: 'High' },
    { projectId: 113, strategyId: 's2', level: 'High' },
    { projectId: 114, strategyId: 's1-2', level: 'Medium' },
    { projectId: 115, strategyId: 's1', level: 'High' },
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
        ownerUserId: 1,
        responsibleUserId: 2,
        approver1Id: 1,
        status: 'Planning',
        calendarId: 1,
        startDate: '2024-09-01',
        endDate: '2024-09-15',
        owningUnit: 'سازمان > واحد انفورماتیک'
    },
    {
        id: 2,
        title: 'بازبینی و تایید نهایی نقشه‌های فاز ۲',
        description: 'جلسه بازبینی نهایی نقشه‌های معماری و سازه فاز دوم ساختمان مرکزی و اخذ تاییدیه از کمیته فنی.',
        ownerUserId: 1,
        responsibleUserId: 3,
        approver1Id: 2,
        status: 'In Progress',
        calendarId: 1,
        startDate: '2024-07-20',
        endDate: '2024-07-25',
        owningUnit: 'سازمان > واحد ساختمان > اداره معماری و عمران',
        projectId: 101
    },
    {
        id: 3,
        title: 'به‌روزرسانی دستورالعمل‌های ایمنی کارگاه‌ها',
        description: 'مرور و به‌روزرسانی کلیه دستورالعمل‌های ایمنی کارگاه‌های ساختمانی بر اساس آخرین استانداردها.',
        ownerUserId: 1,
        responsibleUserId: 4,
        approver1Id: 1,
        status: 'In Progress',
        calendarId: 1,
        startDate: '2024-10-01',
        endDate: '2024-10-30',
        owningUnit: 'سازمان > واحد اجرایی'
    },
    {
        id: 4,
        title: 'برگزاری جلسه دمو اپلیکیشن خدمات مشتریان',
        description: 'برگزاری جلسه نمایش نسخه اولیه اپلیکیشن خدمات مشتریان برای سهامداران اصلی و دریافت بازخورد.',
        ownerUserId: 1,
        responsibleUserId: 5,
        approver1Id: 4,
        status: 'Completed',
        calendarId: 1,
        startDate: '2024-06-20',
        endDate: '2024-06-22',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار',
        projectId: 104
    },
    {
        id: 5,
        title: 'تدوین سند معماری کلان زیرساخت شبکه',
        description: 'استخراج و مستندسازی دقیق استانداردهای جدید شبکه برای تمام شعب استان‌ها.',
        ownerUserId: 1,
        responsibleUserId: 7,
        approver1Id: 2,
        status: 'In Progress',
        calendarId: 1,
        startDate: '2024-06-15',
        endDate: '2024-07-10',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره زیرساخت و شبکه',
        projectId: 103
    },
    {
        id: 6,
        title: 'استعلام قیمت و انتخاب تامین‌کننده سرورها',
        description: 'تهیه اسناد مناقصه و دریافت استعلام قیمت برای سه دستگاه سرور پردازشی مرکزی.',
        ownerUserId: 1,
        responsibleUserId: 6,
        approver1Id: 1,
        status: 'Planning',
        calendarId: 1,
        startDate: '2024-08-01',
        endDate: '2024-08-20',
        owningUnit: 'سازمان > واحد پشتیبانی > اداره تدارکات'
    },
    {
        id: 7,
        title: 'ممیزی ایمنی و بهداشت تاسیسات برج اداری',
        description: 'بازرسی جامع از موتورخانه و سیستم‌های اطفاء حریق و ثبت گزارش عدم انطباق‌ها.',
        ownerUserId: 1,
        responsibleUserId: 5,
        approver1Id: 2,
        status: 'Completed',
        calendarId: 1,
        startDate: '2024-05-20',
        endDate: '2024-05-30',
        owningUnit: 'سازمان > واحد ساختمان > اداره تاسیسات',
        projectId: 108
    },
    {
        id: 8,
        title: 'تهیه گزارش ارزیابی تاثیرات زیست‌محیطی',
        description: 'تکمیل فرم‌های سازمان حفاظت محیط زیست و ارسال مدارک جهت دریافت مجوز نهایی سد.',
        ownerUserId: 1,
        responsibleUserId: 3,
        approver1Id: 2,
        status: 'In Progress',
        calendarId: 1,
        startDate: '2024-08-10',
        endDate: '2024-09-05',
        owningUnit: 'سازمان > واحد ساختمان',
        projectId: 105
    },
    {
        id: 9,
        title: 'سازماندهی تیم تست نفوذ و امنیت داده',
        description: 'هماهنگی با آزمایشگاه معتمد برای انجام ارزیابی‌های امنیتی درگاه پرداخت.',
        ownerUserId: 1,
        responsibleUserId: 4,
        approver1Id: 1,
        status: 'Planning',
        calendarId: 1,
        startDate: '2024-09-10',
        endDate: '2024-09-25',
        owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار',
        projectId: 111
    },
    {
        id: 10,
        title: 'تحویل و انبارگردانی تجهیزات نظارت تصویری',
        description: 'بررسی سلامت فیزیکی و تطبیق سریال دوربین‌های خریداری‌شده در انبار مرکزی.',
        ownerUserId: 1,
        responsibleUserId: 8,
        approver1Id: 6,
        status: 'Completed',
        calendarId: 1,
        startDate: '2024-04-15',
        endDate: '2024-04-25',
        owningUnit: 'سازمان > واحد پشتیبانی > اداره امور عمومی',
        projectId: 114
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
