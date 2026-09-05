import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = verifySessionToken(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim();

    const users = await prisma.user.findMany({
      where: {
        id: { not: session.userId },
        ...(query
          ? {
              OR: [
                { username: { contains: query } },
                { displayName: { contains: query } },
                { email: { contains: query } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        lastSeenAt: true,
      },
      take: 20,
    });

    const formatted = users.map((u) => ({
      ...u,
      lastSeenAt: u.lastSeenAt.toISOString(),
    }));

    return NextResponse.json({ users: formatted });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}
