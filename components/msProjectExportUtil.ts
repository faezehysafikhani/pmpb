import { Project, ProjectActivity, Calendar, User } from '../types';
import { toSafeDate } from '../utils';

export interface MsProjectExportOptions {
  includeProgress?: boolean;
  includeCosts?: boolean;
  includeAssignments?: boolean;
  includePredecessors?: boolean;
  customFileName?: string;
}

/**
 * Escapes special XML characters to prevent syntax errors.
 */
export function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats duration in days to ISO 8601 duration string expected by Microsoft Project (PT[H]H0M0S).
 * Assumes standard 8-hour workday.
 */
export function formatMsDuration(days: number | undefined | null): string {
  const d = Math.max(0, days || 0);
  const hours = Math.round(d * 8 * 10) / 10;
  return `PT${hours}H0M0S`;
}

/**
 * Formats work in hours to ISO 8601 work string.
 */
export function formatMsWork(hours: number | undefined | null): string {
  const h = Math.max(0, Math.round(hours || 0));
  return `PT${h}H0M0S`;
}

/**
 * Formats a Date object or date string to YYYY-MM-DDTHH:MM:SS for MS Project.
 */
export function formatMsDate(dateInput: Date | string | undefined | null, defaultTime: string = '08:00:00'): string {
  const safe = toSafeDate(dateInput);
  if (!safe) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}T${defaultTime}`;
  }
  const y = safe.getFullYear();
  const m = String(safe.getMonth() + 1).padStart(2, '0');
  const d = String(safe.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T${defaultTime}`;
}

/**
 * Converts prerequisite link type to Microsoft Project XML Type integer:
 * 0: FF (Finish-to-Finish)
 * 1: FS (Finish-to-Start)
 * 2: SF (Start-to-Finish)
 * 3: SS (Start-to-Start)
 */
export function getMsLinkTypeCode(type?: 'FS' | 'SS' | 'FF' | 'SF'): number {
  switch (type) {
    case 'FF':
      return 0;
    case 'FS':
      return 1;
    case 'SF':
      return 2;
    case 'SS':
      return 3;
    default:
      return 1;
  }
}

interface FlattenedExportTask {
  activity: ProjectActivity;
  uid: number;
  id: number;
  level: number;
  outlineNumber: string;
  wbs: string;
  isSummary: boolean;
}

/**
 * Flattens the hierarchical schedule tree in pre-order (DFS), ensuring parents appear
 * immediately before their children, as strictly required by Microsoft Project.
 */
function flattenTreeInPreOrder(
  nodes: ProjectActivity[],
  startUid: number = 1
): FlattenedExportTask[] {
  const result: FlattenedExportTask[] = [];
  let currentUid = startUid;

  const traverse = (nodeList: ProjectActivity[], parentOutline: string = '', level: number = 1) => {
    nodeList.forEach((node, index) => {
      // Skip artificial root container
      if (node.id === 'project-root') {
        if (node.children && node.children.length > 0) {
          traverse(node.children, '', 1);
        }
        return;
      }

      const uid = currentUid++;
      const outline = parentOutline ? `${parentOutline}.${index + 1}` : `${index + 1}`;
      const hasChildren = Boolean(node.children && node.children.length > 0);

      result.push({
        activity: node,
        uid,
        id: uid,
        level,
        outlineNumber: node.wbsCode || outline,
        wbs: node.wbsCode || outline,
        isSummary: hasChildren || Boolean(node.isParent)
      });

      if (hasChildren && node.children) {
        traverse(node.children, outline, level + 1);
      }
    });
  };

  traverse(nodes);
  return result;
}

/**
 * Generates an MSPDI-compliant XML document representing the project waterfall schedule.
 */
