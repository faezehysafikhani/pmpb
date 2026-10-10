

import { Project, Calendar, ProjectActivity, EnrichedProject, PlannedProgressType, ActionItem, ActionRecurrence, User, VisibilitySettings, OwningUnitTreeNode } from './types';

export const appLogoUrl = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='512' height='512'%3E%3Crect width='512' height='512' rx='112' fill='%230f766e'/%3E%3Crect x='96' y='130' width='230' height='48' rx='24' fill='%23ffffff'/%3E%3Crect x='186' y='210' width='230' height='48' rx='24' fill='%23ffffff'/%3E%3Crect x='120' y='290' width='190' height='48' rx='24' fill='%23ffffff'/%3E%3Crect x='230' y='370' width='186' height='48' rx='24' fill='%23ffffff'/%3E%3C/svg%3E";

export const appLogoWatermarkUrl = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='512' height='512'%3E%3Cdefs%3E%3ClinearGradient id='bgGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2314b8a6'/%3E%3Cstop offset='50%25' stop-color='%230f766e'/%3E%3Cstop offset='100%25' stop-color='%23042f2c'/%3E%3C/linearGradient%3E%3ClinearGradient id='barGrad' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff'/%3E%3Cstop offset='100%25' stop-color='%23e2e8f0'/%3E%3C/linearGradient%3E%3Cfilter id='barEmboss'%3E%3CfeDropShadow dx='0' dy='6' stdDeviation='4' flood-color='%23000000' flood-opacity='0.4'/%3E%3C/filter%3E%3C/defs%3E%3Crect x='16' y='16' width='480' height='480' rx='104' fill='url(%23bgGrad)' stroke='%23ffffff' stroke-width='12'/%3E%3Cg filter='url(%23barEmboss)'%3E%3Crect x='96' y='130' width='230' height='48' rx='24' fill='url(%23barGrad)'/%3E%3Crect x='186' y='210' width='230' height='48' rx='24' fill='url(%23barGrad)'/%3E%3Crect x='120' y='290' width='190' height='48' rx='24' fill='url(%23barGrad)'/%3E%3Crect x='230' y='370' width='186' height='48' rx='24' fill='url(%23barGrad)'/%3E%3C/g%3E%3C/svg%3E";

// --- Jalali (Shamsi) Calendar Conversion Utilities ---
// Adapted from jalaali-js (MIT License) to be a standalone utility.

