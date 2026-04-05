import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ─── GET /api/logs ────────────────────────────────────────────────────────────
// Returns all audit log entries, newest first.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 200, // Cap at 200 most recent entries
    });
    res.json(logs);
  } catch (err) {
    console.error('[GET /logs]', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
