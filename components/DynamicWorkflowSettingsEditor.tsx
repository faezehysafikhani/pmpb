import React, { useState, useContext } from 'react';
import { User, WorkflowEntityType, WorkflowStage, DynamicWorkflowSettings, DEFAULT_DYNAMIC_WORKFLOW_SETTINGS } from '../types';
import { toPersianDigits } from '../utils';
import { ThemeContext } from '../context';

export interface ProjectWorkflowContext {
  projectName?: string;
  pmName?: string;
  ownerName?: string;
  tabWorkflows?: Record<string, boolean>;
  onToggleTabWorkflow?: (tabKey: string, requiresWorkflow: boolean) => void;
}

interface DynamicWorkflowSettingsEditorProps {
  settings: DynamicWorkflowSettings;
  onUpdateSettings: (newSettings: DynamicWorkflowSettings) => void;
  users: User[];
  isDark?: boolean;
  language?: string;
  activeEntityType?: WorkflowEntityType;
  onChangeActiveEntityType?: (type: WorkflowEntityType) => void;
  projectContext?: ProjectWorkflowContext;
  hideEntityTabs?: boolean;
  showHeaderBanner?: boolean;
  onCloseDrawer?: () => void;
}

export const DynamicWorkflowSettingsEditor: React.FC<DynamicWorkflowSettingsEditorProps> = ({
  settings,
  onUpdateSettings,
  users,
  isDark: propIsDark,
  language = 'fa',
  activeEntityType: controlledActiveEntity,
  onChangeActiveEntityType,
  projectContext,
  hideEntityTabs = false,
  showHeaderBanner = true,
  onCloseDrawer
}) => {
  const { theme } = useContext(ThemeContext);
  const isDark = propIsDark !== undefined ? propIsDark : theme === 'dark';
  const isFa = language === 'fa';
  const [internalActiveEntityType, setInternalActiveEntityType] = useState<WorkflowEntityType>('charter');

  const activeEntityType = controlledActiveEntity !== undefined ? controlledActiveEntity : internalActiveEntityType;
  const setActiveEntityType = (type: WorkflowEntityType) => {
    if (onChangeActiveEntityType) {
      onChangeActiveEntityType(type);
    } else {
      setInternalActiveEntityType(type);
    }
  };

  const entityDefinitions: { 
    id: WorkflowEntityType; 
    tabKey: string;
    titleFa: string; 
    titleEn: string; 
    icon: string; 
    descFa: string; 
    descEn: string 
  }[] = [
    {
      id: 'charter',
      tabKey: 'charter',
      titleFa: 'منشور پروژه',
      titleEn: 'Project Charter',
      icon: 'description',
      descFa: 'مراحل بررسی و تایید ایجاد یا اصلاح منشور پروژه',
      descEn: 'Approval workflow stages for project charter creation or modification'
    },
    {
      id: 'activity_progress',
      tabKey: 'schedule',
      titleFa: 'پیشرفت فعالیت‌ها / زمانبندی',
      titleEn: 'Activity & Schedule Progress',
      icon: 'trending_up',
      descFa: 'مراحل تایید درصدهای پیشرفت ثبت شده توسط مجریان و اعضای تیم',
      descEn: 'Approval stages for reported activity and action progress percentage'
    },
    {
      id: 'risks',
      tabKey: 'risks',
      titleFa: 'ریسک‌های پروژه',
      titleEn: 'Project Risks',
      icon: 'warning',
      descFa: 'مراحل گردش کار و تایید ریسک‌های جدید شناسایی شده در پروژه',
      descEn: 'Approval workflow stages for newly identified project risks'
    },
    {
      id: 'stakeholders',
      tabKey: 'stakeholders',
      titleFa: 'ذینفعان پروژه',
      titleEn: 'Project Stakeholders',
      icon: 'groups',
      descFa: 'مراحل تایید و اعتبارسنجی ماتریس ذینفعان ثبت شده در پروژه',
      descEn: 'Approval workflow stages for project stakeholders register'
    },
    {
      id: 'status_updates',
      tabKey: 'status',
      titleFa: 'شرح آخرین وضعیت پروژه',
      titleEn: 'Project Status Updates',
      icon: 'insights',
      descFa: 'مراحل تایید گزارش‌ها و شرح آخرین وضعیت دوره‌ای پروژه',
      descEn: 'Approval stages for periodic project status update descriptions'
    },
    {
      id: 'delay_reasons',
      tabKey: 'delays',
      titleFa: 'دلایل تاخیر پروژه',
      titleEn: 'Project Delay Reasons',
      icon: 'timer_off',
      descFa: 'مراحل تایید علل و مستندات تاخیرات زمانی پروژه',
      descEn: 'Approval workflow stages for recorded project delay causes'
    },
    {
      id: 'documents',
      tabKey: 'docs',
      titleFa: 'اسناد پروژه',
      titleEn: 'Project Documents',
      icon: 'folder_shared',
      descFa: 'مراحل بررسی و تایید بارگذاری اسناد و مدارک پروژه',
      descEn: 'Approval stages for uploaded project documents'
    },
    {
      id: 'contracts',
      tabKey: 'contracts',
      titleFa: 'قراردادها و الحاقیه‌ها',
      titleEn: 'Contracts & Addendums',
      icon: 'description',
      descFa: 'مراحل بررسی و تایید ثبت قراردادها و الحاقیه‌ها',
      descEn: 'Approval workflow stages for project contracts and addendums'
    },
    {
      id: 'invoices',
      tabKey: 'invoices',
      titleFa: 'صورتحساب‌ها',
      titleEn: 'Project Invoices',
      icon: 'receipt_long',
      descFa: 'مراحل بررسی و تایید صورتحساب‌ها و صورت‌وضعیت‌ها',
      descEn: 'Approval workflow stages for project invoices'
    }
  ];

  const currentStages = settings[activeEntityType] || DEFAULT_DYNAMIC_WORKFLOW_SETTINGS[activeEntityType] || [];
  const activeDef = entityDefinitions.find(e => e.id === activeEntityType) || entityDefinitions[0];

  // Project-specific workflow state for active entity
  const isCustomWorkflowActive = projectContext?.tabWorkflows 
    ? projectContext.tabWorkflows[activeDef.tabKey] === false 
    : false;

  const handleStageTitleChange = (stageIndex: number, newTitle: string) => {
    const updatedStages = [...currentStages];
    updatedStages[stageIndex] = {
      ...updatedStages[stageIndex],
      stageTitle: newTitle
    };
    onUpdateSettings({
      ...settings,
      [activeEntityType]: updatedStages
    });
  };

  const handleApproverChange = (stageIndex: number, newApproverId: 'ROLE_PM' | 'ROLE_OWNER' | number) => {
    const updatedStages = [...currentStages];
    updatedStages[stageIndex] = {
      ...updatedStages[stageIndex],
      approverId: newApproverId
    };
    onUpdateSettings({
      ...settings,
      [activeEntityType]: updatedStages
    });
  };

  const handleAddStage = () => {
    const nextStageNumber = currentStages.length + 1;
    const newStage: WorkflowStage = {
      id: `${activeEntityType}_${Date.now()}`,
      stageNumber: nextStageNumber,
      stageTitle: isFa ? `مرحله ${toPersianDigits(nextStageNumber)}: تایید` : `Stage ${nextStageNumber}: Approval`,
      approverId: 'ROLE_PM'
    };
    const updatedStages = [...currentStages, newStage];
    onUpdateSettings({
      ...settings,
      [activeEntityType]: updatedStages
    });
  };

  const handleRemoveStage = (stageIndex: number) => {
    if (currentStages.length <= 1) {
      alert(isFa ? 'حداقل یک مرحله تایید باید تعریف شده باشد.' : 'At least one approval stage is required.');
      return;
    }
    const updatedStages = currentStages.filter((_, idx) => idx !== stageIndex).map((stg, idx) => ({
      ...stg,
      stageNumber: idx + 1
    }));
    onUpdateSettings({
      ...settings,
      [activeEntityType]: updatedStages
    });
  };

  const handleMoveStage = (stageIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? stageIndex - 1 : stageIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentStages.length) return;
    const updatedStages = [...currentStages];
    const temp = updatedStages[stageIndex];
    updatedStages[stageIndex] = updatedStages[targetIndex];
    updatedStages[targetIndex] = temp;
    const renumbered = updatedStages.map((stg, idx) => ({
      ...stg,
      stageNumber: idx + 1
    }));
    onUpdateSettings({
      ...settings,
      [activeEntityType]: renumbered
    });
  };

  const handleResetToDefault = () => {
    onUpdateSettings({
      ...settings,
      [activeEntityType]: [
        { id: `${activeEntityType}_default`, stageNumber: 1, stageTitle: isFa ? 'تایید نهایی' : 'Final Approval', approverId: 'ROLE_PM' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: hideEntityTabs ? '0.25rem' : '0.5rem' }}>
      {/* Entity Selector Tabs (Hidden in single entity / accordion drawer mode) */}
      {!hideEntityTabs && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          paddingBottom: '0.85rem'
        }}>
          {entityDefinitions.map((entity) => {
            const isActive = entity.id === activeEntityType;
            const stageCount = (settings[entity.id] || []).length || (DEFAULT_DYNAMIC_WORKFLOW_SETTINGS[entity.id] || []).length;
            const isEntityCustom = projectContext?.tabWorkflows ? projectContext.tabWorkflows[entity.tabKey] === false : false;

            return (
              <button
                key={entity.id}
                type="button"
                onClick={() => setActiveEntityType(entity.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 700 : 500,
                  border: isActive 
                    ? (isEntityCustom ? (isDark ? '2px solid #a78bfa' : '2px solid #7c3aed') : (isDark ? '2px solid #34d399' : '2px solid #059669')) 
                    : (isEntityCustom ? (isDark ? '1px solid #7c3aed' : '1px solid #c4b5fd') : (isDark ? '1px solid #334155' : '1px solid var(--border-color, #e2e8f0)')),
                  backgroundColor: isActive 
                    ? (isEntityCustom ? (isDark ? 'rgba(124, 58, 237, 0.25)' : 'rgba(124, 58, 237, 0.12)') : (isDark ? 'rgba(5, 150, 105, 0.25)' : 'rgba(5, 150, 105, 0.12)')) 
                    : (isEntityCustom ? (isDark ? 'rgba(124, 58, 237, 0.1)' : 'rgba(124, 58, 237, 0.04)') : (isDark ? 'rgba(255,255,255,0.03)' : '#ffffff')),
                  color: isActive 
                    ? (isEntityCustom ? (isDark ? '#c4b5fd' : '#6d28d9') : (isDark ? '#6ee7b7' : '#059669')) 
                    : (isDark ? '#e2e8f0' : 'var(--text-color, #334155)'),
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>{entity.icon}</span>
                <span>{isFa ? entity.titleFa : entity.titleEn}</span>
                
                {/* Custom Workflow Badge if in project context */}
                {projectContext?.tabWorkflows && (
                  <span style={{
                    fontSize: '0.66rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    backgroundColor: isEntityCustom ? '#7c3aed' : (isDark ? '#334155' : '#e2e8f0'),
                    color: isEntityCustom ? '#ffffff' : (isDark ? '#cbd5e1' : '#64748b')
                  }}>
                    {isEntityCustom ? (isFa ? 'منحصربفرد' : 'Custom') : (isFa ? 'عمومی' : 'Global')}
                  </span>
                )}

                {/* Stage Count Badge */}
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  backgroundColor: isActive 
                    ? (isEntityCustom ? '#7c3aed' : '#059669') 
                    : (isDark ? '#334155' : 'var(--border-color, #cbd5e1)'),
                  color: isActive ? '#ffffff' : (isDark ? '#cbd5e1' : 'var(--text-color, #475569)')
                }}>
                  {isFa ? `${toPersianDigits(stageCount)} مرحله` : `${stageCount} stage${stageCount > 1 ? 's' : ''}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active Entity Info Banner with Mode Status */}
      {showHeaderBanner && (
        <div style={{
          padding: '0.85rem 1.1rem',
          backgroundColor: isCustomWorkflowActive 
            ? (isDark ? 'rgba(124, 58, 237, 0.18)' : '#f5f3ff')
            : (isDark ? 'rgba(5, 150, 105, 0.14)' : '#f0fdf4'),
          border: isCustomWorkflowActive 
            ? (isDark ? '1px solid rgba(167, 139, 250, 0.35)' : '1px solid #ddd6fe') 
            : (isDark ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid #bbf7d0'),
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 300px' }}>
            <span className="material-symbols-outlined" style={{ 
              color: isCustomWorkflowActive ? (isDark ? '#c4b5fd' : '#7c3aed') : (isDark ? '#6ee7b7' : '#059669'), 
              fontSize: '1.6rem' 
            }}>
              {activeDef.icon}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ 
                  fontWeight: 800, 
                  fontSize: '0.92rem', 
                  color: isCustomWorkflowActive 
                    ? (isDark ? '#f5f3ff' : '#5b21b6') 
                    : (isDark ? '#f0fdf4' : '#166534') 
                }}>
                  {isFa ? `مراحل گردش کار: ${activeDef.titleFa}` : `${activeDef.titleEn} Workflow Stages`}
                </span>

                {projectContext && (
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    fontWeight: 700,
                    backgroundColor: isCustomWorkflowActive ? '#7c3aed' : '#059669',
                    color: '#ffffff',
                    border: isDark ? '1px solid rgba(255,255,255,0.2)' : 'none'
                  }}>
                    {isCustomWorkflowActive 
                      ? (isFa ? '✨ گردش کار منحصربفرد این پروژه' : '✨ Custom Project Workflow') 
                      : (isFa ? '🌐 گردش کار عمومی سیستم' : '🌐 Global System Workflow')}
                  </span>
                )}
              </div>

              <div style={{ 
                fontSize: '0.78rem', 
                color: isCustomWorkflowActive 
                  ? (isDark ? '#ddd6fe' : '#6d28d9') 
                  : (isDark ? '#a7f3d0' : '#15803d'), 
                marginTop: '0.2rem' 
              }}>
                {isFa ? activeDef.descFa : activeDef.descEn}
                {projectContext && isCustomWorkflowActive && (
                  <span style={{ 
                    display: 'block', 
                    marginTop: '0.15rem', 
                    fontWeight: 600,
                    color: isDark ? '#f5d0fe' : '#581c87'
                  }}>
                    {isFa ? '💡 توجه: مراحل و تاییدکنندگان زیر صرفاً برای این صفحه از این پروژه اعمال می‌شوند.' : 'Note: These stages apply uniquely to this project page.'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Controls & Mode Switchers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {projectContext?.onToggleTabWorkflow && (
              <button
                type="button"
                onClick={() => projectContext.onToggleTabWorkflow?.(activeDef.tabKey, isCustomWorkflowActive)}
                className="action-button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  backgroundColor: isCustomWorkflowActive 
                    ? (isDark ? 'rgba(124, 58, 237, 0.25)' : '#ffffff') 
                    : '#7c3aed',
                  color: isCustomWorkflowActive 
                    ? (isDark ? '#e9d5ff' : '#7c3aed') 
                    : '#ffffff',
                  border: isCustomWorkflowActive 
                    ? (isDark ? '1px solid #a78bfa' : '1px solid #7c3aed') 
                    : 'none',
                  cursor: 'pointer'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                  {isCustomWorkflowActive ? 'sync' : 'tune'}
                </span>
                {isCustomWorkflowActive 
                  ? (isFa ? 'تغییر به گردش کار عمومی سیستم' : 'Switch to Global Workflow') 
                  : (isFa ? 'فعال‌سازی گردش کار منحصربفرد' : 'Make Workflow Unique')}
              </button>
            )}

            <button
              type="button"
              onClick={handleAddStage}
              className="action-button primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.8rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                backgroundColor: isCustomWorkflowActive ? '#7c3aed' : '#059669',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
              {isFa ? 'افزودن مرحله تایید' : 'Add Stage'}
            </button>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="action-button secondary"
              title={isFa ? 'بازنشانی به حالت پیش‌فرض (مدیر پروژه / تایید نهایی)' : 'Reset to default (PM / Final Approval)'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.7rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                backgroundColor: 'transparent',
                color: 'var(--text-color, #64748b)',
                cursor: 'pointer'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>restart_alt</span>
              {isFa ? 'پیش‌فرض' : 'Reset'}
            </button>

            {onCloseDrawer && (
              <button
                type="button"
                onClick={onCloseDrawer}
                className="action-button secondary"
                title={isFa ? 'بستن کشو' : 'Close Drawer'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.4rem 0.7rem',
                  fontSize: '0.78rem',
                  borderRadius: '6px',
                  border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff',
                  color: isDark ? '#e2e8f0' : '#475569',
                  cursor: 'pointer'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>expand_less</span>
                {isFa ? 'بستن' : 'Close'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid of Workflow Stages */}
      <div className="table-responsive" style={{
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <table className="users-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', color: 'var(--text-color, #334155)' }}>
              <th style={{ width: '60px', textAlign: 'center', padding: '0.65rem' }}>{isFa ? 'ردیف' : '#'}</th>
              <th style={{ padding: '0.65rem' }}>{isFa ? 'عنوان فاز تایید' : 'Stage Title'}</th>
              <th style={{ padding: '0.65rem', width: '360px' }}>{isFa ? 'تایید کننده این مرحله' : 'Stage Approver'}</th>
              <th style={{ width: '140px', textAlign: 'center', padding: '0.65rem' }}>{isFa ? 'جابجایی و حذف' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {currentStages.map((stage, idx) => (
              <tr key={stage.id || idx} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                <td style={{ 
                  textAlign: 'center', 
                  fontWeight: 700, 
                  color: isCustomWorkflowActive ? (isDark ? '#c4b5fd' : '#7c3aed') : (isDark ? '#6ee7b7' : '#059669') 
                }}>
                  {isFa ? toPersianDigits(idx + 1) : idx + 1}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input
                    type="text"
                    value={stage.stageTitle}
                    onChange={(e) => handleStageTitleChange(idx, e.target.value)}
                    placeholder={isFa ? 'عنوان فاز تایید مثلاً: بررسی اولیه یا تایید نهایی' : 'Approval Phase Title'}
                    className="form-control"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: isDark ? '1px solid #475569' : '1px solid var(--border-color, #cbd5e1)',
                      fontSize: '0.82rem',
                      backgroundColor: 'var(--card-bg-color, #ffffff)',
                      color: 'var(--text-color, #1e293b)'
                    }}
                  />
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <select
                    value={stage.approverId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'ROLE_PM' || val === 'ROLE_OWNER') {
                        handleApproverChange(idx, val);
                      } else {
                        handleApproverChange(idx, Number(val));
                      }
                    }}
                    className="form-control"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: isDark ? '1px solid #475569' : '1px solid var(--border-color, #cbd5e1)',
                      fontSize: '0.82rem',
                      backgroundColor: 'var(--card-bg-color, #ffffff)',
                      color: 'var(--text-color, #1e293b)'
                    }}
                  >
                    <optgroup label={isFa ? 'نقش‌های داینامیک' : 'Dynamic Roles'}>
                      <option value="ROLE_PM">
                        {projectContext?.pmName 
                          ? (isFa ? `⭐ مدیر پروژه: ${projectContext.pmName}` : `⭐ Project Manager: ${projectContext.pmName}`)
                          : (isFa ? '⭐ مدیر پروژه / مسئول اقدام (پیش‌فرض)' : '⭐ Project Manager / Action Responsible (Default)')}
                      </option>
                      <option value="ROLE_OWNER">
                        {projectContext?.ownerName 
                          ? (isFa ? `⭐ مالک پروژه: ${projectContext.ownerName}` : `⭐ Project Owner: ${projectContext.ownerName}`)
                          : (isFa ? '⭐ مالک پروژه / اقدام' : '⭐ Project Owner / Action Owner')}
                      </option>
                    </optgroup>
                    <optgroup label={isFa ? 'کاربران اختصاصی سامانه' : 'Specific Users'}>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name ? `${u.name} (${u.username}) - [${u.role}]` : `${u.username} - [${u.role}]`}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </td>
                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStage(idx, 'up')}
                      title={isFa ? 'انتقال به مرحله قبل' : 'Move Up'}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-color, #cbd5e1)',
                        borderRadius: '4px',
                        padding: '0.2rem',
                        cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        opacity: idx === 0 ? 0.3 : 1,
                        color: 'var(--text-color, #64748b)'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      disabled={idx === currentStages.length - 1}
                      onClick={() => handleMoveStage(idx, 'down')}
                      title={isFa ? 'انتقال به مرحله بعد' : 'Move Down'}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-color, #cbd5e1)',
                        borderRadius: '4px',
                        padding: '0.2rem',
                        cursor: idx === currentStages.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: idx === currentStages.length - 1 ? 0.3 : 1,
                        color: 'var(--text-color, #64748b)'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_downward</span>
                    </button>
                    <button
                      type="button"
                      disabled={currentStages.length <= 1}
                      onClick={() => handleRemoveStage(idx)}
                      title={isFa ? 'حذف این مرحله' : 'Delete Stage'}
                      style={{
                        background: 'none',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        padding: '0.2rem',
                        cursor: currentStages.length <= 1 ? 'not-allowed' : 'pointer',
                        opacity: currentStages.length <= 1 ? 0.3 : 1,
                        color: '#dc2626'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        fontSize: '0.76rem',
        color: isDark ? '#94a3b8' : 'var(--inactive-color, #64748b)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        marginTop: '0.25rem'
      }}>
        <span className="material-symbols-outlined" style={{ 
          fontSize: '1rem', 
          color: isCustomWorkflowActive ? (isDark ? '#c4b5fd' : '#7c3aed') : (isDark ? '#6ee7b7' : '#059669') 
        }}>
          check_circle
        </span>
        <span>
          {projectContext
            ? (isFa
                ? 'تنظیمات مراحل گردش کار این پروژه پس از فشردن دکمه «ذخیره تنظیمات» ذخیره شده و فرآیند تایید بر اساس همین مراحل اختصاصی انجام می‌شود.'
                : 'Project custom workflow stages will be saved when clicking Save and applied to subsequent approvals.')
            : (isFa
                ? 'تغییرات مراحل گردش کار بلافاصله برای تمامی پروژه‌ها و اقدامات ذخیره شده و از این پس اعمال می‌گردد.'
                : 'Workflow stage modifications take effect immediately across all projects and actions.')}
        </span>
      </div>
    </div>
  );
};
