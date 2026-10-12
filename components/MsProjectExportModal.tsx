import React, { useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '../types';
import { LocalizationContext } from '../context';

interface Props {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  /** Asks the backend for the project's schedule as an MS Project XML file and saves it. */
  onExport: (fileName: string) => Promise<{ ok: boolean; message?: string }>;
}

/** The backend builds the MS Project XML from the calculated schedule; the screen only names the file and saves it. */
export const MsProjectExportModal: React.FC<Props> = ({ project, isOpen, onClose, onExport }) => {
  const { language } = useContext(LocalizationContext);
  const isFa = language === 'fa';
  const defaultName = useMemo(() => `${(project.name || 'Project').trim().replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_')}_Schedule.xml`, [project.name]);
  const [fileName, setFileName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const run = async () => {
    setBusy(true);
    const outcome = await onExport(fileName.trim() || defaultName);
    setMessage(outcome.ok ? null : outcome.message ?? (isFa ? 'خروجی گرفته نشد.' : 'The export failed.'));
    setBusy(false);
    if (outcome.ok) onClose();
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isFa ? 'خروجی به Microsoft Project (XML)' : 'Export to Microsoft Project (XML)'}</h3>
          <button type="button" onClick={onClose} className="modal-close-button"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="msproject-export-name">{isFa ? 'نام فایل' : 'File name'}</label>
            <input id="msproject-export-name" type="text" value={fileName} onChange={e => setFileName(e.target.value)} />
          </div>
          {message && <p style={{ color: 'var(--danger-color, #dc2626)' }}>{message}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="save-btn" onClick={run} disabled={busy}>{busy ? '...' : (isFa ? 'دریافت فایل' : 'Download')}</button>
          <button type="button" className="cancel-btn" onClick={onClose}>{isFa ? 'بستن' : 'Close'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
