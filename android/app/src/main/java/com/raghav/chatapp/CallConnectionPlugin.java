package com.raghav.chatapp;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tiny bridge that lets the web layer start/stop the ongoing-call foreground
 * service so WebRTC survives screen-off and backgrounding.
 */
@CapacitorPlugin(name = "CallConnection")
public class CallConnectionPlugin extends Plugin {

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
