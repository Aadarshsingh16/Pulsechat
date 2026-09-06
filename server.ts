import './polyfill';
import express from 'express';
import http from 'http';
import next from 'next';
import 'dotenv/config';
import { attachSocketServer } from './server/index';
import { PresenceService } from './server/services/presence';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

async function main() {
  await nextApp.prepare();

  const app = express();

  // Health check endpoint registered before Next.js catch-all
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      onlineUsers: PresenceService.getOnlineUserIds().length,
    });
  });

  // Everything else — pages, API routes — goes to Next.js (Express 5 compatible)
  app.use((req, res) => handle(req, res));

  const httpServer = http.createServer(app);
  attachSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`⚡ PulseChat ready on port ${port} (Next.js + Socket.IO merged)`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
