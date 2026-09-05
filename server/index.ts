import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import 'dotenv/config';
import { socketAuthMiddleware } from './middleware/auth';
import { PresenceService } from './services/presence';
import { registerMessageHandlers } from './handlers/message';

// dotenv loaded via import 'dotenv/config'

const app = express();
const port = parseInt(process.env.SOCKET_PORT || '3001', 10);

app.use(cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  credentials: true,
}));

app.get('/', (_req, res) => { res.redirect(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'); });

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    onlineUsers: PresenceService.getOnlineUserIds().length,
  });
});

const server = http.createServer(app);

export const io = new Server(server, {
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

server.listen(port, () => {
  console.log(`⚡ PulseChat Socket.IO Server running on port ${port}`);
});
