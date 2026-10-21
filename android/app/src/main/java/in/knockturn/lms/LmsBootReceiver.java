package in.knockturn.lms;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class LmsBootReceiver extends BroadcastReceiver {
    private static final String TAG = "LmsBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Device boot completed, checking LMS background sync...");
        SharedPreferences prefs = context.getSharedPreferences(LmsNotificationHelper.PREFS_NAME, Context.MODE_PRIVATE);
        String role = prefs.getString("user_role", null);
        String userId = prefs.getString("user_id", null);

        // Only start if a user was previously logged in on this device
        if (role != null || userId != null) {
            Log.d(TAG, "Active user session found, starting LMS sync service.");
            LmsBackgroundSyncService.start(context);
            LmsAlarmReceiver.scheduleNext(context, 10000);
        }
    }
}
