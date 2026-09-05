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

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

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

      // 1. Join active conversation room if open
      if (activeConversationId) {
        socket.emit('conversation:join', { conversationId: activeConversationId });
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

    socket.on('typing:update', ({ conversationId, username, isTyping }) => {
      setTyping(conversationId, username, isTyping);

      // Auto-expire typing indicator after 4 seconds to prevent stuck state
      if (isTyping) {
        setTimeout(() => {
          setTyping(conversationId, username, false);
        }, 4000);
      }
    });

    socket.on('presence:initial', ({ onlineUserIds }) => {
      setInitialOnlineUsers(onlineUserIds);
    });

    socket.on('presence:update', ({ userId, isOnline }) => {
      setUserOnline(userId, isOnline);
    });

    return () => {
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