export function generateMsProjectXml(
  project: Project,
  scheduleActivities: ProjectActivity[],
  calendar?: Calendar,
  users?: User[],
  options: MsProjectExportOptions = {}
): string {
  const {
    includeProgress = true,
    includeCosts = true,
    includeAssignments = true,
    includePredecessors = true
  } = options;

  const nowIso = new Date().toISOString();
  const projectName = project.name || 'Project Schedule';

  // Flatten activities in pre-order traversal
  const flattenedTasks = flattenTreeInPreOrder(scheduleActivities);

  // Map activity ID -> task UID for linking predecessors
  const activityIdToUid = new Map<string, number>();
  flattenedTasks.forEach(t => {
    activityIdToUid.set(t.activity.id, t.uid);
  });

  // Calculate project-wide start and finish
  let earliestStart: Date | null = toSafeDate(project.startDate);
  let latestFinish: Date | null = toSafeDate(project.endDate);

  flattenedTasks.forEach(t => {
    const s = toSafeDate(t.activity.startDate);
    const f = toSafeDate(t.activity.endDate);
    if (s && (!earliestStart || s < earliestStart)) earliestStart = s;
    if (f && (!latestFinish || f > latestFinish)) latestFinish = f;
  });

  const projStartIso = formatMsDate(earliestStart || new Date(), '08:00:00');
  const projFinishIso = formatMsDate(latestFinish || earliestStart || new Date(), '17:00:00');

  // Calculate project summary totals
  const totalDurationDays = flattenedTasks.reduce((acc, t) => acc + (t.isSummary ? 0 : (t.activity.duration || 0)), 0);
  const totalWorkHours = flattenedTasks.reduce((acc, t) => {
    if (t.isSummary) return acc;
    return acc + (t.activity.manHour || (t.activity.duration || 0) * 8);
  }, 0);
  const totalCost = flattenedTasks.reduce((acc, t) => acc + (t.isSummary ? 0 : (t.activity.cost || 0)), 0);

  // Compute weighted or average actual progress for root
  let overallProgress = 0;
  const leafTasks = flattenedTasks.filter(t => !t.isSummary);
  if (leafTasks.length > 0) {
    const sumProgress = leafTasks.reduce((acc, t) => acc + (t.activity.actualProgress || 0), 0);
    overallProgress = Math.round(sumProgress / leafTasks.length);
  }

  // Generate WeekDays XML for Project Calendar
  // 0: Sunday, 1: Monday, ..., 6: Saturday
  // In MS Project: 1: Sunday, 2: Monday, ..., 7: Saturday
  let weekDaysXml = '';
  for (let appDay = 0; appDay < 7; appDay++) {
    const msDayType = appDay === 0 ? 1 : appDay + 1;
    const isWorking = calendar && calendar.workingDays ? calendar.workingDays.includes(appDay) : (appDay !== 5); // Default Friday off in Iran or Sat/Sun off
    if (isWorking) {
      weekDaysXml += `
        <WeekDay>
          <DayType>${msDayType}</DayType>
          <DayWorking>1</DayWorking>
          <WorkingTimes>
            <WorkingTime>
              <FromTime>08:00:00</FromTime>
              <ToTime>12:00:00</ToTime>
            </WorkingTime>
            <WorkingTime>
              <FromTime>13:00:00</FromTime>
              <ToTime>17:00:00</ToTime>
            </WorkingTime>
          </WorkingTimes>
        </WeekDay>`;
    } else {
      weekDaysXml += `
        <WeekDay>
          <DayType>${msDayType}</DayType>
          <DayWorking>0</DayWorking>
        </WeekDay>`;
    }
  }

  // Generate Resources and Assignments
  const resourceXmlMap = new Map<string, { resUid: number; user: User }>();
  let resourceCounter = 1;
  if (includeAssignments && users && users.length > 0) {
    flattenedTasks.forEach(t => {
      const assignedId = t.activity.assignedToId;
      if (assignedId && !resourceXmlMap.has(assignedId)) {
        const u = users.find(user => user.id === assignedId);
        if (u) {
          resourceXmlMap.set(assignedId, { resUid: resourceCounter++, user: u });
        }
      }
    });
  }

  let resourcesXml = '';
  if (resourceXmlMap.size > 0) {
    resourcesXml = `
  <Resources>
${Array.from(resourceXmlMap.values()).map(({ resUid, user }) => `    <Resource>
      <UID>${resUid}</UID>
      <ID>${resUid}</ID>
      <Name>${escapeXml(user.name || user.username)}</Name>
      <Type>1</Type>
      <StandardRate>0</StandardRate>
      <OvertimeRate>0</OvertimeRate>
    </Resource>`).join('\n')}
  </Resources>`;
  }

  // Generate Tasks XML
  let assignmentCounter = 1;
  const assignmentsXmlList: string[] = [];

  const tasksXml = flattenedTasks.map(t => {
    const act = t.activity;
    const taskStartIso = formatMsDate(act.startDate || earliestStart || new Date(), '08:00:00');
    const taskFinishIso = formatMsDate(act.endDate || act.startDate || earliestStart || new Date(), '17:00:00');
    const durationIso = formatMsDuration(act.duration);
    const manHours = act.manHour || (act.duration || 0) * 8;
    const workIso = formatMsWork(manHours);
    const progressVal = includeProgress ? Math.min(100, Math.max(0, Math.round(act.actualProgress || 0))) : 0;
    const costVal = includeCosts ? Math.round(act.cost || 0) : 0;
    const isMilestone = !t.isSummary && (act.duration === 0);

    // Predecessor link
    let predXml = '';
    if (includePredecessors && act.prerequisiteId && activityIdToUid.has(act.prerequisiteId)) {
      const predUid = activityIdToUid.get(act.prerequisiteId)!;
      const typeCode = getMsLinkTypeCode(act.prerequisiteType);
      const lagTenths = Math.round((act.lag || 0) * 4800);
      predXml = `
      <PredecessorLink>
        <PredecessorUID>${predUid}</PredecessorUID>
        <Type>${typeCode}</Type>
        <CrossProject>0</CrossProject>
        <LinkLag>${lagTenths}</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>`;
    }

    // Assignment
    if (includeAssignments && act.assignedToId && resourceXmlMap.has(act.assignedToId)) {
      const resInfo = resourceXmlMap.get(act.assignedToId)!;
      assignmentsXmlList.push(`    <Assignment>
      <UID>${assignmentCounter++}</UID>
      <TaskUID>${t.uid}</TaskUID>
      <ResourceUID>${resInfo.resUid}</ResourceUID>
      <PercentWorkComplete>${progressVal}</PercentWorkComplete>
      <Units>1</Units>
    </Assignment>`);
    }

    return `    <Task>
      <UID>${t.uid}</UID>
      <ID>${t.id}</ID>
      <Name>${escapeXml(act.name)}</Name>
      <Type>${t.isSummary ? 1 : 0}</Type>
      <IsNull>0</IsNull>
      <CreateDate>${nowIso}</CreateDate>
      <WBS>${escapeXml(t.wbs)}</WBS>
      <OutlineNumber>${escapeXml(t.outlineNumber)}</OutlineNumber>
      <OutlineLevel>${t.level}</OutlineLevel>
      <Priority>${act.importance === 'High' ? 700 : act.importance === 'Low' ? 300 : 500}</Priority>
      <Start>${taskStartIso}</Start>
      <Finish>${taskFinishIso}</Finish>
      <Duration>${durationIso}</Duration>
      <DurationFormat>7</DurationFormat>
      <Work>${workIso}</Work>
      <PercentComplete>${progressVal}</PercentComplete>
      <PercentWorkComplete>${progressVal}</PercentWorkComplete>
      <Cost>${costVal}</Cost>
      <Summary>${t.isSummary ? 1 : 0}</Summary>
      <Critical>${act.isCritical ? 1 : 0}</Critical>
      <Milestone>${isMilestone ? 1 : 0}</Milestone>${predXml}
    </Task>`;
  }).join('\n');

  let assignmentsSection = '';
  if (assignmentsXmlList.length > 0) {
    assignmentsSection = `
  <Assignments>
${assignmentsXmlList.join('\n')}
  </Assignments>`;
  }

  // Full MSPDI XML Document
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>14</SaveVersion>
  <Name>${escapeXml(projectName)}</Name>
  <Title>${escapeXml(projectName)}</Title>
  <CreationDate>${nowIso}</CreationDate>
  <LastSaved>${nowIso}</LastSaved>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${projStartIso}</StartDate>
  <FinishDate>${projFinishIso}</FinishDate>
  <FYStartDate>1</FYStartDate>
  <CriticalSlackLimit>0</CriticalSlackLimit>
  <CurrencyDigits>0</CurrencyDigits>
  <CurrencySymbol></CurrencySymbol>
  <CalendarUID>1</CalendarUID>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <DefaultTaskType>0</DefaultTaskType>
  <DefaultFixedCostAccrual>3</DefaultFixedCostAccrual>
  <DefaultStandardRate>0</DefaultStandardRate>
  <DefaultOvertimeRate>0</DefaultOvertimeRate>
  <DurationFormat>7</DurationFormat>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>${escapeXml(calendar?.name || 'Standard')}</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <WeekDays>${weekDaysXml}
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>${escapeXml(projectName)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <CreateDate>${nowIso}</CreateDate>
      <WBS>0</WBS>
      <OutlineNumber>0</OutlineNumber>
      <OutlineLevel>0</OutlineLevel>
      <Priority>500</Priority>
      <Start>${projStartIso}</Start>
      <Finish>${projFinishIso}</Finish>
      <Duration>${formatMsDuration(totalDurationDays)}</Duration>
      <DurationFormat>7</DurationFormat>
      <Work>${formatMsWork(totalWorkHours)}</Work>
      <PercentComplete>${overallProgress}</PercentComplete>
      <PercentWorkComplete>${overallProgress}</PercentWorkComplete>
      <Cost>${Math.round(totalCost)}</Cost>
      <Summary>1</Summary>
      <Critical>0</Critical>
      <Milestone>0</Milestone>
    </Task>
${tasksXml}
  </Tasks>${resourcesXml}${assignmentsSection}
</Project>`;
}

/**
 * Downloads the Microsoft Project XML string as a file in the browser.
 */
export function downloadMsProjectXmlFile(
  xmlContent: string,
  fileName: string = 'Project_Schedule.xml'
): void {
  const cleanName = fileName.endsWith('.xml') ? fileName : `${fileName}.xml`;
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = cleanName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
