import React, { useState, useRef, useMemo, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Project, ProjectActivity } from '../types';
import { LocalizationContext } from '../context';
import { toPersianDigits } from '../utils';

const formatCurrencyAmount = (amount?: number, isFa?: boolean) => {
  if (!amount && amount !== 0) return '-';
  const num = Math.round(amount);
  const formatted = num.toLocaleString('en-US');
  return isFa ? toPersianDigits(formatted) : formatted;
};

interface MsProjectImportModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onApplySchedule: (activities: ProjectActivity[], replace: boolean, parentIdsToExpand: string[]) => void;
}

export interface ParsedMsProjectTask {
  uid: string;
  name: string;
  outlineNumber: string;
  outlineLevel: number;
  wbs: string;
  duration: number; // in working days
  isSummary: boolean;
  actualProgress: number;
  cost?: number;
  manHour?: number;
  startDate?: string;
  endDate?: string;
  predecessors: {
    predecessorUid: string;
    type: 'FS' | 'SS' | 'FF' | 'SF';
    lag: number;
  }[];
  parentId: string | null;
  mappedId?: string;
}

/**
 * Parses MS Project ISO 8601 duration format (e.g. PT40H0M0S, PT8H0M0S) or day/hour strings.
 * Standard MS Project working day is 8 hours.
 */
export function parseMsProjectDuration(durationStr: string | null | undefined): number {
  if (!durationStr) return 1;
  const str = durationStr.trim();
  if (!str) return 1;

  // ISO 8601 format: P[n]DT[n]H[n]M[n]S or PT[n]H[n]M[n]S
  const isoRegex = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i;
  const match = str.match(isoRegex);
  if (match) {
    const days = parseFloat(match[1]) || 0;
    const hours = parseFloat(match[2]) || 0;
    const minutes = parseFloat(match[3]) || 0;
    const seconds = parseFloat(match[4]) || 0;

    const totalHours = (days * 8) + hours + (minutes / 60) + (seconds / 3600);
    const calculatedDays = totalHours / 8;
    
    if (calculatedDays <= 0) return 1;
    return Math.max(1, Math.round(calculatedDays * 10) / 10);
  }

  // Check if string contains "d" or "days"
  const dayMatch = str.match(/^([\d.]+)\s*(?:d|days?|روز)?$/i);
  if (dayMatch) {
    const d = parseFloat(dayMatch[1]);
    return isNaN(d) || d <= 0 ? 1 : Math.max(1, Math.round(d));
  }

  // Check if string contains "h" or "hrs" or "hours"
  const hourMatch = str.match(/^([\d.]+)\s*(?:h|hrs?|hours?|ساعت)?$/i);
  if (hourMatch) {
    const h = parseFloat(hourMatch[1]);
    return isNaN(h) || h <= 0 ? 1 : Math.max(1, Math.round(h / 8));
  }

  // Plain number
  const num = parseFloat(str);
  if (!isNaN(num)) {
    return num <= 0 ? 1 : Math.max(1, Math.round(num));
  }

  return 1;
}

/**
 * Parses MS Project Predecessor Link Lag.
 * MS Project XML often stores LinkLag in tenths of a minute (e.g. 4800 = 480 mins = 8 hours = 1 day).
 */
export function parseMsProjectLag(lagStr: string | null | undefined): number {
  if (!lagStr) return 0;
  const str = lagStr.trim();
  if (!str || str === '0') return 0;

  if (str.startsWith('P') || str.startsWith('p')) {
    return parseMsProjectDuration(str);
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  // If tenths of minutes (>= 480)
  if (Math.abs(num) >= 480) {
    return Math.round(num / 4800);
  }
  return Math.round(num);
}

/**
 * Parses Predecessor Link Type (0: FF, 1: FS, 2: SF, 3: SS).
 */
export function parseMsProjectLinkType(typeStr: string | null | undefined): 'FS' | 'SS' | 'FF' | 'SF' {
  if (!typeStr) return 'FS';
  const t = typeStr.trim().toUpperCase();
  switch (t) {
    case '0':
    case 'FF':
      return 'FF';
    case '1':
    case 'FS':
      return 'FS';
    case '2':
    case 'SF':
      return 'SF';
    case '3':
    case 'SS':
      return 'SS';
    default:
      return 'FS';
  }
}

/**
 * Helper to safely extract child tag text inside XML element regardless of namespace prefix.
 */
function getTagText(parent: Element, tagName: string): string | null {
  const targetLower = tagName.toLowerCase();
  
  // Try using localName for better namespace handling
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName && child.localName.toLowerCase() === targetLower) {
      return (child.textContent || '').trim();
    }
  }

  // Fallback to getElementsByTagName but check localName
  const elements = parent.getElementsByTagName('*');
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.localName && el.localName.toLowerCase() === targetLower && el.parentNode === parent) {
      return (el.textContent || '').trim();
    }
  }

  // Try standard getElementsByTagName
  const direct = parent.getElementsByTagName(tagName)[0];
  if (direct && direct.textContent !== null) {
    return direct.textContent.trim();
  }

  return null;
}

