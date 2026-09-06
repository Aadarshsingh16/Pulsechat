import { create } from 'zustand';
import { MessagePayload, ConversationSummary, UserSummary } from '@/types/chat';

interface ChatState {
  activeConversationId: string | null;
  conversations: ConversationSummary[];
  messages: MessagePayload[];
  hasMoreMessages: boolean;
  nextCursor: string | null;
  isTypingMap: Record<string, { username: string; isTyping: boolean }>; // conversationId -> typist
  onlineUserIds: Set<string>;

  setActiveConversationId: (id: string | null) => void;
  removeConversation: (id: string) => void;
  setConversations: (conversations: ConversationSummary[]) => void;
  setMessages: (messages: MessagePayload[]) => void;
  prependMessages: (olderMessages: MessagePayload[], nextCursor: string | null, hasMore: boolean) => void;
  addMessage: (message: MessagePayload) => void;
  updateMessage: (clientTempId: string, updated: Partial<MessagePayload>) => void;
  updateMessageStatus: (clientTempId: string, serverId: string, status: any, conversationId?: string, userId?: string, lastReadAt?: string) => void;
  markConversationRead: (conversationId: string) => void;
  updateConversationParticipants: (conversationId: string, participants: UserSummary[]) => void;
  addParticipantToConversation: (conversationId: string, participant: UserSummary) => void;
  setTyping: (conversationId: string, username: string, isTyping: boolean) => void;
  setUserOnline: (userId: string, isOnline: boolean) => void;
  setInitialOnlineUsers: (userIds: string[]) => void;
  reconcileOptimisticMessages: (reconciled: { clientTempId: string; serverId: string; status: any }[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  conversations: [],
  messages: [],
  hasMoreMessages: false,
  nextCursor: null,
  isTypingMap: {},
  onlineUserIds: new Set<string>(),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
      messages: state.activeConversationId === id ? [] : state.messages,
    })),

  setActiveConversationId: (id) =>
    set((state) => {
      // Mark conversation unread count as 0 when selected
      const updatedConversations = state.conversations.map((c) =>
        c.id === id ? { ...c, unreadCount: 0 } : c
      );
      return {
        activeConversationId: id,
        conversations: updatedConversations,
        messages: [],
        nextCursor: null,
        hasMoreMessages: false,
      };
    }),

  setConversations: (conversations) => set({ conversations }),
  setMessages: (messages) => set({ messages }),

  prependMessages: (olderMessages, nextCursor, hasMore) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const filtered = olderMessages.filter((m) => !existingIds.has(m.id));
      return {
        messages: [...filtered, ...state.messages],
        nextCursor,
        hasMoreMessages: hasMore,
      };
    }),

  updateMessage: (clientTempId, updated) =>
    set((state) => {
      const updatedMessages = state.messages.map((m) =>
        m.clientTempId === clientTempId || (updated.id && m.id === updated.id)
          ? { ...m, ...updated }
          : m
      );
      const updatedConvs = state.conversations.map((c) => {
        if (c.lastMessage && (c.lastMessage.clientTempId === clientTempId || (updated.id && c.lastMessage.id === updated.id))) {
          return {
            ...c,
            lastMessage: { ...c.lastMessage, ...updated },
          };
        }
        return c;
      });
      return { messages: updatedMessages, conversations: updatedConvs };
    }),

  addMessage: (message) =>
    set((state) => {
      const existsIndex = state.messages.findIndex(
        (m) => m.clientTempId === message.clientTempId || (m.id && m.id === message.id)
      );

      let updatedMessages = [...state.messages];
      if (existsIndex >= 0) {
        updatedMessages[existsIndex] = message;
      } else {
        updatedMessages.push(message);
      }

      // Update conversation snippet and unread count in sidebar
      const updatedConvs = state.conversations.map((c) => {
        if (c.id === message.conversationId) {
          const isCurrentActive = state.activeConversationId === message.conversationId;
          return {
            ...c,
            lastMessage: message,
            unreadCount: isCurrentActive ? 0 : (existsIndex >= 0 ? c.unreadCount : c.unreadCount + 1),
            updatedAt: message.createdAt,
          };
        }
        return c;
      });

      return {
        messages: updatedMessages,
        conversations: updatedConvs,
      };
    }),

  updateMessageStatus: (clientTempId, serverId, status, conversationId, userId, lastReadAt) =>
    set((state) => {
      const updatedMessages = state.messages.map((m) => {
        if (m.clientTempId === clientTempId || m.id === serverId) {
          return { ...m, id: serverId || m.id, status };
        }
        // If bulk READ event occurred in the active conversation, mark all preceding sent messages as READ
        if (status === 'READ' && conversationId && m.conversationId === conversationId && m.status !== 'READ') {
          return { ...m, status: 'READ' as any };
        }
        return m;
      });

      // Update participant's lastReadAt if provided
      let updatedConvs = state.conversations;
      if (conversationId && userId && lastReadAt) {
        updatedConvs = state.conversations.map((c) => {
          if (c.id === conversationId && c.participants) {
            const newParticipants = c.participants.map((p) =>
              p.id === userId ? { ...p, lastReadAt } : p
            );
            return { ...c, participants: newParticipants };
          }
          return c;
        });
      }

      return {
        messages: updatedMessages,
        conversations: updatedConvs,
      };
    }),

  markConversationRead: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
      messages: state.messages.map((m) =>
        m.conversationId === conversationId ? { ...m, status: 'READ' as any } : m
      ),
    })),

  updateConversationParticipants: (conversationId, participants) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, participants } : c
      ),
    })),

  addParticipantToConversation: (conversationId, participant) =>
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id === conversationId) {
          const current = c.participants || [];
          if (current.some((p) => p.id === participant.id)) return c;
          return {
            ...c,
            isGroup: true,
            participants: [...current, participant],
          };
        }
        return c;
      }),
    })),

  setTyping: (conversationId, username, isTyping) =>
    set((state) => ({
      isTypingMap: {
        ...state.isTypingMap,
        [conversationId]: { username, isTyping },
      },
    })),

  setUserOnline: (userId, isOnline) =>
    set((state) => {
      const next = new Set(state.onlineUserIds);
      if (isOnline) next.add(userId);
      else next.delete(userId);
      return { onlineUserIds: next };
    }),

  setInitialOnlineUsers: (userIds) => set({ onlineUserIds: new Set(userIds) }),

  reconcileOptimisticMessages: (reconciled) =>
    set((state) => {
      const recMap = new Map(reconciled.map((r) => [r.clientTempId, r]));
      return {
        messages: state.messages.map((m) => {
          const rec = recMap.get(m.clientTempId);
          if (rec) {
            return { ...m, id: rec.serverId, status: rec.status };
          }
          return m;
        }),
      };
    }),
}));
