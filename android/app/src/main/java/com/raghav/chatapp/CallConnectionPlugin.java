package com.raghav.chatapp;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.app.NotificationManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tiny bridge that lets the web layer start/stop the ongoing-call foreground
 * service so WebRTC survives screen-off and backgrounding.
 */
@CapacitorPlugin(name = "CallConnection")
public class CallConnectionPlugin extends Plugin {

    static final String CALL_SETTINGS_PREFS = "call_notification_setup";
    static final String OPEN_NOTIFICATION_SETTINGS_ON_RESUME = "open_notifications_on_resume";

    @PluginMethod
    public void isAppInForeground(PluginCall call) {
        JSObject result = new JSObject();
        result.put("foreground", AppForegroundState.isForeground());
        call.resolve(result);
    }

    @PluginMethod
    public void openCallNotificationSettings(PluginCall call) {
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        boolean notificationsGranted =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED;
        if (
            notificationsGranted &&
            Build.VERSION.SDK_INT >= 34 &&
            manager != null &&
            !manager.canUseFullScreenIntent()
        ) {
            getContext()
                .getSharedPreferences(CALL_SETTINGS_PREFS, 0)
                .edit()
                .putBoolean(OPEN_NOTIFICATION_SETTINGS_ON_RESUME, true)
                .apply();

            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } else {
            openAppNotificationSettings();
        }
        call.resolve();
    }

    void openAppNotificationSettings() {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    @PluginMethod
    public void start(PluginCall call) {
        // Only start the foreground service once mic access is granted; starting
        // a microphone-type FGS without the permission would throw on Android 14
        // and crash the app.
        if (
            getContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            call.resolve();
            return;
        }

        final Intent intent = new Intent(getContext(), CallForegroundService.class);
        intent.setAction(CallForegroundService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        final Intent intent = new Intent(getContext(), CallForegroundService.class);
        intent.setAction(CallForegroundService.ACTION_STOP);
        try {
            getContext().startService(intent);
        } catch (Exception ignored) {
            // Service already stopped - nothing to do.
        }
        call.resolve();
    }
}
