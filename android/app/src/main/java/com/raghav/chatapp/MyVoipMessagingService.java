package com.raghav.chatapp;

import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import app.capgo.incomingcallkit.IncomingCallController;
import app.capgo.incomingcallkit.IncomingCallRecord;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Map;

/**
 * Single FCM entry point for the app.
 *
 * It extends the Capacitor push-notifications service and only delegates to
 * super for non-VoIP messages, so regular chat notifications keep reaching the
 * JS bridge while VoIP call rings are intercepted and handed to the native
 * incoming-call UI (lock screen / full screen).
 *
 * NOTE: an app must declare exactly one com.google.firebase.MESSAGING_EVENT
 * service, otherwise FCM delivery becomes non-deterministic and VoIP pushes can
 * silently land in another service. The two library-declared services are
 * removed in AndroidManifest.xml via tools:node="remove".
 */
public class MyVoipMessagingService extends MessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();

        if (data != null && "true".equals(data.get("isVoip"))) {
            // If the app is already open, the socket-driven in-app UI is ringing;
            // raising the OS full-screen call as well would show two UIs. The
            // offer is still stored server-side, so a foreground answer works.
            if (AppForegroundState.isForeground()) {
                return;
            }

            String callId = data.get("roomId");
            if (callId == null) {
                callId = data.get("callId");
            }
            if (callId == null) {
                callId = String.valueOf(System.currentTimeMillis());
            }

            String callerName = data.get("callerName");
            if (callerName == null) {
                callerName = "Incoming Call";
            }

            String fromUid = data.get("fromUid");
            String signalOffer = data.get("signalOffer");

            JSONObject extra = new JSONObject();
            try {
                if (signalOffer != null) extra.put("signalOffer", signalOffer);
                if (fromUid != null) extra.put("fromUid", fromUid);
                extra.put("callerName", callerName);
                extra.put("roomId", callId);
            } catch (JSONException ignored) {}

            IncomingCallRecord record = new IncomingCallRecord(
                callId,
                callerName,
                fromUid,
                null,
                true,
                60000L,
                "Accept",
                "Decline",
                "incoming_call_kit",
                "Incoming Calls",
                true,
                null,
                null,
                true,
                extra,
                "ringing"
            );

            IncomingCallController.showIncomingCall(getApplicationContext(), record, true);
            // Do not fall through: a VoIP ring must not surface as a chat
            // notification as well.
            return;
        }

        super.onMessageReceived(remoteMessage);
    }
}
