package in.knockturn.lms;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LmsBackgroundSync")
public class LmsBackgroundSyncPlugin extends Plugin {
    private static final String TAG = "LmsSyncPlugin";

    @PluginMethod
    public void setUser(PluginCall call) {
        String userId = call.getString("userId");
        String role = call.getString("role");
        String name = call.getString("name");
        String code = call.getString("code");

        if (role == null && userId == null) {
            call.reject("Must provide role or userId");
            return;
        }

        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(LmsNotificationHelper.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString("user_id", userId != null ? userId : "")
            .putString("user_role", role != null ? role : "")
            .putString("user_name", name != null ? name : "")
            .putString("user_code", code != null ? code : "")
            .apply();

        Log.d(TAG, "LmsBackgroundSync: user configured -> role: " + role + ", id: " + userId + ", code: " + code);

        // Ensure notification channels exist
        LmsNotificationHelper.ensureChannels(ctx);

        // Start Foreground Service and periodic AlarmManager backup
        LmsBackgroundSyncService.start(ctx);
        LmsAlarmReceiver.scheduleNext(ctx, 3000);

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("role", role);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearUser(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(LmsNotificationHelper.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().clear().apply();

        LmsBackgroundSyncService.stop(ctx);
        LmsAlarmReceiver.cancel(ctx);

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void triggerCheck(PluginCall call) {
        Context ctx = getContext();
        new Thread(() -> {
            LmsNotificationHelper.checkAndDispatchNotifications(ctx);
            JSObject ret = new JSObject();
            ret.put("checked", true);
            call.resolve(ret);
        }).start();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(LmsNotificationHelper.PREFS_NAME, Context.MODE_PRIVATE);
        String role = prefs.getString("user_role", null);
        String userId = prefs.getString("user_id", null);

        JSObject ret = new JSObject();
        ret.put("configured", role != null || userId != null);
        ret.put("role", role);
        ret.put("userId", userId);
        call.resolve(ret);
    }
}
