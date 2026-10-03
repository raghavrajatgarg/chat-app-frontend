package com.raghav.chatapp;

import android.os.Bundle;
import android.content.SharedPreferences;
import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugin (not from node_modules) that drives the ongoing-call
        // foreground service; must be registered before super.onCreate().
        registerPlugin(CallConnectionPlugin.class);
        // Plugins are auto-registered by Capacitor from
        // android/app/src/main/assets/capacitor.plugins.json, so no manual
        // registerPlugin() calls are needed here. The previous calls referenced
        // io.capgo.cacapacitorincomingcallkit.CapacitorIncomingCallKit and
        // com.getcapacitor.community.firebase.messaging.FirebaseMessagingPlugin,
        // neither of which exist on the classpath (they fail the build).
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        AppForegroundState.setForeground(true);
        SharedPreferences preferences = getSharedPreferences(
            CallConnectionPlugin.CALL_SETTINGS_PREFS,
            MODE_PRIVATE
        );
        if (preferences.getBoolean(CallConnectionPlugin.OPEN_NOTIFICATION_SETTINGS_ON_RESUME, false)) {
            preferences.edit().remove(CallConnectionPlugin.OPEN_NOTIFICATION_SETTINGS_ON_RESUME).apply();
            new android.os.Handler(getMainLooper()).post(() -> {
                Intent settingsIntent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                settingsIntent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                startActivity(settingsIntent);
            });
        }
    }

    @Override
    public void onPause() {
        AppForegroundState.setForeground(false);
        super.onPause();
    }
}
