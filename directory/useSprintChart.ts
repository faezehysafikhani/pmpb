import { useEffect, useState } from 'react';
import { reportsApi } from '../services/backend/reports';
import { toPersianDigits } from '../utils';

/** The project sprint by sprint, as the backend's chart service works it out (tasks per sprint and how many are done, with running totals). */
export function useSprintChartData(projectId: string | undefined, language: string, refreshKey: string) {
    const [rows, setRows] = useState<{ sprintName: string; sprintNum: number; total: number; completed: number; remaining: number; sprintCompleted: number; sprintTotal: number }[]>([]);
    useEffect(() => {
        let cancelled = false;
        if (!projectId) { setRows([]); return; }
        void reportsApi.sprintProgress(projectId).then(result => {
            if (cancelled || !result.ok || !result.value) return;
            setRows(result.value.sprints.map(s => ({
                sprintName: language === 'fa' ? `اسپرینت ${toPersianDigits(s.sprintNumber)}` : `Sprint ${s.sprintNumber}`,
                sprintNum: s.sprintNumber,
                total: s.cumulativeTotal,
                completed: s.cumulativeCompleted,
                remaining: s.cumulativeRemaining,
                sprintCompleted: s.sprintCompleted,
                sprintTotal: s.sprintTotal
            })));
        });
        return () => { cancelled = true; };
    }, [projectId, language, refreshKey]);
    return rows;
}
