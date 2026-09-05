import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, signSessionToken, AUTH_COOKIE_NAME, getCookieSettings } from '@/lib/auth';

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric and underscores only'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(1).max(50),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = RegisterSchema.parse(body);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: validated.email }, { username: validated.username }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email or username already in use' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(validated.password);
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        username: validated.username,
        displayName: validated.displayName,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
    });

    const res = NextResponse.json({ success: true, user }, { status: 201 });
    const cookieSettings = getCookieSettings();
    res.cookies.set(AUTH_COOKIE_NAME, token, cookieSettings);

    return res;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Validation failed' }, { status: 400 });
    }
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error during registration' }, { status: 500 });
  }
}
