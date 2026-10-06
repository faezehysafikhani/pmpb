import React, { useState, useContext, FormEvent, ChangeEvent, ReactElement } from 'react';
import { LocalizationContext } from '../context';
import { ThemeContext } from '../context';
import { Project, ProjectContract, ContractAmendment, ProjectInvoice, User } from '../types';
import { toPersianDigits, toEnglishDigits, formatDate } from '../utils';
import { ShamsiDatePicker } from './ShamsiDatePicker';

// Helper for formatting numeric amounts with 3-digit thousand separators
export function formatCurrencyAmount(amount?: number | string | null, isFa: boolean = true): string {
    if (amount === undefined || amount === null || amount === '') return isFa ? '۰' : '0';
    const cleaned = typeof amount === 'string' ? toEnglishDigits(amount).replace(/[^0-9.-]/g, '') : amount;
    const num = Number(cleaned);
    if (isNaN(num)) return isFa ? '۰' : '0';
    const formatted = num.toLocaleString('en-US');
    return isFa ? toPersianDigits(formatted) : formatted;
}

// Helper to format input value with 3-digit thousand separators for live input fields
export function formatAmountInputDisplay(val: number | string | undefined | null, isFa: boolean = true): string {
    if (val === undefined || val === null || val === '') return '';
    const cleaned = toEnglishDigits(String(val)).replace(/[^0-9]/g, '');
    if (!cleaned) return '';
    const num = Number(cleaned);
    if (isNaN(num)) return '';
    const formatted = num.toLocaleString('en-US');
    return isFa ? toPersianDigits(formatted) : formatted;
}

// Helper to extract clean digit string from formatted input
export function parseAmountInput(val: string): string {
    return toEnglishDigits(val).replace(/[^0-9]/g, '');
}

