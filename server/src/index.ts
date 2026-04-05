import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import { initSocket } from './socket';

// Route handlers
import slotsRouter from './routes/slots';
import portalRouter from './routes/portal';
import logsRouter from './routes/logs';

// ── App Setup ─────────────────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
}));
app.use(express.json());

// ── Socket.io ─────────────────────────────────────────────────────────────────
initSocket(httpServer, FRONTEND_URL);
console.log(`🔌 Socket.io initialized for origin: ${FRONTEND_URL}`);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/slots', slotsRouter);
app.use('/api/portal', portalRouter);
app.use('/api/logs', logsRouter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ParkGuard 2.0 API',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🚀 ParkGuard API running at http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🅿️  Slots:  http://localhost:${PORT}/api/slots`);
  console.log(`📋 Logs:   http://localhost:${PORT}/api/logs`);
  console.log(`\nFrontend allowed from: ${FRONTEND_URL}\n`);
});

export default app;
