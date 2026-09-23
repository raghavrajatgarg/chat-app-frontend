import React, { useEffect, useRef } from "react";
import styles from "../App.module.css";

export default function CallModal({
  callStatus, // "calling", "incoming", "connected"
  callerName,
  onAccept,
  onReject,
  localVideoRef,
  remoteVideoRef,
}) {
  const audioRef = useRef(null);

  // Play/Stop ringing sound based on call status
  useEffect(() => {
    if (callStatus === "incoming" || callStatus === "calling") {
      audioRef.current?.play().catch(() => {});
    } else {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    }
  }, [callStatus]);

  if (callStatus === "idle") return null;

  return (
    <div className={styles.modalOverlay}>
      <audio
        ref={audioRef}
        src="https://assets.mixkit.co/active_storage/sfx/1350/1350-preview.mp3"
        loop
      />

      <div className={styles.callCard}>
        {callStatus === "connected" ? (
          <div className={styles.videoContainer}>
            <video ref={remoteVideoRef} autoPlay playsInline className={styles.remoteVideo} />
            <video ref={localVideoRef} autoPlay playsInline muted className={styles.localVideo} />
            <button className={styles.hangupBtn} onClick={onReject}>
              End Call
            </button>
          </div>
        ) : (
          <div className={styles.ringContainer}>
            <h3>{callStatus === "incoming" ? `Incoming Call from...` : `Calling...`}</h3>
            <h1>{callerName}</h1>
            
            <div className={styles.actions}>
              {callStatus === "incoming" && (
                <button className={styles.acceptBtn} onClick={onAccept}>
                  Accept
                </button>
              )}
              <button className={styles.rejectBtn} onClick={onReject}>
                Decline / Hang Up
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}