// ----------------------------------------------------
// CONTRACT MODAL (With Master-Detail Amendments)
// ----------------------------------------------------
export const ContractModal = ({
    isOpen,
    onClose,
    onSave,
    contract,
    isEditing = false
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (contractData: ProjectContract) => void;
    contract?: ProjectContract | null;
    isEditing?: boolean;
}): ReactElement | null => {
    const { t, language } = useContext(LocalizationContext);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';
    const isFa = language === 'fa';

    const [contractNumber, setContractNumber] = useState(contract?.contractNumber || '');
    const [title, setTitle] = useState(contract?.title || '');
    const [startDate, setStartDate] = useState(contract?.startDate || '');
    const [endDate, setEndDate] = useState(contract?.endDate || '');
    const [amount, setAmount] = useState<number | string>(contract?.amount ?? '');
    const [contractorName, setContractorName] = useState(contract?.contractorName || '');
    const [supervisorName, setSupervisorName] = useState(contract?.supervisorName || '');
    const [beneficiaryName, setBeneficiaryName] = useState(contract?.beneficiaryName || '');
    const [description, setDescription] = useState(contract?.description || '');
    const [amendments, setAmendments] = useState<ContractAmendment[]>(contract?.amendments || []);

    // State for adding / editing an amendment inline
    const [isAddingAmendment, setIsAddingAmendment] = useState(false);
    const [editingAmendmentId, setEditingAmendmentId] = useState<number | null>(null);
    const [amendmentStartDate, setAmendmentStartDate] = useState('');
    const [amendmentEndDate, setAmendmentEndDate] = useState('');
    const [amendmentAmount, setAmendmentAmount] = useState<number | string>('');
    const [amendmentDescription, setAmendmentDescription] = useState('');

    if (!isOpen) return null;

    // Calculate next amendment number automatically
    const getNextAmendmentNumber = (): number => {
        if (amendments.length === 0) return 1;
        const maxNum = Math.max(...amendments.map(a => a.amendmentNumber || 0));
        return maxNum + 1;
    };

    const handleOpenAddAmendment = () => {
        setEditingAmendmentId(null);
        setAmendmentStartDate(endDate || startDate || '');
        setAmendmentEndDate(endDate || '');
        setAmendmentAmount('');
        setAmendmentDescription('');
        setIsAddingAmendment(true);
    };

    const handleOpenEditAmendment = (amend: ContractAmendment) => {
        setEditingAmendmentId(amend.id);
        setAmendmentStartDate(amend.startDate || '');
        setAmendmentEndDate(amend.endDate || '');
        setAmendmentAmount(amend.amount ?? '');
        setAmendmentDescription(amend.description || '');
        setIsAddingAmendment(true);
    };

    const handleSaveAmendment = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!amendmentStartDate || !amendmentEndDate || amendmentAmount === '') {
            alert(isFa ? 'لطفاً تاریخ شروع، پایان و مبلغ الحاقیه را وارد نمایید.' : 'Please fill all required amendment fields.');
            return;
        }

        const numAmount = Number(amendmentAmount) || 0;

        if (editingAmendmentId) {
            // Edit existing
            setAmendments(prev => prev.map(a => a.id === editingAmendmentId ? {
                ...a,
                startDate: amendmentStartDate,
                endDate: amendmentEndDate,
                amount: numAmount,
                description: amendmentDescription
            } : a));
        } else {
            // Add new with auto-generated amendment number
            const nextNum = getNextAmendmentNumber();
            const newAmendment: ContractAmendment = {
                id: Date.now(),
                amendmentNumber: nextNum,
                startDate: amendmentStartDate,
                endDate: amendmentEndDate,
                amount: numAmount,
                description: amendmentDescription
            };
            setAmendments(prev => [...prev, newAmendment]);
        }

        setIsAddingAmendment(false);
        setEditingAmendmentId(null);
    };

    const handleDeleteAmendment = (id: number) => {
        if (window.confirm(isFa ? 'آیا از حذف این الحاقیه اطمینان دارید؟' : 'Are you sure you want to delete this amendment?')) {
            setAmendments(prev => prev.filter(a => a.id !== id));
        }
    };

    const baseAmountNum = Number(amount) || 0;
    const totalAmendmentsAmount = amendments.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const grandTotalAmount = baseAmountNum + totalAmendmentsAmount;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!contractNumber.trim() || !title.trim() || !startDate || !endDate || amount === '') {
            alert(isFa ? 'لطفاً تمامی فیلدهای الزامی قرارداد را تکمیل نمایید.' : 'Please fill all required contract fields.');
            return;
        }

        const savedContract: ProjectContract = {
            id: contract?.id || Date.now(),
            contractNumber: contractNumber.trim(),
            title: title.trim(),
            startDate,
            endDate,
            amount: Number(amount) || 0,
            contractorName: contractorName.trim(),
            supervisorName: supervisorName.trim(),
            beneficiaryName: beneficiaryName.trim(),
            description: description.trim(),
            amendments: amendments,
            submittedBy: contract?.submittedBy
        };

        onSave(savedContract);
        onClose();
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", {
                className: "modal-content",
                onClick: (e) => e.stopPropagation(),
                style: { maxWidth: '820px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }
            },
                React.createElement("form", { onSubmit: handleSubmit },
                    React.createElement("div", { className: "modal-header" },
                        React.createElement("h3", { style: { margin: 0 } }, isEditing ? (isFa ? 'ویرایش اطلاعات قرارداد' : 'Edit Contract Information') : (isFa ? 'ثبت قرارداد جدید' : 'New Contract Information')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "modal-close-button" },
                            React.createElement("span", { className: "material-symbols-outlined" }, "close")
                        )
                    ),

                    React.createElement("div", { className: "modal-body", style: { display: 'flex', flexDirection: 'column', gap: '1.25rem' } },
                        // Main Contract Fields Grid
                        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' } },
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "contract-num", style: { fontWeight: 600 } },
                                    isFa ? 'شماره قرارداد *' : 'Contract Number *'
                                ),
                                React.createElement("input", {
                                    type: "text",
                                    id: "contract-num",
                                    value: contractNumber,
                                    onChange: (e) => setContractNumber(e.target.value),
                                    placeholder: isFa ? 'مثال: ۱۴۰۲/۹۸-ص' : 'e.g. CNT-2024-001',
                                    required: true
                                })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "contract-title", style: { fontWeight: 600 } },
                                    isFa ? 'عنوان قرارداد *' : 'Contract Title *'
                                ),
                                React.createElement("input", {
                                    type: "text",
                                    id: "contract-title",
                                    value: title,
                                    onChange: (e) => setTitle(e.target.value),
                                    placeholder: isFa ? 'عنوان کامل قرارداد' : 'Full contract title',
                                    required: true
                                })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "contract-start", style: { fontWeight: 600 } },
                                    isFa ? 'تاریخ شروع قرارداد *' : 'Start Date *'
                                ),
                                React.createElement(ShamsiDatePicker, {
                                    id: "contract-start",
                                    name: "startDate",
                                    value: startDate,
                                    onChange: (val: string) => setStartDate(val),
                                    required: true
                                })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "contract-end", style: { fontWeight: 600 } },
                                    isFa ? 'تاریخ پایان قرارداد *' : 'End Date *'
                                ),
                                React.createElement(ShamsiDatePicker, {
                                    id: "contract-end",
                                    name: "endDate",
                                    value: endDate,
                                    onChange: (val: string) => setEndDate(val),
                                    required: true
                                })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "contract-amount", style: { fontWeight: 600 } },
                                    isFa ? 'مبلغ قرارداد (ریال / تومان) *' : 'Contract Amount *'
                                ),
                                React.createElement("input", {
                                    type: "text",
                                    inputMode: "numeric",
                                    id: "contract-amount",
                                    value: formatAmountInputDisplay(amount, isFa),
                                    onChange: (e) => setAmount(parseAmountInput(e.target.value)),
                                    placeholder: isFa ? 'مثال: ۵۰۰,۰۰۰,۰۰۰' : 'e.g. 500,000,000',
                                    required: true,
                                    style: { fontFamily: 'Vazirmatn, Tahoma, sans-serif' }
                                }),
                                amount !== '' && React.createElement("span", { style: { fontSize: '0.75rem', color: '#0284c7', marginTop: '0.2rem', display: 'block' } },
                                    `${isFa ? 'مبلغ با جداکننده سه‌رقمی:' : 'Formatted Amount:'} ${formatCurrencyAmount(amount, isFa)}`
                                )
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "contractor-name", style: { fontWeight: 600 } },
                                    isFa ? 'نام پیمانکار' : 'Contractor Name'
                                ),
                                React.createElement("input", {
                                    type: "text",
                                    id: "contractor-name",
                                    value: contractorName,
                                    onChange: (e) => setContractorName(e.target.value),
                                    placeholder: isFa ? 'نام شرکت یا شخص پیمانکار' : 'Contractor company or individual'
                                })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "supervisor-name", style: { fontWeight: 600 } },
                                    isFa ? 'نام ناظر' : 'Supervisor Name'
                                ),
                                React.createElement("input", {
                                    type: "text",
                                    id: "supervisor-name",
                                    value: supervisorName,
                                    onChange: (e) => setSupervisorName(e.target.value),
                                    placeholder: isFa ? 'نام مهندس یا دستگاه نظارت' : 'Supervisor or inspection agency'
                                })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "beneficiary-name", style: { fontWeight: 600 } },
                                    isFa ? 'نام بهره‌بردار' : 'Beneficiary Name'
                                ),
                                React.createElement("input", {
                                    type: "text",
                                    id: "beneficiary-name",
                                    value: beneficiaryName,
                                    onChange: (e) => setBeneficiaryName(e.target.value),
                                    placeholder: isFa ? 'واحد یا سازمان بهره‌بردار' : 'Beneficiary unit / organization'
                                })
                            )
                        ),

                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "contract-desc" }, isFa ? 'شرح و توضیحات قرارداد' : 'Contract Description'),
                            React.createElement("textarea", {
                                id: "contract-desc",
                                value: description,
                                onChange: (e) => setDescription(e.target.value),
                                rows: 2,
                                placeholder: isFa ? 'توضیحات تکمیلی پیرامون موضوع، تضمین‌ها یا تعهدات...' : 'Additional notes regarding scope or conditions...'
                            })
                        ),

                        // MASTER-DETAIL SECTION: Contract Amendments (الحاقیه‌ها)
                        React.createElement("div", {
                            style: {
                                marginTop: '0.5rem',
                                padding: '1rem',
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                                border: '1px solid var(--border-color, #e2e8f0)',
                                borderRadius: '10px'
                            }
                        },
                            React.createElement("div", {
                                style: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.75rem',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem'
                                }
                            },
                                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
                                    React.createElement("span", { className: "material-symbols-outlined", style: { color: '#f59e0b', fontSize: '1.3rem' } }, "post_add"),
                                    React.createElement("h4", { style: { margin: 0, fontSize: '0.95rem', fontWeight: 700 } },
                                        isFa ? 'اطلاعات الحاقیه‌های قرارداد' : 'Contract Addendums / Amendments'
                                    ),
                                    amendments.length > 0 && React.createElement("span", {
                                        style: {
                                            backgroundColor: '#f59e0b',
                                            color: '#ffffff',
                                            fontSize: '0.7rem',
                                            padding: '2px 7px',
                                            borderRadius: '9999px',
                                            fontWeight: 700
                                        }
                                    }, isFa ? `${toPersianDigits(amendments.length)} الحاقیه` : `${amendments.length} Amendments`)
                                ),
                                !isAddingAmendment && React.createElement("button", {
                                    type: "button",
                                    onClick: handleOpenAddAmendment,
                                    style: {
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0.35rem 0.75rem',
                                        backgroundColor: '#0284c7',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }
                                },
                                    React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1rem' } }, "add"),
                                    isFa ? 'افزودن الحاقیه جدید' : 'Add New Amendment'
                                )
                            ),

                            // Inline Form to Add/Edit Amendment
                            isAddingAmendment && React.createElement("div", {
                                style: {
                                    padding: '1rem',
                                    marginBottom: '1rem',
                                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                                    border: '1px solid #fcd34d',
                                    borderRadius: '8px'
                                }
                            },
                                React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' } },
                                    React.createElement("h5", { style: { margin: 0, fontSize: '0.88rem', fontWeight: 700, color: isDark ? '#fbbf24' : '#b45309' } },
                                        editingAmendmentId
                                            ? (isFa ? 'ویرایش الحاقیه' : 'Edit Amendment')
                                            : (isFa ? `ثبت الحاقیه شماره ${toPersianDigits(getNextAmendmentNumber())} (شماره خودکار)` : `Add Amendment #${getNextAmendmentNumber()} (Auto-numbered)`)
                                    ),
                                    React.createElement("button", {
                                        type: "button",
                                        onClick: () => setIsAddingAmendment(false),
                                        style: { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }
                                    }, React.createElement("span", { className: "material-symbols-outlined" }, "close"))
                                ),
                                React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' } },
                                    React.createElement("div", { className: "form-group" },
                                        React.createElement("label", { style: { fontSize: '0.8rem' } }, isFa ? 'تاریخ شروع الحاقیه *' : 'Start Date *'),
                                        React.createElement(ShamsiDatePicker, {
                                            id: "amendment-start",
                                            name: "amendmentStartDate",
                                            value: amendmentStartDate,
                                            onChange: (val: string) => setAmendmentStartDate(val)
                                        })
                                    ),
                                    React.createElement("div", { className: "form-group" },
                                        React.createElement("label", { style: { fontSize: '0.8rem' } }, isFa ? 'تاریخ پایان الحاقیه *' : 'End Date *'),
                                        React.createElement(ShamsiDatePicker, {
                                            id: "amendment-end",
                                            name: "amendmentEndDate",
                                            value: amendmentEndDate,
                                            onChange: (val: string) => setAmendmentEndDate(val)
                                        })
                                    ),
                                    React.createElement("div", { className: "form-group" },
                                        React.createElement("label", { style: { fontSize: '0.8rem' } }, isFa ? 'مبلغ الحاقیه (افزایش/کاهش) *' : 'Amendment Amount *'),
                                        React.createElement("input", {
                                            type: "text",
                                            inputMode: "numeric",
                                            value: formatAmountInputDisplay(amendmentAmount, isFa),
                                            onChange: (e) => setAmendmentAmount(parseAmountInput(e.target.value)),
                                            placeholder: isFa ? 'مثال: ۵۰,۰۰۰,۰۰۰' : 'e.g. 50,000,000',
                                            style: { padding: '0.4rem', fontSize: '0.85rem', fontFamily: 'Vazirmatn, Tahoma, sans-serif' }
                                        }),
                                        amendmentAmount !== '' && React.createElement("span", { style: { fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.15rem', display: 'block' } },
                                            formatCurrencyAmount(amendmentAmount, isFa)
                                        )
                                    )
                                ),
                                React.createElement("div", { className: "form-group", style: { marginTop: '0.5rem' } },
                                    React.createElement("label", { style: { fontSize: '0.8rem' } }, isFa ? 'شرح و موضوع الحاقیه' : 'Amendment Description'),
                                    React.createElement("input", {
                                        type: "text",
                                        value: amendmentDescription,
                                        onChange: (e) => setAmendmentDescription(e.target.value),
                                        placeholder: isFa ? 'شرح تمدید مدت، تغییر احجام کار، تعدیل نرخ و...' : 'Scope change, duration extension, price adjustment...',
                                        style: { padding: '0.4rem', fontSize: '0.85rem' }
                                    })
                                ),
                                React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' } },
                                    React.createElement("button", {
                                        type: "button",
                                        onClick: () => setIsAddingAmendment(false),
                                        style: { padding: '0.35rem 0.75rem', backgroundColor: 'transparent', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }
                                    }, isFa ? 'انصراف' : 'Cancel'),
                                    React.createElement("button", {
                                        type: "button",
                                        onClick: handleSaveAmendment,
                                        style: { padding: '0.35rem 0.85rem', backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }
                                    }, isFa ? 'ذخیره الحاقیه' : 'Save Amendment')
                                )
                            ),

                            // Amendments Table
                            amendments.length === 0 ? (
                                React.createElement("p", { style: { margin: 0, fontSize: '0.82rem', color: '#64748b', textAlign: 'center', padding: '0.75rem' } },
                                    isFa ? 'تاکنون هیچ الحاقیه‌ای برای این قرارداد ثبت نشده است.' : 'No amendments registered for this contract yet.'
                                )
                            ) : (
                                React.createElement("div", { className: "table-responsive" },
                                    React.createElement("table", { className: "tab-table", style: { fontSize: '0.82rem', margin: 0 } },
                                        React.createElement("thead", null, React.createElement("tr", null,
                                            React.createElement("th", null, isFa ? 'شماره الحاقیه' : 'Amendment #'),
                                            React.createElement("th", null, isFa ? 'تاریخ شروع' : 'Start Date'),
                                            React.createElement("th", null, isFa ? 'تاریخ پایان' : 'End Date'),
                                            React.createElement("th", null, isFa ? 'مبلغ الحاقیه' : 'Amount'),
                                            React.createElement("th", null, isFa ? 'شرح الحاقیه' : 'Description'),
                                            React.createElement("th", { style: { textAlign: 'center' } }, isFa ? 'عملیات' : 'Actions')
                                        )),
                                        React.createElement("tbody", null,
                                            amendments.map((amend, idx) => (
                                                React.createElement("tr", { key: amend.id || idx },
                                                    React.createElement("td", { style: { fontWeight: 700, color: '#f59e0b' } },
                                                        isFa ? `الحاقیه شماره ${toPersianDigits(amend.amendmentNumber || idx + 1)}` : `Amendment #${amend.amendmentNumber || idx + 1}`
                                                    ),
                                                    React.createElement("td", null, formatDate(amend.startDate, language) || '-'),
                                                    React.createElement("td", null, formatDate(amend.endDate, language) || '-'),
                                                    React.createElement("td", { style: { fontWeight: 600 } },
                                                        formatCurrencyAmount(amend.amount, isFa)
                                                    ),
                                                    React.createElement("td", null, amend.description || '-'),
                                                    React.createElement("td", { style: { textAlign: 'center' } },
                                                        React.createElement("div", { style: { display: 'inline-flex', gap: '4px' } },
                                                            React.createElement("button", {
                                                                type: "button",
                                                                onClick: () => handleOpenEditAmendment(amend),
                                                                className: "action-icon edit",
                                                                title: isFa ? 'ویرایش الحاقیه' : 'Edit'
                                                            }, React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.1rem' } }, "edit")),
                                                            React.createElement("button", {
                                                                type: "button",
                                                                onClick: () => handleDeleteAmendment(amend.id),
                                                                className: "action-icon delete",
                                                                title: isFa ? 'حذف الحاقیه' : 'Delete'
                                                            }, React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: '1.1rem' } }, "delete"))
                                                        )
                                                    )
                                                )
                                            ))
                                        )
                                    )
                                )
                            ),

                            // Total Summary Card inside Contract Modal
                            React.createElement("div", {
                                style: {
                                    marginTop: '0.75rem',
                                    padding: '0.75rem',
                                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff',
                                    border: '1px solid #bae6fd',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                    fontSize: '0.85rem'
                                }
                            },
                                React.createElement("div", null,
                                    React.createElement("span", { style: { color: '#64748b' } }, isFa ? 'مبلغ اولیه قرارداد: ' : 'Base Contract: '),
                                    React.createElement("strong", null, formatCurrencyAmount(baseAmountNum, isFa)),
                                    React.createElement("span", { style: { margin: '0 0.5rem', color: '#cbd5e1' } }, '|'),
                                    React.createElement("span", { style: { color: '#64748b' } }, isFa ? 'مجموع الحاقیه‌ها: ' : 'Amendments: '),
                                    React.createElement("strong", { style: { color: '#f59e0b' } }, formatCurrencyAmount(totalAmendmentsAmount, isFa))
                                ),
                                React.createElement("div", null,
                                    React.createElement("span", { style: { fontWeight: 600 } }, isFa ? 'مبلغ کل نهایی قرارداد: ' : 'Grand Total: '),
                                    React.createElement("strong", { style: { fontSize: '1rem', color: '#0284c7' } }, formatCurrencyAmount(grandTotalAmount, isFa))
                                )
                            )
                        )
                    ),

                    React.createElement("div", { className: "modal-footer" },
                        React.createElement("button", { type: "button", onClick: onClose, className: "action-button cancel" }, t('cancel')),
                        React.createElement("button", { type: "submit", className: "action-button primary" }, isEditing ? t('update') : t('save'))
                    )
                )
            )
        )
    );
};