/**
 * Helper to get all child elements matching tag name regardless of namespace.
 */
function getChildElements(parent: Element, tagName: string): Element[] {
  const targetLower = tagName.toLowerCase();
  const results: Element[] = [];

  // Check direct children first
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName && child.localName.toLowerCase() === targetLower) {
      results.push(child);
    }
  }

  // If no direct children found, try a deeper search if needed, 
  // but for MS Project XML structure, Task is usually inside Tasks or directly in Project
  if (results.length === 0) {
    const all = parent.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.localName && el.localName.toLowerCase() === targetLower) {
        // Only include if it's not already in results and matches structure
        results.push(el);
      }
    }
  }

  return Array.from(new Set(results));
}

/**
 * Parses Microsoft Project XML string into structured tasks and metadata.
 */
export function parseMsProjectXml(xmlText: string): {
  projectName: string;
  tasks: ParsedMsProjectTask[];
  totalTasks: number;
  summaryCount: number;
  leafCount: number;
  dependencyCount: number;
  totalDurationDays: number;
} {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('قالب فایل XML نامعتبر است یا ساختار فایل با مشکل مواجه شده است.');
  }

  // Extract Project Title
  let projectName = '';
  const projTitle = getTagText(xmlDoc.documentElement, 'Title') || getTagText(xmlDoc.documentElement, 'Name');
  if (projTitle) {
    projectName = projTitle;
  }

  // Find all <Task> elements
  const allTaskElements = getChildElements(xmlDoc.documentElement, 'Tasks').flatMap(tasksEl =>
    getChildElements(tasksEl, 'Task')
  );

  const taskElements = allTaskElements.length > 0 ? allTaskElements : getChildElements(xmlDoc.documentElement, 'Task');

  if (taskElements.length === 0) {
    throw new Error('هیچ فعالیتی (<Task>) در فایل Microsoft Project یافت نشد.');
  }

  const rawTasks: ParsedMsProjectTask[] = [];

  taskElements.forEach((taskEl) => {
    const uid = getTagText(taskEl, 'UID') || '';
    const name = getTagText(taskEl, 'Name') || '';
    const outlineNumber = getTagText(taskEl, 'OutlineNumber') || '';
    const outlineLevelStr = getTagText(taskEl, 'OutlineLevel');
    const outlineLevel = outlineLevelStr ? parseInt(outlineLevelStr, 10) : (outlineNumber ? outlineNumber.split('.').length : 1);
    const wbs = getTagText(taskEl, 'WBS') || outlineNumber || uid;
    const summaryVal = getTagText(taskEl, 'Summary');
    const isSummary = summaryVal === '1' || summaryVal?.toLowerCase() === 'true';

    // Check if task is project root task (UID 0 or OutlineLevel 0)
    if (uid === '0' || outlineLevel === 0) {
      if (!projectName && name) {
        projectName = name;
      }
      return; // Skip project root summary task from imported schedule list
    }

    // Skip blank tasks or template placeholders with no name and 0 duration
    if (!name && !outlineNumber) {
      return;
    }

    const durationStr = getTagText(taskEl, 'Duration');
    const duration = isSummary ? 1 : parseMsProjectDuration(durationStr);

    const percentCompleteStr = getTagText(taskEl, 'PercentComplete');
    const actualProgress = percentCompleteStr ? Math.min(100, Math.max(0, parseInt(percentCompleteStr, 10) || 0)) : 0;

    const costStr = getTagText(taskEl, 'Cost');
    const cost = costStr ? parseFloat(costStr) || 0 : 0;

    const workStr = getTagText(taskEl, 'Work');
    const manHour = workStr ? Math.round(parseMsProjectDuration(workStr) * 8) : 0;

    const startDate = getTagText(taskEl, 'Start') || undefined;
    const endDate = getTagText(taskEl, 'Finish') || undefined;

    // Predecessor links
    const predElements = getChildElements(taskEl, 'PredecessorLink');
    const predecessors = predElements.map(pEl => {
      const predUid = getTagText(pEl, 'PredecessorUID') || '';
      const typeStr = getTagText(pEl, 'Type');
      const lagStr = getTagText(pEl, 'LinkLag');
      return {
        predecessorUid: predUid,
        type: parseMsProjectLinkType(typeStr),
        lag: parseMsProjectLag(lagStr)
      };
    }).filter(p => p.predecessorUid && p.predecessorUid !== '0');

    rawTasks.push({
      uid,
      name,
      outlineNumber,
      outlineLevel,
      wbs,
      duration,
      isSummary,
      actualProgress,
      cost,
      manHour,
      startDate,
      endDate,
      predecessors,
      parentId: null
    });
  });

  if (rawTasks.length === 0) {
    throw new Error('هیچ فعالیت معتبری در فایل جهت ایمپورت شناسایی نشد.');
  }

  // Hierarchy Resolution:
  // Map outlineNumber -> task.uid
  const outlineMap = new Map<string, string>();
  rawTasks.forEach(t => {
    if (t.outlineNumber) {
      outlineMap.set(t.outlineNumber, t.uid);
    }
  });

  // Stack of levels for fallback hierarchy
  const levelStack: Record<number, string> = {};

  rawTasks.forEach(t => {
    let parentId: string | null = null;

    // Method 1: OutlineNumber (e.g. "1.2.3" -> parent is "1.2")
    if (t.outlineNumber && t.outlineNumber.includes('.')) {
      const parentOutline = t.outlineNumber.substring(0, t.outlineNumber.lastIndexOf('.'));
      if (outlineMap.has(parentOutline)) {
        parentId = outlineMap.get(parentOutline)!;
      }
    }

    // Method 2: Sequential OutlineLevel stack fallback
    if (!parentId && t.outlineLevel > 1) {
      for (let l = t.outlineLevel - 1; l >= 1; l--) {
        if (levelStack[l]) {
          parentId = levelStack[l];
          break;
        }
      }
    }

    t.parentId = parentId;
    levelStack[t.outlineLevel] = t.uid;

    // Clear deeper levels
    Object.keys(levelStack).forEach(k => {
      if (Number(k) > t.outlineLevel) {
        delete levelStack[Number(k)];
      }
    });
  });

  // Identify parents/summaries: any task that has children is a summary/parent
  const parentIdSet = new Set<string>();
  rawTasks.forEach(t => {
    if (t.parentId) parentIdSet.add(t.parentId);
  });

  rawTasks.forEach(t => {
    if (parentIdSet.has(t.uid)) {
      t.isSummary = true;
    }
  });

  const taskUidSet = new Set(rawTasks.map(t => t.uid));

  // Clean and validate predecessor links
  let dependencyCount = 0;
  rawTasks.forEach(t => {
    t.predecessors = t.predecessors.filter(p => taskUidSet.has(p.predecessorUid));
    dependencyCount += t.predecessors.length;
  });

  const summaryCount = rawTasks.filter(t => t.isSummary).length;
  const leafCount = rawTasks.length - summaryCount;
  const totalDurationDays = rawTasks
    .filter(t => !t.isSummary)
    .reduce((sum, t) => sum + (t.duration || 1), 0);

  return {
    projectName,
    tasks: rawTasks,
    totalTasks: rawTasks.length,
    summaryCount,
    leafCount,
    dependencyCount,
    totalDurationDays
  };
}

