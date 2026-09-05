import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { saveMediaFile } from '@/lib/storage';
import { defaultImageModerator } from '@/lib/moderation/imageModerator';

// In-memory sliding window rate limiter: userId -> timestamp[]
const uploadRateLimits = new Map<string, number[]>();
const UPLOAD_RATE_WINDOW_MS = 10000; // 10 seconds
const MAX_UPLOADS_PER_WINDOW = 5;

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user via HttpOnly cookie
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limiting check
    const now = Date.now();
    let timestamps = uploadRateLimits.get(session.userId) || [];
    timestamps = timestamps.filter((t) => now - t < UPLOAD_RATE_WINDOW_MS);
    if (timestamps.length >= MAX_UPLOADS_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Rate limit exceeded: Too many uploads. Please wait a moment.' },
        { status: 429 }
      );
    }
    timestamps.push(now);
    uploadRateLimits.set(session.userId, timestamps);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;
    const clientTempId = (formData.get('clientTempId') as string | null) || `temp-img-${Date.now()}`;
    const caption = (formData.get('content') as string | null) || (formData.get('caption') as string | null) || 'Sent an image';

    if (!file || !conversationId) {
      return NextResponse.json({ error: 'Missing file or conversationId' }, { status: 400 });
    }

    // 2. Authorize user membership
    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.userId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: You are not a participant in this conversation' }, { status: 403 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Absolute Pre-Visibility Image Moderation Inspection
    const moderationResult = await defaultImageModerator.moderate(buffer, file.type);
    if (!moderationResult.isSafe) {
      // Unsafe: reject immediately. File is discarded from RAM and never stored or broadcast.
      return NextResponse.json(
        {
          error: 'Image rejected by server moderation policy',
          details: moderationResult.reason || 'Explicit or unsafe content detected',
          latencyMs: moderationResult.inferenceLatencyMs,
        },
        { status: 422 }
      );
    }

    // 4. Safe: Store media file to storage
    const saved = await saveMediaFile(buffer, file.name, file.type);

    // 5. Persist message to database
    const message = await prisma.message.create({
      data: {
        clientTempId,
        conversationId,
        senderId: session.userId,
        type: 'IMAGE',
        content: caption.trim() || 'Sent an image',
        mediaUrl: saved.url,
        thumbnailUrl: saved.url,
        status: 'SENT',
        isModerated: false,
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

    const formattedMessage = {
      id: message.id,
      clientTempId: message.clientTempId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: message.type,
      content: message.content,
      mediaUrl: message.mediaUrl,
      thumbnailUrl: message.thumbnailUrl,
      status: message.status,
      isModerated: message.isModerated,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      sender: {
        ...message.sender,
        lastSeenAt: message.sender.lastSeenAt.toISOString(),
      },
    };

    return NextResponse.json({
      success: true,
      message: formattedMessage,
      moderation: {
        isSafe: true,
        latencyMs: moderationResult.inferenceLatencyMs,
      },
    });
  } catch (error: any) {
    console.error('Image upload error:', error);
    return NextResponse.json({ error: error.message || 'Image processing failed' }, { status: 500 });
  }
}