// ----------------------------------------------------
// INVOICE MODAL (With Linked Contract Selection)
// ----------------------------------------------------
export const InvoiceModal = ({
    isOpen,
    onClose,
    onSave,
    invoice,
    contracts = [],
    isEditing = false
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (invoiceData: ProjectInvoice) => void;
    invoice?: ProjectInvoice | null;
    contracts?: ProjectContract[];
    isEditing?: boolean;
}): ReactElement | null => {
    const { t, language } = useContext(LocalizationContext);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';
    const isFa = language === 'fa';

    const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber || '');
    const [title, setTitle] = useState(invoice?.title || '');
    const [startDate, setStartDate] = useState(invoice?.startDate || '');
    const [endDate, setEndDate] = useState(invoice?.endDate || '');
    const [amount, setAmount] = useState<number | string>(invoice?.amount ?? '');
    const [contractId, setContractId] = useState<number | ''>(invoice?.contractId ?? (contracts[0]?.id ?? ''));
    const [description, setDescription] = useState(invoice?.description || '');

    if (!isOpen) return null;

    const selectedContract = contracts.find(c => Number(c.id) === Number(contractId));

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!invoiceNumber.trim() || !title.trim() || !startDate || !endDate || amount === '') {
            alert(isFa ? 'لطفاً تمامی فیلدهای الزامی صورتحساب را پر کنید.' : 'Please fill all required invoice fields.');
            return;
        }

        const savedInvoice: ProjectInvoice = {
            id: invoice?.id || Date.now(),
            invoiceNumber: invoiceNumber.trim(),
            title: title.trim(),
            startDate,
            endDate,
            amount: Number(amount) || 0,
            contractId: contractId ? Number(contractId) : undefined,
            contractTitle: selectedContract ? selectedContract.title : undefined,
            description: description.trim(),
            submittedBy: invoice?.submittedBy
        };

        onSave(savedInvoice);
        onClose();
    };

    return (
        React.createElement("div", { className: "modal-overlay", onClick: onClose },
            React.createElement("div", {
                className: "modal-content",
                onClick: (e) => e.stopPropagation(),
                style: { maxWidth: '680px', width: '95%' }
            },
                React.createElement("form", { onSubmit: handleSubmit },
                    React.createElement("div", { className: "modal-header" },
                        React.createElement("h3", { style: { margin: 0 } }, isEditing ? (isFa ? 'ویرایش صورتحساب' : 'Edit Invoice') : (isFa ? 'ثبت صورتحساب جدید' : 'New Invoice')),
                        React.createElement("button", { type: "button", onClick: onClose, className: "modal-close-button" },
                            React.createElement("span", { className: "material-symbols-outlined" }, "close")
                        )
                    ),

                    React.createElement("div", { className: "modal-body", style: { display: 'flex', flexDirection: 'column', gap: '1rem' } },
                        // Contract Combo Box (کمبوباکس عنوان قرارداد بر اساس اطلاعات در تب قرارداد همان پروژه)
                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "invoice-contract", style: { fontWeight: 600 } },
                                isFa ? 'قرارداد مربوطه (انتخاب از اطلاعات قراردادهای پروژه)' : 'Related Contract'
                            ),
                            React.createElement("select", {
                                id: "invoice-contract",
                                value: contractId,
                                onChange: (e) => setContractId(e.target.value ? Number(e.target.value) : ''),
                                className: "form-control",
                                style: { width: '100%', padding: '0.6rem' }
                            },
                                React.createElement("option", { value: "" }, isFa ? '-- بدون قرارداد مستقیم / عمومی --' : '-- No Direct Contract --'),
                                contracts.map(c => (
                                    React.createElement("option", { key: c.id, value: c.id },
                                        `${c.contractNumber ? `[${c.contractNumber}] ` : ''}${c.title}${c.contractorName ? ` (${c.contractorName})` : ''}`
                                    )
                                ))
                            ),
                            selectedContract && React.createElement("div", {
                                style: {
                                    marginTop: '0.35rem',
                                    fontSize: '0.78rem',
                                    color: '#059669',
                                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '6px'
                                }
                            },
                                `${isFa ? 'مبلغ قرارداد انتخاب‌شده:' : 'Selected Contract Total:'} ${formatCurrencyAmount(
                                    (Number(selectedContract.amount) || 0) + (selectedContract.amendments || []).reduce((s, a) => s + (Number(a.amount) || 0), 0),
                                    isFa
                                )}`
                            )
                        ),

                        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' } },
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "invoice-num", style: { fontWeight: 600 } },
                                    isFa ? 'شماره صورتحساب *' : 'Invoice Number *'
                                ),
                                React.createElement("input", {
                                    type: "text",
                                    id: "invoice-num",
                                    value: isFa ? toPersianDigits(invoiceNumber) : invoiceNumber,
                                    onChange: (e) => setInvoiceNumber(toEnglishDigits(e.target.value)),
                                    placeholder: isFa ? 'مثال: INV-001 یا ص/۱۴۰۲/۰۱' : 'e.g. INV-2024-001',
                                    required: true,
                                    style: { fontFamily: 'Vazirmatn, Tahoma, sans-serif' }
                                })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "invoice-title", style: { fontWeight: 600 } },
                                    isFa ? 'عنوان صورتحساب *' : 'Invoice Title *'
                                ),
                                React.createElement("input", {
                                    type: "text",
                                    id: "invoice-title",
                                    value: title,
                                    onChange: (e) => setTitle(e.target.value),
                                    placeholder: isFa ? 'مثال: صورت وضعیت موقت شماره ۱' : 'e.g. Interim Invoice #1',
                                    required: true
                                })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "invoice-start", style: { fontWeight: 600 } },
                                    isFa ? 'تاریخ شروع دوره صورتحساب *' : 'Period Start Date *'
                                ),
                                React.createElement(ShamsiDatePicker, {
                                    id: "invoice-start",
                                    name: "startDate",
                                    value: startDate,
                                    onChange: (val: string) => setStartDate(val),
                                    required: true
                                })
                            ),
                            React.createElement("div", { className: "form-group" },
                                React.createElement("label", { htmlFor: "invoice-end", style: { fontWeight: 600 } },
                                    isFa ? 'تاریخ پایان دوره صورتحساب *' : 'Period End Date *'
                                ),
                                React.createElement(ShamsiDatePicker, {
                                    id: "invoice-end",
                                    name: "endDate",
                                    value: endDate,
                                    onChange: (val: string) => setEndDate(val),
                                    required: true
                                })
                            ),
                            React.createElement("div", { className: "form-group", style: { gridColumn: '1 / -1' } },
                                React.createElement("label", { htmlFor: "invoice-amount", style: { fontWeight: 600 } },
                                    isFa ? 'مبلغ صورتحساب (ریال / تومان) *' : 'Invoice Amount *'
                                ),
                                React.createElement("input", {
                                    type: "text",
                                    inputMode: "numeric",
                                    id: "invoice-amount",
                                    value: formatAmountInputDisplay(amount, isFa),
                                    onChange: (e) => setAmount(parseAmountInput(e.target.value)),
                                    placeholder: isFa ? 'مثال: ۷۵,۰۰۰,۰۰۰' : 'e.g. 75,000,000',
                                    required: true,
                                    style: { fontFamily: 'Vazirmatn, Tahoma, sans-serif' }
                                }),
                                amount !== '' && React.createElement("span", { style: { fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem', display: 'block' } },
                                    `${isFa ? 'مبلغ با جداکننده سه‌رقمی:' : 'Formatted Amount:'} ${formatCurrencyAmount(amount, isFa)}`
                                )
                            )
                        ),

                        React.createElement("div", { className: "form-group" },
                            React.createElement("label", { htmlFor: "invoice-desc" }, isFa ? 'شرح و توضیحات صورتحساب' : 'Invoice Description'),
                            React.createElement("textarea", {
                                id: "invoice-desc",
                                value: description,
                                onChange: (e) => setDescription(e.target.value),
                                rows: 2,
                                placeholder: isFa ? 'توضیحات مربوط به کارکرد، پیش‌پرداخت، علی‌الحساب، کسورات و...' : 'Details regarding work completed, deductions, advances...'
                            })
                        )
                    ),

                    React.createElement("div", { className: "modal-footer" },
                        React.createElement("button", { type: "button", onClick: onClose, className: "action-button cancel" }, t('cancel')),
                        React.createElement("button", { type: "submit", className: "action-button primary" }, isEditing ? t('update') : t('save'))
                    )
                )
            )
        )
    );
};


