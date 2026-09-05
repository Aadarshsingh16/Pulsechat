import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { comparePassword, signSessionToken, AUTH_COOKIE_NAME, getCookieSettings } from '@/lib/auth';

const LoginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = LoginSchema.parse(body);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: identifier.toLowerCase() },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email/username or password' }, { status: 401 });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email/username or password' }, { status: 401 });
    }

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
    });

    const sanitizedUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      lastSeenAt: user.lastSeenAt.toISOString(),
      createdAt: user.createdAt.toISOString(),
    };

    const res = NextResponse.json({ success: true, user: sanitizedUser, socketToken: token });
    const cookieSettings = getCookieSettings();
    res.cookies.set(AUTH_COOKIE_NAME, token, cookieSettings);

    return res;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error during login' }, { status: 500 });
  }
}
