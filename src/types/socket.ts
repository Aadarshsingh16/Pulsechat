import { MessagePayload, MessageStatus } from './chat';

export interface ClientToServerEvents {
  'message:send': (
    payload: {
      conversationId: string;
      clientTempId: string;
      type: 'TEXT' | 'IMAGE' | 'GIF' | 'STICKER';
      content: string;
      mediaUrl?: string;
    },
    callback: (response: {
      success: boolean;
      message?: MessagePayload;
      error?: string;
    }) => void
  ) => void;

  'message:reconcile': (
    payload: {
      conversationId: string;
      pendingTempIds: string[];
    },
    callback: (response: {
      reconciled: {
        clientTempId: string;
        serverId: string;
        status: MessageStatus;
        createdAt: string;
      }[];
    }) => void
  ) => void;

  'message:mark_read': (payload: {
    conversationId: string;
    messageId: string;
  }) => void;

  'typing:start': (payload: { conversationId: string }) => void;
  'typing:stop': (payload: { conversationId: string }) => void;
  'conversation:join': (payload: { conversationId: string }) => void;
}

export interface ServerToClientEvents {
  'message:new': (message: MessagePayload) => void;
  'message:status_update': (payload: {
    conversationId: string;
    messageId: string;
    clientTempId: string;
    status: MessageStatus;
  }) => void;
  'typing:update': (payload: {
    conversationId: string;
    userId: string;
    username: string;
    isTyping: boolean;
  }) => void;
  'presence:initial': (payload: { onlineUserIds: string[] }) => void;
  'presence:update': (payload: {
    userId: string;
    isOnline: boolean;
    lastSeenAt: string;
  }) => void;
  'conversation:memberAdded': (payload: {
    conversationId: string;
    newMember: { id: string; username: string; displayName?: string; avatarUrl?: string | null };
    participants?: Array<{
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      lastSeenAt?: string;
      lastReadAt?: string;
    }>;
  }) => void;
  error: (payload: { code: string; message: string; clientTempId?: string }) => void;
}

export interface SocketData {
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
  };
}
