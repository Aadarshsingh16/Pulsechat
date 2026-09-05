import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { socketAuthMiddleware } from './middleware/auth';
import { PresenceService } from './services/presence';
import { registerMessageHandlers } from './handlers/message';

export let io: Server;

export function attachSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Enforce authentication on WebSocket handshake
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`[Socket.IO] User connected: ${user.username} (${user.id}) via socket ${socket.id}`);

    // Personal user room for multi-tab synchronization
    socket.join(`user:${user.id}`);

    // Send current active online users snapshot to the newly connected socket
    socket.emit('presence:initial', {
      onlineUserIds: PresenceService.getOnlineUserIds(),
    });

    // Track presence
    const isFirstConnection = PresenceService.addSocket(user.id, socket.id);
    if (isFirstConnection) {
      io.emit('presence:update', {
        userId: user.id,
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
      });
    }

    // Register message, typing, and read receipt handlers
    registerMessageHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] User disconnected: ${user.username} (${socket.id})`);
      PresenceService.removeSocket(user.id, socket.id, () => {
        io.emit('presence:update', {
          userId: user.id,
          isOnline: false,
          lastSeenAt: new Date().toISOString(),
        });
      });
    });
  });

  return io;
}
