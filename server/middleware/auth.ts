import { Socket } from 'socket.io';
import { verifySessionToken, AUTH_COOKIE_NAME } from '../../src/lib/auth';

export function parseCookie(cookieString: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieString) return cookies;

  cookieString.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    const value = parts.slice(1).join('=').trim();
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });

  return cookies;
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookie(cookieHeader);
    const token = cookies[AUTH_COOKIE_NAME] || (socket.handshake.auth?.token as string | undefined);
    console.log('[Socket Handshake] id:', socket.id, 'cookieToken:', Boolean(cookies[AUTH_COOKIE_NAME]), 'authToken:', Boolean(socket.handshake.auth?.token));

    if (!token) {
      return next(new Error('UNAUTHORIZED: No authentication token found in cookies or handshake'));
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      return next(new Error('UNAUTHORIZED: Session token is invalid or expired'));
    }

    socket.data.user = {
      id: payload.userId,
      email: payload.email,
      username: payload.username,
      displayName: payload.displayName,
    };

    return next();
  } catch (err) {
    return next(new Error('UNAUTHORIZED: Handshake validation failed'));
  }
}
