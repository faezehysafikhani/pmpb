import React, { useState, useContext, useMemo } from 'react';
import { LocalizationContext } from '../context';

interface FeatureCategory {
  id: string;
  titleFa: string;
  titleEn: string;
  icon: string;
  color: string;
  features: {
    titleFa: string;
    titleEn: string;
    descFa: string;
    descEn: string;
    keyPointsFa?: string[];
    keyPointsEn?: string[];
    badgesFa: string[];
    badgesEn: string[];
  }[];
}

export const FeaturesHandbook: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { language } = useContext(LocalizationContext);
  const isFa = language === 'fa';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');

  const categories: FeatureCategory[] = useMemo(() => [
    {
      id: 'portfolio',
      titleFa: '۱. مدیریت پورتفولیو، منشور، ساختار شکست و برنامه‌ریزی پروژه‌ها (Portfolio & Planning)',
      titleEn: '1. Portfolio, Charter, WBS & Project Planning',
      icon: 'account_tree',
      color: '#2563eb',
      features: [
        {
          titleFa: 'پشتیبانی دوگانه از متدولوژی‌های Waterfall (آبشاری) و Agile (چابک)',
          titleEn: 'Dual Methodology Support: Waterfall & Agile',
          descFa: 'امکان تعریف، مدیریت و پایش پروژه‌ها بر اساس ماهیت کاری به دو متدولوژی مجزا و استاندارد: در متدولوژی آبشاری، فازها، مایلستون‌های کلیدی، روابط پیش‌نیازی چهارگانه (FS, SS, FF, SF)، تقویم‌های کاری و گانت‌چارت تعاملی با قابلیت جابجایی خط زمان پیاده‌سازی شده است. در متدولوژی اجایل، بک‌لوگ محصول، دوره‌های اسپرینت با اهداف مشخص، برآورد امتیاز داستانی (Story Points)، وظایف کانبان و سرعت تیم (Velocity) پوشش داده می‌شود.',
          keyPointsFa: [
            'قابلیت تعریف فازها، مایلستون‌ها و وابستگی‌های پیش‌نیازی در متدولوژی آبشاری',
            'گانت‌چارت داینامیک با نمایش زمان‌بندی شمسی و میلادی و وضعیت درصد پیشرفت',
            'مدیریت اسپرینت‌ها، امتیاز داستانی و بک‌لوگ تعاملی در متدولوژی چابک',
            'تغییر متدولوژی و سفارشی‌سازی جریان کار بر اساس نیاز هر پروژه'
          ],
          keyPointsEn: [
            'Structured phases, milestones, and 4-type dependency relations (FS, SS, FF, SF)',
            'Interactive Gantt chart with dual Jalali/Gregorian timelines and progress tracking',
            'Sprint cycles, story point estimation, and dynamic backlog management for Agile',
            'Adaptive methodology workflow configured per project requirements'
          ],
          badgesFa: ['آبشاری', 'چابک', 'گانت چارت', 'اسپرینت', 'روابط پیش‌نیازی'],
          badgesEn: ['Waterfall', 'Agile', 'Gantt Chart', 'Sprints', 'Dependencies']
        },
        {
          titleFa: 'نمودار پیشرفت اسپرینت‌ها (Burn-Up / Burn-Down) با استخراج زمان تایید',
          titleEn: 'Sprint Burn-Up & Burn-Down Progress Charts with Approval-Based Completion',
          descFa: 'در پروژه‌های چابک (Agile)، امکان دسترسی به نمودار پیشرفت پیشرفته با قابلیت سوییچ بین حالت‌های Burn Up (نمایش روند تکمیل موارد و توسعه حوزه پروژه در طول اسپرینت‌ها) و Burn Down (پایش موارد باقیمانده در هر اسپرینت) فراهم شده است. تکمیل اقلام بر اساس زمان تایید و وضعیت مصوب تسک‌ها در اسپرینت مربوطه استخراج و به تصویر کشیده می‌شود.',
          keyPointsFa: [
            'قابلیت سوییچ آنی میان نمودارهای برن آپ (Burn Up) و برن داون (Burn Down)',
            'استخراج وضعیت و زمان تکمیل موارد بر اساس تاییدیه‌های رسمی و وضعیت اسپرینت‌ها',
            'محور افقی مبتنی بر شماره اسپرینت‌ها با تحلیل جامع حجم کار و پیشرفت تجمعی',
            'پشتیبانی از زبان‌های فارسی و انگلیسی و خروجی گزارش‌های تحلیلی'
          ],
          keyPointsEn: [
            'Toggle switch between Burn Up (cumulative completed vs total scope) and Burn Down charts',
            'Accurate completion extraction based on official task approvals and sprint assignment',
            'Sprint-based horizontal timeline with comprehensive cumulative progress metrics',
            'Full bilingual support (Persian/English) and analytical reporting'
          ],
          badgesFa: ['چابک', 'برن آپ', 'برن داون', 'اسپرینت', 'تاییدیه پیشرفت'],
          badgesEn: ['Agile', 'Burn Up', 'Burn Down', 'Sprints', 'Approval Tracking']
        },
        {
          titleFa: 'ارزیابی و اعتبارسنجی هوشمند منشور پروژه با هوش مصنوعی (AI Charter Validation)',
          titleEn: 'AI-Powered Project Charter Quality Validation',
          descFa: 'موتور هوشمند اعتبارسنجی منشور پروژه بلافاصله پس از تکمیل یا ذخیره منشور فعال شده و کیفیت متون را بررسی می‌کند. این ماژول شفافیت اهداف، مشخص بودن معیارهای پذیرش، قابلیت اندازه‌گیری دستاوردها، واقع‌گرایی زمان‌بندی و تناسب بودجه را با استفاده از الگوهای مدیریت پروژه تحلیل کرده و پیشنهادهای کاربردی برای اصلاح پیش از ورود به چرخه تاییدات ارائه می‌دهد.',
          keyPointsFa: [
            'سنجش هوشمند شفافیت اهداف، محدوده و خروجی‌های کلیدی منشور',
            'بررسی تناسب زمان‌بندی پیش‌بینی شده با حجم کار و نیازمندی‌های پروژه',
            'شناسایی عدم قطعیت‌ها و ارائه توصیه‌های بهبود پیش از ارسال برای تصویب مدیران',
            'کاهش ریسک‌های ناشی از ابهام در شرح خدمات و اهداف پروژه'
          ],
          keyPointsEn: [
            'Automated audit of charter goal clarity, scope boundaries, and deliverables',
            'Schedule and budget realism assessment against stated objectives',
            'Defect and gap identification with actionable refinement recommendations',
            'Prevents downstream scope creep and ambiguity before formal approval'
          ],
          badgesFa: ['هوش مصنوعی', 'اعتبارسنجی منشور', 'کنترل کیفیت', 'ارزیابی اهداف'],
          badgesEn: ['AI Validation', 'Project Charter', 'Quality Audit', 'Goal Clarity']
        },
        {
          titleFa: 'ساختار شکست کار تعاملی (WBS) با اوزان فیزیکی و تولید خودکار با AI',
          titleEn: 'Interactive WBS, Dynamic Weighting & AI Auto-Generation',
          descFa: 'درخت سلسله‌مراتبی ساختار شکست کار (WBS) امکان تعریف سطوح مختلف فعالیت‌ها را با محاسبه خودکار اوزان فیزیکی (بر اساس مدت‌زمان) یا وزن‌دهی دستی و درصدی فراهم می‌سازد. سیستم به صورت خودکار پیشرفت‌های ثبت‌شده در پایین‌ترین سطح را به سطوح والد و کل پروژه تجمیع (Roll-up) می‌کند. همچنین دستیار هوش مصنوعی می‌تواند با بررسی نام و شرح پروژه، ساختار WBS کامل و استانداردی را به صورت آنی تولید نماید.',
          keyPointsFa: [
            'نمایش درختی و سلسله‌مراتبی فعالیت‌ها با کدینگ استاندارد WBS',
            'محاسبه خودکار وزن فیزیکی بر اساس مدت‌زمان یا تخصیص دستی اوزان',
            'تجمیع خودکار (Roll-up) درصد پیشرفت برنامه‌ای و واقعی در گره‌های والد',
            'تولید هوشمند ساختار WBS با هوش مصنوعی و امکان افزودن مستقیم به پروژه'
          ],
          keyPointsEn: [
            'Hierarchical multi-tier tree display with standard WBS code generation',
            'Dynamic weight distribution (duration-based or manual custom percentage)',
            'Automatic bottom-up roll-up for planned and actual progress metrics',
            'Instant AI WBS generation tailored to project scope and domain'
          ],
          badgesFa: ['ساختار شکست (WBS)', 'وزن‌دهی فیزیکی', 'تولید هوشمند WBS', 'محاسبه تجمیعی'],
          badgesEn: ['WBS Tree', 'Physical Weights', 'AI WBS Generator', 'Roll-up Progress']
        },
        {
          titleFa: 'مدیریت جامع ریسک‌ها (با حالت دوگانه تغییر رنگ و فیلتر)، دلایل تأخیر و مستندات',
          titleEn: 'Risk Matrix (Isolated Color/Filter Modes), Delay Root-Causes & Documents',
          descFa: 'ماتریس ثبت و ارزیابی ریسک با حالت‌های دوگانه تفکیک‌شده (حالت تغییر رنگ سلول جهت ویرایش رنگ‌ها بدون فیلترکردن گرید، و حالت فیلتر جهت پایش ریسک‌ها). ثبت دلایل تاخیرات با تفکیک علل ریشه‌ای (تامین مالی، تدارکات، مجوزها، منابع انسانی) و پیشنهاد اقدامات اصلاحی و جبرانی. مرکز متمرکز آرشیو فایل‌ها و مستندات پروژه با امکان دسته‌بندی موضوعی، نسخه‌بندی و تعیین سطح دسترسی.',
          keyPointsFa: [
            'ماتریس ارزیابی ریسک با حالت تفکیک‌شده تغییر رنگ سلول بدون تاثیر بر فیلتر گرید',
            'ثبت علل ریشه‌ای تاخیرات به همراه اثرات زمانی و ریالی و اقدامات اصلاحی',
            'آرشیو متمرکز فایل‌ها و پیوست‌های پروژه با تفکیک انواع اسناد',
            'گزارش‌گیری تحلیلی از تهدیدات فعال و پایش پیشرفت طرح‌های جبرانی'
          ],
          keyPointsEn: [
            'Risk register with isolated color-change mode (toggling cell colors without filtering grid)',
            'Root-cause delay logging with schedule/cost variance impact analysis',
            'Centralized document repository with metadata tagging and attachments',
            'Actionable recovery plans and continuous risk exposure tracking'
          ],
          badgesFa: ['ماتریس ریسک', 'تغییر رنگ سلول', 'تحلیل تأخیرات', 'مدیریت اسناد'],
          badgesEn: ['Risk Register', 'Color Mode', 'Delay Analysis', 'Doc Management']
        },
        {
          titleFa: 'مدیریت قراردادها، الحاقیه‌ها و صورتحساب‌های مالی با پشتیبانی ارقام فارسی',
          titleEn: 'Contracts, Amendments & Financial Invoices with Persian Digits Support',
          descFa: 'سیستم جامع مدیریت مالی و قراردادی پروژه‌ها شامل ثبت قرارداد اصلی، الحاقیه‌های زمانی و مبلغی، صورتحساب‌های مالی، محاسبه خودکار مانده تعهدات و پیشرفت ریالی. پشتیبانی کامل از ارقام فارسی و تبدیل هوشمند عدد به حروف برای مبالغ قرارداد و صورتحساب‌ها، به همراه شماره‌گذاری و ثبت شماره صورتحساب به صورت فارسی.',
          keyPointsFa: [
            'ثبت و ویرایش اطلاعات قرارداد و الحاقیه‌ها با تبدیل خودکار ارقام و اعداد به حروف',
            'مدیریت صورتحساب‌های مالی پروژه با ورود و نمایش شماره صورتحساب فارسی',
            'محاسبه اتوماتیک جمع کل تعهدات، پرداختی‌ها و مانده حساب قراردادها',
            'سازگاری کامل با تقویم شمسی و فرمت‌بندی استاندارد مالی ریال و تومان'
          ],
          keyPointsEn: [
            'Contract and amendment creation with automatic numeral-to-words conversion',
            'Financial invoice management with Persian invoice numbering and input support',
            'Automatic computation of total commitments, payments, and remaining balances',
            'Full Shamsi calendar integration and standard Rial/Toman formatting'
          ],
          badgesFa: ['قراردادها', 'الحاقیه‌ها', 'صورتحساب مالی', 'ارقام فارسی', 'تبدیل عدد به حروف'],
          badgesEn: ['Contracts', 'Amendments', 'Financial Invoices', 'Persian Digits', 'Number to Words']
        },
        {
          titleFa: 'مدیریت سبد اقدامات مستقل و وابسته سازمانی (Action Items Portfolio)',
          titleEn: 'Organizational Action Items & Independent Tasks Portfolio',
          descFa: 'محیط یکپارچه برای مدیریت اقدامات سازمانی اعم از مصوبات جلسات، پیگیری‌های اداری و تصمیمات پروژه‌ای. ایجادکننده به عنوان مالک اقدام (Action Owner) به صورت غیرقابل تغییر قفل می‌شود. اختصاص مسئول اجرا با الزام انتخاب واحد سازمانی سطح ۲، تعیین اولویت (فوری، بالا، عادی، پایین)، موعد تحویل و پایش وضعیت پیشرفت با کنترل دقیق دسترسی‌ها.',
          keyPointsFa: [
            'ثبت اقدامات مستقل از پروژه‌ها یا مرتبط با تصمیمات پورتفولیو',
            'قفل امنیتی مالک اقدام (ایجادکننده) و جلوگیری از تغییر غیرمجاز هویت',
            'الزام انتخاب واحد سازمانی مسئول و تاریخ سررسید دقیق شمسی',
            'فیلترهای پیشرفته بر اساس مالک، مسئول، واحد سازمانی و اولویت'
          ],
          keyPointsEn: [
            'Orchestrate stand-alone action items alongside project-linked decisions',
            'Immutable action owner assignment locked to creator identity',
            'Mandatory responsible user and Level 2 organizational unit binding',
            'Advanced filtering across owners, assignees, owning units, and priority levels'
          ],
          badgesFa: ['اقدامات سازمانی', 'مالک اقدام', 'مسئول اجرا', 'پیگیری مصوبات'],
          badgesEn: ['Action Items', 'Action Owner', 'Assignee', 'Task Tracking']
        }
      ]
    },
    {
      id: 'dashboards',
      titleFa: '۲. هاب داشبوردها، گزارشات تحلیلی، ارزیابی عملکرد و ماتریس‌ها (Dashboards & Reports)',
      titleEn: '2. Executive Dashboards, Performance Analytics & Matrix Hub',
      icon: 'dashboard_customize',
      color: '#7c3aed',
      features: [
        {
          titleFa: 'هاب جامع پایش پورتفولیو و فیلترهای چندبعدی (Dashboard Hub)',
          titleEn: 'Portfolio Dashboard Hub & Multi-Dimensional Filtering',
          descFa: 'مرکز دیداری جامع مدیران ارشد شامل کارت‌های شاخص کلیدی عملکرد (تعداد کل، میانگین پیشرفت برنامه‌ای و واقعی، پروژه‌های دارای تاخیر بحرانی و اقدامات باز). نمودارهای تفکیکی دونات/میله‌ای با پالت رنگ‌های زنده و تفکیک‌شده برای توزیع پروژه‌ها و اقدامات بر اساس واحد سازمانی سطح ۲، وضعیت و متدولوژی. فیلترهای همزمان و آنی بر اساس نام، واحد، وضعیت و مدیر پروژه.',
          keyPointsFa: [
            'خلاصه شاخص‌های کلیدی عملکرد (KPIs) در سطح کل سازمان و سبد پروژه‌ها',
            'نمودارهای دایره‌ای و میله‌ای تعاملی با قابلیت سوییچ و پالت رنگی زنده',
            'فیلترهای همزمان چندمعیاره بر اساس واحد سازمانی، وضعیت، متدولوژی و مدیر',
            'مشاهده سریع اطلاعات آماری پروژه‌ها و اقدامات در یک نگاه'
          ],
          keyPointsEn: [
            'Executive KPI cards tracking portfolio progress, budget, and delay rates',
            'Vibrant interactive doughnut and bar charts with smooth view switching',
            'Instant multi-dimensional filters by unit, status, methodology, and manager',
            'Unified holistic visibility across both project and action portfolios'
          ],
          badgesFa: ['هاب داشبورد', 'شاخص‌های کلیدی (KPI)', 'نمودار تعاملی', 'فیلتر ترکیبی'],
          badgesEn: ['Dashboard Hub', 'Executive KPIs', 'Interactive Charts', 'Multi-Filters']
        },
        {
          titleFa: 'داشبورد تخصصی و اختصاصی هر پروژه (Dedicated Project Analytics Dashboard)',
          titleEn: 'Project-Specific Analytics Dashboard with S-Curve',
          descFa: 'صفحه تحلیلی مجزا و عمیق برای هر پروژه، قابل دسترسی از تمام بخش‌های نرم‌افزار، جداول و چت‌بات هوش مصنوعی. این داشبورد شامل منحنی پیشرفت اس‌کرو (S-Curve) مقایسه‌ای پیشرفت برنامه‌ای در برابر پیشرفت واقعی، شاخص انحراف زمانی (Schedule Variance)، درصد پیشرفت فازها و وزن‌ها، وضعیت مایلستون‌ها، ماتریس ریسک‌های فعال و اقدامات مرتبط است.',
          keyPointsFa: [
            'ترسیم منحنی S-Curve پیشرفت زمانی برنامه‌ای در مقایسه با پیشرفت واقعی',
            'محاسبه دقیق انحراف زمانی و شاخص‌های ارزش کسب‌شده (EVM)',
            'تحلیل وضعیت پیشرفت به تفکیک فازها، اوزان و مایلستون‌های کلیدی',
            'دسترسی سریع با یک کلیک از لیست پروژه‌ها، ماتریس‌ها و پاسخ‌های بات هوش مصنوعی'
          ],
          keyPointsEn: [
            'Comparative S-Curve visualization of baseline plan vs actual progress',
            'Schedule variance and earned value metrics calculated in real-time',
            'Phase-by-phase progress, weight distribution, and milestone tracking',
            'One-click launcher accessible from project lists, matrix, and AI chatbot'
          ],
          badgesFa: ['داشبورد اختصاصی', 'نمودار S-Curve', 'انحراف زمان‌بندی', 'تحلیل فازها'],
          badgesEn: ['Project Dashboard', 'S-Curve', 'Schedule Variance', 'Phase Analytics']
        },
        {
          titleFa: 'گزارش ارزیابی عملکرد واحدهای سازمانی بر اساس سطح ۲ (Unit Performance Evaluation)',
          titleEn: 'Organizational Unit (Level 2) Performance Evaluation Report',
          descFa: 'گزارش تحلیلی ارزیابی عملکرد کلیه واحدهای سازمانی با تجمیع بر اساس واحد سازمانی سطح ۲ (سطح معاونت/مدیریت). محاسبه شاخص ترکیبی عملکرد (Performance Index)، رده‌بندی کیفی (عالی بالای ۹۰٪، خوب بالای ۷۰٪، نیازمند بهبود)، مقایسه میانگین پیشرفت برنامه‌ای و واقعی، درصد انحراف و تعداد پروژه‌های دارای تاخیر به همراه نمودار مقایسه‌ای میله‌ای با گرادیان‌های زنده.',
          keyPointsFa: [
            'تجمیع و محاسبه داده‌ها به صورت دقیق بر اساس واحدهای سازمانی سطح ۲',
            'محاسبه شاخص عملکرد، انحراف برنامه‌ای و رتبه‌بندی عملکردی واحدها',
            'نمودار افقی مقایسه عملکرد با طیف رنگی زنده و متمایز برای هر واحد',
            'شناسایی واحدهای پیشرو و بخش‌های نیازمند پشتیبانی و تسریع اجرایی'
          ],
          keyPointsEn: [
            'Strict aggregation and scoring based on Level 2 organizational units',
            'Performance index computation, variance tracking, and qualitative rating',
            'Horizontal comparative bar charts with vibrant distinct gradients per unit',
            'Identifies top-performing departments and units requiring managerial support'
          ],
          badgesFa: ['ارزیابی عملکرد', 'رتبه‌بندی واحدها', 'واحد سازمانی سطح ۲', 'نمودار مقایسه‌ای'],
          badgesEn: ['Performance Score', 'Unit Ranking', 'Level 2 Units', 'Comparative Charts']
        },
        {
          titleFa: 'گزارش ارزیابی عملکرد مدیران پروژه و تحلیل راندمان (Project Managers Evaluation)',
          titleEn: 'Project Managers Performance & Delivery Evaluation',
          descFa: 'ارزیابی جامع مدیران پروژه بر اساس شاخص‌های تحویل به موقع، میانگین پیشرفت واقعی پروژه‌های تحت هدایت، انحراف از برنامه زمان‌بندی مصوب و تعداد پروژه‌های با تاخیر. امکان کلیک روی ردیف هر مدیر جهت نمایش لیست کامل پروژه‌ها و باز کردن مستقیم داشبورد هر پروژه.',
          keyPointsFa: [
            'سنجش کارایی و اثربخشی مدیران پروژه در تحویل به موقع مایلستون‌ها',
            'محاسبه میانگین انحراف و امتیاز عملکردی برای هر مدیر پروژه',
            'دسترسی سریع به سبد پروژه‌های هر مدیر و باز کردن مستقیم تحلیل‌ها',
            'تسهیل تصمیم‌گیری در توزیع عادلانه بار کاری میان مدیران'
          ],
          keyPointsEn: [
            'Objective evaluation of project managers based on delivery timeliness',
            'Average schedule variance and performance scoring per project manager',
            'Direct drill-down into managed project portfolios and dashboards',
            'Enables balanced workload allocation across management teams'
          ],
          badgesFa: ['مدیران پروژه', 'راندمان اجرایی', 'تحلیل مدیران', 'تحویل به موقع'],
          badgesEn: ['Project Managers', 'Executive Delivery', 'Manager Ranking', 'On-time Delivery']
        },
        {
          titleFa: 'ماتریس تعاملی توزیع پروژه‌ها: واحد سازمانی (سطح ۲) در برابر وضعیت (Matrix Hub)',
          titleEn: 'Interactive Matrix: Owning Unit (Level 2) vs. Project Status',
          descFa: 'ماتریس دوبعدی توزیع پروژه‌ها میان واحدهای سازمانی (سطح ۲) و وضعیت‌های کاری (برنامه‌ریزی، در جریان، متوقف، تکمیل‌شده) با محاسبه جمع سطر و ستون. این ماتریس تعاملی بوده و با کلیک روی هر سلول یا جمع‌های کل، جدول فیلترشده پروژه‌های متناظر در پایین صفحه نمایش داده شده و کاربر می‌تواند جزئیات یا داشبورد پروژه را بررسی کند.',
          keyPointsFa: [
            'ماتریس متقاطع وضعیت‌های چهارگانه در برابر واحدهای سازمانی سطح ۲',
            'محاسبه خودکار جمع سطرها (کل واحد) و جمع ستون‌ها (کل وضعیت)',
            'فیلتر تعاملی و آنی پروژه‌ها با کلیک روی هر سلول از ماتریس',
            'امکان بررسی سریع وضعیت سبد پروژه‌های هر واحد سازمانی'
          ],
          keyPointsEn: [
            'Cross-tabulation matrix of 4 standard statuses against Level 2 units',
            'Automatic row totals (unit totals) and column totals (status totals)',
            'Interactive drill-down on cell click to inspect corresponding project list',
            'Instant inspection of departmental project distribution and bottlenecks'
          ],
          badgesFa: ['ماتریس وضعیت/واحد', 'تحلیل دوبعدی', 'کلیک تعاملی', 'فیلتر سریع', 'سطح ۲'],
          badgesEn: ['Status/Unit Matrix', '2D Cross-tab', 'Drill-Down', 'Instant Filter', 'Level 2']
        },
        {
          titleFa: 'ماتریس همراستایی استراتژیک پروژه‌ها با اهداف کلان (Strategic Alignment Matrix)',
          titleEn: 'Strategic Alignment Matrix & Corporate Goals Alignment',
          descFa: 'سنجش و نمایش بصری میزان انطباق و پشتیبانی پروژه‌ها از اهداف، استراتژی‌ها و چشم‌اندازهای کلان سازمان جهت اولویت‌بندی بهینه تخصیص منابع و سرمایه‌گذاری‌ها.',
          keyPointsFa: [
            'تطبیق پروژه‌ها با محورها و اهداف استراتژیک سازمان',
            'رتبه‌بندی میزان اثرگذاری پروژه‌ها بر اهداف کلان',
            'بهینه‌سازی تصمیمات سرمایه‌گذاری و بودجه‌ریزی پروژه‌ها'
          ],
          keyPointsEn: [
            'Mapping projects against core strategic pillars and organizational goals',
            'Impact rating of initiatives on top-level corporate targets',
            'Optimizes portfolio capital allocation and prioritization'
          ],
          badgesFa: ['همراستایی استراتژیک', 'اهداف کلان', 'اولویت‌بندی', 'پورتفولیو استراتژیک'],
          badgesEn: ['Strategic Alignment', 'Corporate Goals', 'Prioritization', 'Strategic Portfolio']
        }
      ]
    },
    {
      id: 'tasks',
      titleFa: '۳. مرکز مدیریت وظایف، کانبان بورد و کارتابل شخصی (Task Center & Kanban)',
      titleEn: '3. Task Center, Interactive Kanban & Personal Workbench',
      icon: 'view_kanban',
      color: '#059669',
      features: [
        {
          titleFa: 'کارتابل شخص‌محور وظایف و اقدامات (Personal Task Center)',
          titleEn: 'Personalized Task & Action Center',
          descFa: 'کارتابل متمرکز و اختصاصی برای هر کاربر سازمان جهت مشاهده کلیه فعالیت‌های زمان‌بندی‌شده پروژه‌ها و اقدامات منتسب به وی، ثبت درصد پیشرفت کارکرد، ثبت یادداشت و ارسال درخواست تایید پیشرفت به مدیر پروژه.',
          keyPointsFa: [
            'مشاهده اختصاصی کلیه وظایف و اقدامات محوله به کاربر جاری',
            'ثبت درصد پیشرفت کارکرد واقعی و توضیحات فنی برای هر فعالیت',
            'ارسال خودکار اعلان تایید پیشرفت به مدیر پروژه و کارتابل تاییدات',
            'پایش ضرب‌الاجل‌ها و اولویت‌بندی کارهای روزانه'
          ],
          keyPointsEn: [
            'Dedicated personal inbox for all assigned project tasks and actions',
            'Direct progress logging and operational commentary entry',
            'Automatic submission to managerial approval center for verification',
            'Deadline monitoring and daily priority management'
          ],
          badgesFa: ['کارتابل وظایف', 'پیشرفت فردی', 'ثبت کارکرد', 'اقدامات محوله'],
          badgesEn: ['Task Center', 'Individual Progress', 'Timesheet/Progress', 'Assigned Actions']
        },
        {
          titleFa: 'تخته کانبان چابک با کشیدن و رها کردن (Interactive Drag & Drop Kanban)',
          titleEn: 'Interactive Agile Kanban Board with Drag & Drop',
          descFa: 'مدیریت بصری وظایف در ستون‌های کارها (To Do، In Progress، Under Review، Done) با قابلیت کشیدن و رها کردن کارت‌ها، برچسب‌های اولویت‌بندی، انتساب اسپرینت، مسئول انجام و فیلترهای آنی.',
          keyPointsFa: [
            'حرکت روان کارت‌ها بین ستون‌های کاری با Drag & Drop',
            'فیلتر بر اساس اسپرینت، عضو تیم و اولویت کاری',
            'نمایش چک‌لیست‌ها و زیروظایف روی هر کارت کانبان',
            'بروزرسانی بلادرنگ وضعیت در بک‌لوگ و گزارش‌های پروژه'
          ],
          keyPointsEn: [
            'Smooth drag-and-drop task movements across status columns',
            'Filtering by sprint cycle, team member, and priority level',
            'Sub-task checklists and story point badges on cards',
            'Real-time synchronization with project backlog and metrics'
          ],
          badgesFa: ['کانبان تعاملی', 'کشیدن و رها کردن', 'مدیریت بصری', 'اسپرینت'],
          badgesEn: ['Interactive Kanban', 'Drag & Drop', 'Visual Tracking', 'Sprint Tags']
        },
        {
          titleFa: 'لاگ شفاف تغییرات و تاریخچه سوابق فعالیت‌ها (Audit Log & History)',
          titleEn: 'Activity Audit Log & Historical Change Records',
          descFa: 'ثبت دقیق و تغییرناپذیر تاریخچه کلیه تغییرات وضعیت، درصد پیشرفت، نظرات کاربران، لاگ‌های سیستمی و تغییرات منشور جهت تضمین شفافیت سازمانی و مستندسازی دقیق تحولات.',
          keyPointsFa: [
            'ثبت تاریخچه زمانی رویدادها، تاییدات و تغییرات وضعیت',
            'شفافیت کامل در پیگیری مسئول تغییرات و سوابق پیشین',
            'پشتیبانی از الزامات ممیزی سازمانی و استانداردهای حاکمیتی'
          ],
          keyPointsEn: [
            'Chronological timestamped recording of approvals and status transitions',
            'Complete accountability with user tracking and historic snapshot storage',
            'Complies with organizational audit and governance requirements'
          ],
          badgesFa: ['لاگ تغییرات', 'شفافیت سازمانی', 'سوابق فعالیت‌ها', 'ردیابی تاریخچه'],
          badgesEn: ['Audit Log', 'Governance', 'Activity History', 'Change Tracking']
        }
      ]
    },
    {
      id: 'workflow',
      titleFa: '۴. مرکز گردش کار، تاییدات مدیریتی و تفویض اختیار (Approvals & Governance)',
      titleEn: '4. Managerial Approval Center, Workflow & Delegation',
      icon: 'approval',
      color: '#d97706',
      features: [
        {
          titleFa: 'کارتابل هوشمند تاییدات مدیریتی (Managerial Approval Center)',
          titleEn: 'Managerial Approval Center & Governance Workflow',
          descFa: 'بررسی، تایید یا رد مرحله‌ای درخواست‌های ایجاد پروژه جدید، اصلاح منشور، ثبت درصد پیشرفت فعالیت‌ها و تحویل مایلستون‌ها همراه با ثبت توضیحات و بازخورد به درخواست‌دهنده.',
          keyPointsFa: [
            'بررسی چندمرحله‌ای منشورهای پیشنهادی و پیشرفت‌های ارسالی',
            'امکان تایید با اصلاحات یا رد همراه با ثبت دلایل به درخواست‌دهنده',
            'جلوگیری از اعمال تغییرات پیشرفت بدون تایید مدیر پروژه یا مافوق'
          ],
          keyPointsEn: [
            'Multi-step gatekeeping for charters and task completion submissions',
            'Approve, reject, or request revisions with structured feedback',
            'Prevents unverified progress modifications from skewing portfolio data'
          ],
          badgesFa: ['تاییدات مدیران', 'گردش کار', 'کنترل کیفیت', 'تصویب منشور'],
          badgesEn: ['Approval Center', 'Workflow Engine', 'Quality Gate', 'Charter Sign-off']
        },
        {
          titleFa: 'امکان‌سنجی فنی و مالی پروژه‌ها با هوش مصنوعی (AI Project Feasibility)',
          titleEn: 'AI Technical, Financial & Risk Feasibility Assessment',
          descFa: 'ارزیابی خودکار و همه‌جانبه توجیه فنی، بازگشت مالی، پیچیدگی اجرایی و ساختار ریسک در کارتابل تاییدات توسط هوش مصنوعی با ارائه پیشنهاد اصلاحات و امکان انتقال مستقیم به کادر نظرات مدیر با یک کلیک.',
          keyPointsFa: [
            'تحلیل خودکار توجیه اقتصادی و فنی پیش از تصویب نهایی پروژه',
            'پیشنهاد بندهای اصلاحی و امکان انتقال مستقیم به کادر پیام مدیر با یک کلیک',
            'ارزیابی سریع بار منابع و تداخل‌های احتمالی با سایر پروژه‌ها'
          ],
          keyPointsEn: [
            'Automated technical and financial viability assessment before sign-off',
            'Generates tailored suggestions with one-click transfer to comment field',
            'Evaluates resource contention and portfolio conflict risks'
          ],
          badgesFa: ['هوش مصنوعی', 'امکان‌سنجی فنی', 'توجیه مالی', 'پیشنهاد اصلاحات'],
          badgesEn: ['AI Feasibility', 'Technical Viability', 'Financial ROI', 'Suggested Revisions']
        },
        {
          titleFa: 'سیستم تفویض اختیار و جانشینی (Delegation & Substitute System)',
          titleEn: 'Authority Delegation & Substitute Assignment System',
          descFa: 'امکان تفویض صلاحیت تاییدات مدیریتی و مسئولیت‌های کارتابل به همکاران در بازه‌های زمانی معین (ایام مرخصی یا ماموریت) با حفظ کامل شفافیت، لاگ سازمانی و بازگشت خودکار پس از انقضا.',
          keyPointsFa: [
            'تعریف جانشین با تعیین بازه زمانی مشخص و حوزه اختیارات',
            'حفظ لاگ اقدامات انجام‌شده توسط جانشین جهت شفافیت سازمانی',
            'انقضای خودکار و بازگشت دسترسی‌ها به مدیر اصلی پس از پایان بازه'
          ],
          keyPointsEn: [
            'Designate substitutes with specific date ranges and scope of authority',
            'Transparent audit trail recording substitute actions on behalf of manager',
            'Automatic expiration and permission restoration after deadline'
          ],
          badgesFa: ['تفویض اختیار', 'مدیریت جانشینی', 'ماموریت و مرخصی', 'تداوم گردش کار'],
          badgesEn: ['Delegation', 'Substitute Manager', 'Leave Continuity', 'Workflow Uninterrupted']
        }
      ]
    },
    {
      id: 'ai',
      titleFa: '۵. دستیار هوشمند، چت‌بات تعاملی و تحلیل‌گر خودکار (AI Assistant & Automation)',
      titleEn: '5. AI Assistant, Interactive Chatbot & Smart Automation',
      icon: 'smart_toy',
      color: '#0284c7',
      features: [
        {
          titleFa: 'چت‌بات تعاملی هوش مصنوعی با خروجی جداول و دسترسی مستقیم به داشبورد',
          titleEn: 'Interactive AI Chatbot with Dynamic Tables & Direct Launchers',
          descFa: 'دستیار گفتگومحور با دسترسی لحظه‌ای به کلیه داده‌های پروژه‌ها، تاخیرات، اقدامات و بودجه‌ها؛ قابلیت پاسخ به سوالات تحلیلی، رسم جداول ساختاریافته و ارائه دکمه/آیکون تک‌کلیک جهت پرش مستقیم به داشبورد اختصاصی پروژه موردنظر.',
          keyPointsFa: [
            'پاسخگویی به سوالات مدیریتی، آماری و تحلیلی به زبان طبیعی',
            'ارائه جداول مقایسه‌ای و ساختاریافته در پاسخ‌ها',
            'آیکون و دکمه اختصاصی پرش مستقیم به داشبورد تحلیلی پروژه در متن چت',
            'تحلیل ریسک‌ها، دلایل تاخیر و بودجه‌ها بدون نیاز به جستجوی دستی'
          ],
          keyPointsEn: [
            'Conversational natural language querying across all portfolio data',
            'Generates markdown tables and structured summary comparisons',
            'Inline direct dashboard launcher button embedded inside responses',
            'Instant queries on risks, delays, budgets, and assignments'
          ],
          badgesFa: ['چت‌بات هوشمند', 'تحلیل لحظه‌ای', 'جداول پویا', 'ورود مستقیم به داشبورد'],
          badgesEn: ['AI Chatbot', 'Real-time Analytics', 'Dynamic Tables', 'Direct Dashboard Launch']
        },
        {
          titleFa: 'موتور پیشنهاددهنده هوشمند اقدامات اصلاحی برای پروژه‌های دارای تاخیر',
          titleEn: 'AI Corrective Action Recommender for Delayed Projects',
          descFa: 'شناسایی و عارضه‌یابی خودکار پروژه‌هایی که پیشرفت واقعی آن‌ها از برنامه مصوب عقب‌تر است و پیشنهاد بسته‌های اقدام اصلاحی هدفمند (تخصیص مجدد منابع، فشرده‌سازی زمان‌بندی، بازبینی روابط پیش‌نیازی).',
          keyPointsFa: [
            'شناسایی سریع پروژه‌های با انحراف منفی بحرانی نسبت به برنامه مصوب',
            'پیشنهاد استراتژی‌های فشرده‌سازی زمان‌بندی (Crashing / Fast-tracking)',
            'امکان تبدیل مستقیم پیشنهادات به اقدام سازمانی و ارجاع به مسئول'
          ],
          keyPointsEn: [
            'Automatic alert triggers for projects with severe schedule deviation',
            'Schedule compression advice (crashing, fast-tracking, resource leveling)',
            'Converts AI mitigation recommendations into real tracked action items'
          ],
          badgesFa: ['اقدام اصلاحی', 'جبران تاخیر', 'عارضه‌یابی خودکار', 'بهینه‌سازی منابع'],
          badgesEn: ['Corrective Action', 'Schedule Crashing', 'Auto Diagnosis', 'Resource Optimization']
        }
      ]
    },
    {
      id: 'settings',
      titleFa: '۶. ساختار شکست سازمانی، امنیت، سطوح دسترسی و تنظیمات پایه (OBS & Settings)',
      titleEn: '6. Organizational Breakdown Structure (OBS), Security & Master Data',
      icon: 'tune',
      color: '#475569',
      features: [
        {
          titleFa: 'مدیریت درخت ساختار شکست سازمانی (OBS) و تجمیع در سطح ۲',
          titleEn: 'Organizational Breakdown Structure (OBS) Hierarchy & Level 2 Focus',
          descFa: 'تعریف و ویرایش سلسله‌مراتبی واحدهای سازمانی در سطوح چندگانه (معاونت > مدیریت > اداره)، استفاده استاندارد از واحد سازمانی سطح ۲ در کلیه داشبوردها، گزارشات ارزیابی عملکرد و ماتریس‌ها، و الزام انتساب هر کاربر به واحد سازمانی مشخص.',
          keyPointsFa: [
            'تعریف سلسله‌مراتب سازمانی چند سطحی با تفکیک معاونت و مدیریت',
            'مبنا قرار گرفتن واحد سازمانی سطح ۲ در تمام محاسبات، داشبوردها و ماتریس‌ها',
            'الزام انتساب هر کاربر به واحد سازمانی مربوطه در ثبت‌نام و ویرایش',
            'فیلترسازی یکپارچه داده‌ها بر اساس شاخه‌های درخت سازمانی'
          ],
          keyPointsEn: [
            'Multi-tier organizational breakdown structure (Division > Department > Unit)',
            'Standardized Level 2 unit aggregation across all dashboards, reports, and matrices',
            'Mandatory user-to-unit mapping enforced across forms and workflows',
            'Hierarchical security and visibility filtering across the organizational tree'
          ],
          badgesFa: ['ساختار سازمانی (OBS)', 'سلسله‌مراتب واحدها', 'واحد اجباری کاربر', 'واحد سازمانی سطح ۲'],
          badgesEn: ['Org Breakdown (OBS)', 'Hierarchical Units', 'Mandatory Unit', 'L2 Aggregation']
        },
        {
          titleFa: 'کنترل پیشرفته سطوح دسترسی و فیلترهای رویت‌پذیری سبد پروژه و اقدام',
          titleEn: 'Granular Visibility Control & Multi-Role Access Settings',
          descFa: 'پیکربندی دقیق حق رویت پروژه‌ها و اقدامات بر اساس ماتریس نقش‌ها: مالک/ایجادکننده، مدیر پروژه، مسئول اقدام، اعضای تیم، تاییدکنندگان، و رویت‌پذیری سازمانی بر اساس ریشه درخت واحدها.',
          keyPointsFa: [
            'ماتریس تنظیم حق مشاهده بر اساس نقش‌های مالک، مدیر، مسئول و عضو تیم',
            'حفظ محرمانگی اقدامات و پروژه‌های حساس میان واحدهای سازمانی',
            'قفل امنیتی ایجادکننده اقدام و جلوگیری از دستکاری داده‌ها'
          ],
          keyPointsEn: [
            'Role-based visibility matrix for Owners, PMs, Assignees, and Members',
            'Data confidentiality protection between distinct organizational branches',
            'Immutable action item creator lock to guarantee audit integrity'
          ],
          badgesFa: ['سطوح دسترسی', 'امنیت داده‌ها', 'رویت‌پذیری نقش‌محور', 'مالک اقدام'],
          badgesEn: ['Access Control', 'Data Privacy', 'Role Visibility', 'Action Owner']
        },
        {
          titleFa: 'مدیریت تقویم‌های کاری، شیفت‌ها، روزهای تعطیل و پایگاه دانش مدیریت پروژه',
          titleEn: 'Work Calendars, Shifts, Holidays & Knowledge Management Hub',
          descFa: 'تعریف تقویم‌های کاری چندگانه سازمانی با ساعات و ایام کاری منعطف، ثبت ایام تعطیلات رسمی و دوره‌ای جهت محاسبات دقیق گانت و تقویم شمسی/میلادی، همراه با پایگاه جامع مدیریت دانش شامل استانداردها، کتب و مقالات.',
          keyPointsFa: [
            'تقویم‌های کاری منعطف با پشتیبانی کامل از روزهای کاری هفته در ایران (شنبه تا چهارشنبه/پنجشنبه)',
            'محاسبه دقیق مدت‌زمان فعالیت‌ها با کسر خودکار روزهای تعطیل در گانت‌چارت',
            'پایگاه دانش متمرکز شامل کتب، استانداردها (PMBOK, PRINCE2) و فرم‌های نمونه'
          ],
          keyPointsEn: [
            'Configurable organizational working calendars with Iranian work week support',
            'Automatic holiday exclusion from activity duration and Gantt date calculations',
            'Centralized PM knowledge library hosting standards (PMBOK, Agile), books, and guides'
          ],
          badgesFa: ['تقویم کاری', 'ایام تعطیل', 'تقویم شمسی', 'مدیریت دانش'],
          badgesEn: ['Work Calendar', 'Holiday Engine', 'Jalali Support', 'Knowledge Hub']
        }
      ]
    }
  ], []);

  const filteredCategories = useMemo(() => {
    return categories
      .map(cat => {
        if (selectedCategory !== 'all' && cat.id !== selectedCategory) {
          return null;
        }
        const matchedFeatures = cat.features.filter(f => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          const title = isFa ? f.titleFa : f.titleEn;
          const desc = isFa ? f.descFa : f.descEn;
          const badges = (isFa ? f.badgesFa : f.badgesEn).join(' ');
          return title.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || badges.toLowerCase().includes(q);
        });

        if (matchedFeatures.length === 0) return null;
        return { ...cat, features: matchedFeatures };
      })
      .filter(Boolean) as FeatureCategory[];
  }, [categories, selectedCategory, searchQuery, isFa]);

  const handlePrint = (orientation?: 'landscape' | 'portrait') => {
    if (orientation) {
      setPrintOrientation(orientation);
      setTimeout(() => {
        window.print();
      }, 50);
    } else {
      window.print();
    }
  };

  return (
    <div className="features-handbook-wrapper" style={{ padding: '0.5rem' }}>
      {/* Print styles with proper landscape/portrait page fitting and clean grid rendering */}
      <style>{`
        @media print {
          @page {
            size: ${printOrientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
            margin: 8mm 8mm 8mm 8mm;
          }
          html, body {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden;
          }
          .features-handbook-printable, .features-handbook-printable * {
            visibility: visible;
          }
          .no-print,
          .sidebar,
          .app-header,
          .app-footer,
          .header-container,
          .ai-chatbot-container,
          .quick-access-section,
          nav,
          aside {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #root,
          .app-container,
          .main-content,
          .content-container,
          .features-handbook-wrapper {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .features-handbook-printable {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-sizing: border-box !important;
          }
          .features-handbook-printable * {
            box-sizing: border-box !important;
          }
          .handbook-printable-header {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            width: 100% !important;
            max-width: 100% !important;
            margin-bottom: 0.85rem !important;
            padding: 0.8rem 1rem !important;
            background: #0f172a !important;
            color: #ffffff !important;
            border-radius: 8px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          .handbook-category-section {
            break-inside: auto !important;
            page-break-inside: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            margin-bottom: 0.9rem !important;
            padding: 0.75rem !important;
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
          }
          .handbook-category-header {
            break-after: avoid !important;
            page-break-after: avoid !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            padding-bottom: 0.4rem !important;
            margin-bottom: 0.6rem !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .features-grid-container {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.65rem !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .feature-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            width: 100% !important;
            max-width: 100% !important;
            border: 1px solid #cbd5e1 !important;
            background: #f8fafc !important;
            box-shadow: none !important;
            padding: 0.65rem 0.8rem !important;
            border-radius: 6px !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .feature-card h4 {
            color: #0f172a !important;
            font-size: 0.88rem !important;
            font-weight: 700 !important;
            margin-bottom: 0.3rem !important;
            line-height: 1.35 !important;
          }
          .feature-card p {
            color: #334155 !important;
            font-size: 0.76rem !important;
            line-height: 1.45 !important;
          }
          .feature-keypoints {
            margin-top: 0.35rem !important;
            padding-right: 1.1rem !important;
            padding-left: 1.1rem !important;
            font-size: 0.72rem !important;
            line-height: 1.35 !important;
          }
          .feature-keypoints li {
            color: #1e293b !important;
            margin-bottom: 2px !important;
          }
          .handbook-footer {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-top: 1rem !important;
            padding-top: 0.6rem !important;
            font-size: 0.75rem !important;
          }
        }
      `}</style>

      <div className="features-handbook-printable">
        {/* Header Bar */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid var(--border-color, #e2e8f0)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onBack && (
              <button
                onClick={onBack}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
              >
                <span className="material-symbols-outlined">{isFa ? 'arrow_forward' : 'arrow_back'}</span>
                {isFa ? 'بازگشت به تنظیمات' : 'Back to Settings'}
              </button>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-color, #0f172a)' }}>
                {isFa ? 'کتابچه جامع امکانات و قابلیت‌های سامانه مدیریت پروژه (PM)' : 'Project Management (PM) App Features Guide'}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                {isFa ? 'راهنمای تفصیلی ماژول‌ها، ابزارهای تخصصی، هوش مصنوعی و امکانات پیشرفته سیستم' : 'Comprehensive guide of system modules, specialized tools and AI capabilities'}
              </p>
            </div>
          </div>

          {/* Action & Print Controls */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            {/* Orientation Toggle */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary, #f1f5f9)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #cbd5e1)'
            }}>
              <button
                type="button"
                onClick={() => setPrintOrientation('landscape')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: printOrientation === 'landscape' ? '#2563eb' : 'transparent',
                  color: printOrientation === 'landscape' ? '#ffffff' : 'var(--text-color, #475569)',
                  transition: 'all 0.15s ease'
                }}
                title={isFa ? 'تنظیم جهت چاپ به صورت صفحه عرضی / افقی' : 'Set print orientation to landscape'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>crop_landscape</span>
                {isFa ? 'صفحه عرضی (Landscape)' : 'Landscape'}
              </button>
              <button
                type="button"
                onClick={() => setPrintOrientation('portrait')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: printOrientation === 'portrait' ? '#2563eb' : 'transparent',
                  color: printOrientation === 'portrait' ? '#ffffff' : 'var(--text-color, #475569)',
                  transition: 'all 0.15s ease'
                }}
                title={isFa ? 'تنظیم جهت چاپ به صورت صفحه عمودی' : 'Set print orientation to portrait'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>crop_portrait</span>
                {isFa ? 'صفحه عمودی (Portrait)' : 'Portrait'}
              </button>
            </div>

            <button
              onClick={() => handlePrint()}
              title={isFa ? 'خروجی PDF / چاپ کتابچه' : 'Print / Export PDF'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.55rem',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(239,68,68,0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#fff' }}>picture_as_pdf</span>
            </button>
          </div>
        </div>

        {/* Printable Document Title Header */}
        <div className="handbook-printable-header" style={{
          textAlign: 'center',
          padding: '1.2rem 1.5rem',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 14px rgba(15,23,42,0.15)'
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: '#60a5fa' }}>menu_book</span>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
              {isFa ? 'کتابچه جامع راهنمای امکانات و قابلیت‌های سامانه مدیریت پروژه (PM)' : 'Project Management (PM) App Features & Capabilities Handbook'}
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>
            {isFa
              ? 'سامانه یکپارچه مدیریت سبد پروژه‌ها، برنامه‌ریزی آبشاری و چابک، پایش پورتفولیو، گردش کار و هوش مصنوعی'
              : 'Integrated Platform for Waterfall & Agile Planning, Portfolio Analytics, Governance & AI Automation'}
          </p>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="no-print" style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: 'var(--bg-secondary, #f8fafc)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e2e8f0)'
        }}>
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <span className="material-symbols-outlined" style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              right: isFa ? '10px' : 'auto',
              left: isFa ? 'auto' : '10px',
              color: '#94a3b8'
            }}>search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isFa ? 'جستجو در قابلیت‌ها، امکانات و کلیدواژه‌ها...' : 'Search features and keywords...'}
              className="form-control"
              style={{
                width: '100%',
                paddingRight: isFa ? '2.4rem' : '0.8rem',
                paddingLeft: isFa ? '0.8rem' : '2.4rem',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1'
              }}
            />
          </div>

          {/* Category Selector Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedCategory === 'all' ? '#1e293b' : '#e2e8f0',
                color: selectedCategory === 'all' ? '#ffffff' : '#334155'
              }}
            >
              {isFa ? 'همه بخش‌ها' : 'All Sections'}
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: selectedCategory === cat.id ? cat.color : '#e2e8f0',
                  color: selectedCategory === cat.id ? '#ffffff' : '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{cat.icon}</span>
                {isFa ? cat.titleFa.split(' ')[1] || cat.titleFa : cat.titleEn.split(' ')[1] || cat.titleEn}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Categories Rendering */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#cbd5e1' }}>search_off</span>
              <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                {isFa ? 'هیچ قابلیتی با این عبارت جستجو یافت نشد.' : 'No features found matching your search query.'}
              </p>
            </div>
          ) : (
            filteredCategories.map(cat => (
              <div key={cat.id} className="handbook-category-section" style={{
                backgroundColor: 'var(--card-bg-color, #ffffff)',
                borderRadius: '12px',
                border: '1px solid var(--border-color, #e2e8f0)',
                padding: '1.25rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}>
                {/* Category Header */}
                <div className="handbook-category-header" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: `2px solid ${cat.color}`
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: `${cat.color}15`,
                    color: cat.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.3rem' }}>{cat.icon}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-color, #1e293b)' }}>
                    {isFa ? cat.titleFa : cat.titleEn}
                  </h3>
                </div>

                {/* Features Grid */}
                <div className="features-grid-container" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '1rem'
                }}>
                  {cat.features.map((feat, fIdx) => (
                    <div
                      key={fIdx}
                      className="feature-card"
                      style={{
                        padding: '1rem',
                        backgroundColor: 'var(--bg-secondary, #f8fafc)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-color, #0f172a)' }}>
                          {isFa ? feat.titleFa : feat.titleEn}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #475569)', lineHeight: '1.55' }}>
                          {isFa ? feat.descFa : feat.descEn}
                        </p>
                        {((isFa ? feat.keyPointsFa : feat.keyPointsEn) || []).length > 0 && (
                          <ul className="feature-keypoints" style={{
                            margin: '0.6rem 0 0 0',
                            paddingRight: isFa ? '1.2rem' : '0',
                            paddingLeft: isFa ? '0' : '1.2rem',
                            fontSize: '0.8rem',
                            color: 'var(--text-color, #334155)',
                            lineHeight: '1.5'
                          }}>
                            {(isFa ? feat.keyPointsFa : feat.keyPointsEn)?.map((kp, kpIdx) => (
                              <li key={kpIdx} style={{ marginBottom: '3px' }}>
                                {kp}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info in PDF */}
        <div className="handbook-footer" style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px dashed #cbd5e1',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#64748b'
        }}>
          {isFa
            ? `سامانه یکپارچه مدیریت پروژه (PM) - کتابچه جامع راهنما و مشخصات فنی سیستم - تاریخ نسخه: ${new Date().toLocaleDateString('fa-IR')}`
            : `Project Management (PM) System - Comprehensive Capabilities Handbook - Generated: ${new Date().toLocaleDateString()}`}
        </div>
      </div>
    </div>
  );
};
