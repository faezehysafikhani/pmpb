import React, { useContext, ReactElement, useState, useMemo } from 'react';
import { LocalizationContext, ThemeContext } from '../context';
import { User } from '../types';
import { toPersianDigits, appLogoUrl } from '../utils';

export const Header = ({ user, onLogout }: { user: User, onLogout: () => void }): ReactElement => {
  const { t } = useContext(LocalizationContext);
  const { theme, setTheme } = useContext(ThemeContext);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return React.createElement("header", null,
    React.createElement("div", { className: "header-content" },
      React.createElement("div", { className: "header-title-group" },
        React.createElement("img", { src: appLogoUrl, alt: "Company Logo", className: "header-logo" }),
        React.createElement("h1", null, t('mainTitle'))
      ),
      React.createElement("div", { className: "user-info" },
        React.createElement("span", null, t('welcomeUser', { username: user.username })),
        React.createElement("button", {
          onClick: toggleTheme,
          className: "logout-button theme-toggle-button",
          "aria-label": theme === 'dark' ? 'حالت روشن' : 'حالت تاریک',
          title: theme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'
        },
          React.createElement("span", { className: "material-symbols-outlined" }, theme === 'dark' ? "light_mode" : "dark_mode")
        ),
        React.createElement("button", { onClick: onLogout, className: "logout-button", "aria-label": t('logout'), title: t('logout') },
          React.createElement("span", { className: "material-symbols-outlined" }, "logout")
        )
      )
    )
  );
};

export const Footer = (): ReactElement => {
  const { t } = useContext(LocalizationContext);
  return React.createElement("footer", null,
    React.createElement("p", null, t('footerText'))
  );
};

export interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string, context?: any) => void;
  currentUser: User | null;
  overdueProjectsCount: number;
  pendingApprovalsCount: number;
  taskCenterNotificationCount: number;
}

interface SubMenuItem {
  id: string;
  page: string;
  context?: any;
  nameFa: string;
  nameEn: string;
  icon: string;
}

interface MenuItem {
  id?: string;
  page?: string;
  context?: any;
  nameFa: string;
  nameEn: string;
  icon: string;
  count: number;
  roles?: string[];
  subItems?: SubMenuItem[];
}

interface MenuGroup {
  id: string;
  titleFa: string;
  titleEn: string;
  icon: string;
  items: MenuItem[];
}

