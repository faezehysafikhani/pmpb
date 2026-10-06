import React, { useState, useMemo, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Project, ProjectActivity, Calendar, User } from '../types';
import { LocalizationContext } from '../context';
import { toPersianDigits, formatDate } from '../utils';
import { generateMsProjectXml, downloadMsProjectXmlFile, MsProjectExportOptions } from './msProjectExportUtil';

interface MsProjectExportModalProps {
  project: Project;
  scheduleActivities: ProjectActivity[];
  calendar?: Calendar;
  users?: User[];
  isOpen: boolean;
  onClose: () => void;
}

export const MsProjectExportModal: React.FC<MsProjectExportModalProps> = ({
  project,
  scheduleActivities,
  calendar,
  users = [],
  isOpen,
  onClose
}) => {
  const { language } = useContext(LocalizationContext);
  const isFa = language === 'fa';

  const defaultFileName = useMemo(() => {
    const safeName = (project.name || 'Project')
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_');
    return `${safeName}_Schedule.xml`;
  }, [project.name]);

  const [fileName, setFileName] = useState(defaultFileName);
  const [includeProgress, setIncludeProgress] = useState(true);
  const [includeCosts, setIncludeCosts] = useState(true);
  const [includeAssignments, setIncludeAssignments] = useState(true);
  const [includePredecessors, setIncludePredecessors] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Sync default file name if project changes
  React.useEffect(() => {
    setFileName(defaultFileName);
    setDownloadSuccess(false);
  }, [defaultFileName, isOpen]);

  // Flattened tasks for summary and preview
  const { allTasks, summaryCount, leafCount, dependencyCount, totalDays } = useMemo(() => {
    const list: Array<{
      activity: ProjectActivity;
      wbs: string;
      level: number;
      isSummary: boolean;
    }> = [];

    let summaries = 0;
    let leaves = 0;
    let deps = 0;
    let days = 0;

    const traverse = (nodes: ProjectActivity[], parentOutline: string = '', level: number = 1) => {
      nodes.forEach((node, index) => {
        if (node.id === 'project-root') {
          if (node.children && node.children.length > 0) {
            traverse(node.children, '', 1);
          }
          return;
        }

        const outline = node.wbsCode || (parentOutline ? `${parentOutline}.${index + 1}` : `${index + 1}`);
        const hasChildren = Boolean(node.children && node.children.length > 0) || Boolean(node.isParent);

        if (hasChildren) {
          summaries++;
        } else {
          leaves++;
          days += (node.duration || 0);
        }

        if (node.prerequisiteId) {
          deps++;
        }

        list.push({
          activity: node,
          wbs: outline,
          level,
          isSummary: hasChildren
        });

        if (node.children && node.children.length > 0) {
          traverse(node.children, outline, level + 1);
        }
      });
    };

    traverse(scheduleActivities);

    return {
      allTasks: list,
      summaryCount: summaries,
      leafCount: leaves,
      dependencyCount: deps,
      totalDays: days
    };
  }, [scheduleActivities]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return allTasks;
    const q = searchQuery.toLowerCase();
    return allTasks.filter(
      t =>
        t.activity.name.toLowerCase().includes(q) ||
        t.wbs.toLowerCase().includes(q)
    );
  }, [allTasks, searchQuery]);

  const handleExport = () => {
    try {
      const options: MsProjectExportOptions = {
        includeProgress,
        includeCosts,
        includeAssignments,
        includePredecessors,
        customFileName: fileName
      };

      const xmlString = generateMsProjectXml(
        project,
        scheduleActivities,
        calendar,
        users,
        options
      );

      const targetFileName = fileName.trim().endsWith('.xml')
        ? fileName.trim()
        : `${fileName.trim() || 'Project_Schedule'}.xml`;

      downloadMsProjectXmlFile(xmlString, targetFileName);
      setDownloadSuccess(true);
    } catch (err) {
      console.error('Failed to export to MS Project XML:', err);
    }
  };

  if (!isOpen) return null;

  const hasActivities = allTasks.length > 0;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        className="modal-content card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--card-bg-color, #ffffff)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-primary, #ffffff)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 124, 65, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#107c41'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.75rem' }}>
                file_download
              </span>
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--text-color, #0f172a)'
                }}
              >
                {isFa ? 'خروجی به Microsoft Project (فایل XML)' : 'Export to Microsoft Project (XML)'}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.85rem',
                  color: 'var(--text-muted, #64748b)',
                  marginTop: '2px'
                }}
              >
                {isFa
                  ? 'تولید فایل رسمی استاندارد MSPDI XML سازگار با تمامی نسخه‌های Microsoft Project (2010 تا 2024 و Office 365)'
                  : 'Generate standard MSPDI XML format fully compatible with Microsoft Project (2010 to 2024 & Office 365)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="action-button"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '0.5rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}
        >
          {downloadSuccess && (
            <div
              style={{
                padding: '1rem 1.25rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: '#065f46'
              }}
            >
              <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '1.5rem' }}>
                check_circle
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>
                  {isFa ? 'فایل XML با موفقیت دانلود شد!' : 'XML file successfully downloaded!'}
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem' }}>
                  {isFa
                    ? 'فایل در پوشه دانلودهای شما ذخیره شد. برای باز کردن، کافیست روی فایل دابل‌کلیک کرده یا در نرم‌افزار Microsoft Project از منوی File > Open آن را فراخوانی کنید.'
                    : 'The file has been saved to your downloads. You can open it in Microsoft Project directly via File > Open.'}
                </p>
              </div>
            </div>
          )}

          {!hasActivities ? (
            <div
              style={{
                padding: '2.5rem',
                textAlign: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                border: '1px dashed rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                color: 'var(--text-color, #0f172a)'
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '0.75rem', display: 'block' }}
              >
                event_busy
              </span>
              <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                {isFa ? 'هیچ فعالیتی در زمانبندی این پروژه وجود ندارد' : 'No activities in this project schedule'}
              </h3>
              <p style={{ margin: 0, color: 'var(--text-muted, #64748b)', fontSize: '0.9rem' }}>
                {isFa
                  ? 'لطفاً ابتدا فعالیت‌ها و ساختار شکست کار (WBS) پروژه را در نمای زمانبندی آبشاری ثبت یا ایمپورت کنید.'
                  : 'Please create or import activities in the waterfall schedule before exporting.'}
              </p>
            </div>
          ) : (
            <>
              {/* Summary Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem'
                }}
              >
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'rgba(16, 124, 65, 0.06)',
                    border: '1px solid rgba(16, 124, 65, 0.2)',
                    borderRadius: '10px'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', display: 'block' }}>
                    {isFa ? 'کل فعالیت‌ها' : 'Total Activities'}
                  </span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#107c41' }}>
                    {isFa ? toPersianDigits(allTasks.length) : allTasks.length}
                  </span>
                </div>

                <div
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'rgba(59, 130, 246, 0.06)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: '10px'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', display: 'block' }}>
                    {isFa ? 'فازهای خلاصه WBS' : 'Summary Phases'}
                  </span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#2563eb' }}>
                    {isFa ? toPersianDigits(summaryCount) : summaryCount}
                  </span>
                </div>

                <div
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'rgba(245, 158, 11, 0.06)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '10px'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', display: 'block' }}>
                    {isFa ? 'روابط پیش‌نیازی' : 'Dependencies'}
                  </span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#d97706' }}>
                    {isFa ? toPersianDigits(dependencyCount) : dependencyCount}
                  </span>
                </div>

                <div
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'rgba(139, 92, 246, 0.06)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '10px'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', display: 'block' }}>
                    {isFa ? 'مجموع روزهای کاری' : 'Working Days'}
                  </span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#7c3aed' }}>
                    {isFa ? toPersianDigits(totalDays) : totalDays}
                  </span>
                </div>
              </div>

              {/* Export Settings Card */}
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--bg-primary, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '12px'
                }}
              >
                <h4
                  style={{
                    margin: '0 0 1rem 0',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: 'var(--text-color, #0f172a)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#107c41' }}>
                    tune
                  </span>
                  {isFa ? 'تنظیمات و گزینه‌های خروجی' : 'Export Settings & Options'}
                </h4>

                {/* File Name Field */}
                <div style={{ marginBottom: '1rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      marginBottom: '0.35rem',
                      color: 'var(--text-color, #334155)'
                    }}
                  >
                    {isFa ? 'نام فایل خروجی:' : 'Output File Name:'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="Project_Schedule.xml"
                      style={{
                        flex: 1,
                        padding: '0.55rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #cbd5e1)',
                        fontSize: '0.9rem',
                        direction: 'ltr',
                        textAlign: 'left'
                      }}
                    />
                  </div>
                </div>

                {/* Checkbox Options Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '0.75rem'
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-color, #334155)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includePredecessors}
                      onChange={(e) => setIncludePredecessors(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#107c41' }}
                    />
                    <span>{isFa ? 'درج روابط پیش‌نیازی و تاخیرها (Dependencies & Lag)' : 'Include Predecessors & Lags'}</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-color, #334155)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includeProgress}
                      onChange={(e) => setIncludeProgress(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#107c41' }}
                    />
                    <span>{isFa ? 'درج درصد پیشرفت واقعی (Actual Progress %)' : 'Include Actual Progress %'}</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-color, #334155)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includeCosts}
                      onChange={(e) => setIncludeCosts(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#107c41' }}
                    />
                    <span>{isFa ? 'درج برآورد هزینه و نفرساعت کار (Cost & Work)' : 'Include Cost & Work Hours'}</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-color, #334155)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includeAssignments}
                      onChange={(e) => setIncludeAssignments(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#107c41' }}
                    />
                    <span>{isFa ? 'درج منابع و انتصاب نفرات (Resource Assignments)' : 'Include Resource Assignments'}</span>
                  </label>
                </div>
              </div>

              {/* Tasks Preview Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: 'var(--text-color, #0f172a)'
                      }}
                    >
                      {isFa ? 'پیش‌نمایش ساختار شکست کار (WBS)' : 'WBS Tasks Preview'}
                    </h4>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '999px',
                        backgroundColor: 'var(--border-color, #e2e8f0)',
                        color: 'var(--text-muted, #64748b)'
                      }}
                    >
                      {isFa ? `${toPersianDigits(filteredTasks.length)} مورد` : `${filteredTasks.length} items`}
                    </span>
                  </div>

                  {/* Search input */}
                  <div style={{ position: 'relative', width: '220px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={isFa ? 'جستجوی فعالیت...' : 'Search activity...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.75rem',
                        paddingInlineStart: '2rem',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #cbd5e1)'
                      }}
                    />
                    <span
                      className="material-symbols-outlined"
                      style={{
                        position: 'absolute',
                        insetInlineStart: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '1.1rem',
                        color: 'var(--text-muted, #94a3b8)',
                        pointerEvents: 'none'
                      }}
                    >
                      search
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px'
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.85rem',
                      textAlign: isFa ? 'right' : 'left'
                    }}
                  >
                    <thead
                      style={{
                        position: 'sticky',
                        top: 0,
                        backgroundColor: 'var(--bg-primary, #f1f5f9)',
                        borderBottom: '1px solid var(--border-color, #cbd5e1)',
                        zIndex: 1
                      }}
                    >
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', width: '90px' }}>WBS</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>{isFa ? 'نام فعالیت' : 'Activity Name'}</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '85px', textAlign: 'center' }}>
                          {isFa ? 'مدت (روز)' : 'Duration'}
                        </th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '110px' }}>{isFa ? 'تاریخ شروع' : 'Start'}</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '110px' }}>{isFa ? 'تاریخ پایان' : 'Finish'}</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '70px', textAlign: 'center' }}>
                          {isFa ? 'پیشرفت' : 'Progress'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((t, idx) => {
                        const act = t.activity;
                        const indentPx = (t.level - 1) * 16;
                        return (
                          <tr
                            key={`${act.id}-${idx}`}
                            style={{
                              borderBottom: '1px solid var(--border-color, #f1f5f9)',
                              backgroundColor: t.isSummary
                                ? 'rgba(16, 124, 65, 0.03)'
                                : idx % 2 === 0
                                ? 'transparent'
                                : 'rgba(0, 0, 0, 0.015)'
                            }}
                          >
                            <td
                              style={{
                                padding: '0.45rem 0.75rem',
                                fontFamily: 'monospace',
                                fontWeight: t.isSummary ? 700 : 500,
                                color: t.isSummary ? '#107c41' : 'inherit'
                              }}
                            >
                              {isFa ? toPersianDigits(t.wbs) : t.wbs}
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', paddingInlineStart: `${indentPx}px`, gap: '0.35rem' }}>
                                <span
                                  className="material-symbols-outlined"
                                  style={{
                                    fontSize: '1.1rem',
                                    color: t.isSummary ? '#107c41' : '#64748b'
                                  }}
                                >
                                  {t.isSummary ? 'folder' : 'task_alt'}
                                </span>
                                <span style={{ fontWeight: t.isSummary ? 700 : 400 }}>{act.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center' }}>
                              {isFa ? toPersianDigits(act.duration || 0) : (act.duration || 0)}
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                              {formatDate(act.startDate, language)}
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                              {formatDate(act.endDate, language)}
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  backgroundColor:
                                    (act.actualProgress || 0) >= 100
                                      ? 'rgba(16, 185, 129, 0.15)'
                                      : 'rgba(59, 130, 246, 0.15)',
                                  color:
                                    (act.actualProgress || 0) >= 100
                                      ? '#059669'
                                      : '#2563eb'
                                }}
                              >
                                {isFa ? `${toPersianDigits(Math.round(act.actualProgress || 0))}٪` : `${Math.round(act.actualProgress || 0)}%`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-primary, #ffffff)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#107c41' }}>
              verified
            </span>
            <span>
              {isFa
                ? 'فرمت رسمی MSPDI XML با استاندارد Microsoft Project'
                : 'Official Microsoft Project MSPDI XML Standard'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={onClose}
              className="action-button"
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #cbd5e1)',
                backgroundColor: 'transparent',
                color: 'var(--text-color, #334155)',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {isFa ? 'بستن' : 'Close'}
            </button>

            {hasActivities && (
              <button
                onClick={handleExport}
                className="action-button primary"
                style={{
                  padding: '0.6rem 1.4rem',
                  borderRadius: '8px',
                  backgroundColor: '#107c41',
                  borderColor: '#107c41',
                  color: '#ffffff',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(16, 124, 65, 0.25)'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
                  file_download
                </span>
                <span>{isFa ? 'دانلود فایل XML مایکروسافت پروجکت' : 'Download MS Project XML'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