export function toJalali(gy: number, gm: number, gd: number) {
  let g_d_m, jy, jm, jd;
  g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  if (gy > 1600 || (gy === 1600 && gm > 9) || (gy === 1600 && gm === 9 && gd > 20)) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

export function toGregorian(jy: number, jm: number, jd: number) {
  let gy, gm, gd, days;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }
  days = (365 * jy) + (Math.floor(jy / 33) * 8) + (Math.floor(((jy % 33) + 3) / 4)) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * (Math.floor(days / 146097));
  days %= 146097;
  if (days > 36524) {
    gy += 100 * (Math.floor(--days / 36524));
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  gd = days + 1;
  let g_d_m = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (gm = 0; gm < 13; gm++) {
    let v = g_d_m[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return { gy, gm, gd };
}

function jalaaliMonthLength(jy: number, jm: number): number {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    const isLeap = (((jy - 474) % 2820) + 512) * 682 % 2816 < 682;
    return isLeap ? 30 : 29;
}

export function getJalaliInfo(gregorianDate: Date) {
    const { jy, jm } = toJalali(gregorianDate.getFullYear(), gregorianDate.getMonth() + 1, gregorianDate.getDate());
    const firstDayGregorian = toGregorian(jy, jm, 1);
    const firstDayDateObject = new Date(firstDayGregorian.gy, firstDayGregorian.gm - 1, firstDayGregorian.gd);

    return {
        jYear: jy,
        jMonth: jm,
        daysInMonth: jalaaliMonthLength(jy, jm),
        firstDayOfWeek: firstDayDateObject.getDay()
    };
}

export function toPersianDigits(n: number | string): string {
    if (n === null || n === undefined) return '';
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/\d/g, x => farsiDigits[parseInt(x)]);
}

export function toEnglishDigits(n: number | string): string {
    if (n === null || n === undefined) return '';
    return String(n)
        .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function formatShamsiDate(date: Date): string {
    const { jy, jm, jd } = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const str = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
    return toPersianDigits(str);
}

export const formatDate = (date: Date | string | undefined, language: 'en' | 'fa'): string => {
    if (!date) return '';
    if (date === '-') return '-';
    if (typeof date === 'string') {
        const cleanStr = date.trim();
        if (/^(13|14|\u06F1\u06F3|\u06F1\u06F4)/.test(cleanStr) || (cleanStr.includes('/') && !cleanStr.includes('-'))) {
            return language === 'fa' ? toPersianDigits(cleanStr) : cleanStr;
        }
    }
    const d = toSafeDate(date);
    if (!d || isNaN(d.getTime())) {
        return typeof date === 'string' ? (language === 'fa' ? toPersianDigits(date) : date) : '';
    }

    if (language === 'fa') {
        return formatShamsiDate(d);
    }
    
    // Using en-CA gives YYYY-MM-DD format which is good for consistency.
    return new Intl.DateTimeFormat('en-CA').format(d);
};

export const formatDateTime = (date: Date | string | undefined, language: 'en' | 'fa'): string => {
    if (!date) return '';
    if (date === '-') return '-';
    
    if (typeof date === 'string') {
        const cleanStr = date.trim();
        if (!cleanStr || cleanStr === '-') return '-';

        // If string already has Shamsi date and time
        if (/^(13|14|\u06F1\u06F3|\u06F1\u06F4)/.test(cleanStr) && cleanStr.includes(':')) {
            return language === 'fa' ? toPersianDigits(cleanStr) : cleanStr;
        }

        // If string is pure date without time (e.g. 2024-02-15 or 1403/01/01), do not append fake 03:30 time
        const engClean = toEnglishDigits(cleanStr);
        const hasTime = engClean.includes(':') || (engClean.includes('T') && /\d{1,2}:\d{1,2}/.test(engClean));
        if (!hasTime) {
            return formatDate(date, language);
        }
    }

    const d = toSafeDate(date);
    if (!d || isNaN(d.getTime())) {
        return typeof date === 'string' ? (language === 'fa' ? toPersianDigits(date) : date) : '';
    }

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (language === 'fa') {
        const { jy, jm, jd } = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        const dateStr = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
        return toPersianDigits(`${dateStr} - ${timeStr}`);
    }

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day} ${timeStr}`;
};

export const toSafeDate = (d: any): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  if (typeof d === 'string') {
    const clean = d.trim();
    if (!clean || clean === '-') return null;
    // Check if Persian/Shamsi date like 1403/01/01 or 1403-01-01 (with optional time 14:30)
    const engStr = toEnglishDigits(clean);
    const match = engStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[\sT-]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);
      const p3 = parseInt(match[3], 10);
      const hh = match[4] ? parseInt(match[4], 10) : 0;
      const mm = match[5] ? parseInt(match[5], 10) : 0;
      const ss = match[6] ? parseInt(match[6], 10) : 0;
      if (p1 >= 1300 && p1 <= 1500) {
        const { gy, gm, gd } = toGregorian(p1, p2, p3);
        const dateObj = new Date(gy, gm - 1, gd, hh, mm, ss);
        return isNaN(dateObj.getTime()) ? null : dateObj;
      }
    }

    // Check if Gregorian pure date string YYYY-MM-DD or YYYY/MM/DD without time (to avoid UTC midnight shift)
    const gregDateOnlyMatch = engStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (gregDateOnlyMatch) {
      const gy = parseInt(gregDateOnlyMatch[1], 10);
      const gm = parseInt(gregDateOnlyMatch[2], 10);
      const gd = parseInt(gregDateOnlyMatch[3], 10);
      if (gy >= 1900 && gy <= 2100) {
        const dateObj = new Date(gy, gm - 1, gd);
        return isNaN(dateObj.getTime()) ? null : dateObj;
      }
    }

    const parsed = new Date(clean);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof d === 'number') {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

export const getISODateString = (date: Date | string = new Date()): string => {
  const safeDate = toSafeDate(date) || new Date();
  const adjustedDate = new Date(safeDate.getTime() - (safeDate.getTimezoneOffset() * 60000));
  return adjustedDate.toISOString().split('T')[0];
};

export const getISODateTimeString = (date: Date | string = new Date()): string => {
  const safeDate = toSafeDate(date) || new Date();
  return safeDate.toISOString();
};

const normalizeDate = (d: Date | string | undefined): Date | null => {
    const safe = toSafeDate(d);
    if (!safe) return null;
    const newDate = new Date(safe);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

interface LunarHoliday {
  m: number;
  d: number;
  reason: string;
}

const LUNAR_HOLIDAYS: Record<number, LunarHoliday[]> = {
  1402: [
    { m: 1, d: 23, reason: 'شهادت حضرت علی (ع)' },
    { m: 2, d: 2, reason: 'عید سعید فطر' },
    { m: 2, d: 3, reason: 'تعطیل به مناسبت عید سعید فطر' },
    { m: 2, d: 26, reason: 'شهادت امام جعفر صادق (ع)' },
    { m: 4, d: 8, reason: 'عید سعید قربان' },
    { m: 4, d: 16, reason: 'عید سعید غدیر خم' },
    { m: 5, d: 5, reason: 'تاسوعای حسینی' },
    { m: 5, d: 6, reason: 'عاشورای حسینی' },
    { m: 6, d: 15, reason: 'اربعین حسینی' },
    { m: 6, d: 23, reason: 'رحلت حضرت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)' },
    { m: 6, d: 25, reason: 'شهادت امام رضا (ع)' },
    { m: 7, d: 2, reason: 'شهادت امام حسن عسکری (ع)' },
    { m: 7, d: 11, reason: 'ولادت حضرت رسول اکرم (ص) و امام جعفر صادق (ع)' },
    { m: 9, d: 26, reason: 'شهادت حضرت فاطمه زهرا (س)' },
    { m: 11, d: 5, reason: 'ولادت حضرت امام علی (ع)' },
    { m: 11, d: 19, reason: 'مبعث رسول اکرم (ص)' },
    { m: 12, d: 6, reason: 'ولادت حضرت قائم (عج) و جشن نیمه شعبان' }
  ],
  1403: [
    { m: 1, d: 13, reason: 'شهادت حضرت علی (ع) و روز طبیعت' },
    { m: 1, d: 22, reason: 'عید سعید فطر' },
    { m: 1, d: 23, reason: 'تعطیل به مناسبت عید سعید فطر' },
    { m: 2, d: 15, reason: 'شهادت امام جعفر صادق (ع)' },
    { m: 3, d: 28, reason: 'عید سعید قربان' },
    { m: 4, d: 5, reason: 'عید سعید غدیر خم' },
    { m: 4, d: 25, reason: 'تاسوعای حسینی' },
    { m: 4, d: 26, reason: 'عاشورای حسینی' },
    { m: 6, d: 4, reason: 'اربعین حسینی' },
    { m: 6, d: 12, reason: 'رحلت حضرت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)' },
    { m: 6, d: 14, reason: 'شهادت امام رضا (ع)' },
    { m: 6, d: 22, reason: 'شهادت امام حسن عسکری (ع)' },
    { m: 6, d: 31, reason: 'ولادت حضرت رسول اکرم (ص) و امام جعفر صادق (ع)' },
    { m: 9, d: 1, reason: 'شهادت حضرت فاطمه زهرا (س)' },
    { m: 11, d: 26, reason: 'ولادت حضرت قائم (عج) و جشن نیمه شعبان' },
    { m: 11, d: 27, reason: 'مبعث رسول اکرم (ص)' },
    { m: 11, d: 29, reason: 'شهادت امام موسی کاظم (ع)' }
  ],
  1404: [
    { m: 1, d: 2, reason: 'شهادت حضرت علی (ع)' },
    { m: 1, d: 11, reason: 'عید سعید فطر' },
    { m: 1, d: 12, reason: 'تعطیل به مناسبت عید فطر' },
    { m: 2, d: 4, reason: 'شهادت امام جعفر صادق (ع)' },
    { m: 3, d: 16, reason: 'عید سعید قربان' },
    { m: 3, d: 24, reason: 'عید غدیر خم' },
    { m: 4, d: 14, reason: 'تاسوعای حسینی' },
    { m: 4, d: 15, reason: 'عاشورای حسینی' },
    { m: 5, d: 23, reason: 'اربعین حسینی' },
    { m: 5, d: 31, reason: 'رحلت حضرت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)' },
    { m: 6, d: 2, reason: 'شهادت حضرت امام رضا (ع)' },
    { m: 6, d: 10, reason: 'شهادت امام حسن عسکری (ع)' },
    { m: 6, d: 19, reason: 'ولادت حضرت رسول اکرم (ص) و امام جعفر صادق (ع)' },
    { m: 9, d: 3, reason: 'شهادت حضرت فاطمه زهرا (س)' },
    { m: 10, d: 13, reason: 'ولادت حضرت امام علی (ع)' },
    { m: 10, d: 27, reason: 'مبعث رسول اکرم (ص)' },
    { m: 11, d: 15, reason: 'ولادت حضرت قائم (عج) و جشن نیمه شعبان' },
    { m: 12, d: 20, reason: 'شهادت حضرت امام علی (ع)' }
  ],
  1405: [
    { m: 1, d: 1, reason: 'عید سعید فطر' },
    { m: 1, d: 2, reason: 'تعطیل به مناسبت عید فطر' },
    { m: 1, d: 25, reason: 'شهادت امام جعفر صادق (ع)' },
    { m: 3, d: 6, reason: 'عید سعید قربان' },
    { m: 3, d: 14, reason: 'عید سعید غدیر خم' },
    { m: 4, d: 3, reason: 'تاسوعای حسینی' },
    { m: 4, d: 4, reason: 'عاشورای حسینی' },
    { m: 5, d: 13, reason: 'اربعین حسینی' },
    { m: 5, d: 21, reason: 'رحلت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)' },
    { m: 5, d: 22, reason: 'شهادت امام رضا (ع)' },
    { m: 5, d: 30, reason: 'شهادت امام حسن عسکری (ع)' },
    { m: 6, d: 8, reason: 'ولادت پیامبر اکرم (ص) و امام جعفر صادق (ع)' },
    { m: 8, d: 22, reason: 'شهادت حضرت زهرا (س)' },
    { m: 10, d: 2, reason: 'ولادت امام علی (ع)' },
    { m: 10, d: 16, reason: 'مبعث حضرت رسول اکرم (ص)' },
    { m: 11, d: 4, reason: 'ولادت حضرت قائم (عج) و جشن نیمه شعبان' }
  ],
  1406: [
    { m: 1, d: 14, reason: 'شهادت امام جعفر صادق (ع)' },
    { m: 2, d: 27, reason: 'عید قربان' },
    { m: 3, d: 4, reason: 'عید سعید غدیر خم' },
    { m: 3, d: 25, reason: 'تاسوعای حسینی' },
    { m: 3, d: 26, reason: 'عاشورای حسینی' },
    { m: 5, d: 3, reason: 'اربعین حسینی' },
    { m: 5, d: 11, reason: 'رحلت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)' },
    { m: 5, d: 29, reason: 'ولادت پیامبر اکرم (ص) و امام جعفر صادق (ع)' },
    { m: 11, d: 29, reason: 'شهادت حضرت علی (ع)' },
    { m: 12, d: 8, reason: 'عید سعید فطر' },
    { m: 12, d: 9, reason: 'تعطیل به مناسبت عید سعید فطر' }
  ],
  1407: [
    { m: 1, d: 3, reason: 'شهادت امام جعفر صادق (ع)' },
    { m: 2, d: 16, reason: 'عید سعید قربان' },
    { m: 2, d: 24, reason: 'عید غدیر خم' },
    { m: 3, d: 14, reason: 'تاسوعای حسینی' },
    { m: 3, d: 15, reason: 'عاشورای حسینی' },
    { m: 4, d: 23, reason: 'اربعین حسینی' },
    { m: 4, d: 31, reason: 'رحلت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)' },
    { m: 5, d: 18, reason: 'ولادت پیامبر اکرم (ص) و امام جعفر صادق (ع)' },
    { m: 10, d: 18, reason: 'شهادت حضرت علی (ع)' },
    { m: 10, d: 28, reason: 'عید سعید فطر' },
    { m: 10, d: 29, reason: 'تعطیل به مناسبت عید فطر' }
  ]
};

export function getOfficialHolidayReason(date: Date): string | null {
  if (!date || isNaN(date.getTime())) return null;
  const { jy, jm, jd } = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());

  // 1. Fixed Solar (Shamsi) holidays
  if (jm === 1 && jd >= 1 && jd <= 4) return 'عید نوروز';
  if (jm === 1 && jd === 12) return 'روز جمهوری اسلامی';
  if (jm === 1 && jd === 13) return 'روز طبیعت (سیزده به در)';
  if (jm === 3 && jd === 14) return 'رحلت حضرت امام خمینی (ره)';
  if (jm === 3 && jd === 15) return 'قیام خونین ۱۵ خرداد';
  if (jm === 11 && jd === 22) return 'پیروزی انقلاب اسلامی ایران';
  if (jm === 12 && jd === 29) return 'روز ملی شدن صنعت نفت ایران';

  // 2. Lunar holidays
  const yearHolidays = LUNAR_HOLIDAYS[jy];
  if (yearHolidays) {
    const found = yearHolidays.find(h => h.m === jm && h.d === jd);
    if (found) return found.reason;
  }

  return null;
}

const isHoliday = (date: Date, calendar: Calendar): boolean => {
    const dayOfWeek = date.getDay();
    if (!calendar.workingDays.includes(dayOfWeek)) {
        return true;
    }
    const dateString = getISODateString(date);
    if (calendar.specificHolidays && calendar.specificHolidays.some(h => h.date === dateString)) {
        return true;
    }
    if (calendar.applyOfficialHolidays !== false && getOfficialHolidayReason(date) !== null) {
        return true;
    }
    return false;
};

const addWorkingDays = (startDate: Date, duration: number, calendar: Calendar): Date => {
    if (duration === 0) return new Date(startDate);
    let currentDate = new Date(startDate);
    
    if (duration > 0) {
        let daysAdded = 0;
        while (daysAdded < duration) {
            currentDate.setDate(currentDate.getDate() + 1);
            if (!isHoliday(currentDate, calendar)) {
                daysAdded++;
            }
        }
    } else { // duration < 0
        let daysSubtracted = 0;
        while (daysSubtracted < -duration) {
            currentDate.setDate(currentDate.getDate() - 1);
            if (!isHoliday(currentDate, calendar)) {
                daysSubtracted++;
            }
        }
    }
    return currentDate;
};

const getNextWorkingDay = (date: Date, calendar: Calendar): Date => {
    let nextDay = new Date(date);
    while (isHoliday(nextDay, calendar)) {
        nextDay.setDate(nextDay.getDate() + 1);
    }
    return nextDay;
};
const getPreviousWorkingDay = (date: Date, calendar: Calendar): Date => {
    let prevDay = new Date(date);
    while (isHoliday(prevDay, calendar)) {
        prevDay.setDate(prevDay.getDate() - 1);
    }
    return prevDay;
};

const countWorkingDays = (startDate: Date, endDate: Date, calendar: Calendar): number => {
    if (startDate > endDate) return 0;
    let count = 0;
    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
        if (!isHoliday(currentDate, calendar)) {
            count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
};

export const calculateScheduleTreeAndProgress = (
    project: Project,
    calendar: Calendar,
    weightingType: 'manual' | 'time-based' | 'cost-based' | 'complexity-based' | 'combined' = 'manual',
    plannedProgressType: PlannedProgressType = 'continuous',
    calculationDate?: Date
): { rootNode: ProjectActivity | null } => {
    if (!project.schedule || project.schedule.length === 0) {
        return { rootNode: null };
    }

    const activities = [...project.schedule];
    const activityMap = new Map(activities.map(a => [a.id, { 
        ...a,
        startDate: toSafeDate(a.startDate),
        endDate: toSafeDate(a.endDate),
        lateStartDate: toSafeDate(a.lateStartDate),
        lateEndDate: toSafeDate(a.lateEndDate)
    } as ProjectActivity]));

    // Build successor relationships
    activityMap.forEach(activity => activity.successors = []);
    activityMap.forEach(activity => {
        if (activity.prerequisiteId && activityMap.has(activity.prerequisiteId)) {
            const prereq = activityMap.get(activity.prerequisiteId);
            prereq.successors.push(activity.id);
        }
    });

    // --- FORWARD PASS ---
    const projRawStart = toSafeDate(project.startDate) || new Date();
    const projectStartDate = getNextWorkingDay(new Date(projRawStart.getTime() - 24 * 60 * 60 * 1000), calendar);
    let changed = true;
    for (let i = 0; i < activities.length + 1 && changed; i++) {
        changed = false;
        activities.forEach(a => {
            const activity = activityMap.get(a.id);
            if (!activity) return;
            const prereq = activity.prerequisiteId ? activityMap.get(activity.prerequisiteId) : null;
            let newStartDate: Date;

            if (!prereq) {
                newStartDate = projectStartDate;
            } else {
                const prereqType = activity.prerequisiteType || 'FS';
                const lag = activity.lag || 0;
                
                const prereqEnd = toSafeDate(prereq.endDate);
                const prereqStart = toSafeDate(prereq.startDate);

                if ((prereqType === 'FS' || prereqType === 'FF') && !prereqEnd) return; // Prereq not ready
                if ((prereqType === 'SS' || prereqType === 'SF') && !prereqStart) return; // Prereq not ready

                switch (prereqType) {
                    case 'SS':
                        newStartDate = addWorkingDays(prereqStart!, lag, calendar);
                        break;
                    case 'FF': {
                        const newEndDate = addWorkingDays(prereqEnd!, lag, calendar);
                        newStartDate = addWorkingDays(newEndDate, -Math.max(0, activity.duration - 1), calendar);
                        break;
                    }
                    case 'SF': {
                        const newEndDate = addWorkingDays(prereqStart!, lag, calendar);
                        newStartDate = addWorkingDays(newEndDate, -Math.max(0, activity.duration - 1), calendar);
                        break;
                    }
                    case 'FS':
                    default:
                        // Standard FS: Successor starts the working day after the predecessor finishes.
                        // S_start = P_end + 1 day. Lag is added to this.
                        newStartDate = addWorkingDays(prereqEnd!, 1 + lag, calendar);
                        break;
                }
            }
            
            const newEndDate = addWorkingDays(newStartDate, Math.max(0, activity.duration - 1), calendar);
            const curStart = toSafeDate(activity.startDate);
            const curEnd = toSafeDate(activity.endDate);
            if (!curStart || !curEnd || curStart.getTime() !== newStartDate.getTime() || curEnd.getTime() !== newEndDate.getTime()) {
                activity.startDate = newStartDate;
                activity.endDate = newEndDate;
                changed = true;
            }
        });
    }

    // --- BACKWARD PASS ---
    let projectEndDate = new Date(0);
    activityMap.forEach(a => {
        const aEnd = toSafeDate(a.endDate);
        if (aEnd && aEnd > projectEndDate) {
            projectEndDate = aEnd;
        }
    });

    activityMap.forEach(a => {
        if (a.successors.length === 0) {
            a.lateEndDate = projectEndDate;
        }
    });

    changed = true;
    for (let i = 0; i < activities.length + 1 && changed; i++) {
        changed = false;
        activities.slice().reverse().forEach(a => {
            const activity = activityMap.get(a.id);
            if (!activity) return;
            if (activity.successors.length === 0) {
                 activity.lateEndDate = projectEndDate;
            } else {
                let newLateEndDate = new Date('2999-12-31'); // A very late date
                activity.successors.forEach(succId => {
                    const successor = activityMap.get(succId);
                    if (!successor) return;
                    const succLateStart = toSafeDate(successor.lateStartDate);
                    const succLateEnd = toSafeDate(successor.lateEndDate);
                    if (!succLateStart) return; // Successor not ready
                    
                    const prereqType = successor.prerequisiteType || 'FS';
                    const lag = successor.lag || 0;
                    let impliedLateEndDate: Date;
                    
                    switch(prereqType) {
                        case 'SS':
                            const impliedLS = addWorkingDays(succLateStart, -lag, calendar);
                            impliedLateEndDate = addWorkingDays(impliedLS, Math.max(0, activity.duration - 1), calendar);
                            break;
                        case 'FF':
                            if (!succLateEnd) return;
                            impliedLateEndDate = addWorkingDays(succLateEnd, -lag, calendar);
                            break;
                        case 'SF':
                            if (!succLateEnd) return;
                            const impliedEF = addWorkingDays(succLateEnd, -lag, calendar);
                            // This is complex. We'll simplify SF's backward pass to be like an FF dependency
                            impliedLateEndDate = impliedEF;
                            break;
                        case 'FS':
                        default:
                            const succLS = addWorkingDays(succLateStart, -1, calendar);
                            impliedLateEndDate = addWorkingDays(succLS, -(1 + lag), calendar);
                            break;
                    }

                    if(impliedLateEndDate < newLateEndDate) newLateEndDate = impliedLateEndDate;
                });
                const curLateEnd = toSafeDate(activity.lateEndDate);
                if(newLateEndDate < new Date('2999-01-01') && (!curLateEnd || curLateEnd.getTime() !== newLateEndDate.getTime())){
                    activity.lateEndDate = newLateEndDate;
                    changed = true;
                }
            }

            const lateEnd = toSafeDate(activity.lateEndDate);
            const lateStart = toSafeDate(activity.lateStartDate);
            if(lateEnd && (!lateStart || lateEnd.getTime() !== lateEnd.getTime())){
                 activity.lateStartDate = addWorkingDays(lateEnd, -Math.max(0, activity.duration - 1), calendar);
                 changed = true;
            }
        });
    }

    // --- FINAL CALCULATIONS (FLOATS, etc.) ---
    const today = calculationDate ? normalizeDate(calculationDate)! : normalizeDate(new Date())!;
    activityMap.forEach(activity => {
        const actStart = toSafeDate(activity.startDate);
        const actEnd = toSafeDate(activity.endDate);
        const actLateStart = toSafeDate(activity.lateStartDate);

        if (actStart && actLateStart) {
            activity.totalFloat = countWorkingDays(actStart, actLateStart, calendar);
        } else {
            activity.totalFloat = 0;
        }
        activity.isCritical = activity.totalFloat <= 0;

        let minSuccessorES = new Date('2999-12-31');
        activity.successors.forEach(succId => {
            const successor = activityMap.get(succId);
            if (!successor) return;
            const succStart = toSafeDate(successor.startDate);
            if (succStart && succStart < minSuccessorES) {
                minSuccessorES = succStart;
            }
        });
        if (minSuccessorES < new Date('2999-01-01') && actEnd) {
            activity.freeFloat = countWorkingDays(actEnd, minSuccessorES, calendar) - 1;
        } else {
            activity.freeFloat = activity.totalFloat;
        }

        if (actStart && actEnd) {
             if (plannedProgressType === 'zero-hundred') {
                 activity.plannedProgress = today >= actEnd ? 100 : 0;
             } else { // 'continuous'
                 const durationMs = actEnd.getTime() - actStart.getTime();
                 if (durationMs >= 0) {
                    const totalDurationMs = (activity.duration - 1) * 24 * 3600 * 1000;
                    const elapsedMs = today.getTime() - actStart.getTime();
                    const plannedProgress = totalDurationMs > 0 ? (elapsedMs / totalDurationMs) * 100 : (today >= actStart ? 100 : 0);
                    activity.plannedProgress = Math.max(0, Math.min(100, plannedProgress));
                 }
             }
        }
    });

    // --- Build Tree and Aggregate ---
    const activityMapWithData = new Map(Array.from(activityMap.values()).map(a => [a.id, { ...a, children: [] as ProjectActivity[] }]));
    const tree: ProjectActivity[] = [];
    activities.forEach(act => {
        const activity = activityMapWithData.get(act.id)!;
        if (act.parentId && activityMapWithData.has(act.parentId)) {
            activityMapWithData.get(act.parentId)!.children.push(activity);
        } else {
            tree.push(activity);
        }
    });
    
    const leafTasks = activities.filter(a => !activities.some(child => child.parentId === a.id));

    if (weightingType === 'time-based') {
        const totalDuration = leafTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
        activities.forEach(a => {
            const activity = activityMapWithData.get(a.id)!;
            if (leafTasks.some(leaf => leaf.id === a.id)) {
                 activity.weight = totalDuration > 0 ? ((a.duration || 0) / totalDuration) * 100 : 0;
            }
        });
    } else if (weightingType === 'cost-based') {
        const totalCost = leafTasks.reduce((sum, task) => sum + (task.cost || 0), 0);
        activities.forEach(a => {
            const activity = activityMapWithData.get(a.id)!;
            if (leafTasks.some(leaf => leaf.id === a.id)) {
                 activity.weight = totalCost > 0 ? ((a.cost || 0) / totalCost) * 100 : 0;
            }
        });
    } else if (weightingType === 'complexity-based') {
        const complexityScores = { Low: 1, Medium: 2, High: 3 };
        const totalComplexityScore = leafTasks.reduce((sum, task) => {
            const score = complexityScores[task.complexity || 'Medium'];
            return sum + score;
        }, 0);
        activities.forEach(a => {
            const activity = activityMapWithData.get(a.id)!;
            if (leafTasks.some(leaf => leaf.id === a.id)) {
                const score = complexityScores[a.complexity || 'Medium'];
                activity.weight = totalComplexityScore > 0 ? (score / totalComplexityScore) * 100 : 0;
            }
        });
    } else if (weightingType === 'combined') {
        const timeFactor = (project.timeWeightFactor ?? 0) / 100;
        const costFactor = (project.costWeightFactor ?? 0) / 100;
        const complexityFactor = (project.complexityWeightFactor ?? 0) / 100;

        const totalDuration = leafTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
        const totalCost = leafTasks.reduce((sum, task) => sum + (task.cost || 0), 0);
        const complexityScores = { Low: 1, Medium: 2, High: 3 };
        const totalComplexityScore = leafTasks.reduce((sum, task) => sum + complexityScores[task.complexity || 'Medium'], 0);

        activities.forEach(a => {
            const activity = activityMapWithData.get(a.id)!;
            if (leafTasks.some(leaf => leaf.id === a.id)) {
                let combinedWeight = 0;
                
                if (totalDuration > 0) {
                    const timeWeight = ((a.duration || 0) / totalDuration) * 100;
                    combinedWeight += timeWeight * timeFactor;
                }
                
                if (totalCost > 0) {
                    const costWeight = ((a.cost || 0) / totalCost) * 100;
                    combinedWeight += costWeight * costFactor;
                }
                
                if (totalComplexityScore > 0) {
                    const score = complexityScores[a.complexity || 'Medium'];
                    const complexityWeight = (score / totalComplexityScore) * 100;
                    combinedWeight += complexityWeight * complexityFactor;
                }
                
                activity.weight = combinedWeight;
            }
        });
    }

    const calculateTree = (nodes: ProjectActivity[], level: number, parentWbs?: string): ProjectActivity[] => {
        nodes.forEach((node, index) => {
            node.level = level;
            node.wbsCode = parentWbs ? `${parentWbs}.${index + 1}` : `${index + 1}`;
            node.isParent = node.children.length > 0;
            if (node.isParent) {
                node.children = calculateTree(node.children, level + 1, node.wbsCode);
                
                const children = node.children;
                const totalChildWeight = children.reduce((sum, c) => sum + c.weight, 0);
                
                node.weight = totalChildWeight;
                node.cost = children.reduce((sum, c) => sum + (c.cost || 0), 0);
                node.manHour = children.reduce((sum, c) => sum + (c.manHour || 0), 0);
                node.actualProgress = totalChildWeight > 0 ? children.reduce((sum, c) => sum + c.actualProgress * c.weight, 0) / totalChildWeight : 0;
                node.plannedProgress = totalChildWeight > 0 ? children.reduce((sum, c) => sum + (c.plannedProgress || 0) * c.weight, 0) / totalChildWeight : 0;
                
                const childStartDates = children.map(c => toSafeDate(c.startDate)).filter((d): d is Date => d !== null);
                const childEndDates = children.map(c => toSafeDate(c.endDate)).filter((d): d is Date => d !== null);
                
                if(childStartDates.length > 0) node.startDate = new Date(Math.min(...childStartDates.map(d => d.getTime())));
                if(childEndDates.length > 0) node.endDate = new Date(Math.max(...childEndDates.map(d => d.getTime())));
                const nStart = toSafeDate(node.startDate);
                const nEnd = toSafeDate(node.endDate);
                if(nStart && nEnd) {
                     node.duration = countWorkingDays(nStart, nEnd, calendar) + 1;
                }
            }
        });
        return nodes;
    };
    
    const finalTree = calculateTree(tree, 1);
    
    const rootNode: ProjectActivity = {
        id: 'project-root', name: project.name, duration: 0, prerequisiteId: null, weight: 0, assignedToId: null,
        actualProgress: 0, parentId: null, isParent: true, children: finalTree, cost: 0, manHour: 0,
    };
    
    if (rootNode.children && rootNode.children.length > 0) {
        const totalChildWeight = rootNode.children.reduce((sum, c) => sum + c.weight, 0);
        rootNode.weight = totalChildWeight;
        rootNode.cost = rootNode.children.reduce((sum, c) => sum + (c.cost || 0), 0);
        rootNode.manHour = rootNode.children.reduce((sum, c) => sum + (c.manHour || 0), 0);
        rootNode.actualProgress = totalChildWeight > 0 ? rootNode.children.reduce((sum, c) => sum + c.actualProgress * c.weight, 0) / totalChildWeight : 0;
        rootNode.plannedProgress = totalChildWeight > 0 ? rootNode.children.reduce((sum, c) => sum + (c.plannedProgress || 0) * c.weight, 0) / totalChildWeight : 0;
        
        const childStartDates = rootNode.children.map(c => toSafeDate(c.startDate)).filter((d): d is Date => d !== null);
        const childEndDates = rootNode.children.map(c => toSafeDate(c.endDate)).filter((d): d is Date => d !== null);
        if (childStartDates.length > 0) rootNode.startDate = new Date(Math.min(...childStartDates.map(d => d.getTime())));
        if (childEndDates.length > 0) rootNode.endDate = new Date(Math.max(...childEndDates.map(d => d.getTime())));
        const rStart = toSafeDate(rootNode.startDate);
        const rEnd = toSafeDate(rootNode.endDate);
        if (rStart && rEnd) {
            rootNode.duration = countWorkingDays(rStart, rEnd, calendar) + 1;
        }
    }
    
    return { rootNode };
}

export const enrichProjectWithProgress = (project: Project, calendars: Calendar[]): EnrichedProject => {
    const today = new Date();
    const startDate = toSafeDate(project.startDate) || new Date();
    const endDate = toSafeDate(project.endDate) || new Date();

    let plannedProgress = 0;
    if (today > startDate && startDate < endDate) {
        const totalDuration = endDate.getTime() - startDate.getTime();
        const elapsedDuration = today.getTime() - startDate.getTime();
        plannedProgress = Math.max(0, Math.min(100, (elapsedDuration / totalDuration) * 100));
    } else if (today >= endDate) {
        plannedProgress = 100;
    }
    
    let actualProgress = 0;
    const enrichedData: Partial<EnrichedProject> = {}; // Use partial type

    if (project.type === 'waterfall' && calendars.length > 0 && project.schedule && project.schedule.length > 0) {
        const projectCalendar = calendars.find(c => c.id === project.calendarId) || calendars.find(c => c.isDefault)!;
        const { rootNode } = calculateScheduleTreeAndProgress(project, projectCalendar, project.weightingType, project.plannedProgressType);
        actualProgress = rootNode?.actualProgress || 0;
        // Overwrite the simple time-based planned progress with the more accurate schedule-based one.
        plannedProgress = rootNode?.plannedProgress || 0;
    } else if (project.type === 'agile') {
        const totalTasks = project.kanbanTasks?.length || 0;
        const doneTasks = project.kanbanTasks?.filter(t => t.status === 'Done').length || 0;
        if (totalTasks > 0) {
            actualProgress = (doneTasks / totalTasks) * 100;
        }
        enrichedData.totalTasks = totalTasks;
        enrichedData.doneTasks = doneTasks;
        enrichedData.todoTasks = project.kanbanTasks?.filter(t => t.status === 'To-Do').length || 0;
        enrichedData.doingTasks = project.kanbanTasks?.filter(t => t.status === 'Doing').length || 0;
    }

    const performance = plannedProgress > 0 ? (actualProgress / plannedProgress) * 100 : (actualProgress > 0 ? 100 : 0);

    return { ...project, plannedProgress, actualProgress, performance, ...enrichedData };
};

export const getCalendarDisplayName = (name: string, language: string): string => {
  if (!name) return '';
  if (name.toLowerCase() === 'default') {
    return language === 'fa' ? 'تقویم اصلی' : 'Main Calendar';
  }
  return name;
};

const DEFAULT_OBS_TREE: OwningUnitTreeNode[] = [
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

/**
 * Normalizes an organizational unit string to Level 2 (e.g. Department/Management level)
 * for reports, dashboards, portfolio grouping, and matrix aggregations.
 * If a path like "Level 1 > Level 2 > Level 3" or "Level 3" is provided, returns Level 2 ("Level 2").
 * If only Level 1 exists, returns Level 1.
 */
export const getUnitLevel2 = (unitName?: string | null, customTree?: OwningUnitTreeNode[]): string => {
  if (!unitName || typeof unitName !== 'string') return '';
  const trimmed = unitName.trim();
  if (!trimmed) return '';

  let tree = customTree;
  if (!tree) {
    try {
      const rawTree = typeof window !== 'undefined' ? localStorage.getItem('pms_owning_units_tree') : null;
      if (rawTree) {
        tree = JSON.parse(rawTree);
      }
    } catch (e) {
      // ignore
    }
  }
  if (!tree || tree.length === 0) {
    tree = DEFAULT_OBS_TREE;
  }

  const resolveLevel2ForNodeName = (name: string): string | null => {
    const clean = name.trim();
    const node = tree!.find(n => n.name === clean);
    if (!node) return null;
    if (!node.parentId) {
      // Root Level 1 node
      return null;
    }

    let curr = node;
    while (curr.parentId) {
      const parent = tree!.find(n => n.id === curr.parentId);
      if (!parent) break;
      if (!parent.parentId) {
        // parent is Root (Level 1), so curr is Level 2!
        return curr.name;
      }
      curr = parent;
    }
    return curr.name;
  };

  const parts = trimmed.split(/\s*>\s*/).map(p => p.trim()).filter(Boolean);

  // 1. Try resolving parts via tree starting from the last part (most specific)
  for (let i = parts.length - 1; i >= 0; i--) {
    const level2 = resolveLevel2ForNodeName(parts[i]);
    if (level2) return level2;
  }

  // 2. Fallback heuristics if tree lookup didn't match
  if (parts.length >= 3) {
    if (parts[0] === 'سازمان' || parts[0] === 'Organization') {
      return parts[1];
    }
    return parts[0];
  }

  if (parts.length === 2) {
    if (parts[0] === 'سازمان' || parts[0] === 'Organization') {
      return parts[1];
    }
    return parts[0];
  }

  return parts[0] || trimmed;
};

/**
 * Alias for getUnitLevel2 to ensure compatibility across all modules.
 */
export const getUnitLevel1And2 = getUnitLevel2;

export function isAncestorOrgUnit(headUnit: string, targetUnit: string, unitNodes?: OwningUnitTreeNode[]): boolean {
    if (!headUnit || !targetUnit) return false;
    const cleanHead = headUnit.trim();
    const cleanTarget = targetUnit.trim();

    // Exact match or string path match (e.g., target = "واحد اجرایی > اداره ۱ > گروه ۱", head = "واحد اجرایی")
    if (cleanHead === cleanTarget) return true;
    if (cleanTarget.startsWith(cleanHead + ' > ') || cleanTarget.startsWith(cleanHead + '>')) {
        return true;
    }

    // Check tree hierarchy if available
    if (unitNodes && unitNodes.length > 0) {
        const targetNode = unitNodes.find(n => n.name === cleanTarget || cleanTarget.endsWith(n.name));
        if (targetNode) {
            let currParentId = targetNode.parentId;
            while (currParentId) {
                const parentNode = unitNodes.find(n => n.id === currParentId);
                if (!parentNode) break;
                if (parentNode.name === cleanHead) return true;
                currParentId = parentNode.parentId;
            }
        }
    }

    return false;
}

export function isProjectVisibleToUser(
    project: Project,
    currentUser: User | null,
    visibilitySettings: VisibilitySettings,
    users: User[],
    unitNodes?: OwningUnitTreeNode[]
): boolean {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;

    // 1. Owner
    if (visibilitySettings.viewByOwner && project.ownerId && Number(project.ownerId) === Number(currentUser.id)) {
        return true;
    }

    // 2. Project Manager
    if (visibilitySettings.viewByManagerOrResponsible && project.projectManagerId && Number(project.projectManagerId) === Number(currentUser.id)) {
        return true;
    }

    // 3. Approvers
    if (visibilitySettings.viewByApprovers) {
        if (project.approver1Id && Number(project.approver1Id) === Number(currentUser.id)) return true;
        if (project.schedule && project.schedule.some(a => 
            (a.approver1Id && Number(a.approver1Id) === Number(currentUser.id)) ||
            (a.approver2Id && Number(a.approver2Id) === Number(currentUser.id)) ||
            (a.approver3Id && Number(a.approver3Id) === Number(currentUser.id))
        )) return true;
        if (project.kanbanTasks && project.kanbanTasks.some(t => 
            (t.approver1Id && Number(t.approver1Id) === Number(currentUser.id)) ||
            (t.approver2Id && Number(t.approver2Id) === Number(currentUser.id)) ||
            (t.approver3Id && Number(t.approver3Id) === Number(currentUser.id))
        )) return true;
    }

    // 4. Resources
    if (visibilitySettings.viewByResources) {
        if (project.teamMemberIds && project.teamMemberIds.map(Number).includes(Number(currentUser.id))) return true;
        if (project.schedule && project.schedule.some(a => a.assignedToId && Number(a.assignedToId) === Number(currentUser.id))) return true;
        if (project.kanbanTasks && project.kanbanTasks.some(t => t.assignedToId && Number(t.assignedToId) === Number(currentUser.id))) return true;
    }

    // 5. Org Heads
    if (visibilitySettings.viewByOrgHeads && currentUser.owningUnit) {
        const userUnit = currentUser.owningUnit;
        const relatedUnits = new Set<string>();
        if (project.owningUnit) relatedUnits.add(project.owningUnit);

        const ownerUser = users.find(u => Number(u.id) === Number(project.ownerId));
        if (ownerUser?.owningUnit) relatedUnits.add(ownerUser.owningUnit);

        const pmUser = users.find(u => Number(u.id) === Number(project.projectManagerId));
        if (pmUser?.owningUnit) relatedUnits.add(pmUser.owningUnit);

        for (const targetUnit of relatedUnits) {
            if (isAncestorOrgUnit(userUnit, targetUnit, unitNodes)) {
                return true;
            }
        }
    }

    return false;
}

export function isActionVisibleToUser(
    action: ActionItem,
    currentUser: User | null,
    visibilitySettings: VisibilitySettings,
    users: User[],
    unitNodes?: OwningUnitTreeNode[]
): boolean {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;

    // 1. Owner
    if (visibilitySettings.viewByOwner && action.ownerUserId && Number(action.ownerUserId) === Number(currentUser.id)) {
        return true;
    }

    // 2. Responsible
    if (visibilitySettings.viewByManagerOrResponsible && action.responsibleUserId && Number(action.responsibleUserId) === Number(currentUser.id)) {
        return true;
    }

    // 3. Approvers
    if (visibilitySettings.viewByApprovers) {
        if (action.approver1Id && Number(action.approver1Id) === Number(currentUser.id)) return true;
        if (action.approver2Id && Number(action.approver2Id) === Number(currentUser.id)) return true;
        if (action.approver3Id && Number(action.approver3Id) === Number(currentUser.id)) return true;
    }

    // 4. Resources (responsible is the primary resource)
    if (visibilitySettings.viewByResources && action.responsibleUserId && Number(action.responsibleUserId) === Number(currentUser.id)) {
        return true;
    }

    // 5. Org Heads
    if (visibilitySettings.viewByOrgHeads && currentUser.owningUnit) {
        const userUnit = currentUser.owningUnit;
        const relatedUnits = new Set<string>();
        if (action.owningUnit) relatedUnits.add(action.owningUnit);

        const ownerUser = users.find(u => Number(u.id) === Number(action.ownerUserId));
        if (ownerUser?.owningUnit) relatedUnits.add(ownerUser.owningUnit);

        const respUser = users.find(u => Number(u.id) === Number(action.responsibleUserId));
        if (respUser?.owningUnit) relatedUnits.add(respUser.owningUnit);

        for (const targetUnit of relatedUnits) {
            if (isAncestorOrgUnit(userUnit, targetUnit, unitNodes)) {
                return true;
            }
        }
    }

    return false;
}

export function exportToPdf(options?: { title?: string; orientation?: 'landscape' | 'portrait' } | string): void {
    let title: string | undefined;
    let orientation: 'landscape' | 'portrait' = 'landscape';

    if (typeof options === 'string') {
        title = options;
    } else if (options && typeof options === 'object') {
        title = options.title;
        if (options.orientation) orientation = options.orientation;
    }

    const originalTitle = document.title;
    const cleanTitle = (title || 'Report').replace(/[^\w\s\u0600-\u06FF-]/gi, '').trim() || 'Report';
    document.title = `${cleanTitle}`;

    // Inject dynamic @page orientation style
    const styleId = 'dynamic-print-orientation-style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `@media print { @page { size: ${orientation} !important; margin: 6mm 6mm !important; } }`;

    setTimeout(() => {
        try {
            window.focus();
            window.print();
        } catch (err) {
            console.error('Error initiating print:', err);
        } finally {
            setTimeout(() => {
                document.title = originalTitle;
                if (styleEl && styleEl.parentNode) {
                    styleEl.parentNode.removeChild(styleEl);
                }
            }, 1500);
        }
    }, 150);
}

export function exportDashboardToLandscapePdf(title?: string): void {
    exportToPdf({ title, orientation: 'landscape' });
}

export function exportDashboardToPortraitPdf(title?: string): void {
    exportToPdf({ title, orientation: 'portrait' });
}

// --- Recurrence Utilities for Actions & Tasks ---
export const PERSIAN_WEEKDAY_NAMES: Record<number, string> = {
    6: 'شنبه',
    0: 'یکشنبه',
    1: 'دوشنبه',
    2: 'سه‌شنبه',
    3: 'چهارشنبه',
    4: 'پنج‌شنبه',
    5: 'جمعه'
};

export const ENGLISH_WEEKDAY_NAMES: Record<number, string> = {
    6: 'Sat',
    0: 'Sun',
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri'
};

export const PERSIAN_MONTH_NAMES = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export function getRecurrenceSummary(recurrence?: ActionRecurrence, isFa: boolean = true): string {
    if (!recurrence || !recurrence.isRecurring) return '';
    const interval = Math.max(1, recurrence.interval || 1);
    const duration = recurrence.durationHours ? (isFa ? `${toPersianDigits(recurrence.durationHours)} ساعت` : `${recurrence.durationHours} hrs`) : '';

    if (recurrence.frequency === 'daily') {
        const intervalText = interval === 1 
            ? (isFa ? 'روزانه (هر روز)' : 'Daily (Every day)') 
            : (isFa ? `روزانه (هر ${toPersianDigits(interval)} روز یک‌بار)` : `Daily (Every ${interval} days)`);
        return duration ? `${intervalText} - مدت: ${duration}` : intervalText;
    }

    if (recurrence.frequency === 'weekly') {
        const days = (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0)
            ? recurrence.daysOfWeek.map(d => isFa ? PERSIAN_WEEKDAY_NAMES[d] : ENGLISH_WEEKDAY_NAMES[d]).join('، ')
            : (isFa ? 'روزهای کاری' : 'Workdays');
        const intervalText = interval === 1
            ? (isFa ? `هفتگی (روزهای ${days})` : `Weekly on ${days}`)
            : (isFa ? `هفتگی (هر ${toPersianDigits(interval)} هفته - روزهای ${days})` : `Weekly (Every ${interval} wks - ${days})`);
        return duration ? `${intervalText} - مدت: ${duration}` : intervalText;
    }

    if (recurrence.frequency === 'monthly') {
        const dayText = recurrence.dayOfMonth 
            ? (isFa ? `روز ${toPersianDigits(recurrence.dayOfMonth)} هر ماه` : `Day ${recurrence.dayOfMonth}`)
            : (isFa ? 'ماهیانه' : 'Monthly');
        const monthsText = (!recurrence.allMonths && recurrence.monthsOfYear && recurrence.monthsOfYear.length > 0)
            ? ` (${isFa ? 'ماه‌های' : 'Months'}: ${recurrence.monthsOfYear.map(m => isFa ? PERSIAN_MONTH_NAMES[m - 1] : m).join('، ')})`
            : (isFa ? ' (تمام ماه‌ها)' : ' (All months)');
        const intervalText = interval === 1
            ? (isFa ? `ماهیانه (${dayText}${monthsText})` : `Monthly (${dayText}${monthsText})`)
            : (isFa ? `ماهیانه (هر ${toPersianDigits(interval)} ماه یک‌بار - ${dayText}${monthsText})` : `Monthly (Every ${interval} mos - ${dayText}${monthsText})`);
        return duration ? `${intervalText} - مدت: ${duration}` : intervalText;
    }

    return '';
}

export function generateRecurringOccurrences(action: ActionItem, maxCount: number = 100): Array<{
    id: string;
    date: string;
    instanceIndex: number;
    label: string;
    durationHours?: number;
}> {
    if (!action.recurrence?.isRecurring || !action.startDate || !action.endDate) {
        return [{
            id: `act-${action.id}`,
            date: action.endDate || action.startDate || getISODateString(),
            instanceIndex: 1,
            label: '',
            durationHours: action.recurrence?.durationHours
        }];
    }

    const rec = action.recurrence;
    const start = new Date(action.startDate);
    const end = new Date(action.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        return [{
            id: `act-${action.id}`,
            date: action.startDate || getISODateString(),
            instanceIndex: 1,
            label: '',
            durationHours: rec.durationHours
        }];
    }

    const interval = Math.max(1, rec.interval || 1);
    const results: Array<{ id: string; date: string; instanceIndex: number; label: string; durationHours?: number }> = [];

    const curr = new Date(start);
    let index = 1;

    if (rec.frequency === 'daily') {
        while (curr <= end && results.length < maxCount) {
            const dateStr = getISODateString(curr);
            results.push({
                id: `act-${action.id}-inst-${index}`,
                date: dateStr,
                instanceIndex: index,
                label: `نوبت ${toPersianDigits(index)} (روزانه)`,
                durationHours: rec.durationHours
            });
            index++;
            curr.setDate(curr.getDate() + interval);
        }
    } else if (rec.frequency === 'weekly') {
        const targetDays = new Set(rec.daysOfWeek && rec.daysOfWeek.length > 0 ? rec.daysOfWeek : [6, 0, 1, 2, 3]);
        while (curr <= end && results.length < maxCount) {
            const dayOfWeek = curr.getDay(); // 0: Sun, ..., 6: Sat
            const diffDays = Math.floor((curr.getTime() - start.getTime()) / (1000 * 3600 * 24));
            const weekIndex = Math.floor(diffDays / 7);

            if (weekIndex % interval === 0 && targetDays.has(dayOfWeek)) {
                const dateStr = getISODateString(curr);
                const dayNameFa = PERSIAN_WEEKDAY_NAMES[dayOfWeek] || '';
                results.push({
                    id: `act-${action.id}-inst-${index}`,
                    date: dateStr,
                    instanceIndex: index,
                    label: `نوبت ${toPersianDigits(index)} (${dayNameFa})`,
                    durationHours: rec.durationHours
                });
                index++;
            }
            curr.setDate(curr.getDate() + 1);
        }
    } else if (rec.frequency === 'monthly') {
        while (curr <= end && results.length < maxCount) {
            const jalali = toJalali(curr.getFullYear(), curr.getMonth() + 1, curr.getDate());
            const matchesMonth = rec.allMonths || !rec.monthsOfYear || rec.monthsOfYear.length === 0 || rec.monthsOfYear.includes(jalali.jm);
            const targetDay = rec.dayOfMonth || 1;

            if (matchesMonth && (jalali.jd === targetDay || (targetDay > 30 && jalali.jd >= 29))) {
                const dateStr = getISODateString(curr);
                results.push({
                    id: `act-${action.id}-inst-${index}`,
                    date: dateStr,
                    instanceIndex: index,
                    label: `نوبت ${toPersianDigits(index)} (${PERSIAN_MONTH_NAMES[jalali.jm - 1]})`,
                    durationHours: rec.durationHours
                });
                index++;
            }
            curr.setDate(curr.getDate() + 1);
        }
    }

    if (results.length === 0) {
        results.push({
            id: `act-${action.id}-inst-1`,
            date: action.startDate,
            instanceIndex: 1,
            label: 'نوبت ۱',
            durationHours: rec.durationHours
        });
    }

    return results;
}

export interface SCurveDataPoint {
    dateLabel: string;
    isoDate: string;
    date: Date;
    plannedProgress: number;
    actualProgress: number | null;
    hasActualSnapshot: boolean;
    dayIndex: number;
}

export const calculateSCurveData = (
    project: Project,
    activities: ProjectActivity[] = [],
    calendar?: Calendar,
    language: string = 'fa'
): SCurveDataPoint[] => {
    const effectiveCal: Calendar = calendar || {
        id: '1',
        name: 'Default',
        workingDays: [0, 1, 2, 3, 4],
        workHoursPerDay: 8
    };

    // Ensure we have activities with CPM calculated start/end dates
    let effectiveNodes = activities;
    const hasCalculatedDates = activities && activities.some(a => (a.children && a.children.length > 0) || (a.startDate && a.endDate));
    if (!hasCalculatedDates && project.schedule && project.schedule.length > 0) {
        const { rootNode } = calculateScheduleTreeAndProgress(project, effectiveCal, project.weightingType, project.plannedProgressType);
        if (rootNode) {
            effectiveNodes = [rootNode];
        }
    }

    const list: ProjectActivity[] = [];
    const dive = (nodes: ProjectActivity[]) => {
        nodes.forEach(node => {
            if (node.id !== 'project-root') list.push(node);
            if (node.children) dive(node.children);
        });
    };
    dive(effectiveNodes && effectiveNodes.length > 0 ? effectiveNodes : (project.schedule || []));

    if (list.length === 0) return [];
    const validTasks = list.filter(t => t.startDate && t.endDate);

    const projStart = project.startDate ? new Date(project.startDate) : (validTasks.length > 0 ? new Date(Math.min(...validTasks.map(t => new Date(t.startDate!).getTime()))) : new Date());
    const projEnd = project.endDate ? new Date(project.endDate) : (validTasks.length > 0 ? new Date(Math.max(...validTasks.map(t => new Date(t.endDate!).getTime()))) : new Date());

    const minDate = validTasks.length > 0 ? new Date(Math.min(...validTasks.map(t => new Date(t.startDate!).getTime()))) : projStart;
    const maxDate = validTasks.length > 0 ? new Date(Math.max(...validTasks.map(t => new Date(t.endDate!).getTime()))) : projEnd;

    const effectiveStart = minDate < projStart ? minDate : projStart;
    const effectiveEnd = maxDate > projEnd ? maxDate : projEnd;

    const totalDays = Math.max(1, Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 3600 * 24)) + 1);
    const step = Math.max(1, Math.floor(totalDays / 30));
    const rawPoints: { date: Date; dayIndex: number; dateLabel: string; isoDate: string }[] = [];

    for (let i = 0; i <= totalDays; i += step) {
        const d = new Date(effectiveStart);
        d.setDate(effectiveStart.getDate() + i);
        if (d > effectiveEnd && i < totalDays) {
            d.setTime(effectiveEnd.getTime());
        }

        const dateLabel = language === 'fa' ? formatDate(d, 'fa') : formatDate(d, 'en');
        const isoDate = d.toISOString().split('T')[0];

        rawPoints.push({
            date: d,
            dayIndex: i,
            dateLabel,
            isoDate
        });

        if (d.getTime() === effectiveEnd.getTime()) break;
    }

    const lastRaw = rawPoints[rawPoints.length - 1];
    if (!lastRaw || lastRaw.dayIndex !== totalDays) {
        rawPoints.push({
            date: effectiveEnd,
            dayIndex: totalDays,
            dateLabel: language === 'fa' ? formatDate(effectiveEnd, 'fa') : formatDate(effectiveEnd, 'en'),
            isoDate: effectiveEnd.toISOString().split('T')[0]
        });
    }

    const normalizeDateKey = (str: string): string => {
        return (str || '')
            .trim()
            .replace(/[۰-۹]/g, d => "0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)])
            .replace(/[\/\.]/g, '-');
    };

    // Filter progress information snapshots
    const progressSnapshots = (project.scheduleSnapshots || []).filter(s => s.type === 'Progress Information');
    const snapshotMap = new Map<string, number>();

    progressSnapshots.forEach(s => {
        let val: number = 0;
        if (typeof s.actualProgress === 'number') {
            val = s.actualProgress;
        } else {
            const { rootNode } = calculateScheduleTreeAndProgress(
                { ...project, schedule: s.schedule || [] },
                effectiveCal,
                project.weightingType,
                project.plannedProgressType
            );
            val = Math.round((rootNode?.actualProgress || 0) * 10) / 10;
        }
        snapshotMap.set(s.name.trim(), val);
        snapshotMap.set(normalizeDateKey(s.name), val);
    });

    let maxSnapshotDayIndex = -1;
    if (progressSnapshots.length > 0) {
        rawPoints.forEach(p => {
            const key = normalizeDateKey(p.dateLabel);
            if (snapshotMap.has(p.dateLabel.trim()) || snapshotMap.has(key)) {
                if (p.dayIndex > maxSnapshotDayIndex) {
                    maxSnapshotDayIndex = p.dayIndex;
                }
            }
        });
        if (maxSnapshotDayIndex === -1 && progressSnapshots.length > 0) {
            maxSnapshotDayIndex = 0;
        }
    }

    return rawPoints.map(p => {
        const { rootNode } = calculateScheduleTreeAndProgress(
            { ...project, schedule: list },
            effectiveCal,
            project.weightingType,
            project.plannedProgressType,
            p.date
        );
        const plannedProgress = Math.round((rootNode?.plannedProgress || 0) * 10) / 10;

        const key = normalizeDateKey(p.dateLabel);
        const hasDirectSnapshot = snapshotMap.has(p.dateLabel.trim()) || snapshotMap.has(key);
        let actualProgress: number | null = null;
        let hasActualSnapshot = false;

        if (hasDirectSnapshot) {
            actualProgress = snapshotMap.get(p.dateLabel.trim()) ?? snapshotMap.get(key) ?? 0;
            hasActualSnapshot = true;
        } else if (p.dayIndex === 0 && progressSnapshots.length > 0) {
            actualProgress = 0;
            hasActualSnapshot = true;
        } else if (progressSnapshots.length > 0 && p.dayIndex <= maxSnapshotDayIndex) {
            actualProgress = null;
        } else {
            actualProgress = null;
        }

        return {
            dateLabel: p.dateLabel,
            isoDate: p.isoDate,
            date: p.date,
            plannedProgress,
            actualProgress,
            hasActualSnapshot,
            dayIndex: p.dayIndex
        };
    });
};
