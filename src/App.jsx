import { useRef, useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import styles from "./styles/App.module.scss";
import { auth } from "./firebase";
import LoginCard from "./components/LoginCard";
import ChatShell from "./components/ChatShell";
import DeleteModal from "./components/DeleteModal";
import EditMessageModal from "./components/EditMessageModal";
import InfoModal from "./components/InfoModal";
import CallModal from "./components/CallModal";
import ScreenCaptureModal from "./components/ScreenCaptureModal";
import Lightbox from "./components/Lightbox";
import useAudioRecorder from "./hooks/useAudioRecorder";
import useCall from "./hooks/useCall";
import useChatController from "./hooks/useChatController";
import useLightbox from "./hooks/useLightbox";
import useDemoController from "./hooks/useDemoController";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import axios from "axios";

export default function App() {
  const demo = useDemoController();
  const socketRef = useRef(null);
  const userRef = useRef(null);
  const callPermissionSetupRef = useRef(null);
  const call = useCall({ userRef, socketRef });
  const callRef = useRef(call);
  useEffect(() => {
    callRef.current = call;
  }, [call]);
  const chat = useChatController({
    callControllerRef: call.controllerRef,
    providedSocketRef: socketRef,
  });
  const recording = useAudioRecorder();
  const lightbox = useLightbox();
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [captureType, setCaptureType] = useState("screen");
  const [isDemo, setIsDemo] = useState(false);
  const activeChat = isDemo ? demo : chat;
  const { setSelectedImage } = activeChat;
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [displayNameStatus, setDisplayNameStatus] = useState("");
  useEffect(() => {
    userRef.current = activeChat.user;
  }, [activeChat.user, userRef]);
  useEffect(() => {
    if (activeChat.isSettingsOpen) {
      setDisplayNameDraft(activeChat.user?.displayName || "");
      setDisplayNameStatus("");
    }
  }, [activeChat.isSettingsOpen, activeChat.user]);

  useEffect(() => {
    window.triggerStudioEditOverride = (image) => {
      setCaptureType("camera");
      setSelectedImage(image);
      setIsStudioOpen(true);
    };
    return () => {
      window.triggerStudioEditOverride = null;
    };
  }, [setSelectedImage]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      callPermissionSetupRef.current = Promise.resolve({
        notificationsGranted: false,
      });
      return undefined;
    }

    const promptKey = "call-notification-permissions-prompted-v1";
    const wasPrompted = window.localStorage.getItem(promptKey);

    callPermissionSetupRef.current = (async () => {
      try {
        const { IncomingCallKit } = await import(
          "@capgo/capacitor-incoming-call-kit"
        );
        let permissions = await IncomingCallKit.checkPermissions();

        if (!wasPrompted && (
          permissions.notifications === "prompt" ||
          permissions.notifications === "prompt-with-rationale"
        )) {
          permissions = await IncomingCallKit.requestPermissions();
        }

        let notificationsGranted = permissions.notifications === "granted";
        if (permissions.notifications === "notApplicable") {
          const pushPermission = await PushNotifications.requestPermissions();
          notificationsGranted = pushPermission.receive === "granted";
        }

        if (!wasPrompted && Capacitor.getPlatform() === "android") {
          const callConnection = Capacitor.registerPlugin("CallConnection");
          await callConnection.openCallNotificationSettings();
        }
        if (!wasPrompted) window.localStorage.setItem(promptKey, "true");
        return { notificationsGranted };
      } catch (error) {
        console.warn("First-launch call permission setup failed:", error);
        return { notificationsGranted: false };
      }
    })();
    return undefined;
  }, []);

