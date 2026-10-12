import React, { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '../types';
import { LocalizationContext } from '../context';

interface Props {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  /** Sends the file to the backend, which reads the MS Project XML and builds the WBS and its dependencies. */
  onImport: (file: File, replaceExisting: boolean) => Promise<{ ok: boolean; message?: string; warnings?: string[]; imported?: number }>;
}

/** Choose an MS Project XML file; the backend does the reading (the screen only sends the file and shows what came back). */
export const MsProjectImportModal: React.FC<Props> = ({ project, isOpen, onClose, onImport }) => {
  const { language } = useContext(LocalizationContext);
  const isFa = language === 'fa';
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string; warnings?: string[]; imported?: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setResult(null);
      setBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasActivities = (project.schedule?.length ?? 0) > 0;

  const run = async () => {
    if (!file) return;
    setBusy(true);
    // A project that already has activities is refused by the backend unless it is told to replace them.
    setResult(await onImport(file, hasActivities && mode === 'replace'));
    setBusy(false);
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isFa ? 'ایمپورت از Microsoft Project (XML)' : 'Import from Microsoft Project (XML)'}</h3>
          <button type="button" onClick={onClose} className="modal-close-button"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="msproject-file">{isFa ? 'فایل XML' : 'XML file'}</label>
            <input id="msproject-file" type="file" accept=".xml,text/xml,application/xml" onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
          </div>
          {hasActivities && (
            <div className="form-group">
              <label><input type="radio" name="msproject-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> {isFa ? 'جایگزینی فعالیت‌های فعلی' : 'Replace the current activities'}</label>
              <label><input type="radio" name="msproject-mode" checked={mode === 'append'} onChange={() => setMode('append')} /> {isFa ? 'افزودن به فعالیت‌های فعلی' : 'Add to the current activities'}</label>
              {mode === 'append' && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                  {isFa ? 'اگر پروژه فعالیت دارد، سامانه ایمپورت را بدون جایگزینی نمی‌پذیرد.' : 'A project that already has activities is refused unless they are replaced.'}
                </p>
              )}
            </div>
          )}
          {result && (
            <div id="msproject-result" style={{ marginTop: '0.75rem' }}>
              {result.ok
                ? <strong>{isFa ? `${result.imported ?? 0} فعالیت ایمپورت شد.` : `${result.imported ?? 0} activities imported.`}</strong>
                : <strong style={{ color: 'var(--danger-color, #dc2626)' }}>{result.message}</strong>}
              {(result.warnings?.length ?? 0) > 0 && (
                <ul style={{ fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{result.warnings!.map((w, i) => <li key={i}>{w}</li>)}</ul>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="save-btn" onClick={run} disabled={!file || busy}>{busy ? '...' : (isFa ? 'ایمپورت' : 'Import')}</button>
          <button type="button" className="cancel-btn" onClick={onClose}>{isFa ? 'بستن' : 'Close'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
