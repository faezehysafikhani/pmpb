import React, { useState, useEffect, useRef, useContext, ReactElement } from 'react';
import { LocalizationContext } from '../context';
import { toJalali, toGregorian, toPersianDigits, getOfficialHolidayReason } from '../utils';
import { Calendar } from '../types';

interface ShamsiDatePickerProps {
  value?: string; // Expects ISO string YYYY-MM-DD
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  calendar?: Calendar;
}

const JALALI_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
  'مرداد', 'شهریور', 'مهر', 'آبان',
  'آذر', 'دی', 'بهمن', 'اسفند'
];

const WEEK_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export const ShamsiDatePicker: React.FC<ShamsiDatePickerProps> = ({
  value,
  onChange,
  id,
  name,
  required,
  disabled,
  placeholder,
  className,
  calendar
}): ReactElement => {
  const { language, t } = useContext(LocalizationContext);
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load calendars from localStorage to identify active calendar holidays
  const calendars: Calendar[] = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('pms_calendars');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [{ id: 1, name: 'Default', isDefault: true, workingDays: [6, 0, 1, 2, 3], specificHolidays: [] }];
  }, []);

  // Current view month & year in Jalali
  const todayG = new Date();
  const todayJ = toJalali(todayG.getFullYear(), todayG.getMonth() + 1, todayG.getDate());

  // Parse initial selected date
  const parsedSelected = React.useMemo(() => {
    if (!value) return null;
    const parts = value.split(/[-/]/);
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        if (y > 1700) {
          return toJalali(y, m, d);
        } else if (y > 1300 && y < 1500) {
          return { jy: y, jm: m, jd: d };
        }
      }
    }
    return null;
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(parsedSelected ? parsedSelected.jy : todayJ.jy);
  const [viewMonth, setViewMonth] = useState<number>(parsedSelected ? parsedSelected.jm : todayJ.jm);

  // Update view when value changes from outside
  useEffect(() => {
    if (parsedSelected) {
      setViewYear(parsedSelected.jy);
      setViewMonth(parsedSelected.jm);
    }
  }, [parsedSelected]);

  // Handle click outside to close popover & detect if should open upwards
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popoverHeight = 330;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [isOpen]);

  const rawFormatted = parsedSelected
    ? `${parsedSelected.jy}/${String(parsedSelected.jm).padStart(2, '0')}/${String(parsedSelected.jd).padStart(2, '0')}`
    : '';
  const formattedDisplayValue = (language === 'fa' || !language) && rawFormatted ? toPersianDigits(rawFormatted) : rawFormatted;

  // Calculate calendar days grid for viewYear / viewMonth
  const calendarData = React.useMemo(() => {
    const firstDayG = toGregorian(viewYear, viewMonth, 1);
    const dateObj = new Date(firstDayG.gy, firstDayG.gm - 1, firstDayG.gd);
    const dayOfWeekJS = dateObj.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const startOffset = (dayOfWeekJS + 1) % 7; // 0 for Sat, 1 for Sun, ..., 6 for Fri

    let totalDays = 30;
    if (viewMonth <= 6) totalDays = 31;
    else if (viewMonth <= 11) totalDays = 30;
    else {
      const isLeap = (((viewYear - 474) % 2820) + 512) * 682 % 2816 < 682;
      totalDays = isLeap ? 30 : 29;
    }

    return { startOffset, totalDays };
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(v => v - 1);
    } else {
      setViewMonth(v => v - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(v => v + 1);
    } else {
      setViewMonth(v => v + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const g = toGregorian(viewYear, viewMonth, day);
    const isoString = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
    onChange(isoString);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const g = toGregorian(todayJ.jy, todayJ.jm, todayJ.jd);
    const isoString = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
    onChange(isoString);
    setViewYear(todayJ.jy);
    setViewMonth(todayJ.jm);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const yearOptions = Array.from({ length: 41 }, (_, i) => 1380 + i);

  return (
    React.createElement("div", { ref: containerRef, className: `shamsi-datepicker-container ${className || ''}` },
      React.createElement("div", { className: "shamsi-datepicker-input-wrapper", onClick: () => !disabled && setIsOpen(!isOpen) },
        React.createElement("input", {
          type: "text",
          id,
          name,
          readOnly: true,
          value: formattedDisplayValue,
          placeholder: placeholder || (language === 'fa' ? 'مثال: ۱۴۰۳/۰۵/۱۵' : 'YYYY/MM/DD'),
          required,
          disabled,
          className: "shamsi-datepicker-input"
        }),
        React.createElement("span", { className: "material-symbols-outlined shamsi-datepicker-icon" }, "event")
      ),

      isOpen && !disabled && (
        React.createElement("div", {
          className: `shamsi-datepicker-popover ${openUpwards ? 'open-upwards' : ''}`
        },
          // Header with navigation and selectors
          React.createElement("div", { className: "shamsi-datepicker-header" },
            React.createElement("button", {
              type: "button",
              className: "shamsi-nav-btn",
              onClick: handlePrevMonth,
              title: "ماه قبل"
            }, React.createElement("span", { className: "material-symbols-outlined" }, "chevron_right")),

            React.createElement("div", { className: "shamsi-selectors" },
              React.createElement("select", {
                value: viewMonth,
                onChange: (e) => setViewMonth(parseInt(e.target.value, 10)),
                className: "shamsi-select"
              },
                JALALI_MONTH_NAMES.map((m, idx) => (
                  React.createElement("option", { key: idx + 1, value: idx + 1 }, m)
                ))
              ),
              React.createElement("select", {
                value: viewYear,
                onChange: (e) => setViewYear(parseInt(e.target.value, 10)),
                className: "shamsi-select"
              },
                yearOptions.map(y => (
                  React.createElement("option", { key: y, value: y }, (language === 'fa' || !language) ? toPersianDigits(y) : y)
                ))
              )
            ),

            React.createElement("button", {
              type: "button",
              className: "shamsi-nav-btn",
              onClick: handleNextMonth,
              title: "ماه بعد"
            }, React.createElement("span", { className: "material-symbols-outlined" }, "chevron_left"))
          ),

          // Days of Week Header
          React.createElement("div", { className: "shamsi-weekdays" },
            WEEK_DAYS.map((wd, i) => (
              React.createElement("div", { key: i, className: `shamsi-weekday ${i === 6 ? 'friday' : ''}` }, wd)
            ))
          ),

          // Days Grid
          React.createElement("div", { className: "shamsi-days-grid" },
            Array.from({ length: calendarData.startOffset }).map((_, i) => (
              React.createElement("div", { key: `blank-${i}`, className: "shamsi-day-cell blank" })
            )),

            Array.from({ length: calendarData.totalDays }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected = parsedSelected && parsedSelected.jy === viewYear && parsedSelected.jm === viewMonth && parsedSelected.jd === dayNum;
              const isToday = todayJ.jy === viewYear && todayJ.jm === viewMonth && todayJ.jd === dayNum;
              
              const g = toGregorian(viewYear, viewMonth, dayNum);
              const dateObj = new Date(g.gy, g.gm - 1, g.gd);
              const dateString = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;

              const activeCalendar = calendar || calendars.find(c => c.isDefault) || calendars[0];
              const isWeeklyHoliday = activeCalendar ? !activeCalendar.workingDays.includes(dateObj.getDay()) : (dateObj.getDay() === 5);
              const specificHoliday = activeCalendar?.specificHolidays?.find(h => h.date === dateString);
              const officialReason = (activeCalendar && activeCalendar.applyOfficialHolidays !== false) ? getOfficialHolidayReason(dateObj) : null;
              const isHoliday = isWeeklyHoliday || !!specificHoliday || !!officialReason;

              const tooltipText = specificHoliday?.reason || officialReason || (isWeeklyHoliday ? (language === 'fa' ? 'تعطیل هفتگی' : 'Weekly Holiday') : '');

              return React.createElement("button", {
                key: dayNum,
                type: "button",
                onClick: () => handleSelectDay(dayNum),
                title: tooltipText,
                className: `shamsi-day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isHoliday ? 'holiday' : ''}`
              }, (language === 'fa' || !language) ? toPersianDigits(dayNum) : dayNum);
            })
          ),

          // Footer buttons
          React.createElement("div", { className: "shamsi-datepicker-footer" },
            React.createElement("button", {
              type: "button",
              className: "shamsi-footer-btn today-btn",
              onClick: handleSelectToday
            }, "امروز"),
            React.createElement("button", {
              type: "button",
              className: "shamsi-footer-btn clear-btn",
              onClick: handleClear
            }, "پاک‌کردن")
          )
        )
      )
    )
  );
};
