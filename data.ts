import { ActionItem, Calendar, Delegation, KnowledgeDocument, OwningUnitTreeNode, ProjectStrategyAlignment, Strategy, User } from './types';

export const initialCalendars: Calendar[] = [
    { id: '1', name: 'تقویم رسمی ۱۴۰۳', isDefault: true, workingDays: [0, 1, 2, 3, 4], workHoursPerDay: 8 },
    { id: '2', name: 'تقویم نوبتی کارگاهی (۷ روز هفته)', isDefault: false, workingDays: [0, 1, 2, 3, 4, 5, 6], workHoursPerDay: 10 }
];

export const initialUsers: User[] = [
  { id: '1', username: 'admin', password: 'admin', role: 'Admin', isActive: true, owningUnit: 'سازمان > مدیریت ارشد' },
  { id: '2', username: 'user1', password: 'user1', role: 'Project Manager', isActive: true, owningUnit: 'سازمان > واحد اجرایی' },
  { id: '3', username: 'user2', password: 'user2', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد اجرایی > اداره ۲' },
  { id: '4', username: 'user3', password: 'user3', role: 'Project Manager', isActive: true, owningUnit: 'سازمان > واحد انفورماتیک > اداره نرم‌افزار' },
  { id: '5', username: 'user4', password: 'user4', role: 'Project Manager', isActive: true, owningUnit: 'سازمان > واحد ساختمان' },
  { id: '6', username: 'user5', password: 'user5', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد پشتیبانی' },
  { id: '7', username: 'user6', password: 'user6', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد انفورماتیک > اداره زیرساخت و شبکه' },
  { id: '8', username: 'user7', password: 'user7', role: 'Project Team', isActive: true, owningUnit: 'سازمان > واحد پشتیبانی > اداره امور عمومی' }
];


export const initialOwningUnitsFlat: string[] = [
  'سازمان',
  'سازمان > مدیریت ارشد',
  'سازمان > واحد اجرایی',
  'سازمان > واحد اجرایی > اداره ۱',
  'سازمان > واحد اجرایی > اداره ۲',
  'سازمان > واحد انفورماتیک',
  'سازمان > واحد انفورماتیک > اداره نرم‌افزار',
  'سازمان > واحد انفورماتیک > اداره زیرساخت و شبکه',
  'سازمان > واحد ساختمان',
  'سازمان > واحد ساختمان > اداره معماری و عمران',
  'سازمان > واحد ساختمان > اداره تاسیسات',
  'سازمان > واحد پشتیبانی',
  'سازمان > واحد پشتیبانی > اداره تدارکات',
  'سازمان > واحد پشتیبانی > اداره امور عمومی'
];

export const initialOwningUnitsTree: OwningUnitTreeNode[] = [
  { id: 'u1', name: 'سازمان', parentId: null },
  { id: 'u2', name: 'مدیریت ارشد', parentId: 'u1' },
  { id: 'u3', name: 'واحد اجرایی', parentId: 'u1' },
  { id: 'u4', name: 'اداره ۱', parentId: 'u3' },
  { id: 'u5', name: 'اداره ۲', parentId: 'u3' },
  { id: 'u6', name: 'واحد انفورماتیک', parentId: 'u1' },
  { id: 'u7', name: 'اداره نرم‌افزار', parentId: 'u6' },
  { id: 'u8', name: 'اداره زیرساخت و شبکه', parentId: 'u6' },
  { id: 'u9', name: 'واحد ساختمان', parentId: 'u1' },
  { id: 'u10', name: 'اداره معماری و عمران', parentId: 'u9' },
  { id: 'u11', name: 'اداره تاسیسات', parentId: 'u9' },
  { id: 'u12', name: 'واحد پشتیبانی', parentId: 'u1' },
  { id: 'u13', name: 'اداره تدارکات', parentId: 'u12' },
  { id: 'u14', name: 'اداره امور عمومی', parentId: 'u12' }
];