export const MsProjectImportModal: React.FC<MsProjectImportModalProps> = ({
  project,
  isOpen,
  onClose,
  onApplySchedule
}) => {
  const { language } = useContext(LocalizationContext);
  const isFa = language === 'fa';

  const [fileName, setFileName] = useState<string>('');
  const [fileSizeStr, setFileSizeStr] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mppWarning, setMppWarning] = useState(false);
  const [parsedData, setParsedData] = useState<ReturnType<typeof parseMsProjectXml> | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = (file: File) => {
    setError(null);
    setMppWarning(false);
    setParsedData(null);
    setFileName(file.name);

    // Format file size
    const sizeKb = Math.round(file.size / 1024);
    setFileSizeStr(sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`);

    // Check if user uploaded .mpp binary file
    if (file.name.toLowerCase().endsWith('.mpp')) {
      setMppWarning(true);
      return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          throw new Error('خواندن فایل ناموفق بود.');
        }

        // Detect encoding: check first 250 bytes for encoding declaration
        const previewDecoder = new TextDecoder('utf-8');
        const previewSlice = previewDecoder.decode(buffer.slice(0, 300));
        let encoding = 'utf-8';

        if (/encoding=["']windows-1256["']/i.test(previewSlice)) {
          encoding = 'windows-1256';
        } else if (/encoding=["']iso-8859-1["']/i.test(previewSlice)) {
          encoding = 'iso-8859-1';
        } else if (/encoding=["']utf-16["']/i.test(previewSlice)) {
          encoding = 'utf-16le';
        }

        const fullDecoder = new TextDecoder(encoding);
        const xmlText = fullDecoder.decode(buffer);

        const result = parseMsProjectXml(xmlText);
        setParsedData(result);
      } catch (err: any) {
        console.error('Error parsing MS Project file:', err);
        setError(err.message || 'خطا در خواندن و تحلیل فایل Microsoft Project');
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('خطا در خواندن فایل از حافظه');
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData || parsedData.tasks.length === 0) return;

    const rawTasks = parsedData.tasks;
    const isReplace = importMode === 'replace';

    // Calculate base ID index
    const currentSchedule = project.schedule || [];
    let baseOffset = 0;
    if (!isReplace && currentSchedule.length > 0) {
      baseOffset = currentSchedule.reduce((max, a) => Math.max(max, parseInt(a.id, 10) || 0), 0);
    }

    // Map each task's UID to sequential clean integer ID string
    const idMap = new Map<string, string>();
    rawTasks.forEach((t, idx) => {
      idMap.set(t.uid, String(baseOffset + idx + 1));
    });

    // Leaf tasks count for weight distribution
    const leafTasks = rawTasks.filter(t => !t.isSummary);
    const equalWeight = leafTasks.length > 0 ? Math.round((100 / leafTasks.length) * 10) / 10 : 0;

    const parentIdsToExpand: string[] = [];

    const newActivities: ProjectActivity[] = rawTasks.map((t) => {
      const mappedId = idMap.get(t.uid)!;
      const mappedParentId = t.parentId ? (idMap.get(t.parentId) || null) : null;

      if (t.isSummary) {
        parentIdsToExpand.push(mappedId);
      }

      // Predecessor resolution
      let prerequisiteId: string | null = null;
      let prerequisiteType: 'FS' | 'SS' | 'FF' | 'SF' = 'FS';
      let lag = 0;

      if (t.predecessors && t.predecessors.length > 0) {
        const firstPred = t.predecessors[0];
        if (idMap.has(firstPred.predecessorUid)) {
          prerequisiteId = idMap.get(firstPred.predecessorUid)!;
          prerequisiteType = firstPred.type;
          lag = firstPred.lag || 0;
        }
      }

      // Initial weight: if leaf, set equalWeight, else 0 (will roll up automatically)
      const weight = t.isSummary ? 0 : equalWeight;

      return {
        id: mappedId,
        name: t.name || (isFa ? `فعالیت ${mappedId}` : `Task ${mappedId}`),
        duration: t.isSummary ? 1 : Math.max(1, t.duration || 1),
        prerequisiteId,
        prerequisiteType,
        lag,
        cost: t.cost || 0,
        manHour: t.manHour || 0,
        importance: 'Medium',
        complexity: 'Medium',
        weight,
        assignedToId: null,
        actualProgress: t.actualProgress || 0,
        parentId: mappedParentId,
        approver1Id: project.projectManagerId || null,
        approver2Id: null,
        approver3Id: null,
        startDate: t.startDate ? new Date(t.startDate) : undefined,
        endDate: t.endDate ? new Date(t.endDate) : undefined
      };
    });

    onApplySchedule(newActivities, isReplace, parentIdsToExpand);
    onClose();
  };

  const filteredTasks = useMemo(() => {
    if (!parsedData) return [];
    if (!searchQuery.trim()) return parsedData.tasks;
    const q = searchQuery.toLowerCase().trim();
    return parsedData.tasks.filter(
      t => t.name.toLowerCase().includes(q) || t.outlineNumber.toLowerCase().includes(q) || t.wbs.toLowerCase().includes(q)
    );
  }, [parsedData, searchQuery]);

  if (!isOpen) return null;

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
          maxWidth: '960px',
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
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 124, 65, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#107c41'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.75rem' }}>
                upload_file
              </span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-color, #0f172a)' }}>
                {isFa ? 'ایمپورت زمانبندی از Microsoft Project' : 'Import Schedule from Microsoft Project'}
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                {isFa
                  ? 'خواندن خودکار ساختار شکست کار (WBS)، فازها، مدت زمان فعالیت‌ها و روابط پیش‌نیازی'
                  : 'Automatic extraction of WBS hierarchy, phases, task durations, and predecessor links'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="action-icon"
            style={{ padding: '0.4rem', borderRadius: '8px' }}
            title={isFa ? 'بستن' : 'Close'}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* File Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: isDragging ? '2px dashed #107c41' : '2px dashed var(--border-color, #cbd5e1)',
              backgroundColor: isDragging ? 'rgba(16, 124, 65, 0.05)' : 'var(--bg-secondary, #f8fafc)',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '1rem'
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.mpp"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '2.5rem', color: isDragging ? '#107c41' : '#64748b' }}
              >
                cloud_upload
              </span>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-color, #0f172a)' }}>
                {isFa
                  ? 'فایل Microsoft Project را اینجا بکشید یا برای انتخاب کلیک کنید'
                  : 'Drop your Microsoft Project file here or click to browse'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {isFa
                  ? 'فرمت استاندارد: XML پروژه مایکروسافت پروجکت (Save As > XML Format *.xml)'
                  : 'Supported standard: Microsoft Project XML (*.xml)'}
              </div>
              {fileName && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    backgroundColor: 'rgba(16, 124, 65, 0.12)',
                    color: '#107c41',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>description</span>
                  <span>{fileName}</span>
                  {fileSizeStr && <span style={{ opacity: 0.8 }}>({fileSizeStr})</span>}
                </div>
              )}
            </div>
          </div>

          {/* Quick Guide Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              backgroundColor: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.82rem',
              lineHeight: '1.6',
              color: 'var(--text-color, #0369a1)'
            }}
          >
            <span className="material-symbols-outlined" style={{ color: '#0284c7', fontSize: '1.25rem', marginTop: '2px' }}>
              help_outline
            </span>
            <div>
              <strong style={{ display: 'block', marginBottom: '0.2rem', color: '#0369a1' }}>
                {isFa ? 'نحوه خروجی گرفتن از Microsoft Project:' : 'How to export from Microsoft Project:'}
              </strong>
              <span>
                {isFa
                  ? 'در نرم‌افزار MS Project از منوی File > گزینه Save As را زده و در بخش نوع فایل (Save as type)، گزینه «XML Format (*.xml)» را انتخاب و ذخیره نمایید. این فایل شامل تمام فازها، تسک‌ها، مدت زمان و لینک‌های پیش‌نیازی پروژه است.'
                  : 'In MS Project, open File > Save As, and in the Save as type dropdown, select "XML Format (*.xml)". This standard XML file preserves all WBS hierarchy, durations, and predecessor links.'}
              </span>
            </div>
          </div>

          {/* Warning for .mpp binary file */}
          {mppWarning && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                backgroundColor: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                color: '#854d0e',
                fontSize: '0.85rem',
                lineHeight: '1.6'
              }}
            >
              <span className="material-symbols-outlined" style={{ color: '#ca8a04', fontSize: '1.5rem' }}>
                warning
              </span>
              <div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                  {isFa ? 'فایل .mpp مستقیماً در مرورگر قابل خواندن نیست' : 'Binary .mpp files cannot be parsed directly'}
                </strong>
                <span>
                  {isFa
                    ? 'فایل‌های با پسوند .mpp دارای ساختار باینری اختصاصی مایکروسافت هستند. لطفاً این پروژه را در نرم‌افزار Microsoft Project باز کرده و از منوی File > Save As آن را با فرمت XML Format (*.xml) ذخیره فرمایید، سپس فایل XML را در این کادر قرار دهید.'
                    : 'The .mpp extension is a proprietary binary stream. Please open your project in Microsoft Project, go to File > Save As, choose "XML Format (*.xml)", and upload the resulting .xml file here.'}
                </span>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
              <div
                className="spinner"
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#107c41',
                  borderRadius: '50%',
                  margin: '0 auto 1rem',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
                {isFa ? 'در حال خواندن و تحلیل ساختار فایل Microsoft Project...' : 'Parsing Microsoft Project file...'}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                color: '#b91c1c',
                fontSize: '0.85rem'
              }}
            >
              <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>
                error
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Parsed Summary & Preview */}
          {parsedData && (
            <div>
              {/* Metric Badges */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1rem'
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {isFa ? 'تعداد کل فعالیت‌ها' : 'Total Activities'}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-color, #0f172a)' }}>
                    {isFa ? toPersianDigits(parsedData.totalTasks) : parsedData.totalTasks}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {isFa ? 'فازها و سطوح WBS' : 'WBS Summary Phases'}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0284c7' }}>
                    {isFa ? toPersianDigits(parsedData.summaryCount) : parsedData.summaryCount}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {isFa ? 'روابط پیش‌نیازی' : 'Dependencies'}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#107c41' }}>
                    {isFa ? toPersianDigits(parsedData.dependencyCount) : parsedData.dependencyCount}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {isFa ? 'مجموع مدت‌زمان اجرایی' : 'Total Working Days'}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#8b5cf6' }}>
                    {isFa ? `${toPersianDigits(parsedData.totalDurationDays)} روز` : `${parsedData.totalDurationDays} days`}
                  </span>
                </div>
              </div>

              {/* Import Mode Options */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1rem'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-color, #0f172a)' }}>
                  {isFa ? 'نحوه اعمال در زمانبندی پروژه:' : 'Schedule Import Mode:'}
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                    />
                    <span>
                      <strong>{isFa ? 'جایگزینی کامل زمانبندی فعلی' : 'Replace existing schedule'}</strong>{' '}
                      <span style={{ color: '#64748b' }}>
                        {isFa ? '(پیش‌فرض - زمانبندی قبلی پاک شده و ساختار جدید جایگزین می‌شود)' : '(Overwrites existing tasks)'}
                      </span>
                    </span>
                  </label>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                    />
                    <span>
                      <strong>{isFa ? 'افزودن به زمانبندی موجود' : 'Append to existing schedule'}</strong>{' '}
                      <span style={{ color: '#64748b' }}>
                        {isFa ? '(فعالیت‌های جدید به انتهای فعالیت‌های فعلی افزوده می‌شوند)' : '(Appends tasks to current list)'}
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Preview Table Section */}
              <div style={{ marginBottom: '0.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.65rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#107c41' }}>
                      preview
                    </span>
                    <strong style={{ fontSize: '0.9rem' }}>
                      {isFa ? 'پیش‌نمایش فعالیت‌ها و ساختار شکست کار (WBS):' : 'Activities & WBS Preview:'}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      ({isFa ? `${toPersianDigits(filteredTasks.length)} ردیف` : `${filteredTasks.length} rows`})
                    </span>
                  </div>

                  <div style={{ minWidth: '220px' }}>
                    <input
                      type="text"
                      placeholder={isFa ? 'جستجو در فعالیت‌ها یا WBS...' : 'Filter activities or WBS...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.78rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color, #cbd5e1)',
                        width: '100%',
                        backgroundColor: 'var(--card-bg-color, #ffffff)'
                      }}
                    />
                  </div>
                </div>

                <div
                  className="table-responsive"
                  style={{
                    maxHeight: '320px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px'
                  }}
                >
                  <table className="tab-table" style={{ fontSize: '0.76rem', margin: 0 }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-secondary, #f8fafc)' }}>
                      <tr>
                        <th style={{ width: '38px', padding: '0.45rem 0.5rem' }}>{isFa ? '#' : '#'}</th>
                        <th style={{ width: '80px', padding: '0.45rem 0.5rem' }}>{isFa ? 'کد WBS' : 'WBS'}</th>
                        <th style={{ padding: '0.45rem 0.5rem' }}>{isFa ? 'نام فعالیت / فاز' : 'Task / Phase Name'}</th>
                        <th style={{ width: '75px', padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                          {isFa ? 'مدت (روز)' : 'Duration'}
                        </th>
                        <th style={{ width: '130px', padding: '0.45rem 0.5rem' }}>{isFa ? 'پیش‌نیازی' : 'Predecessor'}</th>
                        <th style={{ width: '70px', padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                          {isFa ? 'پیشرفت' : 'Progress'}
                        </th>
                        <th style={{ width: '85px', padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                          {isFa ? 'هزینه' : 'Cost'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                            {isFa ? 'فعالیتی با این مشخصات یافت نشد.' : 'No tasks match your search.'}
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map((t, idx) => {
                          const indentPx = Math.max(0, (t.outlineLevel - 1) * 16);
                          return (
                            <tr
                              key={t.uid || idx}
                              style={{
                                backgroundColor: t.isSummary ? 'rgba(2, 132, 199, 0.04)' : undefined,
                                fontWeight: t.isSummary ? 700 : 400
                              }}
                            >
                              <td style={{ padding: '0.45rem 0.5rem', color: '#64748b' }}>
                                {isFa ? toPersianDigits(idx + 1) : idx + 1}
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', fontFamily: 'monospace', fontWeight: 600, color: '#0369a1' }}>
                                {isFa ? toPersianDigits(t.outlineNumber || t.wbs) : (t.outlineNumber || t.wbs)}
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingInlineStart: `${indentPx}px` }}>
                                  <span
                                    className="material-symbols-outlined"
                                    style={{
                                      fontSize: '0.95rem',
                                      color: t.isSummary ? '#0284c7' : '#107c41'
                                    }}
                                  >
                                    {t.isSummary ? 'folder' : 'task'}
                                  </span>
                                  <span>{t.name}</span>
                                </div>
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>
                                {t.isSummary
                                  ? '-'
                                  : isFa
                                  ? toPersianDigits(t.duration)
                                  : t.duration}
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem' }}>
                                {t.predecessors && t.predecessors.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                    {t.predecessors.map((p, pIdx) => {
                                      const predTask = parsedData.tasks.find(x => x.uid === p.predecessorUid);
                                      const label = predTask ? (predTask.outlineNumber || predTask.name) : `#${p.predecessorUid}`;
                                      return (
                                        <span
                                          key={pIdx}
                                          style={{
                                            backgroundColor: 'rgba(16, 124, 65, 0.1)',
                                            color: '#107c41',
                                            padding: '1px 5px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600
                                          }}
                                          title={predTask ? `${predTask.name} (${p.type}${p.lag ? `+${p.lag}d` : ''})` : ''}
                                        >
                                          {isFa ? toPersianDigits(label) : label} ({p.type}
                                          {p.lag ? `+${p.lag}d` : ''})
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>-</span>
                                )}
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                                {t.actualProgress > 0 ? (
                                  <span style={{ color: '#059669', fontWeight: 600 }}>
                                    {isFa ? `${toPersianDigits(t.actualProgress)}%` : `${t.actualProgress}%`}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>0%</span>
                                )}
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                                {t.cost ? (
                                  <span style={{ fontSize: '0.72rem' }}>
                                    {formatCurrencyAmount(t.cost, isFa)}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
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
            gap: '0.75rem'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="action-button"
            style={{ padding: '0.5rem 1.25rem' }}
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {parsedData && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="action-button"
                style={{ padding: '0.5rem 1rem' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', marginInlineEnd: '0.25rem' }}>
                  cached
                </span>
                {isFa ? 'انتخاب فایل دیگر' : 'Change File'}
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!parsedData || parsedData.tasks.length === 0}
              className="action-button primary"
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#107c41',
                borderColor: '#107c41',
                opacity: !parsedData || parsedData.tasks.length === 0 ? 0.5 : 1,
                cursor: !parsedData || parsedData.tasks.length === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
                check_circle
              </span>
              <span>
                {isFa
                  ? `تأیید و ایمپورت در زمانبندی (${isFa && parsedData ? toPersianDigits(parsedData.tasks.length) : parsedData?.tasks.length || 0} فعالیت)`
                  : `Confirm & Import (${parsedData?.tasks.length || 0} tasks)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
