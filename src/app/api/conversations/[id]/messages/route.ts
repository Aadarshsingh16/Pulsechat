import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { MessageCursor } from '@/types/chat';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: conversationId } = await params;

    // 1. Authorization: verify conversation membership
    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.userId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this conversation' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursorParam = searchParams.get('cursor');

    let cursorData: MessageCursor | null = null;
    if (cursorParam) {
      try {
        cursorData = JSON.parse(Buffer.from(cursorParam, 'base64').toString('utf-8'));
      } catch {
        return NextResponse.json({ error: 'Invalid cursor parameter' }, { status: 400 });
      }
    }

    // 2. Deterministic Compound Cursor Pagination: (createdAt DESC, id DESC)
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(cursorData
          ? {
              OR: [
                { createdAt: { lt: new Date(cursorData.createdAt) } },
                {
                  createdAt: new Date(cursorData.createdAt),
                  id: { lt: cursorData.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
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

    const hasMore = messages.length > limit;
    const returnList = hasMore ? messages.slice(0, limit) : messages;

    const nextCursor = hasMore
      ? Buffer.from(
          JSON.stringify({
            createdAt: returnList[returnList.length - 1].createdAt.toISOString(),
            id: returnList[returnList.length - 1].id,
          })
        ).toString('base64')
      : null;

    const formatted = returnList.map((m) => ({
      id: m.id,
      clientTempId: m.clientTempId,
      conversationId: m.conversationId,
      senderId: m.senderId,
      type: m.type,
      content: m.content,
      mediaUrl: m.mediaUrl,
      thumbnailUrl: m.thumbnailUrl,
      mediaWidth: m.mediaWidth,
      mediaHeight: m.mediaHeight,
      status: m.status,
      isModerated: m.isModerated,
      moderationReason: m.moderationReason,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      sender: {
        ...m.sender,
        lastSeenAt: m.sender.lastSeenAt.toISOString(),
      },
    }));

    return NextResponse.json({
      messages: formatted,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to retrieve messages' }, { status: 500 });
  }
}
