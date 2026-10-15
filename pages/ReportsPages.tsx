import React, { useState, useMemo, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocalizationContext } from '../context';
import { User, Project, EnrichedProject, Calendar, WorkStatus } from '../types';
import { toPersianDigits, enrichProjectWithProgress, getUnitLevel2, exportDashboardToLandscapePdf } from '../utils';
import { reportsApi } from '../services/backend/reports';
import type { BackendManagerEvaluation, BackendStatusMatrix, BackendUnitReport } from '../services/backend/reports';

interface ReportsDashboardPageProps {
  projects: Project[];
  actions?: any[];
  users: User[];
  calendars: Calendar[];
  onNavigate: (page: string, context?: any) => void;
  owningUnits: string[];
  projectStatuses: string[];
}

const VIBRANT_BAR_GRADIENTS = [
  'linear-gradient(135deg, #3B82F6, #1D4ED8)',
  'linear-gradient(135deg, #10B981, #047857)',
  'linear-gradient(135deg, #F59E0B, #B45309)',
  'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  'linear-gradient(135deg, #EC4899, #BE185D)',
  'linear-gradient(135deg, #06B6D4, #0E7490)',
  'linear-gradient(135deg, #F97316, #C2410C)',
  'linear-gradient(135deg, #14B8A6, #0F766E)',
  'linear-gradient(135deg, #6366F1, #4338CA)',
  'linear-gradient(135deg, #E11D48, #9F1239)',
  'linear-gradient(135deg, #84CC16, #4D7C0F)',
  'linear-gradient(135deg, #A855F7, #7E22CE)',
];

export const ReportsDashboardPage = ({
  projects,
  actions = [],
  users,
  calendars,
  onNavigate,
  owningUnits,
  projectStatuses,
}: ReportsDashboardPageProps) => {
  const { t, language } = useContext(LocalizationContext);
  const [activeTab, setActiveTab] = useState<'units' | 'managers' | 'matrix'>('units');

  // Matrix specific states
  const [selectedCell, setSelectedCell] = useState<{ unit: string | null; status: string | null }>({ unit: null, status: null });

  // Selected manager for detailed view
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);

  // --- 1. THE BACKEND'S REPORTS ---
  // Averages, delays, ratings and the unit / status counts are worked out by the backend; this page only lays them out.
  // (The projects listed when a row or cell is opened are looked up by the ids the backend returns.)
  const [reports, setReports] = useState<{ units: BackendUnitReport | null; managers: BackendManagerEvaluation[]; matrix: BackendStatusMatrix | null }>(
    { units: null, managers: [], matrix: null });
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportsLoading, setReportsLoading] = useState(true);

  const projectsKey = projects.map(p => `${p.id}:${p.status}:${p.approvalStatus}`).join(',');
  useEffect(() => {
    let cancelled = false;
    setReportsLoading(true);
    void Promise.all([reportsApi.units(), reportsApi.managers(), reportsApi.matrix()]).then(([units, managers, matrix]) => {
      if (cancelled) return;
      const failure = [units, managers, matrix].find(r => !r.ok);
      setReportError(failure ? (failure.error?.status === 403
        ? (language === 'fa' ? 'برای مشاهده این گزارش‌ها دسترسی «مشاهده همه گزارش‌ها» لازم است.' : 'Viewing these reports needs the "view all reports" permission.')
        : failure.error?.message ?? 'The reports could not be loaded.') : null);
      setReports({ units: units.value ?? null, managers: managers.value?.managers ?? [], matrix: matrix.value ?? null });
      setReportsLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsKey]);

  const enrichedProjects = useMemo(() => {
    return projects
      .filter((p) => p.approvalStatus === 'Approved')
      .map((p) => enrichProjectWithProgress(p, calendars));
  }, [projects, calendars]);
  const projectsByIds = (ids: string[] | null | undefined) => {
    const wanted = new Set(ids ?? []);
    return enrichedProjects.filter(p => wanted.has(p.id));
  };

  // Helper to resolve manager name
  const getManagerName = (id: string | null) => {
    if (id === null) return language === 'fa' ? 'بدون مدیر' : 'No Manager';
    const user = users.find((u) => u.id === id);
    return user ? user.username : (language === 'fa' ? `شناسه ${id}` : `ID ${id}`);
  };

  // Helper to translate statuses
  const getStatusText = (status: string) => {
    if (language === 'fa') {
      switch (status) {
        case 'Planning': return 'برنامه‌ریزی';
        case 'In Progress': return 'در حال انجام';
        case 'On Hold': return 'متوقف شده';
        case 'Completed': return 'تکمیل شده';
        default: return status;
      }
    } else {
      return status;
    }
  };

  type Rating = 'Excellent' | 'Good' | 'Needs Improvement';
  const ratingOf = (backendRating: string | null): Rating =>
    backendRating === 'Excellent' ? 'Excellent' : backendRating === 'Good' ? 'Good' : 'Needs Improvement';

  // --- 2. DEPARTMENT PERFORMANCE ---
  const unitPerformanceData = useMemo(() => (reports.units?.units ?? []).map((u) => {
    const avgPlanned = u.averagePlannedProgress ?? 0;
    const avgActual = u.averageActualProgress ?? 0;
    return {
      unit: u.unitId ? u.unitName : (language === 'fa' ? 'تعیین نشده' : 'Unassigned'),
      projectsCount: u.projectCount,
      completedCount: u.completedProjects,
      inProgressCount: u.runningProjects,
      delayedCount: u.delayedProjects,
      avgPlanned,
      avgActual,
      avgPerformance: u.averagePerformance ?? 0,
      variance: u.averageDeviation ?? avgActual - avgPlanned,
      rating: ratingOf(u.rating),
      projects: projectsByIds(u.projectIds),
    };
  }).sort((a, b) => b.avgPerformance - a.avgPerformance), [reports.units, enrichedProjects, language]);

  const orgStats = useMemo(() => {
    const summary = reports.units?.summary;
    if (!summary || summary.projectCount === 0) return { avgPerformance: 0, topUnit: 'N/A', inProgress: 0, delayed: 0 };
    return {
      avgPerformance: summary.averagePerformance ?? 0,
      topUnit: unitPerformanceData[0]?.projectsCount > 0 ? unitPerformanceData[0].unit : 'N/A',
      inProgress: summary.runningProjects,
      delayed: summary.delayedProjects,
    };
  }, [reports.units, unitPerformanceData]);

  // --- 3. PROJECT MANAGERS ---
  const managerPerformanceData = useMemo(() => reports.managers
    .filter(m => m.managerUserId !== null)
    .map((m) => {
      const avgPlanned = m.averagePlannedProgress ?? 0;
      const avgActual = m.averageActualProgress ?? 0;
      return {
        managerId: m.managerUserId as string,
        managerName: getManagerName(m.managerUserId),
        projectsCount: m.projectCount,
        completedCount: m.completedProjects,
        inProgressCount: m.runningProjects,
        delayedCount: m.delayedProjects,
        avgPlanned,
        avgActual,
        avgPerformance: m.averagePerformance ?? 0,
        variance: avgActual - avgPlanned,
        rating: ratingOf(m.rating),
        projects: projectsByIds(m.projectIds),
      };
    }).sort((a, b) => b.avgPerformance - a.avgPerformance), [reports.managers, enrichedProjects, users, language]);

  const selectedManagerProjects = useMemo(
    () => managerPerformanceData.find(m => m.managerId === selectedManagerId)?.projects ?? [],
    [selectedManagerId, managerPerformanceData]);

  // --- 4. UNIT / STATUS MATRIX ---
  const UI_STATUS_OF: Record<string, WorkStatus> = { Draft: 'Planning', Active: 'In Progress', OnHold: 'On Hold', Completed: 'Completed' };
  const matrixData = useMemo(() => {
    const matrix = reports.matrix;
    const columns = (matrix?.statuses ?? []).map((name, index) => ({ index, status: UI_STATUS_OF[name] })).filter(c => c.status !== undefined);
    const statuses = columns.map(c => c.status);
    const grid: Record<string, Record<WorkStatus, number>> = {};
    const unitTotals: Record<string, number> = {};
    const cellProjects: Record<string, string[]> = {};
    const statusTotals = { 'Planning': 0, 'In Progress': 0, 'On Hold': 0, 'Completed': 0 } as Record<WorkStatus, number>;
    let grandTotal = 0;
    const distinctUnits: string[] = [];
    for (const row of matrix?.rows ?? []) {
      const unit = row.unitId ? row.unitName : (language === 'fa' ? 'تعیین نشده' : 'Unassigned');
      distinctUnits.push(unit);
      grid[unit] = { 'Planning': 0, 'In Progress': 0, 'On Hold': 0, 'Completed': 0 };
      unitTotals[unit] = 0;
      for (const column of columns) {
        const count = row.counts[column.index] ?? 0;
        grid[unit][column.status] = count;
        unitTotals[unit] += count;
        statusTotals[column.status] += count;
        grandTotal += count;
        cellProjects[`${unit}|${column.status}`] = row.projectIdsByStatus?.[column.index] ?? [];
      }
    }
    return { grid, unitTotals, statusTotals, grandTotal, statuses, distinctUnits, cellProjects };
  }, [reports.matrix, language]);

  // List of projects corresponding to the selected cell in the Matrix
  const matrixSelectedProjects = useMemo(() => {
    const { unit, status } = selectedCell;
    if (!unit && !status) return [];
    const ids = new Set<string>();
    for (const [key, list] of (Object.entries(matrixData.cellProjects) as [string, string[]][])) {
      const [cellUnit, cellStatus] = key.split('|');
      if ((!unit || cellUnit === unit) && (!status || cellStatus === status)) list.forEach(id => ids.add(id));
    }
    return enrichedProjects.filter(p => ids.has(p.id));
  }, [selectedCell, matrixData, enrichedProjects]);


  // Helper for localization numbers
  const displayNum = (num: number) => {
    return language === 'fa' ? toPersianDigits(num) : num.toString();
  };

  const displayPercent = (num: number) => {
    const fixed = num.toFixed(1);
    return language === 'fa' ? `%${toPersianDigits(fixed)}` : `${fixed}%`;
  };

  return (
    <div className="content-container reports-hub-container" style={{ paddingBottom: '3rem' }}>
      {/* PAGE HEADER */}
      <div className="page-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: 'var(--primary-color, #2563eb)' }}>analytics</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>
              {language === 'fa' ? 'داشبوردها و گزارشات ارزیابی عملکرد' : 'Dashboards & Performance Reports'}
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
              {language === 'fa' 
                ? 'تحلیل جامع عملکرد واحدها، ارزیابی خروجی مدیران پروژه و ماتریس توزیع وضعیت پروژه‌ها' 
                : 'Comprehensive analysis of department performance, project managers evaluation, and project distribution matrix'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            const reportName = activeTab === 'units' 
              ? (language === 'fa' ? 'گزارش_ارزیابی_عملکرد_واحدها' : 'Owning_Units_Performance_Report')
              : activeTab === 'managers'
              ? (language === 'fa' ? 'گزارش_ارزیابی_مدیران_پروژه' : 'Project_Managers_Evaluation_Report')
              : (language === 'fa' ? 'گزارش_ماتریس_واحد_وضعیت' : 'Unit_Status_Matrix_Report');
            exportDashboardToLandscapePdf(reportName);
          }}
          className="action-button secondary no-print"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.5rem',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#ef4444',
            border: 'none',
            color: '#fff'
          }}
          title={language === 'fa' ? 'خروجی PDF این گزارش' : 'Export Current Report to PDF'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#fff' }}>picture_as_pdf</span>
        </button>
      </div>

      {reportError && (
        <div id="reports-error" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.85rem' }}>{reportError}</div>
      )}
      {reportsLoading && !reportError && (
        <div style={{ padding: '0.5rem 0', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>...</div>
      )}

      {/* TABS SELECTOR */}
      <div className="reports-tab-bar" style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
        marginBottom: '2rem',
        gap: '0.5rem',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        <button
          onClick={() => { setActiveTab('units'); setSelectedCell({ unit: null, status: null }); setSelectedManagerId(null); }}
          className={`tab-btn ${activeTab === 'units' ? 'active' : ''}`}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            background: activeTab === 'units' ? 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-dark, var(--primary-color)) 100%)' : 'none',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            borderBottom: activeTab === 'units' ? '3px solid var(--primary-color-dark, rgba(0,0,0,0.2))' : '3px solid transparent',
            color: activeTab === 'units' ? '#ffffff' : 'var(--text-muted, #64748b)',
            boxShadow: activeTab === 'units' ? '0 4px 12px var(--shadow-color, rgba(0, 95, 115, 0.2))' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>corporate_fare</span>
            {language === 'fa' ? 'ارزیابی عملکرد واحدها' : 'Owning Units Performance'}
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('managers'); setSelectedCell({ unit: null, status: null }); setSelectedManagerId(null); }}
          className={`tab-btn ${activeTab === 'managers' ? 'active' : ''}`}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            background: activeTab === 'managers' ? 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-dark, var(--primary-color)) 100%)' : 'none',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            borderBottom: activeTab === 'managers' ? '3px solid var(--primary-color-dark, rgba(0,0,0,0.2))' : '3px solid transparent',
            color: activeTab === 'managers' ? '#ffffff' : 'var(--text-muted, #64748b)',
            boxShadow: activeTab === 'managers' ? '0 4px 12px var(--shadow-color, rgba(0, 95, 115, 0.2))' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>supervisor_account</span>
            {language === 'fa' ? 'ارزیابی عملکرد مدیران پروژه' : 'Project Managers Evaluation'}
          </div>
        </button>

        <button
          onClick={() => { setActiveTab('matrix'); setSelectedCell({ unit: null, status: null }); setSelectedManagerId(null); }}
          className={`tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            background: activeTab === 'matrix' ? 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-dark, var(--primary-color)) 100%)' : 'none',
            borderRadius: '10px 10px 0 0',
            border: 'none',
            borderBottom: activeTab === 'matrix' ? '3px solid var(--primary-color-dark, rgba(0,0,0,0.2))' : '3px solid transparent',
            color: activeTab === 'matrix' ? '#ffffff' : 'var(--text-muted, #64748b)',
            boxShadow: activeTab === 'matrix' ? '0 4px 12px var(--shadow-color, rgba(0, 95, 115, 0.2))' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>grid_on</span>
            {language === 'fa' ? 'ماتریس واحد / وضعیت' : 'Unit / Status Matrix'}
          </div>
        </button>
      </div>

      {/* CONTENT SECTIONS */}
      <AnimatePresence mode="wait">
        {activeTab === 'units' && (
          <motion.div
            key="units"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {/* KPI OVERVIEW CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {/* Avg Performance */}
              <div className="card shadow-sm" style={{ padding: '1.25rem', background: 'var(--card-bg-color, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                    {language === 'fa' ? 'میانگین عملکرد کل سازمان' : 'Org-Wide Performance'}
                  </span>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary-color, #2563eb)' }}>equalizer</span>
                </div>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #1e293b)' }}>
                  {displayPercent(orgStats.avgPerformance)}
                </h3>
                <div style={{ width: '100%', backgroundColor: 'var(--placeholder-bg, #f1f5f9)', height: '6px', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, orgStats.avgPerformance)}%`, height: '100%', backgroundColor: 'var(--primary-color, #2563eb)' }} />
                </div>
              </div>

              {/* Best Unit */}
              <div className="card shadow-sm" style={{ padding: '1.25rem', background: 'var(--card-bg-color, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                    {language === 'fa' ? 'واحد سازمانی برتر' : 'Top Performing Unit'}
                  </span>
                  <span className="material-symbols-outlined" style={{ color: '#eab308' }}>workspace_premium</span>
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #1e293b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {orgStats.topUnit}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                  {language === 'fa' ? 'بیشترین میانگین درصد عملکرد تحقق‌یافته' : 'Highest average completed performance'}
                </p>
              </div>

              {/* Active Projects */}
              <div className="card shadow-sm" style={{ padding: '1.25rem', background: 'var(--card-bg-color, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                    {language === 'fa' ? 'پروژه‌های فعال در حال اجرا' : 'Active Projects'}
                  </span>
                  <span className="material-symbols-outlined" style={{ color: 'var(--success-color, #22c55e)' }}>autorenew</span>
                </div>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #1e293b)' }}>
                  {displayNum(orgStats.inProgress)}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                  {language === 'fa' ? 'پروژه‌های تایید شده با وضعیت در جریان' : 'Approved projects currently in progress'}
                </p>
              </div>

              {/* Delayed Projects */}
              <div className="card shadow-sm" style={{ padding: '1.25rem', background: 'var(--card-bg-color, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                    {language === 'fa' ? 'پروژه‌های دارای تاخیر' : 'Delayed Projects'}
                  </span>
                  <span className="material-symbols-outlined" style={{ color: 'var(--warning-color, #ef4444)' }}>error_outline</span>
                </div>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: orgStats.delayed > 0 ? 'var(--warning-color, #ef4444)' : 'var(--text-primary, #1e293b)' }}>
                  {displayNum(orgStats.delayed)}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                  {language === 'fa' ? 'پیشرفت واقعی عقب‌تر از برنامه زمان‌بندی' : 'Actual progress behind plan by >5%'}
                </p>
              </div>
            </div>

            {/* PERFORMANCE ANALYSIS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem' }}>
              {/* TABLE */}
              <div className="card shadow-sm" style={{ background: 'var(--card-bg-color, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '1.5rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
                      {language === 'fa' ? 'گزارش ارزیابی عملکرد واحدهای سازمانی' : 'Organizational Units Performance Evaluation'}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--primary-color, #2563eb)', background: 'var(--secondary-color, #eff6ff)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 600 }}>
                      {language === 'fa' ? 'تجمیع براساس واحدهای سازمانی' : 'Aggregated by Owning Units'}
                    </span>
                  </div>
                  <button
                    onClick={() => exportDashboardToLandscapePdf(language === 'fa' ? 'گزارش_ارزیابی_عملکرد_واحدها' : 'Owning_Units_Performance_Report')}
                    className="action-button secondary no-print"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.4rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: '#ef4444',
                      border: 'none',
                      color: '#fff'
                    }}
                    title={language === 'fa' ? 'خروجی PDF گزارش عملکرد واحدها' : 'Export Units Report to PDF'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.15rem', color: '#fff' }}>picture_as_pdf</span>
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="pms-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: language === 'fa' ? 'right' : 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)' }}>
                        <th style={{ padding: '1rem' }}>{language === 'fa' ? 'نام واحد سازمانی' : 'Unit Name'}</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>{language === 'fa' ? 'تعداد پروژه' : 'Projects Count'}</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>{language === 'fa' ? 'میانگین پیشرفت برنامه‌ای' : 'Avg Planned'}</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>{language === 'fa' ? 'میانگین پیشرفت واقعی' : 'Avg Actual'}</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>{language === 'fa' ? 'انحراف' : 'Variance'}</th>
                        <th style={{ padding: '1rem', width: '200px' }}>{language === 'fa' ? 'شاخص عملکرد' : 'Performance Index'}</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>{language === 'fa' ? 'رده عملکرد' : 'Rating'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitPerformanceData.map((item, index) => {
                        const isNeg = item.variance < -0.1;
                        const isPos = item.variance > 0.1;
                        const ratingClass = item.rating === 'Excellent' ? 'excellent' : (item.rating === 'Good' ? 'good' : 'needs-support');
                        const ratingText = item.rating === 'Excellent' 
                          ? (language === 'fa' ? 'عالی' : 'Excellent') 
                          : (item.rating === 'Good' ? (language === 'fa' ? 'قابل قبول' : 'Good') : (language === 'fa' ? 'نیازمند بهبود' : 'Needs Support'));

                        return (
                          <tr key={index} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', transition: 'background-color 0.15s' }} className="hover:bg-slate-50">
                            <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>{item.unit}</td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>{displayNum(item.projectsCount)}</td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>{displayPercent(item.avgPlanned)}</td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>{displayPercent(item.avgActual)}</td>
                            <td style={{ 
                              padding: '1rem', 
                              textAlign: 'center', 
                              direction: 'ltr',
                              color: isNeg ? 'var(--warning-color, #ef4444)' : (isPos ? 'var(--success-color, #22c55e)' : 'var(--text-muted, #64748b)'),
                              fontWeight: 600 
                            }}>
                              {item.variance === 0 ? displayPercent(0) : (isPos ? '+' : '') + displayPercent(item.variance)}
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ flex: 1, backgroundColor: 'var(--border-color, #f1f5f9)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ 
                                    width: `${Math.min(100, item.avgPerformance)}%`, 
                                    height: '100%', 
                                    backgroundColor: item.avgPerformance >= 90 ? 'var(--success-color, #22c55e)' : (item.avgPerformance >= 70 ? 'var(--warning-color, #eab308)' : 'var(--danger-color, #ef4444)') 
                                  }} />
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, width: '45px', textAlign: 'right' }}>
                                  {displayPercent(item.avgPerformance)}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              <span className={`rating-badge ${ratingClass}`}>
                                {ratingText}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {unitPerformanceData.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                            {language === 'fa' ? 'هیچ پروژه فعالی برای ارزیابی واحدها وجود ندارد.' : 'No approved projects available for unit evaluation.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VISUAL CHART */}
              {unitPerformanceData.length > 0 && (
                <div className="card shadow-sm" style={{ background: 'var(--card-bg-color, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
                    {language === 'fa' ? 'نمودار مقایسه‌ای شاخص عملکرد واحدها' : 'Comparison of Department Performance Scores'}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
                    {unitPerformanceData.map((item, idx) => {
                      const barGradient = VIBRANT_BAR_GRADIENTS[idx % VIBRANT_BAR_GRADIENTS.length];
                      return (
                        <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '160px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary, #1e293b)' }}>{item.unit}</div>
                          <div style={{ flex: 1, minWidth: '200px', background: 'var(--placeholder-bg, #f1f5f9)', height: '26px', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ 
                              width: `${Math.min(100, item.avgPerformance)}%`, 
                              height: '100%', 
                              background: barGradient,
                              borderRadius: '6px',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.12)',
                              transition: 'width 1s ease-out'
                            }} />
                            <span style={{ 
                              position: 'absolute', 
                              left: language === 'fa' ? '10px' : 'auto', 
                              right: language === 'fa' ? 'auto' : '10px', 
                              top: '50%', 
                              transform: 'translateY(-50%)', 
                              fontSize: '0.8rem', 
                              fontWeight: 700, 
                              color: item.avgPerformance > 35 ? '#ffffff' : 'var(--text-primary, #1e293b)',
                              textShadow: item.avgPerformance > 35 ? '0 1px 2px rgba(0,0,0,0.4)' : 'none'
                            }}>
                              {displayPercent(item.avgPerformance)}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', width: '90px', textAlign: 'center', fontWeight: 600 }}>
                            {displayNum(item.projectsCount)} {language === 'fa' ? 'پروژه' : 'projects'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'managers' && (
          <motion.div
            key="managers"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {/* MANAGER LEADERBOARD PODIUM */}
            {managerPerformanceData.length >= 1 && (
              <div className="card shadow-sm" style={{ background: 'var(--card-bg-color, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)', textAlign: 'center' }}>
                  {language === 'fa' ? 'برترین مدیران پروژه بر اساس شاخص تحقق اهداف زمانی' : 'Top Project Managers by Schedule Performance Index'}
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '2rem', height: '200px', paddingBottom: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                  {/* SECOND PLACE */}
                  {managerPerformanceData[1] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--podium-silver-border, #cbd5e1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--podium-silver-text, #1e293b)', fontSize: '1.25rem', border: '3px solid var(--podium-silver-bg, #e2e8f0)' }}>
                          🥈
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '0.5rem', color: 'var(--text-primary, #1e293b)' }}>{managerPerformanceData[1].managerName}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--primary-color, #2563eb)', fontWeight: 700 }}>{displayPercent(managerPerformanceData[1].avgPerformance)}</span>
                      <div style={{ width: '100px', height: '70px', backgroundColor: 'var(--podium-silver-bg, #e2e8f0)', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0.5rem', border: '1px solid var(--podium-silver-border, #cbd5e1)', boxShadow: '0 -2px 10px rgba(0,0,0,0.03)' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--podium-silver-text, #64748b)' }}>۲</span>
                      </div>
                    </div>
                  )}

                  {/* FIRST PLACE */}
                  {managerPerformanceData[0] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: '68px', height: '68px', borderRadius: '50%', backgroundColor: 'var(--podium-gold-border, #fef08a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--podium-gold-text, #854d0e)', fontSize: '1.5rem', border: '3px solid var(--podium-gold-bg, #fde047)', boxShadow: '0 4px 10px rgba(234, 179, 8, 0.2)' }}>
                          🥇
                        </div>
                        <span className="material-symbols-outlined" style={{ position: 'absolute', top: '-18px', left: '22px', color: '#eab308', fontSize: '1.5rem' }}>workspace_premium</span>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '1rem', marginTop: '0.5rem', color: 'var(--text-primary, #1e293b)' }}>{managerPerformanceData[0].managerName}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--primary-color, #2563eb)', fontWeight: 800 }}>{displayPercent(managerPerformanceData[0].avgPerformance)}</span>
                      <div style={{ width: '110px', height: '100px', backgroundColor: 'var(--podium-gold-bg, #fef9c3)', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0.5rem', border: '1px solid var(--podium-gold-border, #fde047)', boxShadow: '0 -4px 15px rgba(234, 179, 8, 0.08)' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--podium-gold-text, #854d0e)' }}>۱</span>
                      </div>
                    </div>
                  )}

                  {/* THIRD PLACE */}
                  {managerPerformanceData[2] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--podium-bronze-border, #fed7aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--podium-bronze-text, #7c2d12)', fontSize: '1.1rem', border: '3px solid var(--podium-bronze-bg, #ffedd5)' }}>
                          🥉
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '0.5rem', color: 'var(--text-primary, #1e293b)' }}>{managerPerformanceData[2].managerName}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--primary-color, #2563eb)', fontWeight: 700 }}>{displayPercent(managerPerformanceData[2].avgPerformance)}</span>
                      <div style={{ width: '100px', height: '50px', backgroundColor: 'var(--podium-bronze-bg, #ffedd5)', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0.5rem', border: '1px solid var(--podium-bronze-border, #fed7aa)', boxShadow: '0 -2px 10px rgba(0,0,0,0.03)' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--podium-bronze-text, #9a3412)' }}>۳</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MAIN PERFORMANCE LIST / TABLE */}
            <div className="card shadow-sm" style={{ background: 'var(--card-bg-color, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
                  {language === 'fa' ? 'گزارش تفصیلی عملکرد مدیران پروژه' : 'Detailed Project Managers Performance Table'}
                </h3>
                <button
                  onClick={() => exportDashboardToLandscapePdf(language === 'fa' ? 'گزارش_ارزیابی_مدیران_پروژه' : 'Project_Managers_Evaluation_Report')}
                  className="action-button secondary no-print"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.4rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: '#ef4444',
                    border: 'none',
                    color: '#fff'
                  }}
                  title={language === 'fa' ? 'خروجی PDF ارزیابی مدیران پروژه' : 'Export Managers Report to PDF'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.15rem', color: '#fff' }}>picture_as_pdf</span>
                </button>
              </div>
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
                {language === 'fa' ? 'جهت مشاهده جزئیات پروژه‌های تحت مدیریت هر مدیر، بر روی نام وی کلیک کنید.' : 'Click on any manager to inspect all their managed projects.'}
              </p>
              
              <div style={{ overflowX: 'auto' }}>
                <table className="pms-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: language === 'fa' ? 'right' : 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)' }}>
                      <th style={{ padding: '1rem' }}>{language === 'fa' ? 'مدیر پروژه' : 'Project Manager'}</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>{language === 'fa' ? 'تعداد پروژه‌ها' : 'Total Projects'}</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>{language === 'fa' ? 'پروژه‌های تکمیل‌شده' : 'Completed'}</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>{language === 'fa' ? 'پروژه‌های دارای تاخیر' : 'Delayed'}</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>{language === 'fa' ? 'میانگین پیشرفت واقعی' : 'Avg Actual Progress'}</th>
                      <th style={{ padding: '1rem', width: '220px' }}>{language === 'fa' ? 'میانگین عملکرد' : 'Avg Performance'}</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>{language === 'fa' ? 'ارزیابی وضعیت' : 'Status Evaluation'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerPerformanceData.map((item, idx) => {
                      const isSelected = selectedManagerId === item.managerId;
                      const ratingClass = item.rating === 'Excellent' ? 'excellent' : (item.rating === 'Good' ? 'good' : 'needs-support');
                      const ratingText = item.rating === 'Excellent' 
                        ? (language === 'fa' ? 'عالی' : 'Excellent') 
                        : (item.rating === 'Good' ? (language === 'fa' ? 'قابل قبول' : 'Good') : (language === 'fa' ? 'نیازمند بهبود' : 'Needs Support'));

                      return (
                        <tr 
                          key={idx} 
                          onClick={() => setSelectedManagerId(isSelected ? null : item.managerId)}
                          style={{ 
                            borderBottom: '1px solid var(--border-color, #e2e8f0)', 
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'var(--secondary-bg, #f8fafc)' : 'transparent',
                            fontWeight: isSelected ? 600 : 'normal',
                            transition: 'all 0.2s'
                          }} 
                          className="hover:bg-slate-50"
                        >
                          <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: isSelected ? 'var(--primary-color, #2563eb)' : '#94a3b8' }}>
                              {isSelected ? 'expand_circle_down' : 'chevron_right'}
                            </span>
                            <span style={{ color: 'var(--text-primary, #1e293b)', fontWeight: 600 }}>{item.managerName}</span>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>{displayNum(item.projectsCount)}</td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--success-color, #22c55e)' }}>{displayNum(item.completedCount)}</td>
                          <td style={{ padding: '1rem', textAlign: 'center', color: item.delayedCount > 0 ? 'var(--warning-color, #ef4444)' : 'inherit' }}>{displayNum(item.delayedCount)}</td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>{displayPercent(item.avgActual)}</td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, backgroundColor: 'var(--border-color, #f1f5f9)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ 
                                  width: `${Math.min(100, item.avgPerformance)}%`, 
                                  height: '100%', 
                                  backgroundColor: item.avgPerformance >= 90 ? 'var(--success-color, #22c55e)' : (item.avgPerformance >= 70 ? 'var(--warning-color, #eab308)' : 'var(--danger-color, #ef4444)') 
                                }} />
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                {displayPercent(item.avgPerformance)}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <span className={`rating-badge ${ratingClass}`}>
                              {ratingText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {managerPerformanceData.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                          {language === 'fa' ? 'هیچ پروژه فعالی با مدیر پروژه تعریف شده وجود ندارد.' : 'No active projects with defined project managers.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MANAGER'S MANAGED PROJECTS DRAWER / SUB-TABLE */}
            <AnimatePresence>
              {selectedManagerId !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden', marginBottom: '2rem' }}
                >
                  <div style={{ background: 'var(--body-bg-color, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
                        {language === 'fa' 
                          ? `لیست پروژه‌های تحت مدیریت: ${getManagerName(selectedManagerId)}` 
                          : `Projects Supervised by: ${getManagerName(selectedManagerId)}`}
                      </h4>
                      <button 
                        onClick={() => setSelectedManagerId(null)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted, #64748b)' }}
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: language === 'fa' ? 'right' : 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid var(--border-color, #cbd5e1)', color: 'var(--text-muted, #475569)', fontSize: '0.85rem', fontWeight: 600 }}>
                            <th style={{ padding: '0.75rem' }}>{language === 'fa' ? 'نام پروژه' : 'Project Name'}</th>
                            <th style={{ padding: '0.75rem' }}>{language === 'fa' ? 'واحد مالک' : 'Owning Unit'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'نوع پروژه' : 'Project Type'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'پیشرفت برنامه‌ای' : 'Planned Progress'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'پیشرفت واقعی' : 'Actual Progress'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'درصد انحراف' : 'Delay %'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'وضعیت پروژه' : 'Project Status'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'داشبورد' : 'Dashboard'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedManagerProjects.map((p, idx) => {
                            const delayVal = p.actualProgress - p.plannedProgress;
                            const hasDelay = delayVal < -5;

                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                                <td style={{ padding: '0.75rem', fontWeight: 600, color: '#1e293b' }}>{p.name}</td>
                                <td style={{ padding: '0.75rem', color: '#475569' }}>{p.owningUnit}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  {p.type === 'waterfall' ? (language === 'fa' ? 'آبشاری' : 'Waterfall') : (language === 'fa' ? 'چابک' : 'Agile')}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{displayPercent(p.plannedProgress)}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{displayPercent(p.actualProgress)}</td>
                                <td style={{ 
                                  padding: '0.75rem', 
                                  textAlign: 'center', 
                                  direction: 'ltr',
                                  color: hasDelay ? '#ef4444' : (delayVal > 0 ? '#22c55e' : '#475569'),
                                  fontWeight: 600 
                                }}>
                                  {delayVal === 0 ? displayPercent(0) : (delayVal > 0 ? '+' : '') + displayPercent(delayVal)}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <span className={`project-status-badge status-${p.status.toLowerCase().replace(/ /g, '-')}`} style={{ fontSize: '0.8rem' }}>
                                    {getStatusText(p.status)}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <button
                                    onClick={() => onNavigate('project_dashboard_details', { project: p, from: 'reports_dashboard' })}
                                    className="action-button"
                                    style={{ padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', cursor: 'pointer' }}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>bar_chart</span>
                                    {language === 'fa' ? 'مشاهده' : 'View'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === 'matrix' && (
          <motion.div
            key="matrix"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {/* INSTRUCTIONS */}
            <div className="navigation-hint-banner" style={{ marginBottom: '1.5rem' }}>
              <span className="material-symbols-outlined hint-icon">info</span>
              <span>
                {language === 'fa' 
                  ? 'راهنما: بر روی هر یک از اعداد ماتریس (تلاقی سطر و ستون یا جمع کل) کلیک کنید تا لیست کامل پروژه‌های متناظر با آن در جدول پایین نمایش داده شود.' 
                  : 'Guide: Click on any number inside the matrix (including row and column totals) to display the corresponding projects list below.'}
              </span>
            </div>

            {/* THE MATRIX TABLE CONTAINER */}
            <div className="card shadow-sm" style={{ background: 'var(--card-bg-color, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
                    {language === 'fa' ? 'ماتریس توزیع پروژه‌ها: واحد سازمانی / وضعیت' : 'Project Distribution Matrix: Owning Unit vs. Status'}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary-color, #2563eb)', background: 'var(--secondary-color, #eff6ff)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 600 }}>
                    {language === 'fa' ? 'محاسبه براساس واحد سازمانی' : 'Aggregated by Owning Unit'}
                  </span>
                </div>
                <button
                  onClick={() => exportDashboardToLandscapePdf(language === 'fa' ? 'گزارش_ماتریس_واحد_وضعیت' : 'Unit_Status_Matrix_Report')}
                  className="action-button secondary no-print"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.4rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: '#ef4444',
                    border: 'none',
                    color: '#fff'
                  }}
                  title={language === 'fa' ? 'خروجی PDF ماتریس واحد/وضعیت' : 'Export Matrix Report to PDF'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.15rem', color: '#fff' }}>picture_as_pdf</span>
                </button>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table className="pms-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)' }}>
                      <th style={{ padding: '1rem', textAlign: language === 'fa' ? 'right' : 'left' }}>
                        {language === 'fa' ? 'واحد سازمانی / وضعیت' : 'Owning Unit / Status'}
                      </th>
                      {matrixData.statuses.map((status) => (
                        <th key={status} style={{ padding: '1rem' }}>
                          {getStatusText(status)}
                        </th>
                      ))}
                      <th style={{ padding: '1rem', backgroundColor: 'var(--placeholder-bg, #f8fafc)', fontWeight: 800 }}>
                        {language === 'fa' ? 'جمع کل واحد' : 'Unit Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.distinctUnits.map((unit) => {
                      const rowTotal = matrixData.unitTotals[unit] || 0;
                      return (
                        <tr key={unit} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }} className="hover:bg-slate-50">
                          <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary, #1e293b)', textAlign: language === 'fa' ? 'right' : 'left' }}>
                            {unit}
                          </td>
                          {matrixData.statuses.map((status) => {
                            const count = matrixData.grid[unit] ? matrixData.grid[unit][status] || 0 : 0;
                            const isCellSelected = selectedCell.unit === unit && selectedCell.status === status;
                            
                            return (
                              <td 
                                key={status} 
                                onClick={() => setSelectedCell({ unit, status })}
                                style={{ 
                                  padding: '1rem',
                                  cursor: 'pointer',
                                  backgroundColor: isCellSelected 
                                    ? 'var(--secondary-color, #dbeafe)' 
                                    : (count > 0 ? 'var(--status-in-progress-bg, #f0fdf4)' : 'transparent'),
                                  color: isCellSelected 
                                    ? 'var(--primary-color, #1e40af)' 
                                    : (count > 0 ? 'var(--status-in-progress-text, #166534)' : 'var(--text-muted, #64748b)'),
                                  fontWeight: count > 0 || isCellSelected ? 700 : 'normal',
                                  transition: 'all 0.15s'
                                }}
                                className={count > 0 ? "hover:scale-105 active:scale-95" : ""}
                              >
                                {displayNum(count)}
                              </td>
                            );
                          })}
                          <td 
                            onClick={() => setSelectedCell({ unit, status: null })}
                            style={{ 
                              padding: '1rem', 
                              backgroundColor: selectedCell.unit === unit && selectedCell.status === null ? 'var(--secondary-color, #dbeafe)' : 'var(--placeholder-bg, #f8fafc)', 
                              color: selectedCell.unit === unit && selectedCell.status === null ? 'var(--primary-color, #1e40af)' : 'var(--text-color, #1e293b)',
                              fontWeight: 800,
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            {displayNum(rowTotal)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* COLUMNS TOTAL ROW */}
                    <tr style={{ backgroundColor: 'var(--placeholder-bg, #f8fafc)', fontWeight: 800 }}>
                      <td style={{ padding: '1rem', textAlign: language === 'fa' ? 'right' : 'left' }}>
                        {language === 'fa' ? 'جمع کل وضعیت' : 'Status Total'}
                      </td>
                      {matrixData.statuses.map((status) => {
                        const colTotal = matrixData.statusTotals[status] || 0;
                        const isColSelected = selectedCell.unit === null && selectedCell.status === status;

                        return (
                          <td 
                            key={status}
                            onClick={() => setSelectedCell({ unit: null, status })}
                            style={{ 
                              padding: '1rem', 
                              cursor: 'pointer',
                              backgroundColor: isColSelected ? 'var(--secondary-color, #dbeafe)' : 'transparent',
                              color: isColSelected ? 'var(--primary-color, #1e40af)' : 'inherit',
                              transition: 'all 0.15s'
                            }}
                          >
                            {displayNum(colTotal)}
                          </td>
                        );
                      })}
                      <td 
                        onClick={() => setSelectedCell({ unit: null, status: null })}
                        style={{ 
                          padding: '1rem', 
                          backgroundColor: selectedCell.unit === null && selectedCell.status === null ? 'var(--secondary-color, #bfdbfe)' : 'var(--placeholder-bg, #f1f5f9)', 
                          color: selectedCell.unit === null && selectedCell.status === null ? 'var(--primary-color, #1e40af)' : 'var(--text-color, #0f172a)',
                          fontWeight: 900,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {displayNum(matrixData.grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* MATRIX DETAILS AREA (SHOW PROJECTS) */}
            <AnimatePresence mode="wait">
              {/* If a cell or total is clicked, render details here */}
              {(selectedCell.unit !== null || selectedCell.status !== null || (selectedCell.unit === null && selectedCell.status === null)) && (
                <motion.div
                  key={`${selectedCell.unit}-${selectedCell.status}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="card shadow-sm" style={{ background: 'var(--card-bg-color, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary-color, #2563eb)' }}>format_list_bulleted</span>
                        {language === 'fa' ? 'لیست پروژه‌های فیلتر شده بر اساس ماتریس انتخاب شده' : 'Filtered Projects List from Selection'}
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted, #64748b)', background: 'var(--placeholder-bg, #f1f5f9)', padding: '0.1rem 0.6rem', borderRadius: '4px', margin: `0 ${language === 'fa' ? '0.75rem' : '0'} 0 ${language === 'fa' ? '0' : '0.75rem'}` }}>
                          {selectedCell.unit ? selectedCell.unit : (language === 'fa' ? 'همه واحدها' : 'All Units')}
                          {' / '}
                          {selectedCell.status ? getStatusText(selectedCell.status) : (language === 'fa' ? 'همه وضعیت‌ها' : 'All Statuses')}
                        </span>
                      </h4>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
                        {displayNum(matrixSelectedProjects.length)} {language === 'fa' ? 'پروژه یافت شد' : 'projects found'}
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table className="pms-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: language === 'fa' ? 'right' : 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid var(--border-color, #cbd5e1)', color: 'var(--text-muted, #64748b)' }}>
                            <th style={{ padding: '0.75rem' }}>{language === 'fa' ? 'نام پروژه' : 'Project Name'}</th>
                            <th style={{ padding: '0.75rem' }}>{language === 'fa' ? 'واحد سازمانی' : 'Owning Unit'}</th>
                            <th style={{ padding: '0.75rem' }}>{language === 'fa' ? 'مدیر پروژه' : 'Project Manager'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'نوع پروژه' : 'Type'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'پیشرفت برنامه‌ای' : 'Planned Progress'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'پیشرفت واقعی' : 'Actual Progress'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'انحراف' : 'Delay %'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'وضعیت' : 'Status'}</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>{language === 'fa' ? 'عملیات' : 'Actions'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matrixSelectedProjects.map((p, idx) => {
                            const delayVal = p.actualProgress - p.plannedProgress;
                            const hasDelay = delayVal < -5;

                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', transition: 'background-color 0.1s' }} className="hover:bg-slate-50">
                                <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>{p.name}</td>
                                <td style={{ padding: '0.75rem' }} title={p.owningUnit}>{getUnitLevel2(p.owningUnit) || p.owningUnit}</td>
                                <td style={{ padding: '0.75rem' }}>{getManagerName(p.projectManagerId)}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  {p.type === 'waterfall' ? (language === 'fa' ? 'آبشاری' : 'Waterfall') : (language === 'fa' ? 'چابک' : 'Agile')}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{displayPercent(p.plannedProgress)}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{displayPercent(p.actualProgress)}</td>
                                <td style={{ 
                                  padding: '0.75rem', 
                                  textAlign: 'center', 
                                  direction: 'ltr',
                                  color: hasDelay ? 'var(--warning-color, #ef4444)' : (delayVal > 0 ? 'var(--success-color, #22c55e)' : 'inherit'),
                                  fontWeight: 600 
                                }}>
                                  {delayVal === 0 ? displayPercent(0) : (delayVal > 0 ? '+' : '') + displayPercent(delayVal)}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <span className={`project-status-badge status-${p.status.toLowerCase().replace(/ /g, '-')}`}>
                                    {getStatusText(p.status)}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <button
                                    onClick={() => onNavigate('project_dashboard_details', { project: p, from: 'reports_dashboard' })}
                                    className="action-button"
                                    style={{ padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>bar_chart</span>
                                    {language === 'fa' ? 'مشاهده داشبورد' : 'View Dashboard'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {matrixSelectedProjects.length === 0 && (
                            <tr>
                              <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                                {language === 'fa' ? 'هیچ پروژه‌ای مطابق فیلتر ماتریس انتخاب شده یافت نشد.' : 'No projects correspond to the selected matrix coordinates.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