// Native Mobile Device Call Handler Integration
useEffect(() => {
  if (!Capacitor.isNativePlatform() || !chat.user) return undefined;

  let cancelled = false;
  let registrationListener;
  let answerSubscription;
  let declineSubscription;

  const setupNativeCalling = async () => {
    // Install this before register(), which may emit the token immediately.
    try {
      registrationListener = await PushNotifications.addListener(
        "registration",
        async (token) => {
          if (cancelled) return;
          console.log("FCM Device Token:", token.value);
          try {
            const idToken = await chat.user.getIdToken();
            await axios.post(
              `${chat.BACKEND_URL}/api/users/save-fcm-token`,
              { token: token.value },
              { headers: { Authorization: `Bearer ${idToken}` } },
            );
          } catch (err) {
            console.error("Failed to map push token on backend:", err);
          }
        },
      );
    } catch (error) {
      console.warn("Failed to attach FCM registration listener:", error);
    }

    const permissionStatus = await callPermissionSetupRef.current;

    // Register only after the token listener and first-launch permission flow are ready.
    try {
      if (permissionStatus?.notificationsGranted) {
        await PushNotifications.register();
      }
    } catch (error) {
      console.warn("Push registration failed:", error);
    }

    // 3. Load the native call kit. The plugin exports `IncomingCallKit`
    //    (not `CapacitorIncomingCallKit`) - the wrong name here meant the
    //    listeners below silently never attached.
    let IncomingCallKit;
    try {
      ({ IncomingCallKit } = await import("@capgo/capacitor-incoming-call-kit"));
    } catch (err) {
      console.error("Failed to load native call kit plugin:", err);
      return;
    }
    if (cancelled || !IncomingCallKit) return;

    // The plugin's event payload is { call, reason, source } and the metadata
    // we passed to showIncomingCall lives under call.extra.
    const startCallFromExtra = (extra) => {
      if (!extra) return;
      const fromUid = extra.fromUid || extra.roomId;
      if (!fromUid) return;
      // Older flow shipped the SDP in `extra.signalOffer`; the new flow keeps
      // the offer on the server and the hook pulls it over the socket.
      let signalOffer = null;
      if (extra.signalOffer) {
        try {
          signalOffer = JSON.parse(extra.signalOffer);
        } catch (error) {
          console.warn("Ignoring unparsable native call offer:", error);
        }
      }
      callRef.current.acceptCall({ fromUid, signalOffer });
    };

    // Native UI accept - works from the lock screen, background and cold boot
    // (the plugin buffers the event until a listener is attached).
    answerSubscription = await IncomingCallKit.addListener(
      "callAccepted",
      (event) => {
        console.log("Native call accepted", event);
        startCallFromExtra(event?.call?.extra);
      },
    );

    declineSubscription = await IncomingCallKit.addListener(
      "callDeclined",
      (event) => {
        callRef.current.handleHangup(event?.call?.extra?.fromUid);
      },
    );

    // Cold-boot safety net: if the user answered while the app was killed the
    // buffered event can be missed, so reconcile with the active call list.
    try {
      const { calls } = await IncomingCallKit.getActiveCalls();
      const accepted = (calls || []).find(
        (item) =>
          item.state === "accepted" &&
          (item.extra?.signalOffer ||
            item.extra?.fromUid ||
            item.extra?.roomId),
      );
      if (accepted && !cancelled) startCallFromExtra(accepted.extra);
    } catch (error) {
      console.warn("Failed to inspect active native calls:", error);
    }

    // Pre-grant camera/mic while the app is in the foreground so a cold-start
    // lock-screen accept never stalls on a permission dialog it cannot show.
    callRef.current.warmUpMediaPermissions?.();

  };

  setupNativeCalling();

  return () => {
    cancelled = true;
    registrationListener?.remove();
    answerSubscription?.remove();
    declineSubscription?.remove();
  };
}, [chat.user, chat.BACKEND_URL]);


  if (chat.loading && !isDemo)
    return (
      <div className={styles.loader}>
        <h3>Loading...</h3>
      </div>
    );

  const handleDelete = () => {
    if (isDemo) {
      demo.deleteMessage();
      return;
    }
    chat.setIsDeleting(true);
    chat.socketRef.current?.emit("delete_message", {
      messageId: chat.deleteModalMessageId,
      userId: chat.user.uid,
    });
    setTimeout(() => {
      chat.setIsDeleting(false);
      chat.setDeleteModalMessageId(null);
    }, 500);
  };

  const saveDisplayName = async (event) => {
    event.preventDefault();
    try {
      await activeChat.handleUpdateDisplayName(displayNameDraft);
      setDisplayNameStatus("Display name updated.");
    } catch (error) {
      setDisplayNameStatus(error.message);
    }
  };

  return (
    <div className={styles.container}>
      {!isDemo && !chat.user ? (
        <LoginCard
          onLogin={chat.handleGoogleLogin}
          onEmailLogin={chat.handleEmailLogin}
          onRefreshUser={chat.refreshUser}
          onUpdateDisplayName={chat.handleUpdateDisplayName}
          onPreview={() => setIsDemo(true)}
        />
      ) : (
        <>
          {isDemo && (
            <div className={styles.previewBanner}>
              <span>
                Preview mode: changes stay in this browser and are never saved.
              </span>
              <button type="button" onClick={() => setIsDemo(false)}>
                Create an account
              </button>
            </div>
          )}
          <ChatShell
            state={activeChat}
            recording={recording}
            styles={styles}
            onStudioOpen={() => setIsStudioOpen(true)}
            onCaptureTypeChange={setCaptureType}
            onOpenLightbox={lightbox.setActiveLightboxImage}
            onStartCall={call.startCall}
            handleToggleReaction={activeChat.handleToggleReaction}
          />
        </>
      )}
      <Lightbox
        image={lightbox.activeLightboxImage}
        styles={styles}
        lightbox={lightbox}
        onEdit={(image) => {
          window.triggerStudioEditOverride?.(image);
          lightbox.closeLightbox();
        }}
      />
      {activeChat.editingMessageId && (
        <EditMessageModal
          isOpen
          initialText={activeChat.editingText}
          onSave={activeChat.handleEditMessage}
          onClose={() => {
            activeChat.setEditingMessageId(null);
            activeChat.setEditingText("");
          }}
        />
      )}
      {activeChat.infoModalMessage && (
        <InfoModal
          message={activeChat.infoModalMessage}
          styles={styles}
          allRegisteredUsers={activeChat.allRegisteredUsers}
          onClose={() => activeChat.setInfoModalMessage(null)}
        />
      )}
      {activeChat.deleteModalMessageId && (
        <DeleteModal
          isDeleting={activeChat.isDeleting}
          onCancel={() => activeChat.setDeleteModalMessageId(null)}
          onDelete={handleDelete}
        />
      )}
      {activeChat.isSettingsOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => activeChat.setIsSettingsOpen(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>User Settings</h3>
            <div className={styles.settingsProfile}>
              <img
                src={activeChat.user.photoURL}
                alt=""
                className={styles.settingsProfileAvatar}
              />
              <p className={styles.settingsProfileName}>
                {activeChat.user.displayName}
              </p>
              <p className={styles.settingsProfileEmail}>
                {activeChat.user.email}
              </p>
            </div>
            <form
              onSubmit={saveDisplayName}
              className={styles.settingsNameForm}
            >
              <label htmlFor="display-name">Global display name</label>
              <input
                id="display-name"
                className={styles.settingsNameInput}
                value={displayNameDraft}
                onChange={(event) => setDisplayNameDraft(event.target.value)}
                maxLength={50}
                required
              />
              <button className={styles.modalCancelBtn} type="submit">
                Save display name
              </button>
              {displayNameStatus && (
                <p className={styles.settingsStatus} role="status">
                  {displayNameStatus}
                </p>
              )}
            </form>
            <div className={styles.settingsActions}>
              <button
                className={styles.modalDeleteBtn}
                onClick={() => {
                  activeChat.setIsSettingsOpen(false);
                  if (isDemo) {
                    setIsDemo(false);
                  } else {
                    signOut(auth);
                  }
                }}
              >
                Log Out
              </button>
              <button
                className={styles.modalCancelBtn}
                onClick={() => activeChat.setIsSettingsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <CallModal
        callStatus={call.callStatus}
        callerName={call.callerInfo.name}
        onAccept={call.acceptCall}
        onReject={call.handleHangup}
        localStream={call.localStream}
        remoteStream={call.remoteStream}
      />
      {isStudioOpen && (
        <ScreenCaptureModal
          isOpen={isStudioOpen}
          onClose={(discard = false) => {
            setIsStudioOpen(false);
            if (discard && captureType === "camera")
              activeChat.setSelectedImage(null);
          }}
          onSaveScreenshot={activeChat.setSelectedImage}
          captureType={captureType}
          selectedImage={activeChat.selectedImage}
        />
      )}
    </div>
  );
}
