import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';

const CreateConversationSchema = z.object({
  recipientId: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
  title: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId: session.userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                lastSeenAt: true,
              },
            },
          },
        },
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
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
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = await Promise.all(
      conversations.map(async (conv) => {
        const otherPart = conv.participants.find((p) => p.userId !== session.userId);
        const myPart = conv.participants.find((p) => p.userId === session.userId);

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: session.userId },
            createdAt: { gt: myPart?.lastReadAt || new Date(0) },
          },
        });

        const lastMsg = conv.messages[0];
        const allParticipants = conv.participants.map((p) => ({
          ...p.user,
          lastSeenAt: p.user.lastSeenAt.toISOString(),
          lastReadAt: p.lastReadAt.toISOString(),
        }));

        let displayName = otherPart?.user.displayName || 'Unknown User';
        if (conv.isGroup) {
          displayName = conv.title || `Group (${conv.participants.length})`;
        }

        return {
          id: conv.id,
          title: conv.title,
          isGroup: conv.isGroup,
          otherParticipant: {
            id: conv.isGroup ? 'group' : (otherPart?.user.id || 'unknown'),
            username: conv.isGroup ? 'group' : (otherPart?.user.username || 'unknown'),
            displayName,
            avatarUrl: conv.isGroup ? null : (otherPart?.user.avatarUrl || null),
            lastSeenAt: otherPart?.user.lastSeenAt.toISOString() || new Date().toISOString(),
          },
          participants: allParticipants,
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                clientTempId: lastMsg.clientTempId,
                conversationId: lastMsg.conversationId,
                senderId: lastMsg.senderId,
                type: lastMsg.type,
                content: lastMsg.content,
                mediaUrl: lastMsg.mediaUrl,
                status: lastMsg.status,
                isModerated: lastMsg.isModerated,
                createdAt: lastMsg.createdAt.toISOString(),
                updatedAt: lastMsg.updatedAt.toISOString(),
              }
            : null,
          unreadCount,
          updatedAt: conv.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ conversations: formatted });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { recipientId, participantIds, title } = CreateConversationSchema.parse(body);

    // Group chat creation
    if (participantIds && participantIds.length > 0) {
      const uniqueUsers = Array.from(new Set([session.userId, ...participantIds]));
      if (uniqueUsers.length < 2) {
        return NextResponse.json({ error: 'At least 2 members are required for a group' }, { status: 400 });
      }

      const group = await prisma.conversation.create({
        data: {
          title: title || 'New Group',
          isGroup: true,
          participants: {
            create: uniqueUsers.map((uid) => ({ userId: uid })),
          },
        },
      });

      return NextResponse.json({ conversationId: group.id }, { status: 201 });
    }

    // 1-on-1 chat creation
    if (!recipientId) {
      return NextResponse.json({ error: 'recipientId or participantIds is required' }, { status: 400 });
    }

    if (recipientId === session.userId) {
      return NextResponse.json({ error: 'Cannot create conversation with yourself' }, { status: 400 });
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: session.userId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ conversationId: existing.id });
    }

    const newConv = await prisma.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [{ userId: session.userId }, { userId: recipientId }],
        },
      },
    });

    return NextResponse.json({ conversationId: newConv.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
