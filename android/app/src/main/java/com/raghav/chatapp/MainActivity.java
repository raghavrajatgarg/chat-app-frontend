package com.raghav.chatapp;

import android.os.Bundle;
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
    }

    @Override
    public void onPause() {
        AppForegroundState.setForeground(false);
        super.onPause();
    }
}
