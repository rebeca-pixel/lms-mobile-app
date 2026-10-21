package in.knockturn.lms;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

public class LmsAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "LmsAlarmReceiver";
    public static final int REQUEST_CODE = 4040;

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "LmsAlarmReceiver triggered.");

        final PendingResult pendingResult = goAsync();
        new Thread(() -> {
            try {
                LmsNotificationHelper.checkAndDispatchNotifications(context.getApplicationContext());
                // Make sure foreground service is alive
                LmsBackgroundSyncService.start(context.getApplicationContext());
            } catch (Throwable t) {
                Log.e(TAG, "Alarm check error: " + t.getMessage());
            } finally {
                // Re-schedule for next periodic backup interval (every 45 seconds)
                scheduleNext(context.getApplicationContext(), 45000);
                pendingResult.finish();
            }
        }).start();
    }

    public static void scheduleNext(Context context, long delayMillis) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent intent = new Intent(context, LmsAlarmReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pi = PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags);
            long triggerAt = SystemClock.elapsedRealtime() + delayMillis;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            } else {
                am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule next alarm: " + e.getMessage());
        }
    }

    public static void cancel(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent intent = new Intent(context, LmsAlarmReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pi = PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags);
            am.cancel(pi);
        } catch (Exception e) {
            Log.e(TAG, "Failed to cancel alarm: " + e.getMessage());
        }
    }
}
