import { Server, Socket } from 'socket.io';
import { prisma } from '../../src/lib/prisma';
import { moderateText } from '../../src/lib/moderation/textModerator';
import { MessagePayload } from '../../src/types/chat';

// In-memory sliding window rate limiter: socketId -> timestamp[]
const socketRateLimits = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 5000;
const MAX_MESSAGES_PER_WINDOW = 10;

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  let timestamps = socketRateLimits.get(socketId) || [];
  timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    return false; // Rate limited
  }
  timestamps.push(now);
  socketRateLimits.set(socketId, timestamps);
  return true;
}

export function registerMessageHandlers(io: Server, socket: Socket) {
  const user = socket.data.user;

  // 1. Join conversation room with strict membership authorization
  socket.on('conversation:join', async ({ conversationId }: { conversationId: string }) => {
    try {
      if (!conversationId) return;

      const membership = await prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: user.id,
          },
        },
      });

      if (!membership) {
        socket.emit('error', {
          code: 'FORBIDDEN',
          message: 'You are not a participant in this conversation',
        });
        return;
      }

      socket.join(`conversation:${conversationId}`);
    } catch (error) {
      console.error('Error joining conversation room:', error);
      socket.emit('error', { code: 'SERVER_ERROR', message: 'Failed to join conversation room' });
    }
  });

  // 2. Send message with strict sender protection, rate-limiting, moderation, idempotency, and ACK
  socket.on(
    'message:send',
    async (
      payload: {
        conversationId: string;
        clientTempId: string;
        type: 'TEXT' | 'GIF' | 'STICKER';
        content: string;
      },
      callback
    ) => {
      try {
        const { conversationId, clientTempId, type = 'TEXT', content } = payload;

        if (!conversationId || !clientTempId || !content) {
          if (callback) callback({ success: false, error: 'Missing required message parameters' });
          return;
        }

        // A. Rate limiting check
        if (!checkRateLimit(socket.id)) {
          if (callback) callback({ success: false, error: 'RATE_LIMITED: You are sending messages too quickly' });
          return;
        }

        // B. Strict Authorization check
        const membership = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId,
              userId: user.id,
            },
          },
        });

        if (!membership) {
          if (callback) callback({ success: false, error: 'FORBIDDEN: Unauthorized to post to this conversation' });
          return;
        }

        // C. Idempotency check: does clientTempId already exist in DB?
        const existing = await prisma.message.findUnique({
          where: { clientTempId },
          include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, lastSeenAt: true } } },
        });

        if (existing) {
          const formattedExisting: MessagePayload = {
            id: existing.id,
            clientTempId: existing.clientTempId,
            conversationId: existing.conversationId,
            senderId: existing.senderId,
            type: existing.type as any,
            content: existing.content,
            mediaUrl: existing.mediaUrl,
            thumbnailUrl: existing.thumbnailUrl,
            mediaWidth: existing.mediaWidth,
            mediaHeight: existing.mediaHeight,
            status: existing.status as any,
            isModerated: existing.isModerated,
            moderationReason: existing.moderationReason,
            createdAt: existing.createdAt.toISOString(),
            updatedAt: existing.updatedAt.toISOString(),
            sender: {
              ...existing.sender,
              lastSeenAt: existing.sender.lastSeenAt.toISOString(),
            },
          };
          if (callback) callback({ success: true, message: formattedExisting });
          return;
        }

        // D. Synchronous Server-Side Text Moderation
        // Requirement 4: Detect and block prohibited profanity/curse words before the message is delivered.
        if (type === 'TEXT') {
          const modResult = moderateText(content);
          if (modResult.flagged) {
            if (callback) {
              callback({
                success: false,
                error: `Message blocked by server moderation policy: ${modResult.reason || 'Contains prohibited language'}`,
                isModerated: true,
                moderationReason: modResult.reason || 'Contains prohibited language',
              });
            }
            return; // Blocked before delivery: not persisted as sent, not broadcast to recipients
          }
        }

        let finalContent = content;
        let isModerated = false;
        let moderationReason: string | undefined = undefined;

        // E. Database persistence (SENDER ID IS STRICTLY BOUND TO user.id)
        const savedMessage = await prisma.message.create({
          data: {
            clientTempId,
            conversationId,
            senderId: user.id,
            type,
            content: finalContent,
            mediaUrl: type === 'GIF' ? content : null,
            status: 'SENT',
            isModerated,
            moderationReason,
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                lastSeenAt: true,
              },
            },
          },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        const formattedMessage: MessagePayload = {
          id: savedMessage.id,
          clientTempId: savedMessage.clientTempId,
          conversationId: savedMessage.conversationId,
          senderId: savedMessage.senderId,
          type: savedMessage.type as any,
          content: savedMessage.content,
          mediaUrl: savedMessage.mediaUrl,
          thumbnailUrl: savedMessage.thumbnailUrl,
          mediaWidth: savedMessage.mediaWidth,
          mediaHeight: savedMessage.mediaHeight,
          status: savedMessage.status as any,
          isModerated: savedMessage.isModerated,
          moderationReason: savedMessage.moderationReason,
          createdAt: savedMessage.createdAt.toISOString(),
          updatedAt: savedMessage.updatedAt.toISOString(),
          sender: {
            ...savedMessage.sender,
            lastSeenAt: savedMessage.sender.lastSeenAt.toISOString(),
          },
        };

        // Clear typist state automatically when sending message
        socket.to(`conversation:${conversationId}`).emit('typing:update', {
          conversationId,
          userId: user.id,
          username: user.displayName || user.username,
          isTyping: false,
        });

        // F. Send ACK callback to sender
        if (callback) {
          callback({ success: true, message: formattedMessage });
        }

        // G. Broadcast to room
        io.to(`conversation:${conversationId}`).emit('message:new', formattedMessage);
      } catch (err: any) {
        console.error('Error processing message:send:', err);
        if (callback) {
          callback({ success: false, error: err.message || 'Server error while sending message' });
        }
      }
    }
  );

  // 3. Reconnection Reconciliation: settle unconfirmed optimistic messages
  socket.on(
    'message:reconcile',
    async (
      payload: { conversationId: string; pendingTempIds: string[] },
      callback
    ) => {
      try {
        const { conversationId, pendingTempIds = [] } = payload;
        if (!pendingTempIds.length) {
          if (callback) callback({ reconciled: [] });
          return;
        }

        const messages = await prisma.message.findMany({
          where: {
            conversationId,
            clientTempId: { in: pendingTempIds },
          },
          select: {
            clientTempId: true,
            id: true,
            status: true,
            createdAt: true,
          },
        });

        const reconciled = messages.map((m) => ({
          clientTempId: m.clientTempId,
          serverId: m.id,
          status: m.status as any,
          createdAt: m.createdAt.toISOString(),
        }));

        if (callback) {
          callback({ reconciled });
        }
      } catch (err) {
        console.error('Error reconciling messages:', err);
        if (callback) callback({ reconciled: [] });
      }
    }
  );

  // 4. Delivery receipt handling (SENT -> DELIVERED)
  socket.on(
    'message:delivered',
    async ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      try {
        if (!socket.rooms.has(`conversation:${conversationId}`)) return;

        await prisma.message.updateMany({
          where: {
            id: messageId,
            conversationId,
            senderId: { not: user.id },
            status: 'SENT',
          },
          data: { status: 'DELIVERED' },
        });

        io.to(`conversation:${conversationId}`).emit('message:status_update', {
          conversationId,
          messageId,
          clientTempId: '',
          status: 'DELIVERED',
        });
      } catch (err) {
        console.error('Error recording message delivery:', err);
      }
    }
  );

  // 5. Read receipt handling (DELIVERED/SENT -> READ)
  socket.on(
    'message:mark_read',
    async ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      try {
        const membership = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId,
              userId: user.id,
            },
          },
        });

        if (!membership) return;

        const now = new Date();
        await prisma.conversationParticipant.update({
          where: {
            conversationId_userId: {
              conversationId,
              userId: user.id,
            },
          },
          data: { lastReadAt: now },
        });

        await prisma.message.updateMany({
          where: {
            conversationId,
            senderId: { not: user.id },
            status: { not: 'READ' },
          },
          data: { status: 'READ' },
        });

        io.to(`conversation:${conversationId}`).emit('message:status_update', {
          conversationId,
          messageId,
          userId: user.id,
          lastReadAt: now.toISOString(),
          clientTempId: '',
          status: 'READ',
        });
      } catch (err) {
        console.error('Error marking messages as read:', err);
      }
    }
  );

  // 6. Ephemeral Typing indicators (protected by room membership)
  socket.on('typing:start', ({ conversationId }: { conversationId: string }) => {
    if (!socket.rooms.has(`conversation:${conversationId}`)) return;

    socket.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      userId: user.id,
      username: user.displayName || user.username,
      isTyping: true,
    });
  });

  socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
    if (!socket.rooms.has(`conversation:${conversationId}`)) return;

    socket.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      userId: user.id,
      username: user.displayName || user.username,
      isTyping: false,
    });
  });
}
