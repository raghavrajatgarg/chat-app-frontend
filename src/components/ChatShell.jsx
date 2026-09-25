import Header from './Header';
import Sidebar from './Sidebar';
import ChatFeed from './ChatFeed';
import TypingIndicator from './TypingIndicator';
import ChatInputForm from './ChatInputForm';
import ThreadView from './ThreadView';

export default function ChatShell({ state, styles, recording, onStudioOpen, onStartCall, onCaptureTypeChange, onOpenLightbox }) {
  const {
    user, room, isPrivateRoom, activeHeaderTitle, activeHeaderAvatar, activeHeaderUser, isHeaderUserOnline,
    searchQuery, setSearchQuery, searchInputRef, setIsMobileMenuOpen, setIsSettingsOpen, activeUsers,
    isMobileMenuOpen, unreadCounts, allRegisteredUsers, handleSelectRoom, handleOpenPrivateChat,
    filteredMessages, roomLoading, selectedImage, setSelectedImage, isSendingImage, editingMessageId,
    setEditingMessageId, editingText, setEditingText, handleEditMessage, openMenuId, setOpenMenuId,
    setDeleteModalMessageId, highlightText, messagesEndRef, setInfoModalMessage, loadMoreMessages,
    hasMorePages, isFetchingMore, setShowScrollBtn, setActiveThreadMessage,
    typingUser, activeThreadMessage, setThreadInput, threadMessages, threadInput, handleSendThreadReply,
    newMessage, handleInputChange, handlePaste, handleSendMessage, fileInputRef, isSending,
    handleImageSelect, setSelectedImage: selectImage,
  } = state;

  return (
    <div className={styles.chatWrapper}>
      <Header user={user} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchInputRef={searchInputRef}
        handleSvgClick={() => searchInputRef.current?.focus()} onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onOpenSettings={() => setIsSettingsOpen(true)} room={room} isPrivateRoom={isPrivateRoom} headerTitle={activeHeaderTitle}
        headerAvatar={activeHeaderAvatar} activeHeaderUser={activeHeaderUser} isHeaderUserOnline={isHeaderUserOnline}
        formatLastSeen={state.formatLastSeen} startCall={onStartCall} activeUsers={activeUsers} />
      <div className={styles.mainContent}>
        <div className={`${styles.backdrop} ${isMobileMenuOpen ? styles.backdropVisible : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
        <Sidebar roomsList={state.ROOMS_LIST} room={room} onSelectRoom={handleSelectRoom} onSelectPrivateChat={handleOpenPrivateChat}
          unreadCounts={unreadCounts} activeUsers={activeUsers} allUsers={allRegisteredUsers} currentUser={user}
          isMobileMenuOpen={isMobileMenuOpen} onCloseMobileMenu={() => setIsMobileMenuOpen(false)} />
        <div className={styles.chatWindow}>
          <ChatFeed messages={filteredMessages} user={user} searchQuery={searchQuery} roomLoading={roomLoading} room={room}
            selectedImage={selectedImage} isSendingImage={isSendingImage} setSelectedImage={setSelectedImage}
            editingMessageId={editingMessageId} setEditingMessageId={setEditingMessageId} editingText={editingText}
            setEditingText={setEditingText} handleEditMessage={handleEditMessage} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
            setDeleteModalMessageId={setDeleteModalMessageId} highlightText={highlightText} messagesEndRef={messagesEndRef}
            setInfoModalMessage={setInfoModalMessage} loadMoreMessages={loadMoreMessages} hasMorePages={hasMorePages}
            isFetchingMore={isFetchingMore} setShowScrollBtn={setShowScrollBtn} setActiveThreadMessage={setActiveThreadMessage}
            setActiveLightboxImage={onOpenLightbox} />
          <TypingIndicator typingUser={typingUser} />
          <ThreadView activeThreadMessage={activeThreadMessage} setActiveThreadMessage={setActiveThreadMessage}
            threadMessages={threadMessages} user={user} threadInput={threadInput} setThreadInput={setThreadInput}
            handleSendThreadReply={handleSendThreadReply} />
          <ChatInputForm newMessage={newMessage} handleInputChange={handleInputChange} handlePaste={handlePaste}
            handleSendMessage={handleSendMessage} roomLoading={roomLoading} isSendingImage={isSendingImage} fileInputRef={fileInputRef}
            isSending={isSending} handleImageSelect={handleImageSelect} isRecording={recording.isRecording}
            startRecording={recording.startRecording} stopRecording={recording.stopRecording} cancelRecording={recording.cancelRecording}
            recordedAudioUrl={recording.recordedAudioUrl} setRecordedAudioUrl={recording.setRecordedAudioUrl}
            recordingTime={recording.recordingTime} handleSendAudio={async () => { const sent = await state.handleSendAudio(recording.audioBlob); if (sent) { recording.setAudioBlob(null); recording.setRecordedAudioUrl(null); } }}
            setIsStudioOpen={onStudioOpen} setCaptureType={onCaptureTypeChange} setSelectedImage={selectImage} />
        </div>
      </div>
    </div>
  );
}