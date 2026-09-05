import { prisma } from '../../src/lib/prisma';

// In-memory multi-tab / multi-device socket registry
// userId -> Set<socketId>
const userSockets = new Map<string, Set<string>>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();

export class PresenceService {
  static addSocket(userId: string, socketId: string): boolean {
    // Clear any pending disconnect grace timer
    if (disconnectTimers.has(userId)) {
      clearTimeout(disconnectTimers.get(userId)!);
      disconnectTimers.delete(userId);
    }

    let sockets = userSockets.get(userId);
    const isFirstConnection = !sockets || sockets.size === 0;

    if (!sockets) {
      sockets = new Set();
      userSockets.set(userId, sockets);
    }

    sockets.add(socketId);
    return isFirstConnection;
  }

  static removeSocket(
    userId: string,
    socketId: string,
    onOfflineCallback: () => void
  ) {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        userSockets.delete(userId);
        // 3-second grace period to prevent flickering during page refresh
        const timer = setTimeout(async () => {
          disconnectTimers.delete(userId);
          try {
            await prisma.user.update({
              where: { id: userId },
              data: { lastSeenAt: new Date() },
            });
          } catch (e) {
            console.error('Failed to update lastSeenAt:', e);
          }
          onOfflineCallback();
        }, 3000);
        disconnectTimers.set(userId, timer);
      }
    }
  }

  static isUserOnline(userId: string): boolean {
    const sockets = userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  static getOnlineUserIds(): string[] {
    return Array.from(userSockets.keys());
  }
}
