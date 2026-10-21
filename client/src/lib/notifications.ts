import { supabase } from './supabaseClient';

export type NotificationType =
  | 'comp_off_applied'
  | 'comp_off_admin_approved'
  | 'comp_off_hr_approved'
  | 'comp_off_admin_rejected'
  | 'comp_off_hr_rejected'
  | 'comp_off_credited'
  | 'comp_off_leave_lop_warning'
  | 'comp_off_leave_applied';

export interface AppNotification {
  id: string;
  userId?: string;
  role?: 'Admin' | 'HR' | 'Employee';
  title: string;
  message: string;
  type: NotificationType | string;
  relatedType?: string;
  relatedId?: number;
  isRead: boolean;
  createdAt: string;
}

function mapRow(row: any): AppNotification {
  return {
    id: String(row.id),
    userId: row.user_id || undefined,
    role: row.role || undefined,
    title: row.title,
    message: row.message,
    type: row.type,
    relatedType: row.related_type || undefined,
    relatedId: row.related_id ?? undefined,
    isRead: !!row.is_read,
    createdAt: row.created_at,
  };
}

/** Send a notification to one specific employee (by user_id). */
export async function notifyUser(userId: string, title: string, message: string, type: NotificationType | string, relatedType?: string, relatedId?: number) {
  try {
    const { error } = await supabase.from('app_notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      related_type: relatedType || null,
      related_id: relatedId ?? null,
    });
    if (error) console.error('notifyUser error:', error);
  } catch (err) {
    console.error('notifyUser exception:', err);
  }
}

/** Broadcast a notification to an entire role (Admin or HR). */
export async function notifyRole(role: 'Admin' | 'HR', title: string, message: string, type: NotificationType | string, relatedType?: string, relatedId?: number) {
  try {
    const { error } = await supabase.from('app_notifications').insert({
      role,
      title,
      message,
      type,
      related_type: relatedType || null,
      related_id: relatedId ?? null,
    });
    if (error) console.error('notifyRole error:', error);
  } catch (err) {
    console.error('notifyRole exception:', err);
  }
}

/** Convenience: notify both Admin and HR at once. */
export async function notifyAdminAndHR(title: string, message: string, type: NotificationType | string, relatedType?: string, relatedId?: number) {
  await Promise.all([
    notifyRole('Admin', title, message, type, relatedType, relatedId),
    notifyRole('HR', title, message, type, relatedType, relatedId),
  ]);
}

/** Fetch notifications relevant to a logged-in user (their own + their role broadcasts). */
export async function getMyNotifications(userId: string, role: 'Admin' | 'HR' | 'Employee', limit = 30): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase
      .from('app_notifications')
      .select('*')
      .or(`user_id.eq.${userId},role.eq.${role}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    return (data || []).map(mapRow);
  } catch (err) {
    console.error('getMyNotifications exception:', err);
    return [];
  }
}

export async function getUnreadCount(userId: string, role: 'Admin' | 'HR' | 'Employee'): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('app_notifications')
      .select('id', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},role.eq.${role}`)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
    return count || 0;
  } catch (err) {
    console.error('getUnreadCount exception:', err);
    return 0;
  }
}

export async function markNotificationRead(id: string) {
  try {
    await supabase.from('app_notifications').update({ is_read: true }).eq('id', parseInt(id));
  } catch (err) {
    console.error('markNotificationRead exception:', err);
  }
}

export async function markAllNotificationsRead(userId: string, role: 'Admin' | 'HR' | 'Employee') {
  try {
    await supabase
      .from('app_notifications')
      .update({ is_read: true })
      .or(`user_id.eq.${userId},role.eq.${role}`)
      .eq('is_read', false);
  } catch (err) {
    console.error('markAllNotificationsRead exception:', err);
  }
}