// ----------------------------------------------------
// PROJECT CONTRACTS TAB COMPONENT
// ----------------------------------------------------
export const ProjectContractsTab = ({
    contracts = [],
    project,
    onUpdateContracts,
    isReadOnly = false,
    currentUser,
    isModalOpen: externalIsModalOpen,
    onCloseModal: externalOnCloseModal,
    onOpenAddModal: externalOnOpenAddModal,
    editingContract: externalEditingContract,
    onEditContract: externalOnEditContract
}: {
    contracts?: ProjectContract[];
    project: Project;
    onUpdateContracts: (newContracts: ProjectContract[]) => void;
    isReadOnly?: boolean;
    currentUser?: User | null;
    isModalOpen?: boolean;
    onCloseModal?: () => void;
    onOpenAddModal?: () => void;
    editingContract?: ProjectContract | null;
    onEditContract?: (c: ProjectContract | null) => void;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';
    const isFa = language === 'fa';

    const [internalIsModalOpen, setInternalIsModalOpen] = useState(false);
    const [internalEditingContract, setInternalEditingContract] = useState<ProjectContract | null>(null);
    const [expandedContractIds, setExpandedContractIds] = useState<Record<number, boolean>>({});
    const [searchTerm, setSearchTerm] = useState('');

    const isModalOpen = externalIsModalOpen !== undefined ? externalIsModalOpen : internalIsModalOpen;
    const editingContract = externalEditingContract !== undefined ? externalEditingContract : internalEditingContract;

    const closeModal = () => {
        if (externalOnCloseModal) externalOnCloseModal();
        setInternalIsModalOpen(false);
    };

    const toggleExpand = (contractId: number) => {
        setExpandedContractIds(prev => ({
            ...prev,
            [contractId]: !prev[contractId]
        }));
    };

    const handleOpenAdd = () => {
        if (externalOnOpenAddModal) {
            externalOnOpenAddModal();
        } else {
            setInternalEditingContract(null);
            setInternalIsModalOpen(true);
        }
    };

    const handleOpenEdit = (c: ProjectContract) => {
        if (externalOnEditContract) {
            externalOnEditContract(c);
        } else {
            setInternalEditingContract(c);
            setInternalIsModalOpen(true);
        }
    };

    const handleDelete = (id: number) => {
        if (window.confirm(isFa ? 'آیا از حذف این قرارداد و تمامی الحاقیه‌های آن اطمینان دارید؟' : 'Are you sure you want to delete this contract and its amendments?')) {
            const updated = contracts.filter(c => c.id !== id);
            onUpdateContracts(updated);
        }
    };

    const handleSaveContract = (savedContract: ProjectContract) => {
        if (editingContract) {
            const updated = contracts.map(c => c.id === savedContract.id ? savedContract : c);
            onUpdateContracts(updated);
        } else {
            const updated = [...contracts, savedContract];
            onUpdateContracts(updated);
        }
    };

    const filteredContracts = contracts.filter(c => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (c.contractNumber && c.contractNumber.toLowerCase().includes(q)) ||
               (c.title && c.title.toLowerCase().includes(q)) ||
               (c.contractorName && c.contractorName.toLowerCase().includes(q)) ||
               (c.supervisorName && c.supervisorName.toLowerCase().includes(q));
    });

    // Summary calculations
    const totalBaseAmount = contracts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const totalAmendmentsAmount = contracts.reduce((sum, c) => {
        return sum + (c.amendments || []).reduce((aSum, a) => aSum + (Number(a.amount) || 0), 0);
    }, 0);
    const grandTotal = totalBaseAmount + totalAmendmentsAmount;

    return (
        <div className="project-contracts-tab">
            {isModalOpen && (
                <ContractModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    onSave={handleSaveContract}
                    contract={editingContract}
                    isEditing={!!editingContract}
                />
            )}

            <div className="tab-section-header" style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: 0 }}>{isFa ? 'اطلاعات قراردادها و الحاقیه‌ها' : 'Contracts & Amendments Information'}</h4>
            </div>

            {contracts.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.85rem',
                    marginBottom: '1.25rem'
                }}>
                    <div style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                        border: '1px solid var(--border-color, #e2e8f0)'
                    }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.25rem' }}>
                            {isFa ? 'مجموع مبالغ اولیه قراردادها' : 'Total Base Contracts'}
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isDark ? '#38bdf8' : '#0284c7' }}>
                            {formatCurrencyAmount(totalBaseAmount, isFa)}
                        </div>
                    </div>
                    <div style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                        border: '1px solid var(--border-color, #e2e8f0)'
                    }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.25rem' }}>
                            {isFa ? 'مجموع مبالغ الحاقیه‌ها' : 'Total Amendments'}
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>
                            {formatCurrencyAmount(totalAmendmentsAmount, isFa)}
                        </div>
                    </div>
                    <div style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                        border: '1px solid var(--border-color, #e2e8f0)'
                    }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.25rem' }}>
                            {isFa ? 'مجموع کل نهایی تعهدات' : 'Grand Total Commitments'}
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                            {formatCurrencyAmount(grandTotal, isFa)}
                        </div>
                    </div>
                </div>
            )}

            {/* Search and Filters Header */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '1rem',
                alignItems: 'center',
                flexWrap: 'wrap'
            }}>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={isFa ? 'جستجو در شماره، عنوان، پیمانکار یا ناظر قرارداد...' : 'Search contracts by number, title, contractor...'}
                    style={{
                        flex: '1',
                        minWidth: '240px',
                        maxWidth: '400px',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.78rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color, #cbd5e1)',
                        backgroundColor: 'var(--card-bg-color, #ffffff)'
                    }}
                />
            </div>

            {/* Contracts Grid Table - ALWAYS RENDERED */}
            <div className="table-responsive">
                <table className="tab-table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '40px', fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'ردیف' : '#'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'شماره قرارداد' : 'Contract #'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'عنوان قرارداد' : 'Title'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'پیمانکار' : 'Contractor'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'ناظر' : 'Supervisor'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'بهره‌بردار' : 'Beneficiary'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'بازه زمانی' : 'Dates'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'مبلغ قرارداد' : 'Amount'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'الحاقیه‌ها' : 'Amendments'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'مبلغ کل نهایی' : 'Final Total'}</th>
                            <th style={{ textAlign: 'center', width: '80px', fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'عملیات' : 'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredContracts.length === 0 ? (
                            <tr>
                                <td colSpan={11} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>
                                    {isFa ? 'هیچ قراردادی برای این پروژه ثبت نشده است.' : 'No contracts recorded for this project yet.'}
                                </td>
                            </tr>
                        ) : (
                            filteredContracts.map((c, idx) => {
                                const cAmendments = c.amendments || [];
                                const isExpanded = !expandedContractIds[c.id];
                                const amendSum = cAmendments.reduce((s, a) => s + (Number(a.amount) || 0), 0);
                                const contractGrand = (Number(c.amount) || 0) + amendSum;

                                return (
                                    <React.Fragment key={c.id}>
                                        <tr style={{
                                            backgroundColor: isExpanded ? (isDark ? 'rgba(2, 132, 199, 0.1)' : '#f0f9ff') : undefined,
                                            fontWeight: isExpanded ? 600 : undefined
                                        }}>
                                            <td style={{ padding: '0.45rem 0.6rem' }}>{isFa ? toPersianDigits(idx + 1) : (idx + 1)}</td>
                                            <td style={{ fontWeight: 700, color: '#0284c7', padding: '0.45rem 0.6rem' }}>{c.contractNumber}</td>
                                            <td style={{ fontWeight: 600, padding: '0.45rem 0.6rem' }}>{c.title}</td>
                                            <td style={{ padding: '0.45rem 0.6rem' }}>{c.contractorName || '-'}</td>
                                            <td style={{ padding: '0.45rem 0.6rem' }}>{c.supervisorName || '-'}</td>
                                            <td style={{ padding: '0.45rem 0.6rem' }}>{c.beneficiaryName || '-'}</td>
                                            <td style={{ fontSize: '0.74rem', padding: '0.45rem 0.6rem' }}>
                                                {formatDate(c.startDate, language)} {isFa ? 'تا' : 'to'} {formatDate(c.endDate, language)}
                                            </td>
                                            <td style={{ padding: '0.45rem 0.6rem' }}>{formatCurrencyAmount(c.amount, isFa)}</td>
                                            <td style={{ padding: '0.45rem 0.6rem' }}>
                                                {cAmendments.length > 0 ? (
                                                    <div
                                                        onClick={() => toggleExpand(c.id)}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            cursor: 'pointer'
                                                        }}
                                                        title={isExpanded ? (isFa ? 'بستن الحاقیه‌ها' : 'Collapse') : (isFa ? 'مشاهده الحاقیه‌ها' : 'Expand')}
                                                    >
                                                        <span style={{
                                                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
                                                            color: isDark ? '#fde68a' : '#b45309',
                                                            padding: '2px 6px',
                                                            borderRadius: '9999px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 600,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '2px'
                                                        }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>post_add</span>
                                                            {isFa ? `${toPersianDigits(cAmendments.length)} الحاقیه` : `${cAmendments.length} Amendments`}
                                                        </span>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#0284c7' }}>
                                                            {isExpanded ? "expand_less" : "expand_more"}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>{isFa ? 'بدون الحاقیه' : 'None'}</span>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 700, color: '#0369a1', padding: '0.45rem 0.6rem' }}>
                                                {formatCurrencyAmount(contractGrand, isFa)}
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '0.45rem 0.6rem' }}>
                                                <div style={{ display: 'inline-flex', gap: '3px' }}>
                                                    {!isReadOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(c)}
                                                            className="action-icon edit"
                                                            title={isFa ? 'ویرایش و مدیریت الحاقیه‌ها' : 'Edit'}
                                                            style={{ padding: '3px' }}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit</span>
                                                        </button>
                                                    )}
                                                    {!isReadOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(c.id)}
                                                            className="action-icon delete"
                                                            title={isFa ? 'حذف قرارداد' : 'Delete'}
                                                            style={{ padding: '3px' }}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {isExpanded && cAmendments.length > 0 && (
                                            <tr key={`${c.id}-amendments-detail`} style={{ backgroundColor: isDark ? 'rgba(2, 132, 199, 0.05)' : '#f8fafc' }}>
                                                <td colSpan={11} style={{ padding: '0.75rem 1rem', borderBottom: '2px solid #bae6fd' }}>
                                                    <div style={{
                                                        borderRight: isFa ? '3px solid #f59e0b' : undefined,
                                                        borderLeft: !isFa ? '3px solid #f59e0b' : undefined,
                                                        paddingRight: isFa ? '0.75rem' : undefined,
                                                        paddingLeft: !isFa ? '0.75rem' : undefined
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                            <h5 style={{ margin: 0, fontSize: '0.8rem', color: '#b45309', fontWeight: 700 }}>
                                                                {isFa ? `لیست الحاقیه‌های قرارداد «${c.title}»:` : `Addendums for contract: ${c.title}`}
                                                            </h5>
                                                            {!isReadOnly && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenEdit(c)}
                                                                    style={{
                                                                        padding: '2px 6px',
                                                                        fontSize: '0.7rem',
                                                                        backgroundColor: '#f59e0b',
                                                                        color: '#ffffff',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer',
                                                                        fontWeight: 600
                                                                    }}
                                                                >
                                                                    {isFa ? 'مدیریت الحاقیه‌ها' : 'Manage'}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <table className="tab-table" style={{ fontSize: '0.74rem', margin: '0.4rem 0' }}>
                                                            <thead>
                                                                <tr>
                                                                    <th style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem' }}>{isFa ? 'شماره الحاقیه' : 'Addendum #'}</th>
                                                                    <th style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem' }}>{isFa ? 'تاریخ شروع' : 'Start Date'}</th>
                                                                    <th style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem' }}>{isFa ? 'تاریخ پایان' : 'End Date'}</th>
                                                                    <th style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem' }}>{isFa ? 'مبلغ الحاقیه' : 'Amount'}</th>
                                                                    <th style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem' }}>{isFa ? 'شرح و موضوع' : 'Description'}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {cAmendments.map((a, aIdx) => (
                                                                    <tr key={a.id || aIdx}>
                                                                        <td style={{ fontWeight: 700, color: '#f59e0b', padding: '0.35rem 0.5rem' }}>
                                                                            {isFa ? `الحاقیه شماره ${toPersianDigits(a.amendmentNumber || aIdx + 1)}` : `Amendment #${a.amendmentNumber || aIdx + 1}`}
                                                                        </td>
                                                                        <td style={{ padding: '0.35rem 0.5rem' }}>{formatDate(a.startDate, language) || '-'}</td>
                                                                        <td style={{ padding: '0.35rem 0.5rem' }}>{formatDate(a.endDate, language) || '-'}</td>
                                                                        <td style={{ fontWeight: 600, padding: '0.35rem 0.5rem' }}>{formatCurrencyAmount(a.amount, isFa)}</td>
                                                                        <td style={{ padding: '0.35rem 0.5rem' }}>{a.description || '-'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// ----------------------------------------------------
// PROJECT INVOICES TAB COMPONENT
// ----------------------------------------------------
export const ProjectInvoicesTab = ({
    invoices = [],
    contracts = [],
    project,
    onUpdateInvoices,
    isReadOnly = false,
    currentUser,
    isModalOpen: externalIsModalOpen,
    onCloseModal: externalOnCloseModal,
    onOpenAddModal: externalOnOpenAddModal,
    editingInvoice: externalEditingInvoice,
    onEditInvoice: externalOnEditInvoice
}: {
    invoices?: ProjectInvoice[];
    contracts?: ProjectContract[];
    project: Project;
    onUpdateInvoices: (newInvoices: ProjectInvoice[]) => void;
    isReadOnly?: boolean;
    currentUser?: User | null;
    isModalOpen?: boolean;
    onCloseModal?: () => void;
    onOpenAddModal?: () => void;
    editingInvoice?: ProjectInvoice | null;
    onEditInvoice?: (inv: ProjectInvoice | null) => void;
}): ReactElement => {
    const { t, language } = useContext(LocalizationContext);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';
    const isFa = language === 'fa';

    const [internalIsModalOpen, setInternalIsModalOpen] = useState(false);
    const [internalEditingInvoice, setInternalEditingInvoice] = useState<ProjectInvoice | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedContractFilter, setSelectedContractFilter] = useState<number | 'all'>('all');

    const isModalOpen = externalIsModalOpen !== undefined ? externalIsModalOpen : internalIsModalOpen;
    const editingInvoice = externalEditingInvoice !== undefined ? externalEditingInvoice : internalEditingInvoice;

    const closeModal = () => {
        if (externalOnCloseModal) externalOnCloseModal();
        setInternalIsModalOpen(false);
    };

    const handleOpenAdd = () => {
        if (externalOnOpenAddModal) {
            externalOnOpenAddModal();
        } else {
            setInternalEditingInvoice(null);
            setInternalIsModalOpen(true);
        }
    };

    const handleOpenEdit = (inv: ProjectInvoice) => {
        if (externalOnEditInvoice) {
            externalOnEditInvoice(inv);
        } else {
            setInternalEditingInvoice(inv);
            setInternalIsModalOpen(true);
        }
    };

    const handleDelete = (id: number) => {
        if (window.confirm(isFa ? 'آیا از حذف این صورتحساب اطمینان دارید؟' : 'Are you sure you want to delete this invoice?')) {
            const updated = invoices.filter(inv => inv.id !== id);
            onUpdateInvoices(updated);
        }
    };

    const handleSaveInvoice = (savedInvoice: ProjectInvoice) => {
        if (editingInvoice) {
            const updated = invoices.map(inv => inv.id === savedInvoice.id ? savedInvoice : inv);
            onUpdateInvoices(updated);
        } else {
            const updated = [...invoices, savedInvoice];
            onUpdateInvoices(updated);
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        if (selectedContractFilter !== 'all' && inv.contractId !== selectedContractFilter) return false;
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
               (inv.title && inv.title.toLowerCase().includes(q)) ||
               (inv.contractTitle && inv.contractTitle.toLowerCase().includes(q)) ||
               (inv.description && inv.description.toLowerCase().includes(q));
    });

    // Calculations
    const totalInvoicedAmount = invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
    const totalContractsGrandAmount = contracts.reduce((sum, c) => {
        const amend = (c.amendments || []).reduce((aSum, a) => aSum + (Number(a.amount) || 0), 0);
        return sum + (Number(c.amount) || 0) + amend;
    }, 0);

    const invoiceCoveragePercent = totalContractsGrandAmount > 0
        ? Math.min(100, Math.round((totalInvoicedAmount / totalContractsGrandAmount) * 100))
        : 0;

    return (
        <div className="project-invoices-tab">
            {isModalOpen && (
                <InvoiceModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    onSave={handleSaveInvoice}
                    invoice={editingInvoice}
                    contracts={contracts}
                    isEditing={!!editingInvoice}
                />
            )}

            <div className="tab-section-header" style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: 0 }}>{isFa ? 'صورتحساب‌ها و صورت‌وضعیت‌ها' : 'Project Invoices & Billings'}</h4>
            </div>

            {(invoices.length > 0 || contracts.length > 0) && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.85rem',
                    marginBottom: '1.25rem'
                }}>
                    <div style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                        border: '1px solid var(--border-color, #e2e8f0)'
                    }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.25rem' }}>
                            {isFa ? 'مجموع مبالغ صورتحساب‌ها' : 'Total Invoiced Amount'}
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                            {formatCurrencyAmount(totalInvoicedAmount, isFa)}
                        </div>
                    </div>
                    <div style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                        border: '1px solid var(--border-color, #e2e8f0)'
                    }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.25rem' }}>
                            {isFa ? 'مجموع کل تعهدات قراردادها' : 'Total Contracts Value'}
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isDark ? '#38bdf8' : '#0284c7' }}>
                            {formatCurrencyAmount(totalContractsGrandAmount, isFa)}
                        </div>
                    </div>
                    <div style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
                        border: '1px solid var(--border-color, #e2e8f0)'
                    }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.25rem' }}>
                            {isFa ? 'درصد پوشش صورت‌وضعیت‌ها' : 'Billing Coverage'}
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: invoiceCoveragePercent >= 100 ? '#ef4444' : '#f59e0b' }}>
                            {isFa ? `${toPersianDigits(invoiceCoveragePercent)}٪` : `${invoiceCoveragePercent}%`}
                        </div>
                    </div>
                </div>
            )}

            <div style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '1rem',
                flexWrap: 'wrap'
            }}>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={isFa ? 'جستجو در شماره، عنوان یا توضیحات صورتحساب...' : 'Search invoices...'}
                    style={{
                        flex: '1',
                        minWidth: '240px',
                        maxWidth: '350px',
                        padding: '0.55rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #cbd5e1)',
                        backgroundColor: 'var(--card-bg-color, #ffffff)'
                    }}
                />
                {contracts.length > 0 && (
                    <select
                        value={selectedContractFilter}
                        onChange={(e) => setSelectedContractFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        style={{
                            padding: '0.45rem 0.75rem',
                            fontSize: '0.78rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color, #cbd5e1)',
                            backgroundColor: 'var(--card-bg-color, #ffffff)',
                            color: 'var(--text-color, #1e293b)'
                        }}
                    >
                        <option value="all">{isFa ? 'همه قراردادها' : 'All Contracts'}</option>
                        {contracts.map(c => (
                            <option key={c.id} value={c.id}>
                                {`${c.contractNumber ? `[${c.contractNumber}] ` : ''}${c.title}`}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Invoices Grid Table - ALWAYS RENDERED */}
            <div className="table-responsive">
                <table className="tab-table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '40px', fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'ردیف' : '#'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'شماره صورتحساب' : 'Invoice #'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'عنوان صورتحساب' : 'Invoice Title'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'قرارداد مربوطه' : 'Related Contract'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'دوره صورتحساب' : 'Billing Period'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'مبلغ صورتحساب' : 'Amount'}</th>
                            <th style={{ fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'شرح / توضیحات' : 'Description'}</th>
                            <th style={{ textAlign: 'center', width: '80px', fontSize: '0.75rem', padding: '0.45rem 0.6rem' }}>{isFa ? 'عملیات' : 'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>
                                    {isFa ? 'هیچ صورتحسابی برای این پروژه ثبت نشده است.' : 'No invoices recorded for this project yet.'}
                                </td>
                            </tr>
                        ) : (
                            filteredInvoices.map((inv, idx) => {
                                const linkedContract = contracts.find(c => Number(c.id) === Number(inv.contractId));
                                return (
                                    <tr key={inv.id}>
                                        <td style={{ padding: '0.45rem 0.6rem' }}>{isFa ? toPersianDigits(idx + 1) : (idx + 1)}</td>
                                        <td style={{ fontWeight: 700, color: '#10b981', padding: '0.45rem 0.6rem' }}>{isFa ? toPersianDigits(inv.invoiceNumber) : inv.invoiceNumber}</td>
                                        <td style={{ fontWeight: 600, padding: '0.45rem 0.6rem' }}>{inv.title}</td>
                                        <td style={{ padding: '0.45rem 0.6rem' }}>
                                            {linkedContract ? (
                                                <span style={{
                                                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe',
                                                    color: isDark ? '#bae6fd' : '#0369a1',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600
                                                }}>
                                                    {`${linkedContract.contractNumber ? `[${linkedContract.contractNumber}] ` : ''}${linkedContract.title}`}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>{inv.contractTitle || '-'}</span>
                                            )}
                                        </td>
                                        <td style={{ fontSize: '0.74rem', padding: '0.45rem 0.6rem' }}>
                                            {formatDate(inv.startDate, language)} {isFa ? 'تا' : 'to'} {formatDate(inv.endDate, language)}
                                        </td>
                                        <td style={{ fontWeight: 700, color: '#059669', padding: '0.45rem 0.6rem' }}>
                                            {formatCurrencyAmount(inv.amount, isFa)}
                                        </td>
                                        <td style={{ fontSize: '0.74rem', color: '#64748b', padding: '0.45rem 0.6rem' }}>{inv.description || '-'}</td>
                                        <td style={{ textAlign: 'center', padding: '0.45rem 0.6rem' }}>
                                            <div style={{ display: 'inline-flex', gap: '3px' }}>
                                                {!isReadOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(inv)}
                                                        className="action-icon edit"
                                                        title={isFa ? 'ویرایش صورتحساب' : 'Edit'}
                                                        style={{ padding: '3px' }}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit</span>
                                                    </button>
                                                )}
                                                {!isReadOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(inv.id)}
                                                        className="action-icon delete"
                                                        title={isFa ? 'حذف صورتحساب' : 'Delete'}
                                                        style={{ padding: '3px' }}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
