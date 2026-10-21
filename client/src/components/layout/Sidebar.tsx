import { useAuth } from '@/context/AuthContext';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Clock,
  Hourglass,
  Timer,
  FileCheck,
  BadgeCheck,
  CalendarPlus,
  CalendarCheck2,
  SlidersHorizontal,
  Users,
  Building2,
  BarChart3,
  ClipboardList,
  History,
  User,
  LogOut,
  X,
  UserCheck,
  Settings
} from 'lucide-react';

import logoUrl from '@assets/Screenshot_2025-10-15_183825_1765652253224.png';

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (location === path) return true;
    if (path.startsWith('/admin/individual-report') && location.startsWith('/admin/individual-report')) return true;
    return false;
  };

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  const employeeLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/dashboard' },
    { icon: FileText, label: 'Apply Leave', path: '/employee/apply-leave' },
    { icon: Clock, label: 'Apply Permission', path: '/employee/permission' },
    { icon: CalendarPlus, label: 'Apply Comp Off', path: '/employee/apply-comp-off' },
    { icon: History, label: 'Leave History', path: '/employee/history' },
    { icon: User, label: 'Profile', path: '/employee/profile' },
    { icon: BarChart3, label: 'My Report', path: `/admin/individual-report/${user?.id || ''}` },
  ];

  const adminLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: UserCheck, label: 'Attendance & Late Report', path: '/admin/attendance-report' },
    { icon: Settings, label: 'Attendance Settings', path: '/admin/attendance-settings' },
    { icon: FileText, label: 'Apply Leave', path: '/employee/apply-leave' },
    { icon: Clock, label: 'Apply Permission', path: '/employee/permission' },
    { icon: Hourglass, label: 'View Pending Leaves', path: '/admin/view-leaves' },
    { icon: Timer, label: 'View Pending Permissions', path: '/admin/view-permissions' },
    { icon: FileCheck, label: 'Approved Leaves', path: '/admin/approved-leaves' },
    { icon: BadgeCheck, label: 'Approved Permissions', path: '/admin/approved-permissions' },
    { icon: CalendarPlus, label: 'Apply Comp Off', path: '/employee/apply-comp-off' },
    { icon: CalendarCheck2, label: 'Approve Comp Off', path: '/admin/approve-comp-off' },
    { icon: SlidersHorizontal, label: 'Manage Balances', path: '/admin/manage-balances' },
    { icon: Users, label: 'Employees', path: '/admin/employees' },
    { icon: Building2, label: 'Departments', path: '/admin/departments' },
    { icon: BarChart3, label: 'Analytics', path: '/admin/charts' },
    { icon: ClipboardList, label: 'Reports', path: '/reports' },
  ];

  const hrLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/employee/dashboard' },
    { icon: UserCheck, label: 'Attendance & Late Report', path: '/admin/attendance-report' },
    { icon: Settings, label: 'Attendance Settings', path: '/admin/attendance-settings' },
    { icon: FileText, label: 'Apply Leave', path: '/employee/apply-leave' },
    { icon: Clock, label: 'Apply Permission', path: '/employee/permission' },
    { icon: Hourglass, label: 'View Pending Leaves', path: '/admin/view-leaves' },
    { icon: Timer, label: 'View Pending Permissions', path: '/admin/view-permissions' },
    { icon: FileCheck, label: 'Approved Leaves', path: '/admin/approved-leaves' },
    { icon: BadgeCheck, label: 'Approved Permissions', path: '/admin/approved-permissions' },
    { icon: CalendarPlus, label: 'Apply Comp Off', path: '/employee/apply-comp-off' },
    { icon: CalendarCheck2, label: 'Approve Comp Off', path: '/admin/approve-comp-off' },
    { icon: SlidersHorizontal, label: 'Manage Balances', path: '/admin/manage-balances' },
    { icon: History, label: 'Leave History', path: '/employee/history' },
    { icon: User, label: 'Profile', path: '/employee/profile' },
    { icon: ClipboardList, label: 'Reports', path: '/reports' },
  ];

  const links = user?.role === 'Admin' ? adminLinks : (user?.role === 'HR' ? hrLinks : employeeLinks);

  const getInitials = (name?: string, code?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return code ? code.slice(0, 2).toUpperCase() : '';
  };

  return (
    <aside className="w-72 max-w-[85vw] md:w-64 h-full bg-[#1A3DB1] dark:bg-[#0F172A] flex flex-col shadow-2xl md:shadow-xl transition-all duration-300">
      {/* Header with Logo and Close button */}
      <div className="pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 px-4 sm:p-5 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center justify-center flex-1 pr-2">
          <img src={logoUrl} alt="Knockturn Logo" className="h-10 sm:h-11 w-auto object-contain mix-blend-screen" />
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="md:hidden p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links with touch-friendly spacing and hidden scrollbar */}
      <div className="flex-1 py-3 px-3 space-y-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {links.map((link) => (
          <Link key={link.path} href={link.path} onClick={handleNavClick}>
            <div
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 group cursor-pointer text-sm sm:text-base select-none border",
                isActive(link.path)
                  ? "bg-white/20 dark:bg-white/20 text-white font-semibold shadow-sm backdrop-blur-sm border-white/20"
                  : "text-white/80 dark:text-slate-300 border-transparent hover:text-white hover:bg-white/10 dark:hover:bg-white/10 active:bg-white/15 font-medium"
              )}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <link.icon
                  className={cn(
                    "w-5 h-5 transition-transform duration-150 group-hover:scale-105",
                    isActive(link.path)
                      ? "text-white"
                      : "text-white/75 dark:text-slate-400 group-hover:text-white"
                  )}
                />
              </div>
              <span className="truncate tracking-wide">{link.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* User footer with safe-area bottom padding */}
      <div className="p-4 border-t border-white/10 bg-black/10 dark:bg-white/5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/15 text-xs font-bold text-white shrink-0">
            {getInitials(user?.name, user?.code)}
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-white/70 truncate">{user?.code || user?.id}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/20 py-2.5 rounded-lg transition-all text-sm font-medium touch-manipulation"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
