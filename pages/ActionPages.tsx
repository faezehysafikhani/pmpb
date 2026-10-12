

import React, { useState, useContext, useEffect, useMemo, MouseEvent, ReactElement, ChangeEvent } from 'react';
import { LocalizationContext } from '../context';
import { User, Calendar, ActionItem, Project, TranslationKey, WorkStatus } from '../types';
import { getISODateString, formatDate } from '../utils';
import { ActionForm } from '../components/Forms';


export const ActionDefinitionPage = ({ onNavigate, onSaveAction, users, calendars, projects, existingAction, pageContext, setInfoModal, owningUnits, currentUser }: {
    onNavigate: (page: string, context?: any) => void;
    onSaveAction: (action: ActionItem, context?: any) => void;
    users: User[];
    calendars: Calendar[];
    projects: Project[];
    existingAction?: ActionItem | null;
    pageContext?: any;
    setInfoModal: (modal: { title: string, message: string } | null) => void;
    owningUnits: string[];
    currentUser?: User;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const isEditing = !!existingAction;
    const [actionData, setActionData] = useState<Partial<ActionItem>>(
        existingAction || {
            title: '',
            description: '',
            ownerUserId: currentUser?.id,
            responsibleUserId: null,
            status: 'Planning',
            calendarId: (calendars.find(c => c.isDefault) || calendars[0])?.id,
            startDate: getISODateString(),
            endDate: getISODateString(),
            owningUnit: '',
            projectId: pageContext?.relatedProject?.id || undefined,
        }
    );

    useEffect(() => {
        if (existingAction) {
            setActionData({
                ...existingAction
            });
        } else {
             setActionData({
                title: '',
                description: '',
                ownerUserId: currentUser?.id,
                responsibleUserId: currentUser?.id || null,
                status: 'Planning',
                calendarId: (calendars.find(c => c.isDefault) || calendars[0])?.id,
                startDate: getISODateString(),
                endDate: getISODateString(),
                owningUnit: '',
                projectId: pageContext?.relatedProject?.id || undefined,
            });
        }
    }, [existingAction, pageContext?.relatedProject, calendars, currentUser?.id]);

    const handleSave = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (!actionData.title || !actionData.responsibleUserId || !actionData.startDate || !actionData.endDate || !actionData.owningUnit) {
            setInfoModal({ title: t('error'), message: t('fillRequiredFields') });
            return;
        }

        const parseDateDigits = (str?: string) => {
            if (!str) return 0;
            return parseInt(str.replace(/[^\d]/g, ''), 10) || 0;
        };
        const startVal = parseDateDigits(actionData.startDate);
        const endVal = parseDateDigits(actionData.endDate);

        if (startVal > 0 && endVal > 0 && endVal <= startVal) {
            const shamsiStart = formatDate(actionData.startDate, 'fa');
            const shamsiEnd = formatDate(actionData.endDate, 'fa');
            setInfoModal({ 
                title: t('error'), 
                message: language === 'fa' 
                    ? `تاریخ پایان اقدام (${shamsiEnd}) باید حتماً بعد از تاریخ شروع اقدام (${shamsiStart}) باشد.`
                    : `Action end date (${shamsiEnd}) must be strictly after start date (${shamsiStart}).`
            });
            return;
        }

        const finalActionData: ActionItem = {
            id: actionData.id || Date.now(),
            ...actionData,
            ownerUserId: actionData.ownerUserId || currentUser?.id || 1,
            approver1Id: actionData.approver1Id || actionData.responsibleUserId || null,
        } as ActionItem;

        onSaveAction(finalActionData, pageContext);
    };

    const isProjectLocked = !!pageContext?.relatedProject;

    return (
        React.createElement("div", { className: "content-container" },
            React.createElement("div", { className: "page-header" },
                React.createElement("h2", null, isEditing ? t('edit') : t('defineAction'))
            ),
            React.createElement("div", { className: "tab-content", style: { marginTop: '1rem' } },
                React.createElement(ActionForm, { 
                    actionData: actionData, 
                    setActionData: setActionData, 
                    users: users, 
                    calendars: calendars, 
                    projects: projects, 
                    owningUnits: owningUnits, 
                    currentUser: currentUser, 
                    isProjectLocked: isProjectLocked 
                })
            ),
             React.createElement("div", { className: "project-details-footer" },
                 React.createElement("button", { onClick: (e) => handleSave(e), className: "save-btn" } as React.HTMLAttributes<HTMLButtonElement>,
                    React.createElement("span", { className: "material-symbols-outlined" }, "save"),
                    isEditing ? t('update') : t('saveInformation')
                 )
            )
        )
    );
};