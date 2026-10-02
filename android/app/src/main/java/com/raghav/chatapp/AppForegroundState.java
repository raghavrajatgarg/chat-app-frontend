package com.raghav.chatapp;

/**
 * Process-wide flag telling whether the app's activity is currently in the
 * foreground. The native VoIP push handler reads this so an incoming call is
 * only raised as an OS full-screen call when the app is backgrounded; while the
 * app is open the in-app (socket driven) UI rings instead of showing both.
 */
public final class AppForegroundState {

    private static volatile boolean foreground = false;

    private AppForegroundState() {}

    public static void setForeground(boolean value) {
        foreground = value;
    }

    public static boolean isForeground() {
        return foreground;
    }
}
