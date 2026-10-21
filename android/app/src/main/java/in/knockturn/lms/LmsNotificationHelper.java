package in.knockturn.lms;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class LmsNotificationHelper {
    public static final String TAG = "LmsNotification";
    public static final String APPROVALS_CHANNEL_ID = "lms_approvals_channel";
    public static final String PERSISTENT_CHANNEL_ID = "lms_persistent_channel";
    public static final String PREFS_NAME = "lms_background_prefs";

    private static final String SUPABASE_URL = "https://gykfyiqujyiwchqgmsjx.supabase.co/rest/v1/app_notifications?select=*&order=created_at.desc&limit=20";
    private static final String SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5a2Z5aXF1anlpd2NocWdtc2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODU4MzcsImV4cCI6MjA4MzM2MTgzN30.x_kTc_EUfq2Y3cldzLwdHM0M7jcYIzAr37TRjsx3fqY";

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm == null) return;

            // 1. High-priority approvals channel for Lock Screen & Heads-up alerts
            NotificationChannel approvalChan = nm.getNotificationChannel(APPROVALS_CHANNEL_ID);
            if (approvalChan == null) {
                approvalChan = new NotificationChannel(
                    APPROVALS_CHANNEL_ID,
                    "Leave & Permission Approvals",
                    NotificationManager.IMPORTANCE_HIGH
                );
                approvalChan.setDescription("High-priority alerts for employee leaves and permissions");
                approvalChan.enableLights(true);
                approvalChan.setLightColor(Color.parseColor("#06B6D4"));
                approvalChan.enableVibration(true);
                approvalChan.setVibrationPattern(new long[]{0, 250, 250, 250});
                approvalChan.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .build();
                approvalChan.setSound(soundUri, audioAttributes);
                nm.createNotificationChannel(approvalChan);
            }

            // 2. Low-priority background service channel
            NotificationChannel persistentChan = nm.getNotificationChannel(PERSISTENT_CHANNEL_ID);
            if (persistentChan == null) {
                persistentChan = new NotificationChannel(
                    PERSISTENT_CHANNEL_ID,
                    "LMS Background Alert Service",
                    NotificationManager.IMPORTANCE_LOW
                );
                persistentChan.setDescription("Maintains background monitoring for real-time leave approvals");
                persistentChan.setShowBadge(false);
                persistentChan.setLockscreenVisibility(NotificationCompat.VISIBILITY_SECRET);
                nm.createNotificationChannel(persistentChan);
            }
        }
    }

    public static void checkAndDispatchNotifications(Context context) {
        ensureChannels(context);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String userRole = prefs.getString("user_role", null);
        String userId = prefs.getString("user_id", null);
        String userCode = prefs.getString("user_code", null);

        // If no user is logged in yet, skip check
        if (userRole == null && userId == null) {
            return;
        }

        String rawSeen = prefs.getString("seen_ids", "");
        Set<String> seenIds = new HashSet<>();
        if (!rawSeen.isEmpty()) {
            seenIds.addAll(Arrays.asList(rawSeen.split(",")));
        }

        boolean isFirstRun = prefs.getBoolean("is_first_run", true);

        try {
            URL url = new URL(SUPABASE_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            int responseCode = conn.getResponseCode();
            if (responseCode != 200) {
                Log.w(TAG, "Supabase request returned status " + responseCode);
                conn.disconnect();
                return;
            }

            BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = in.readLine()) != null) {
                sb.append(line);
            }
            in.close();
            conn.disconnect();

            JSONArray array = new JSONArray(sb.toString());

            // On first startup, seed seen IDs with all existing notifications so user isn't spammed
            if (isFirstRun) {
                for (int i = 0; i < array.length(); i++) {
                    JSONObject obj = array.getJSONObject(i);
                    seenIds.add(String.valueOf(obj.optLong("id")));
                }
                prefs.edit()
                    .putBoolean("is_first_run", false)
                    .putString("seen_ids", String.join(",", seenIds))
                    .apply();
                return;
            }

            String currentRole = userRole != null ? userRole.trim().toLowerCase() : "";
            String curId = userId != null ? userId.trim().toLowerCase() : "";
            String curCode = userCode != null ? userCode.trim().toLowerCase() : "";

            boolean newSeenAdded = false;

            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                long id = obj.optLong("id", -1);
                if (id <= 0) continue;

                String idStr = String.valueOf(id);
                if (seenIds.contains(idStr)) {
                    continue;
                }

                // New unseen notification found
                seenIds.add(idStr);
                newSeenAdded = true;

                String targetRole = obj.optString("role", "").trim().toLowerCase();
                String targetUserId = obj.optString("user_id", "").trim().toLowerCase();

                boolean isForMe = false;
                if (!targetUserId.isEmpty() && (targetUserId.equals(curId) || targetUserId.equals(curCode))) {
                    isForMe = true;
                } else if (!targetRole.isEmpty()) {
                    if (currentRole.equals("admin") || currentRole.equals("hr")) {
                        // Admin & HR both receive admin & hr role broadcasts
                        if (targetRole.equals("admin") || targetRole.equals("hr")) {
                            isForMe = true;
                        }
                    } else if (currentRole.equals(targetRole)) {
                        isForMe = true;
                    }
                }

                if (isForMe) {
                    dispatchNativeNotification(context, obj);
                }
            }

            if (newSeenAdded) {
                // Keep set within last 300 IDs
                if (seenIds.size() > 300) {
                    seenIds = new HashSet<>(Arrays.asList(seenIds.toArray(new String[0])).subList(seenIds.size() - 250, seenIds.size()));
                }
                prefs.edit().putString("seen_ids", String.join(",", seenIds)).apply();
            }

        } catch (Exception e) {
            Log.e(TAG, "Error checking notifications: " + e.getMessage());
        }
    }

    private static void dispatchNativeNotification(Context context, JSONObject item) {
        try {
            int notifId = (int) item.optLong("id", System.currentTimeMillis() % 100000);
            String title = item.optString("title", "LMS Notification");
            String message = item.optString("message", "You have a new update.");
            String relatedType = item.optString("related_type", item.optString("type", ""));
            int relatedId = item.optInt("related_id", 0);

            Intent clickIntent = new Intent(context, MainActivity.class);
            clickIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            clickIntent.putExtra("notification_id", notifId);
            clickIntent.putExtra("related_type", relatedType);
            clickIntent.putExtra("related_id", relatedId);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                notifId,
                clickIntent,
                flags
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, APPROVALS_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_EVENT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setVibrate(new long[]{0, 250, 250, 250})
                .setContentIntent(pendingIntent);

            NotificationManagerCompat.from(context).notify(notifId, builder.build());
            Log.d(TAG, "Native alert notification fired for ID " + notifId + ": " + title);

        } catch (Exception e) {
            Log.e(TAG, "Error dispatching native notification: " + e.getMessage());
        }
    }
}
