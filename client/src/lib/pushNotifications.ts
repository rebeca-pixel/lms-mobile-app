import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications, Channel } from '@capacitor/local-notifications';
import { supabase } from './supabaseClient';

export interface LmsBackgroundSyncPluginType {
  setUser(options: { userId?: string; role?: string; name?: string; code?: string }): Promise<{ success: boolean; role?: string }>;
  clearUser(): Promise<{ success: boolean }>;
  triggerCheck(): Promise<{ checked: boolean }>;
  getStatus(): Promise<{ configured: boolean; role?: string; userId?: string }>;
}

export const LmsBackgroundSync = registerPlugin<LmsBackgroundSyncPluginType>('LmsBackgroundSync');

export const APPROVALS_CHANNEL_ID = 'lms_approvals_channel';

let isInitialized = false;

/**
 * Initialize Push/Local Notification channels and request native permissions on Android & iOS.
 */
export async function initPushNotifications(): Promise<boolean> {
  if (isInitialized) return true;

  try {
    if (Capacitor.isNativePlatform()) {
      // 1. Create High-Priority Notification Channel for Android (API 26+)
      // Importance 5 = High/Max => Heads-up banner on home screen, sound, and vibration
      // Visibility 1 = Public => Fully visible on Lock Screen!
      const approvalsChannel: Channel = {
        id: APPROVALS_CHANNEL_ID,
        name: 'Leave & Permission Approvals',
        description: 'High-priority notifications for employee leave and permission requests',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#06B6D4',
      };

      await LocalNotifications.createChannel(approvalsChannel).catch((err) => {
        console.warn('Failed to create notification channel:', err);
      });

      // 2. Request Android 13+ / iOS notification permissions
      const checkResult = await LocalNotifications.checkPermissions();
      if (checkResult.display !== 'granted') {
        const reqResult = await LocalNotifications.requestPermissions();
        console.log('Notification permission request result:', reqResult);
      }

      // 3. Register notification action listener (when user taps the notification)
      LocalNotifications.removeAllListeners().catch(() => { });
      LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const extra = notificationAction.notification.extra;
        console.log('Notification tapped:', extra);
        if (!extra) return;

        if (extra.type === 'leave' || extra.relatedType === 'leave') {
          window.location.href = '/admin/view-leaves';
        } else if (extra.type === 'permission' || extra.relatedType === 'permission') {
          window.location.href = '/admin/view-permissions';
        } else if (extra.type === 'comp_off' || extra.relatedType === 'comp_off_request') {
          window.location.href = '/admin/approve-comp-off';
        }
      });
    } else {
      // Web Fallback: Request browser notification permission
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission().catch(() => { });
        }
      }
    }

    isInitialized = true;
    return true;
  } catch (err) {
    console.error('Error initializing push notifications:', err);
    return false;
  }
}

export interface NativePushOptions {
  title: string;
  body: string;
  id?: number;
  channelId?: string;
  extra?: Record<string, any>;
  scheduleInMs?: number;
}

/**
 * Trigger an immediate high-priority system notification.
 * Displays on the lock screen and notification shade on mobile devices.
 */
export async function sendNativePushNotification(options: NativePushOptions): Promise<void> {
  const notificationId = options.id ?? Math.floor(Date.now() % 100000000) + Math.floor(Math.random() * 1000);
  const scheduleDelay = options.scheduleInMs ?? 100;

  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: options.title,
            body: options.body,
            channelId: options.channelId || APPROVALS_CHANNEL_ID,
            smallIcon: 'ic_launcher',
            iconColor: '#06B6D4',
            sound: 'default',
            autoCancel: true,
            extra: options.extra,
            schedule: {
              at: new Date(Date.now() + scheduleDelay),
              allowWhileIdle: true, // Wakes device in Doze mode to show on lock screen
            },
          },
        ],
      });
      console.log(`[Push] Native notification scheduled (#${notificationId}): ${options.title}`);
    } else {
      // Fallback for web testing / preview
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(options.title, {
          body: options.body,
          icon: '/favicon.ico',
        });
      }
      console.log(`[Push Web/Dev] Notification: ${options.title} - ${options.body}`);
    }
  } catch (err) {
    console.error('Failed to schedule native notification:', err);
  }
}