export const Sidebar = ({
  currentPage,
  onNavigate,
  currentUser,
  overdueProjectsCount,
  pendingApprovalsCount,
  taskCenterNotificationCount
}: SidebarProps): ReactElement | null => {
  const { t, language } = useContext(LocalizationContext);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [expandedSubMenuId, setExpandedSubMenuId] = useState<string | null>(null);
  const [hoveredSubMenuId, setHoveredSubMenuId] = useState<string | null>(null);

  const isFa = language === 'fa' || !language;

  const menuGroups: MenuGroup[] = useMemo(() => [
    {
      id: 'dashboards',
      titleFa: 'داشبوردها',
      titleEn: 'Dashboards',
      icon: 'dashboard',
      items: [
        {
          id: 'dashboard',
          page: 'dashboard',
          nameFa: 'داشبورد',
          nameEn: 'Dashboard',
          icon: 'dashboard_customize',
          count: 0
        },
        {
          id: 'reports_dashboard',
          page: 'reports_dashboard',
          nameFa: 'داشبورد پروژه',
          nameEn: 'Project Dashboard',
          icon: 'analytics',
          count: 0
        }
      ]
    },
    {
      id: 'projects_actions',
      titleFa: 'پروژه‌ها و اقدامات',
      titleEn: 'Projects & Actions',
      icon: 'folder_special',
      items: [
        {
          id: 'portfolio',
          page: 'portfolio',
          nameFa: 'سبد پروژه‌ها و اقدامات',
          nameEn: 'Projects & Actions Portfolio',
          icon: 'inventory',
          count: overdueProjectsCount
        },
        {
          id: 'create_project',
          nameFa: 'ایجاد پروژه',
          nameEn: 'Create Project',
          icon: 'add_business',
          count: 0,
          roles: ['Admin', 'Project Manager'],
          subItems: [
            {
              id: 'create_waterfall',
              page: 'create_waterfall_details',
              context: { type: 'waterfall' },
              nameFa: 'پروژه آبشاری جدید',
              nameEn: 'New Waterfall Project',
              icon: 'account_tree'
            },
            {
              id: 'create_agile',
              page: 'create_agile_details',
              context: { type: 'agile' },
              nameFa: 'پروژه چابک جدید',
              nameEn: 'New Agile Project',
              icon: 'sync_alt'
            }
          ]
        },
        {
          id: 'define_action',
          page: 'define_action',
          nameFa: 'ایجاد اقدام',
          nameEn: 'Create Action',
          icon: 'edit_note',
          count: 0,
          roles: ['Admin', 'Project Manager']
        }
      ]
    },
    {
      id: 'tasks_approvals',
      titleFa: 'کارتابل وظایف و تاییدات',
      titleEn: 'Task Inbox & Approvals',
      icon: 'inbox',
      items: [
        {
          id: 'task_center',
          page: 'task_center',
          nameFa: 'کارتابل وظایف',
          nameEn: 'Task Center',
          icon: 'task_alt',
          count: taskCenterNotificationCount
        },
        {
          id: 'approval_center',
          page: 'approval_center',
          nameFa: 'تاییدات',
          nameEn: 'Approval Center',
          icon: 'approval',
          count: pendingApprovalsCount
        }
      ]
    },
    {
      id: 'knowledge_strategy',
      titleFa: 'مدیریت دانش و استراتژی',
      titleEn: 'Knowledge & Strategy',
      icon: 'hub',
      items: [
        {
          id: 'knowledge_management',
          page: 'knowledge_management',
          nameFa: 'مدیریت دانش',
          nameEn: 'Knowledge Management',
          icon: 'school',
          count: 0
        },
        {
          id: 'strategy_management',
          page: 'strategy_management',
          nameFa: 'استراتژی',
          nameEn: 'Strategy Management',
          icon: 'lan',
          count: 0,
          roles: ['Admin', 'Project Manager']
        }
      ]
    },
    {
      id: 'users_settings',
      titleFa: 'کاربران و تنظیمات',
      titleEn: 'Users & Settings',
      icon: 'settings_suggest',
      items: [
        {
          id: 'users',
          page: 'users',
          nameFa: 'مدیریت کاربران',
          nameEn: 'User Management',
          icon: 'manage_accounts',
          count: 0,
          roles: ['Admin']
        },
        {
          id: 'settings',
          page: 'settings',
          nameFa: 'تنظیمات',
          nameEn: 'Settings',
          icon: 'settings',
          count: 0
        }
      ]
    }
  ], [overdueProjectsCount, pendingApprovalsCount, taskCenterNotificationCount]);

  if (!currentUser) return null;

  const isItemActive = (item: MenuItem | SubMenuItem) => {
    if (item.page && currentPage === item.page) return true;
    if ('subItems' in item && item.subItems) {
      return item.subItems.some(sub => sub.page === currentPage);
    }
    if (item.page === 'dashboard' && ['dashboard', 'dashboard_hub', 'project_dashboard_details'].includes(currentPage)) return true;
    if (item.page === 'action_dashboard' && currentPage === 'action_dashboard') return true;
    if (item.page === 'portfolio' && ['view_snapshot'].includes(currentPage)) return true;
    if (item.page === 'strategy_management' && ['define_strategies', 'alignment_matrix'].includes(currentPage)) return true;
    if (item.page === 'settings' && ['calendar_management', 'edit_calendar', 'color_format', 'reference_tables'].includes(currentPage)) return true;
    return false;
  };

  const handleToggleGroup = (groupId: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    setOpenGroupId(prev => prev === groupId ? null : groupId);
  };

  const handleToggleSubMenu = (itemId: string, e: React.MouseEvent, isCurrentlyExpanded: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedSubMenuId(isCurrentlyExpanded ? '__CLOSED__' : itemId);
  };

  const collapseIcon = isCollapsed
    ? (language === 'fa' ? 'chevron_left' : 'chevron_right')
    : (language === 'fa' ? 'chevron_right' : 'chevron_left');

  return (
    React.createElement("aside", { className: `app-sidebar ${isCollapsed ? 'collapsed' : ''}` },
      React.createElement("div", { className: "sidebar-header" },
        !isCollapsed && React.createElement("div", { className: "sidebar-title-wrapper" },
          React.createElement("span", { className: "material-symbols-outlined sidebar-header-icon" }, "menu_open"),
          React.createElement("span", { className: "sidebar-title" }, t('mainMenuTitle'))
        ),
        React.createElement("button", {
          className: "sidebar-toggle-btn",
          onClick: () => setIsCollapsed(!isCollapsed),
          title: isCollapsed ? (isFa ? 'بزرگ‌نمایی منو' : 'Expand menu') : (isFa ? 'کوچک‌سازی منو' : 'Collapse menu'),
          "aria-label": "Toggle sidebar"
        },
          React.createElement("span", { className: "material-symbols-outlined" }, collapseIcon)
        )
      ),
      React.createElement("nav", { className: "sidebar-nav", "aria-label": "Sidebar Navigation" },
        menuGroups.map((group) => {
          const visibleItems = group.items.filter(item => {
            if (item.roles && !item.roles.includes(currentUser.role)) {
              return false;
            }
            return true;
          });

          if (visibleItems.length === 0) return null;

          const isOpen = openGroupId === group.id;
          const hasActiveChild = visibleItems.some(item => isItemActive(item));
          const totalGroupBadge = visibleItems.reduce((sum, item) => sum + (item.count || 0), 0);
          const groupTitle = isFa ? group.titleFa : group.titleEn;

          return React.createElement("div", {
            key: group.id,
            className: `sidebar-group ${isOpen ? 'open' : ''} ${hasActiveChild ? 'has-active-child' : ''}`
          },
            React.createElement("button", {
              type: "button",
              className: `sidebar-group-header ${isOpen ? 'open' : ''} ${hasActiveChild ? 'active-parent' : ''}`,
              onClick: () => handleToggleGroup(group.id),
              title: isCollapsed ? groupTitle : undefined,
              "aria-expanded": isOpen
            },
              React.createElement("div", { className: "sidebar-group-header-left" },
                React.createElement("span", { className: "material-symbols-outlined sidebar-icon" }, group.icon),
                !isCollapsed && React.createElement("span", { className: "sidebar-group-title" }, groupTitle)
              ),
              !isCollapsed && React.createElement("div", { className: "sidebar-group-header-right" },
                (!isOpen && totalGroupBadge > 0) && React.createElement("span", { className: "sidebar-badge" }, isFa ? toPersianDigits(totalGroupBadge) : totalGroupBadge),
                React.createElement("span", { className: "material-symbols-outlined sidebar-group-chevron" }, isOpen ? "expand_less" : "expand_more")
              ),
              (isCollapsed && !isOpen && totalGroupBadge > 0) && React.createElement("span", { className: "sidebar-badge collapsed-badge" }, isFa ? toPersianDigits(totalGroupBadge) : totalGroupBadge)
            ),
            (!isCollapsed && isOpen) && React.createElement("div", { className: "sidebar-group-items" },
              visibleItems.map(item => {
                const active = isItemActive(item);
                const itemName = isFa ? item.nameFa : item.nameEn;
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isSubMenuExpanded = expandedSubMenuId === (item.id || item.nameEn) || (active && expandedSubMenuId !== '__CLOSED__');

                if (hasSubItems) {
                  return React.createElement("div", { key: item.id || item.nameEn, className: "sidebar-subitem-group" },
                    React.createElement("a", {
                      href: "#",
                      className: `sidebar-subitem ${active ? 'active-parent' : ''}`,
                      role: "button",
                      onClick: (e: React.MouseEvent) => handleToggleSubMenu(item.id || item.nameEn, e, isSubMenuExpanded)
                    },
                      React.createElement("span", { className: "material-symbols-outlined sidebar-subitem-icon" }, item.icon),
                      React.createElement("span", { className: "sidebar-text" }, itemName),
                      React.createElement("span", { className: "material-symbols-outlined sidebar-subitem-chevron" }, 
                        isSubMenuExpanded ? "expand_less" : "expand_more"
                      )
                    ),
                    isSubMenuExpanded && React.createElement("div", { className: "sidebar-nested-items" },
                      item.subItems!.map(sub => {
                        const subActive = currentPage === sub.page;
                        const subName = isFa ? sub.nameFa : sub.nameEn;
                        return React.createElement("a", {
                          href: "#",
                          key: sub.id,
                          className: `sidebar-nested-subitem ${subActive ? 'active' : ''}`,
                          role: "button",
                          onClick: (e: React.MouseEvent) => {
                            e.preventDefault();
                            onNavigate(sub.page, sub.context);
                          }
                        },
                          React.createElement("span", { className: "material-symbols-outlined nested-icon" }, sub.icon),
                          React.createElement("span", null, subName)
                        );
                      })
                    )
                  );
                }

                return React.createElement("a", {
                  href: "#",
                  key: item.page || item.nameEn,
                  className: `sidebar-subitem ${active ? 'active' : ''}`,
                  role: "button",
                  onClick: (e: React.MouseEvent) => {
                    e.preventDefault();
                    if (item.page) {
                      onNavigate(item.page, item.context);
                    }
                  }
                },
                  React.createElement("span", { className: "material-symbols-outlined sidebar-subitem-icon" }, item.icon),
                  React.createElement("span", { className: "sidebar-text" }, itemName),
                  item.count > 0 && React.createElement("span", { className: "sidebar-badge" }, isFa ? toPersianDigits(item.count) : item.count)
                );
              })
            ),
            (isCollapsed && isItemActive(group.items[0]) && false) && null
          );
        })
      )
    )
  );
};
