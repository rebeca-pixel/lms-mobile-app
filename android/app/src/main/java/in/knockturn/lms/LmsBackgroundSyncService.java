package in.knockturn.lms;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class LmsBackgroundSyncService extends Service {
    private static final String TAG = "LmsSyncService";
    private static final int PERSISTENT_NOTIF_ID = 9999;
    private volatile boolean isRunning = false;
    private Thread syncThread;

    @Override
    public void onCreate() {
        super.onCreate();
        LmsNotificationHelper.ensureChannels(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startAsForeground();

        if (!isRunning) {
            isRunning = true;
            syncThread = new Thread(() -> {
                Log.d(TAG, "LmsBackgroundSyncService background worker started.");
                while (isRunning) {
                    try {
                        LmsNotificationHelper.checkAndDispatchNotifications(getApplicationContext());
                    } catch (Throwable t) {
                        Log.e(TAG, "Sync loop error: " + t.getMessage());
                    }

                    try {
                        Thread.sleep(12000); // 12 seconds interval
                    } catch (InterruptedException e) {
                        break;
                    }
                }
                Log.d(TAG, "LmsBackgroundSyncService background worker stopped.");
            });
            syncThread.setDaemon(true);
            syncThread.start();
        }

        // Schedule backup AlarmManager check in case OS ever kills background process
        LmsAlarmReceiver.scheduleNext(this, 45000);

        return START_STICKY;
    }

    private void startAsForeground() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            pendingFlags
        );

        Notification notification = new NotificationCompat.Builder(this, LmsNotificationHelper.PERSISTENT_CHANNEL_ID)
            .setContentTitle("LMS Notification Service")
            .setContentText("Monitoring leave and approval alerts in background")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // Android 14+
            startForeground(PERSISTENT_NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { // Android 10+
            startForeground(PERSISTENT_NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(PERSISTENT_NOTIF_ID, notification);
        }
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (syncThread != null) {
            syncThread.interrupt();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    public static void start(Context context) {
        try {
            Intent serviceIntent = new Intent(context, LmsBackgroundSyncService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start LmsBackgroundSyncService: " + e.getMessage());
        }
    }

    public static void stop(Context context) {
        try {
            Intent serviceIntent = new Intent(context, LmsBackgroundSyncService.class);
            context.stopService(serviceIntent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop LmsBackgroundSyncService: " + e.getMessage());
        }
    }
}