/**
 * Realtime & Background Polling listener for all users (Employees, Admins, HR).
 * Listens for new leave & permission applications, approvals, and rejections across ALL devices
 * and triggers instant native lock-screen push notifications.
 */
export function startRealtimePushListener(currentUser: { id: string; role: string; name?: string; code?: string } | null) {
  if (!currentUser) return () => { };

  // Activate Native 24/7 Background Service on Android for lock-screen alerts
  if (Capacitor.isNativePlatform()) {
    LmsBackgroundSync.setUser({
      userId: currentUser.id,
      role: currentUser.role,
      name: currentUser.name,
      code: currentUser.code,
    }).catch((err) => console.warn('LmsBackgroundSync.setUser error:', err));
  }

  const SEEN_KEY = `lms_seen_notif_${currentUser.id || currentUser.code || 'user'}`;
  let seenIds: Set<string>;
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    seenIds = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    seenIds = new Set();
  }

  const saveSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seenIds).slice(-300)));
    } catch { }
  };

  const handleIncomingNotification = (row: any) => {
    if (!row || !row.id) return;
    const notifIdStr = String(row.id);
    if (seenIds.has(notifIdStr)) return;

    seenIds.add(notifIdStr);
    saveSeen();

    const currentRole = (currentUser.role || '').toLowerCase();
    const rowRole = (row.role || '').toLowerCase();
    const rowUserId = String(row.user_id || '').toLowerCase();
    const currentId = String(currentUser.id || '').toLowerCase();
    const currentCode = String(currentUser.code || '').toLowerCase();

    // Check if notification is targeted to this user or their role
    const isForMe =
      (rowUserId && (rowUserId === currentId || rowUserId === currentCode)) ||
      (rowRole && (
        rowRole === currentRole ||
        (currentRole === 'admin' && rowRole === 'hr') ||
        (currentRole === 'hr' && rowRole === 'admin')
      ));

    if (isForMe) {
      sendNativePushNotification({
        title: row.title || 'LMS Notification',
        body: row.message || 'You have a new update.',
        id: Math.abs(Number(row.id)) || Math.floor(Math.random() * 100000),
        extra: {
          type: row.related_type || row.type || 'general',
          id: row.related_id,
        },
      });
    }
  };

  let isFirstRun = seenIds.size === 0;

  // Poll app_notifications every 8 seconds as a guaranteed multi-device fallback
  const pollNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);

      if (error || !data) return;

      if (isFirstRun) {
        // On very first app launch, mark all existing past items as seen so user isn't spammed with old history
        data.forEach((item: any) => seenIds.add(String(item.id)));
        saveSeen();
        isFirstRun = false;
        return;
      }

      // Process new incoming notifications
      data.forEach(handleIncomingNotification);
    } catch (e) {
      console.warn('Notification poll error:', e);
    }
  };

  pollNotifications();
  const intervalId = setInterval(pollNotifications, 8000);

  // Also maintain Supabase Realtime channel for instant sub-second delivery
  const realtimeChannel = supabase
    .channel('lms_realtime_approvals_' + (currentUser.id || 'all'))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_notifications' }, (payload) => {
      handleIncomingNotification(payload.new);
    })
    .subscribe();

  return () => {
    clearInterval(intervalId);
    supabase.removeChannel(realtimeChannel);
  };
}

/**
 * Clear native background sync on user logout
 */
export function stopBackgroundSync() {
  if (Capacitor.isNativePlatform()) {
    LmsBackgroundSync.clearUser().catch(() => { });
  }
}

