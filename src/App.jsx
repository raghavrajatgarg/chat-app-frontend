import { useRef, useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import styles from './styles/App.module.scss';
import { auth } from './firebase';
import LoginCard from './components/LoginCard';
import ChatShell from './components/ChatShell';
import DeleteModal from './components/DeleteModal';
import EditMessageModal from './components/EditMessageModal';
import InfoModal from './components/InfoModal';
import CallModal from './components/CallModal';
import ScreenCaptureModal from './components/ScreenCaptureModal';
import Lightbox from './components/Lightbox';
import useAudioRecorder from './hooks/useAudioRecorder';
import useCall from './hooks/useCall';
import useChatController from './hooks/useChatController';
import useLightbox from './hooks/useLightbox';
import useDemoController from './hooks/useDemoController';

export default function App() {
  const demo = useDemoController();
  const socketRef = useRef(null);
  const userRef = useRef(null);
  const call = useCall({ userRef, socketRef });
  const chat = useChatController({ callControllerRef: call.controllerRef, providedSocketRef: socketRef });
  const recording = useAudioRecorder();
  const lightbox = useLightbox();
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [captureType, setCaptureType] = useState('screen');
  const [isDemo, setIsDemo] = useState(false);
  const activeChat = isDemo ? demo : chat;
  const { setSelectedImage } = activeChat;
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [displayNameStatus, setDisplayNameStatus] = useState('');

  useEffect(() => { userRef.current = activeChat.user; }, [activeChat.user, userRef]);
  useEffect(() => {
    if (activeChat.isSettingsOpen) {
      setDisplayNameDraft(activeChat.user?.displayName || '');
      setDisplayNameStatus('');
    }
  }, [activeChat.isSettingsOpen, activeChat.user]);

  useEffect(() => {
    window.triggerStudioEditOverride = (image) => {
      setCaptureType('camera');
      setSelectedImage(image);
      setIsStudioOpen(true);
    };
    return () => { window.triggerStudioEditOverride = null; };
  }, [setSelectedImage]);

  if (chat.loading && !isDemo) return <div className={styles.loader}><h3>Loading...</h3></div>;

  const handleDelete = () => {
    if (isDemo) {
      demo.deleteMessage();
      return;
    }
    chat.setIsDeleting(true);
    chat.socketRef.current?.emit('delete_message', { messageId: chat.deleteModalMessageId, userId: chat.user.uid });
    setTimeout(() => { chat.setIsDeleting(false); chat.setDeleteModalMessageId(null); }, 500);
  };

  const saveDisplayName = async (event) => {
    event.preventDefault();
    try {
      await activeChat.handleUpdateDisplayName(displayNameDraft);
      setDisplayNameStatus('Display name updated.');
    } catch (error) {
      setDisplayNameStatus(error.message);
    }
  };

  return (
    <div className={styles.container}>
      {!isDemo && !chat.user ? <LoginCard onLogin={chat.handleGoogleLogin} onEmailLogin={chat.handleEmailLogin} onRefreshUser={chat.refreshUser} onUpdateDisplayName={chat.handleUpdateDisplayName} onPreview={() => setIsDemo(true)} /> : (
        <>
          {isDemo && <div className={styles.previewBanner}><span>Preview mode: changes stay in this browser and are never saved.</span><button type="button" onClick={() => setIsDemo(false)}>Create an account</button></div>}
          <ChatShell state={activeChat} recording={recording} styles={styles}
            onStudioOpen={() => setIsStudioOpen(true)} onCaptureTypeChange={setCaptureType}
            onOpenLightbox={lightbox.setActiveLightboxImage} onStartCall={() => window.alert('Calls are available after you create an account.')} />
        </>
      )}
      <Lightbox image={lightbox.activeLightboxImage} styles={styles} lightbox={lightbox}
        onEdit={(image) => { window.triggerStudioEditOverride?.(image); lightbox.closeLightbox(); }} />
      {activeChat.editingMessageId && <EditMessageModal isOpen initialText={activeChat.editingText} onSave={activeChat.handleEditMessage}
        onClose={() => { activeChat.setEditingMessageId(null); activeChat.setEditingText(''); }} />}
      {activeChat.infoModalMessage && <InfoModal message={activeChat.infoModalMessage} onClose={() => activeChat.setInfoModalMessage(null)} />}
      {activeChat.deleteModalMessageId && <DeleteModal isDeleting={activeChat.isDeleting}
        onCancel={() => activeChat.setDeleteModalMessageId(null)} onDelete={handleDelete} />}
      {activeChat.isSettingsOpen && (
        <div className={styles.modalOverlay} onClick={() => activeChat.setIsSettingsOpen(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <h3>User Settings</h3>
            <div className={styles.settingsProfile}>
              <img src={activeChat.user.photoURL} alt="" className={styles.settingsProfileAvatar} />
              <p className={styles.settingsProfileName}>{activeChat.user.displayName}</p>
              <p className={styles.settingsProfileEmail}>{activeChat.user.email}</p>
            </div>
            <form onSubmit={saveDisplayName} className={styles.settingsNameForm}>
              <label htmlFor="display-name">Global display name</label>
              <input id="display-name" className={styles.settingsNameInput} value={displayNameDraft} onChange={(event) => setDisplayNameDraft(event.target.value)} maxLength={50} required />
              <button className={styles.modalCancelBtn} type="submit">Save display name</button>
              {displayNameStatus && <p className={styles.settingsStatus} role="status">{displayNameStatus}</p>}
            </form>
            <div className={styles.settingsActions}>
              <button className={styles.modalDeleteBtn} onClick={() => {
                activeChat.setIsSettingsOpen(false);
                if (isDemo) {
                  setIsDemo(false);
                } else {
                  signOut(auth);
                }
              }}>Log Out</button>
              <button className={styles.modalCancelBtn} onClick={() => activeChat.setIsSettingsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      <CallModal callStatus={call.callStatus} callerName={call.callerInfo.name}
        onAccept={call.acceptCall} onReject={call.handleHangup}
        localStream={call.localStream} remoteStream={call.remoteStream} />
      <ScreenCaptureModal isOpen={isStudioOpen} onClose={() => setIsStudioOpen(false)}
        onSaveScreenshot={activeChat.setSelectedImage} captureType={captureType} selectedImage={activeChat.selectedImage} />
    </div>
  );
}
