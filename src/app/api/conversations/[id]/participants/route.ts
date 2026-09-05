import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { getIO } from '../../../../../../server/index';
import { PresenceService } from '../../../../../../server/services/presence';

const AddParticipantsSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user is required'),
});

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

    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.userId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId },
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
      orderBy: { joinedAt: 'asc' },
    });

    const formatted = participants.map((p) => ({
      id: p.user.id,
      username: p.user.username,
      displayName: p.user.displayName,
      avatarUrl: p.user.avatarUrl,
      lastSeenAt: p.user.lastSeenAt.toISOString(),
      lastReadAt: p.lastReadAt.toISOString(),
      joinedAt: p.joinedAt.toISOString(),
    }));

    return NextResponse.json({ participants: formatted });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: conversationId } = await params;

    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.userId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: You cannot add members to this chat' }, { status: 403 });
    }

    const body = await req.json();
    const { userIds } = AddParticipantsSchema.parse(body);

    const existingParticipants = await prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const existingSet = new Set(existingParticipants.map((p) => p.userId));

    const newUsersToAdd = userIds.filter((uid) => !existingSet.has(uid));

    if (newUsersToAdd.length > 0) {
      await prisma.$transaction([
        prisma.conversationParticipant.createMany({
          data: newUsersToAdd.map((uid) => ({
            conversationId,
            userId: uid,
          })),
        }),
        prisma.conversation.update({
          where: { id: conversationId },
          data: { isGroup: true, updatedAt: new Date() },
        }),
      ]);
    }

    const allParticipants = await prisma.conversationParticipant.findMany({
      where: { conversationId },
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
      orderBy: { joinedAt: 'asc' },
    });

    const formatted = allParticipants.map((p) => ({
      id: p.user.id,
      username: p.user.username,
      displayName: p.user.displayName,
      avatarUrl: p.user.avatarUrl,
      lastSeenAt: p.user.lastSeenAt.toISOString(),
      lastReadAt: p.lastReadAt.toISOString(),
    }));

    // Real-time broadcast to conversation and joining sockets
    if (newUsersToAdd.length > 0) {
      try {
        const socketServer = getIO();
        if (socketServer) {
          const newlyAddedMembers = formatted.filter((p) => newUsersToAdd.includes(p.id));

          for (const newMember of newlyAddedMembers) {
            // Join active sockets for the new member into this conversation room immediately
            const theirSocketIds = PresenceService.getSocketIds(newMember.id);
            theirSocketIds?.forEach((socketId) => {
              const clientSocket = socketServer.sockets.sockets.get(socketId);
              if (clientSocket) {
                clientSocket.join(`conversation:${conversationId}`);
              }
            });

            const eventPayload = {
              conversationId,
              newMember: {
                id: newMember.id,
                username: newMember.username,
                displayName: newMember.displayName,
                avatarUrl: newMember.avatarUrl,
              },
              participants: formatted,
            };

            // Broadcast to the conversation room for existing members
            socketServer.to(`conversation:${conversationId}`).emit('conversation:memberAdded', eventPayload);

            // Also broadcast directly to the new member's personal user room
            socketServer.to(`user:${newMember.id}`).emit('conversation:memberAdded', eventPayload);
          }
        }
      } catch (sockErr) {
        console.error('Socket emission error in add participants route:', sockErr);
      }
    }

    return NextResponse.json({ success: true, participants: formatted });
  } catch (error) {
    console.error('Error adding participants:', error);
    return NextResponse.json({ error: 'Failed to add participants' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: conversationId } = await params;

    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.userId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this group' }, { status: 400 });
    }

    // Count remaining participants
    const totalMembers = await prisma.conversationParticipant.count({
      where: { conversationId },
    });

    if (totalMembers <= 1) {
      // Last person leaving deletes the group
      await prisma.conversation.delete({
        where: { id: conversationId },
      });
      return NextResponse.json({ success: true, groupDisbanded: true });
    }

    // Remove this user from the group
    await prisma.conversationParticipant.delete({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.userId,
        },
      },
    });

    return NextResponse.json({ success: true, leftGroup: true });
  } catch (error) {
    console.error('Error leaving group:', error);
    return NextResponse.json({ error: 'Failed to leave group' }, { status: 500 });
  }
}

