import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import styles from '../styles/App.module.scss';

// Waveform / Audio Player component for voice notes
function VoiceMessagePlayer({ audioSrc }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState('0:00');

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      const mins = Math.floor(audio.duration / 60);
      const secs = Math.floor(audio.duration % 60);
      setDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => console.warn("Playback error:", err));
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    audio.currentTime = (clickX / width) * audio.duration;
  };

  return (
    <div className={styles.voicePlayerContainer}>
      <audio ref={audioRef} src={audioSrc} preload="metadata" />
      <button type="button" onClick={togglePlay} className={styles.voicePlayBtn} aria-label={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.693-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393" />
          </svg>
        )}
      </button>

      <div className={styles.voiceWaveformArea}>
        <div className={styles.voiceProgressBarBg} onClick={handleSeek}>
          <div className={styles.voiceProgressBarFill} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.voiceBarsDecoration}>
          {[...Array(20)].map((_, i) => (
            <span key={i} className={styles.voiceBar} style={{ height: `${Math.sin(i + 1) * 60 + 40}%` }} />
          ))}
        </div>
      </div>

      <span className={styles.voiceDuration}>{duration}</span>
    </div>
  );
}

export default function ChatFeed({
  messages,
  user,
  searchQuery,
  roomLoading,
  room,
  selectedImage,
  isSendingImage,
  setSelectedImage,
  setEditingMessageId,
  setEditingText,
  openMenuId,
  setOpenMenuId,
  setDeleteModalMessageId,
  highlightText,
  setInfoModalMessage,
  loadMoreMessages,
  setActiveThreadMessage,
  messagesEndRef,
  setActiveLightboxImage,
  hasMorePages
}) {
  // Overwrite the top scrolling useEffect block layers inside ChatFeed.jsx to this structure:
  const scrollContainerRef = useRef(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const lastMessageIdRef = useRef(null); // Retain your specific pagination reference hook
  const isInitialRoomLoadRef = useRef(true);
  const roomLoadingObservedRef = useRef(false);
  const previousMessagesRef = useRef({ room, count: 0, lastMessageKey: null });
  const shouldStickToBottomRef = useRef(true);
  const isFetchingMoreRef = useRef(false);

  // Keep the first visible message at the same viewport coordinate after a prepend.
  const paginationAnchorRef = useRef(null);
  const paginationFirstMessageIdRef = useRef(null);
  const isPaginatingRef = useRef(false);

  const performScrollSnap = () => {
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  };

  const keepFeedAtBottomAfterLayoutChange = () => {
    const container = scrollContainerRef.current;
    if (container && shouldStickToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  };

  // Reset room-local scroll state before the new room's messages render.
  useLayoutEffect(() => {
    isInitialRoomLoadRef.current = true;
    roomLoadingObservedRef.current = false;
    previousMessagesRef.current = { room, count: 0, lastMessageKey: null };
    shouldStickToBottomRef.current = true;
    lastMessageIdRef.current = null;
    isPaginatingRef.current = false;
    paginationAnchorRef.current = null;
    paginationFirstMessageIdRef.current = null;
  }, [room]);

  // Wait for this room's loading cycle so stale messages from the previous room are never targeted.
  useLayoutEffect(() => {
    if (roomLoading) {
      roomLoadingObservedRef.current = true;
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const lastMessageKey = lastMessage?.clientMessageId || lastMessage?._id || lastMessage?.id || null;

    if (isInitialRoomLoadRef.current) {
      const messagesBelongToRoom = messages.length > 0 && messages.every((message) => !message.room || message.room === room);
      if (!roomLoadingObservedRef.current && !messagesBelongToRoom) return;
      isInitialRoomLoadRef.current = false;
      roomLoadingObservedRef.current = false;
      previousMessagesRef.current = { room, count: messages.length, lastMessageKey };
      shouldStickToBottomRef.current = true;
      if (messages.length > 0) performScrollSnap();
      return;
    }

    const container = scrollContainerRef.current;
    if (!container || previousMessagesRef.current.room !== room) return;

    if (isPaginatingRef.current) {
      const firstMessage = messages[0];
      const firstMessageId = firstMessage?._id || firstMessage?.id;
      if (firstMessageId === paginationFirstMessageIdRef.current) return;

      const anchor = paginationAnchorRef.current;
      if (anchor?.element?.isConnected) {
        const currentTop = anchor.element.getBoundingClientRect().top;
        container.scrollTop += currentTop - anchor.top;
      }

      isPaginatingRef.current = false;
      paginationAnchorRef.current = null;
      paginationFirstMessageIdRef.current = null;
      previousMessagesRef.current = { room, count: messages.length, lastMessageKey };
      return;
    }

    const previousMessages = previousMessagesRef.current;
    const appendedMessage = messages.length > previousMessages.count
      && lastMessageKey !== previousMessages.lastMessageKey;
    previousMessagesRef.current = { room, count: messages.length, lastMessageKey };

    if (appendedMessage && (lastMessage?.senderUid === user.uid || shouldStickToBottomRef.current)) {
      shouldStickToBottomRef.current = true;
      performScrollSnap();
    }
  }, [messages, room, roomLoading, user.uid]);

  // Capture a stable visible message before the API prepends older history.
  const handleTriggerHistoryFetch = async () => {
    const container = scrollContainerRef.current;
    if (container && !isFetchingMore && hasMorePages) { //
      const containerTop = container.getBoundingClientRect().top;
      const anchorElement = Array.from(container.querySelectorAll('[data-message-id]'))
        .find((element) => element.getBoundingClientRect().bottom > containerTop);
      paginationAnchorRef.current = anchorElement
        ? { element: anchorElement, top: anchorElement.getBoundingClientRect().top }
        : null;
      paginationFirstMessageIdRef.current = messages[0]?._id || messages[0]?.id || null;
      isPaginatingRef.current = true; // Set lock to alert our effect processing layer

      const addedMessages = await loadMoreMessages(); // Trigger your parent history database API query loop
      if (!addedMessages) {
        isPaginatingRef.current = false;
        paginationAnchorRef.current = null;
        paginationFirstMessageIdRef.current = null;
      }
    }
  };

  // Helper to parse URL from text
  function extractUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
  }

  const filteredMessages = messages.filter(
    (msg) => !searchQuery.trim() || (msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleScroll = async (e) => {
    const container = e.currentTarget;
    const { scrollTop } = container;
    const distanceFromBottom = container.scrollHeight - scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 160;

    if (scrollTop <= 20 && typeof loadMoreMessages === 'function' && !searchQuery.trim() && !isFetchingMoreRef.current && filteredMessages.length > 0) {
      lastMessageIdRef.current = filteredMessages[0]._id || filteredMessages[0].id;
      isFetchingMoreRef.current = true;
      setIsFetchingMore(true);
      try {
        await handleTriggerHistoryFetch();
      } catch (error) {
        console.error("Failed to load more messages:", error);
      } finally {
        isFetchingMoreRef.current = false;
        setIsFetchingMore(false);
      }
    }

    if (openMenuId) {
      setOpenMenuId(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!openMenuId) return;
      const clickedInsideMenu = event.target.closest(`.${styles.dropdownMenu}`) ||
        event.target.closest(`.${styles.dropdownMenuFlipped}`) ||
        event.target.closest(`.${styles.messageActionTrigger}`);
      if (!clickedInsideMenu) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId, setOpenMenuId]);


  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className={styles.messageFeed}
      style={{ overflowY: 'auto', height: '100%', position: 'relative' }}
    >
      {roomLoading ? (
        <div className={styles.roomLoaderContainer}>
          <div className={styles.spinner} />
          <p className={styles.modalDescription} style={{ marginTop: '10px' }}>Switching to #{room}...</p>
        </div>
      ) : selectedImage ? (
        <div className={styles.previewContainer}>
          <img src={selectedImage} alt="Upload preview" className={styles.previewImage} />
          <button
            type="button"
            onClick={() => !isSendingImage && setSelectedImage(null)}
            className={styles.removePreviewBtn}
            disabled={isSendingImage}
          >
            ×
          </button>
        </div>
      ) : (
        <div className={styles.messagesListContainer}>
          {isFetchingMore && (
            <div className={styles.topLoaderContainer} style={{ textAlign: 'center', padding: '12px 0' }}>
              <div className={styles.spinner} style={{ width: '20px', height: '20px', margin: '0 auto' }} />
            </div>
          )}

          {filteredMessages.map((msg, index) => {
            const msgId = msg._id || msg.id;
            const isMe = msg.senderUid === user.uid;
            const timeString = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const isMenuOpen = openMenuId === msgId;
            const isNearBottom = index >= filteredMessages.length - 3;
            const isFirstFew = index < 3;
            let menuClass = styles.dropdownMenu; // Default drops downward
            if (!isFirstFew && isNearBottom) {
              // Only flip upward if it's NOT in the first few messages AND it's near the bottom
              menuClass = styles.dropdownMenuFlipped;
            }
            const prevMsg = filteredMessages[index - 1];
            const isSameSender = prevMsg && prevMsg.senderUid === msg.senderUid;
            const timeDiff = prevMsg && msg.createdAt && prevMsg.createdAt
              ? new Date(msg.createdAt) - new Date(prevMsg.createdAt)
              : 0;
            const isWithinTimeWindow = timeDiff < 5 * 60 * 1000;
            const showHeader = (!isSameSender && !isWithinTimeWindow);
            return (
              <div
                key={msgId || index}
                data-message-id={msgId}
                className={styles.messageRow}
                style={{
                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                  position: 'relative',
                  zIndex: isMenuOpen ? 100 : 1
                }}
              >
                <div className={styles.messageContentWrapper} style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  {!isMe && (
                    <div style={{ width: '32px', flexShrink: 0 }}>
                      {showHeader ? (
                        <img src={msg.avatar || 'https://placeholder.com'} alt="" className={styles.messageAvatar} />
                      ) : null}
                    </div>
                  )}
                  <div>
                    {!isMe && showHeader && <small className={styles.messageSenderName}>{msg.sender}</small>}

                    <div
                      className={`${styles.messageBubbleBase} ${isMe ? styles.messageBubbleMe : styles.messageBubbleOther}`}
                      style={{ position: 'relative', paddingRight: msgId ? '28px' : '14px' }}
                    >

                      <div className={styles.messageText}>
                        {msg.image && (
                          <img
                            src={msg.image}
                            alt="Sent asset"
                            className={styles.chatImage}
                            onLoad={keepFeedAtBottomAfterLayoutChange}
                            onClick={() => setActiveLightboxImage(msg.image)}
                          />
                        )}
                        {(() => {
                          const url = extractUrl(msg.text);
                          return url ? (
                            <div className={styles.linkPreviewCard} onClick={() => window.open(url, '_blank')}>
                              <div className={styles.linkPreviewContent}>
                                <span className={styles.linkDomain}>{new URL(url).hostname}</span>
                                <p className={styles.linkTitle}>{url}</p>
                              </div>
                            </div>
                          ) : null;
                        })()}
                        {msg.audio && (
                          <VoiceMessagePlayer audioSrc={msg.audio} />
                        )}
                        <div className={styles.messageFooterRow}>
                          <span>
                            {msg.text && msg.text !== "\u200B" && highlightText(msg.text, searchQuery)}
                            {msg.edited && <small className={styles.editedIndicatorTag}> (edited)</small>}
                          </span>
                          <span className={isMe ? styles.messageTimestampMe : styles.messageTimestampOther}>{timeString}</span>
                        </div>
                      </div>


                      {msgId && (
                        <div
                          className={`${styles.messageActionTrigger} ${isMenuOpen ? styles.forceVisible : ''}`}
                          style={{ position: 'absolute', top: '6px', right: '6px' }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(isMenuOpen ? null : msgId);
                            }}
                            className={styles.optionsButton}
                            title="Message options"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              fill="currentColor"
                              viewBox="0 0 16 16"
                              style={{
                                transform: isNearBottom ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease'
                              }}
                            >
                              <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708" />
                            </svg>
                          </button>

                          {isMenuOpen && (
                            <div className={menuClass} style={{ padding: -0 }}>
                              {isMe && (
                                <>
                                  <button
                                    onClick={() => { setOpenMenuId(null); setDeleteModalMessageId(msgId); }}
                                    className={styles.dropdownItemDelete}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                                      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
                                    </svg>
                                    <span>Delete</span>
                                  </button>
                                  <button
                                    onClick={() => { setOpenMenuId(null); setEditingMessageId(msgId); setEditingText(msg.text); }}
                                    className={styles.dropdownItemEdit}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                      <path d="m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001m-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057 3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708z" />
                                    </svg>
                                    Edit
                                  </button>
                                </>
                              )}
                              {isMe && (
                                <button
                                  className={styles.dropdownItemInfo}
                                  onClick={() => {
                                    setInfoModalMessage(msg);
                                    setOpenMenuId(null);
                                  }}
                                  style={{ marginBottom: 0 }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
                                    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1,1,0 1,1-2,0 1,1 0 0,1 2,0" />
                                  </svg>
                                  Info
                                </button>
                              )}
                              <button
                                onClick={() => { setOpenMenuId(null); setActiveThreadMessage(msg); }}
                                className={styles.threadReplyTriggerBtn}
                                title="Reply in thread"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.414A2 2 0 0 0 3 11.586l-2 2V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12.793a.5.5 0 0 0 .854.353l2.853-2.853A1 1 0 0 1 4.414 12H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z" />
                                  <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5M3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6m0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5" />
                                </svg>
                                <span>Thread</span>
                              </button>
                            </div>
                          )}
                          <div className={styles.dropdownQuickReactions}>
                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  handleToggleReaction(msgId, emoji);
                                  setOpenMenuId(null);
                                }}
                                className={styles.quickReactionEmojiBtn}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className={styles.reactionBadgesRow}>
                          {Object.entries(
                            msg.reactions.reduce((acc, r) => {
                              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([emoji, count]) => {
                            const hasReacted = msg.reactions.some(r => r.emoji === emoji && r.userId === user.uid);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(msgId, emoji)}
                                className={`${styles.reactionBadgeBtn} ${hasReacted ? styles.reactionBadgeActive : ''}`}
                              >
                                <span>{emoji}</span>
                                {count > 1 && <span className={styles.reactionCount}>{count}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}