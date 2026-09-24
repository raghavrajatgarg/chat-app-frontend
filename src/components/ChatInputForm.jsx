import { useState, useRef, useEffect } from 'react';
import styles from '../App.module.css';
import ScreenCaptureModal from './ScreenCaptureModal';

export default function ChatInputForm({
  newMessage,
  handleInputChange,
  handlePaste,
  handleSendMessage,
  roomLoading,
  isSendingImage,
  fileInputRef,
  handleImageSelect,
  isSending,
  isRecording,
  startRecording,
  stopRecording,
  cancelRecording,
  recordedAudioUrl,
  setRecordedAudioUrl,
  recordingTime,
  handleSendAudio,
  setSelectedImage,
  setIsStudioOpen,
  setCaptureType
}) {
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const menuRef = useRef(null);
  const textareaRef = useRef(null);
  const cameraInputRef = useRef(null);
  // Inside src/components/ChatInputForm.jsx (Near the top of the component)
const handleCameraCapture = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const base64DataUrl = event.target.result;
    
    // First setup type boundaries
    setCaptureType('camera');
    
    // Pass the raw base64 data to our chat preview AND trigger the studio modal setup
    setSelectedImage(base64DataUrl); 
    setIsStudioOpen(base64DataUrl); // FIX: Pass dataUrl directly as truthy verification flag
  };
};


  // Automatically reset textarea height when the message is cleared/sent
  useEffect(() => {
    if (!newMessage && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [newMessage]);

  const handleTextareaChange = (e) => {
    handleInputChange(e);
    
    // Dynamic height adjustment
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // Reset height temporarily to recalculate
      textarea.style.height = `${textarea.scrollHeight}px`; // Set to content height
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Close dropup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAttachClick = () => {
    setShowAttachMenu((prev) => !prev);
  };

  const handleSelectPhotos = () => {
    setShowAttachMenu(false);
    fileInputRef.current.click();
  };

  const handleSelectAudio = () => {
    setShowAttachMenu(false);
    startRecording();
  };

  return (
    <div className={styles.formWidthWrapper}>
      {isRecording ? (
        <div className={styles.recordingBar}>
          <div className={styles.recordingIndicator}>
            <span className={styles.recordingPulseDot} />
            <span className={styles.recordingTimer}>{formatTime(recordingTime)}</span>
            <span className={styles.recordingText}>Recording...</span>
          </div>
          <div className={styles.recordingActions}>
            <button type="button" onClick={cancelRecording} className={styles.cancelAudioBtn} title="Cancel recording">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
</svg> <span className={styles.btnText}>Cancel</span>
            </button>
            <button type="button" onClick={stopRecording} className={styles.stopAudioBtn} title="Stop recording">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-check" viewBox="0 0 16 16">
  <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/>
</svg> <span className={styles.btnText}>Done</span>
            </button>
          </div>
        </div>
      ) : recordedAudioUrl ? (
        <div className={styles.audioPreviewBar}>
          <audio src={recordedAudioUrl} controls className={styles.previewAudioPlayer} />
          <div className={styles.recordingActions}>
            <button type="button" onClick={cancelRecording} className={styles.cancelAudioBtn} title="Discard">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
</svg> <span className={styles.btnText}>Discard</span>
            </button>
            <button type="button" onClick={handleSendAudio} className={styles.sendAudioBtn} title="Send Voice Note">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-send" viewBox="0 0 16 16">
  <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z"/>
</svg> <span className={styles.btnText}>Send Voice Note</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className={styles.chatForm}>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} />
          
          {/* Attachment Button & Dropup Menu Container */}
          <div className={styles.attachMenuContainer} ref={menuRef}>
            <button 
              type="button" 
              onClick={handleAttachClick} 
              className={styles.logoutBtn} 
              style={{padding: '10px 12px', borderColor: '#374151', color: '#9ca3af', marginRight: '-4px'}} 
              title="Attach"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z"/>
              </svg>
            </button>

{showAttachMenu && (
  <div className={styles.attachDropup}>
    {/* Option 1: Standard Photos Upload */}
    <button type="button" onClick={handleSelectPhotos} className={styles.dropupItem}>
      <svg xmlns="http://w3.org" width="16" height="16" fill="currentColor" className="bi bi-image" viewBox="0 0 16 16">
        <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/>
        <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
      </svg>
      <span>Upload Photo</span>
    </button>

    {/* Option 2: Desktop Screen Studio Picker */}
    <button 
      type="button" 
      onClick={() => { setShowAttachMenu(false); setCaptureType('screen'); setIsStudioOpen(true); }} 
      className={styles.dropupItem}
    >
      <svg xmlns="http://w3.org" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M1.5 1a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 1 0v-2.5h2.5a.5.5 0 0 0 0-1zM12 1.5a.5.5 0 0 1 .5-.5h2.5a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-1 0v-2.5h-2.5a.5.5 0 0 1-.5-.5M1.5 12a.5.5 0 0 1 .5.5v2.5h2.5a.5.5 0 0 1 0 1H1.5a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5m13 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1h2.5v-2.5a.5.5 0 0 1 .5-.5M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1"/>
      </svg>
      <span>Screenshot Studio</span>
    </button>

    {/* Option 3: NEW SEPARATE MOBILE CAMERA STUDIO BUTTON */}
{/* 1. Hidden inputs mounted near the top of the form layout */}
<input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} />

{/* ADD THIS LOGIC LINE: Hidden mobile native camera input framework */}
<input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleCameraCapture} style={{ display: 'none' }} />

{/* 2. Inside your attachDropup panel, adjust the Camera Studio button to trigger this input */}
<button 
  type="button" 
  onClick={() => { setShowAttachMenu(false); cameraInputRef.current.click(); }} 
  className={styles.dropupItem}
>
  <svg xmlns="http://w3.org" width="16" height="16" fill="currentColor" className="bi bi-camera" viewBox="0 0 16 16">
    <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z"/>
    <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
  </svg>
  <span>Camera Studio</span>
</button>

    {/* Option 4: Existing Voice Note button */}
    <button type="button" onClick={handleSelectAudio} className={`${styles.dropupItem} ${styles.voiceBtn}`}>
      {/* Existing voice svg tag logic content remains completely untouched */}
      <span>Voice Note</span>
    </button>
  </div>
)}

          </div>

          {/* Mic Button - Hidden automatically on mobile via CSS media query */}
          <button 
            type="button" 
            onClick={startRecording} 
            className={`${styles.micBtn} ${styles.desktopMicBtn}`} 
            style={{padding: '8px 12px', borderColor: '#374151', color: '#9ca3af'}} 
            title="Record Voice Note"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"/>
              <path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3"/>
            </svg>
          </button>

<textarea
  value={newMessage}
  onChange={handleInputChange}
  onPaste={handlePaste}
  onKeyDown={(e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevents adding a newline
      // Trigger message submission if not empty
      if (newMessage.trim() && !roomLoading && !isSendingImage && !isSending) {
        // Find the form element and submit it programmatically
        e.target.form.requestSubmit();
      }
    }
  }}
  placeholder={isSendingImage ? "Sending image asset..." : roomLoading ? "Loading room..." : "Type a message..."}
  disabled={roomLoading || isSendingImage || isSending}
  rows={1}
  className={styles.chatInput} 
/>
          
          <button type="submit" disabled={roomLoading || isSendingImage || isSending} className={styles.sendBtn}>
             {isSendingImage ? (
               <span className={styles.inlineSpinner} />
             ) : (
               <>
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                   <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z"/>
                 </svg>
                 <span className={styles.btnText} style={{marginLeft: '6px'}}>Send</span>
               </>
             )}
          </button>
        </form>
      )}
      {/* Inject custom modal instance parameters loop inside base layout wrapper container */}
    </div> // End of formWidthWrapper div node
  );
}