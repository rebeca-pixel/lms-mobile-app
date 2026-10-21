import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { getMyNotifications, getUnreadCount, markAllNotificationsRead, AppNotification } from '@/lib/notifications';
import { formatDistanceToNow } from 'date-fns';

export function NotificationsBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    if (!user) return;
    const [list, count] = await Promise.all([
      getMyNotifications(user.id, user.role),
      getUnreadCount(user.id, user.role),
    ]);
    setNotifications(list);
    setUnread(count);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleOpenChange = async (open: boolean) => {
    if (!open && user && unread > 0) {
      await markAllNotificationsRead(user.id, user.role);
      setUnread(0);
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" data-testid="button-notifications">
          <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[28rem] overflow-y-auto bg-white border-slate-200">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-sm text-slate-400 italic text-center">No notifications yet.</div>
        ) : (
          notifications.map(n => (
            <DropdownMenuItem key={n.id} className={`flex flex-col items-start gap-0.5 py-2 whitespace-normal ${!n.isRead ? 'bg-primary/5' : ''}`}>
              <span className="text-sm font-semibold text-slate-900">{n.title}</span>
              <span className="text-xs text-slate-600">{n.message}</span>
              <span className="text-[10px] text-slate-400">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
