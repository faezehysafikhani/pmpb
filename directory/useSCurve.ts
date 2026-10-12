import * as React from 'react';
import type { Project } from '../types';
import { waterfall } from '../services/backend/planning';
import { toSCurvePoints } from '../services/backend/planningMappers';
import { formatDate } from '../utils';
import type { SCurveDataPoint } from '../utils';

/**
 * The project's S-curve as the backend works it out (planned from the schedule, actual from the progress records kept so far). It is read
 * again whenever the plan or the saved copies change.
 */
export function useSCurve(project: Project | undefined, language: string): SCurveDataPoint[] {
  const [points, setPoints] = React.useState<SCurveDataPoint[]>([]);
  const projectId = project?.id;
  const isWaterfall = project?.type === 'waterfall';

  React.useEffect(() => {
    let cancelled = false;
    if (!projectId || !isWaterfall) {
      setPoints([]);
      return;
    }
    waterfall.sCurve(projectId).then(result => {
      if (cancelled) return;
      setPoints(result.ok && result.value ? toSCurvePoints(result.value, date => formatDate(date, language === 'fa' ? 'fa' : 'en')) : []);
    });
    return () => { cancelled = true; };
  }, [projectId, isWaterfall, language, project?.schedule, project?.scheduleSnapshots]);

  return points;
}
