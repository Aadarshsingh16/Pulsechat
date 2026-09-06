'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/useAuthStore';
import { useChatStore } from '@/stores/useChatStore';
import { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const user = useAuthStore((s) => s.user);
  const socketToken = useAuthStore((s) => s.socketToken);
  const {
    activeConversationId,
    setInitialOnlineUsers,
    addMessage,
    updateMessageStatus,
    setTyping,
    setUserOnline,
    reconcileOptimisticMessages,
  } = useChatStore();

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

    const socket: TypedSocket = io(socketUrl, {
      withCredentials: true,
      auth: { token: socketToken },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.warn('⚠️ [PulseChat Socket] connect_error:', err.message);
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to PulseChat Socket.IO server');

      // 1. Join active conversation room dynamically from latest store state
      const currentActive = useChatStore.getState().activeConversationId;
      if (currentActive) {
        socket.emit('conversation:join', { conversationId: currentActive });
      }

      // 2. Reconnection Reconciliation: settle unconfirmed optimistic messages
      const pending = useChatStore.getState().messages.filter((m) => m.status === 'SENDING');
      if (pending.length > 0 && activeConversationId) {
        const pendingTempIds = pending.map((m) => m.clientTempId);
        socket.emit(
          'message:reconcile',
          { conversationId: activeConversationId, pendingTempIds },
          (res) => {
            if (res?.reconciled?.length) {
              reconcileOptimisticMessages(res.reconciled);
            }
          }
        );
      }
    });

    socket.on('message:new', (message) => {
      addMessage(message);

      // Auto-acknowledge delivery if received by the recipient
      if (message.senderId !== user.id) {
        (socket as any).emit('message:delivered', {
          conversationId: message.conversationId,
          messageId: message.id,
        });
      }
    });

    socket.on('message:status_update', (data: any) => {
      const { clientTempId, messageId, status, conversationId, userId, lastReadAt } = data;
      updateMessageStatus(clientTempId, messageId, status, conversationId, userId, lastReadAt);
    });

    const typingTimers: Record<string, NodeJS.Timeout> = {};

    socket.on('typing:update', ({ conversationId, username, isTyping }) => {
      setTyping(conversationId, username, isTyping);

      if (typingTimers[conversationId]) {
        clearTimeout(typingTimers[conversationId]);
        delete typingTimers[conversationId];
      }

      // Auto-expire typing indicator after 15 seconds to give plenty of time to switch windows during showcase
      if (isTyping) {
        typingTimers[conversationId] = setTimeout(() => {
          setTyping(conversationId, username, false);
          delete typingTimers[conversationId];
        }, 15000);
      }
    });

    socket.on('presence:initial', ({ onlineUserIds }) => {
      setInitialOnlineUsers(onlineUserIds);
    });

    socket.on('presence:update', ({ userId, isOnline }) => {
      setUserOnline(userId, isOnline);
    });

    socket.on('conversation:memberAdded', async ({ conversationId, newMember, participants }) => {
      console.log('👥 [Socket.IO] Member added to conversation:', conversationId, newMember);
      const chatStore = useChatStore.getState();
      const existing = chatStore.conversations.find((c) => c.id === conversationId);

      if (existing) {
        if (participants && participants.length > 0) {
          chatStore.updateConversationParticipants(conversationId, participants as any);
        } else if (newMember) {
          chatStore.addParticipantToConversation(conversationId, newMember as any);
        }
      } else {
        // If this user was added to a group not yet in their sidebar, fetch and add it immediately
        try {
          const res = await fetch(`/api/conversations/${conversationId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.conversation) {
              chatStore.setConversations([data.conversation, ...chatStore.conversations]);
            }
          }
        } catch (e) {
          console.error('Failed to fetch newly joined group conversation:', e);
        }
      }
    });

    return () => {
      Object.values(typingTimers).forEach(clearTimeout);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, socketToken]);

  useEffect(() => {
    if (socketRef.current && activeConversationId) {
      socketRef.current.emit('conversation:join', { conversationId: activeConversationId });
      (socketRef.current as any).emit('message:mark_read', {
        conversationId: activeConversationId,
        messageId: '',
      });
    }
  }, [activeConversationId]);

  return socketRef;
}
