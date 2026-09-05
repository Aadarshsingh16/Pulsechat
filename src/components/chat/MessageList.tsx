'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { useChatStore } from '@/stores/useChatStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatDateDivider } from '@/lib/utils';
import { Loader2, ChevronDown } from 'lucide-react';

interface MessageListProps {
  conversationId: string;
  socketRef?: any;
}

export function MessageList({ conversationId, socketRef }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const user = useAuthStore((s) => s.user);
  const {
    messages,
    conversations,
    setMessages,
    prependMessages,
    markConversationRead,
    updateMessageStatus,
    nextCursor,
    hasMoreMessages,
    isTypingMap,
  } = useChatStore();

  const activeConv = conversations.find((c) => c.id === conversationId);
  const isGroup = !!activeConv?.isGroup;
  const participants = activeConv?.participants || [];
  const typist = isTypingMap[conversationId];

  // Track scroll position to display floating jump-to-bottom button (WhatsApp style)
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const isFarFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight > 220;
    setShowScrollBottom(isFarFromBottom);
  };

  const scrollToBottom = () => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  };

  // 1-Click Retry Handler for FAILED messages
  const handleRetry = (msg: any) => {
    if (!socketRef?.current || !user) return;
    const tempId = msg.clientTempId || msg.id;
    updateMessageStatus(tempId, tempId, 'SENDING');
    socketRef.current.emit(
      'message:send',
      {
        conversationId,
        clientTempId: tempId,
        type: msg.type,
        content: msg.content,
        mediaUrl: msg.mediaUrl,
      },
      (res: any) => {
        if (res?.success && res.message) {
          updateMessageStatus(tempId, res.message.id, res.message.status);
        } else {
          updateMessageStatus(tempId, tempId, 'FAILED');
        }
      }
    );
  };

  // 1. Initial Load: Fetch 50 most recent messages
  useEffect(() => {
    let isMounted = true;

    async function loadRecent() {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages?limit=50`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          const chronological = (data.messages || []).reverse();
          setMessages(chronological);
          useChatStore.setState({
            nextCursor: data.nextCursor,
            hasMoreMessages: data.hasMore,
          });
          setInitialLoaded(true);

          // Mark conversation as read on load
          markConversationRead(conversationId);
          if (chronological.length > 0 && socketRef?.current) {
            const lastMsg = chronological[chronological.length - 1];
            socketRef.current.emit('message:mark_read', {
              conversationId,
              messageId: lastMsg.id,
            });
          }

          // Smooth scroll to bottom on initial load
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }, 50);
        }
      } catch (err) {
        console.error('Failed to load recent messages:', err);
      }
    }

    setInitialLoaded(false);
    loadRecent();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  // 2. Fetch Older Messages on upward scroll with Scroll Height Preservation
  const loadOlderMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || !nextCursor) return;

    setIsLoadingMore(true);
    const container = containerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    const prevScrollTop = container?.scrollTop || 0;

    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?limit=50&cursor=${encodeURIComponent(nextCursor)}`
      );
      if (!res.ok) return;

      const data = await res.json();
      const olderChronological = (data.messages || []).reverse();

      prependMessages(olderChronological, data.nextCursor, data.hasMore);

      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
        }
      });
    } catch (err) {
      console.error('Error loading older messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 3. IntersectionObserver on top sentinel
  useEffect(() => {
    if (!initialLoaded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadOlderMessages();
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [initialLoaded, nextCursor, hasMoreMessages, isLoadingMore]);

  // 4. Scroll to bottom & emit read on new incoming message
  useEffect(() => {
    if (!initialLoaded) return;
    const container = containerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 180;
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }

    if (messages.length > 0 && socketRef?.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== user?.id) {
        socketRef.current.emit('message:mark_read', {
          conversationId,
          messageId: lastMsg.id,
        });
        markConversationRead(conversationId);
      }
    }
  }, [messages.length]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 space-y-1 relative"
      style={{
        backgroundImage: 'radial-gradient(rgba(192, 132, 38, 0.04) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Top Sentinel for Infinite Scroll */}
      <div ref={sentinelRef} className="h-4 flex items-center justify-center">
        {isLoadingMore && (
          <div className="flex items-center gap-1.5 text-xs text-stone-400 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C08426]" />
            <span>Loading older messages...</span>
          </div>
        )}
      </div>

      {/* Render Messages with Sticky/Pill Date Dividers */}
      {messages.map((msg, index) => {
        const prevMsg = messages[index - 1];
        const showDateDivider =
          !prevMsg || formatDateDivider(msg.createdAt) !== formatDateDivider(prevMsg.createdAt);

        return (
          <React.Fragment key={msg.id || msg.clientTempId}>
            {showDateDivider && (
              <div className="flex items-center justify-center my-3 sticky top-2 z-10 select-none">
                <span className="text-[10px] font-semibold tracking-wider uppercase px-3 py-1 bg-[#FAF8F5]/90 backdrop-blur-xs text-stone-500 rounded-full border border-stone-200/80 shadow-2xs">
                  {formatDateDivider(msg.createdAt)}
                </span>
              </div>
            )}
            <MessageBubble
              message={msg}
              isCurrentUser={msg.senderId === user?.id}
              isGroup={isGroup}
              participants={participants}
              onRetry={handleRetry}
            />
          </React.Fragment>
        );
      })}

      {/* Typing Indicator */}
      {typist?.isTyping && (
        <div className="pt-1">
          <TypingIndicator username={typist.username} />
        </div>
      )}

      {/* Floating Jump to Bottom Button (WhatsApp Style) */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-20 right-6 sm:right-8 z-30 p-2.5 bg-white border border-stone-200 shadow-lg hover:shadow-xl rounded-full text-stone-600 hover:text-[#C08426] transition-all animate-in fade-in zoom-in-90 duration-150 active:scale-95"
          title="Scroll to bottom"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
