export type MessageType = 'TEXT' | 'IMAGE' | 'GIF' | 'STICKER';
export type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: string;
  lastReadAt?: string;
  isOnline?: boolean;
}

export interface MessagePayload {
  id: string;
  clientTempId: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  status: MessageStatus;
  isModerated: boolean;
  moderationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: UserSummary;
}

export interface ConversationSummary {
  id: string;
  title?: string | null;
  isGroup?: boolean;
  otherParticipant: UserSummary;
  participants?: UserSummary[];
  lastMessage: MessagePayload | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageCursor {
  createdAt: string; // ISO string
  id: string;
}

export interface PaginatedMessagesResponse {
  messages: MessagePayload[];
  nextCursor: string | null;
  hasMore: boolean;
}
