import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket';

const router = Router();
const prisma = new PrismaClient();

// ─── Utility: Simple hash ─────────────────────────────────────────────────────
const hashString = (str: string): string =>
  Array.from(str)
    .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0)
    .toString(16)
    .substring(0, 8);

// ─── GET /api/slots ───────────────────────────────────────────────────────────
// Returns all parking slots with their current status.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const slots = await prisma.parkingSlot.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(slots);
  } catch (err) {
    console.error('[GET /slots]', err);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// ─── PATCH /api/slots/:id/fault ───────────────────────────────────────────────
// Inject a hardware fault into a specific slot.
// Body: { type: 'SRAM_FLIP' | 'THERMAL' | 'PWR_DROP', title: string }
router.patch('/:id/fault', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, title } = req.body as { type: string; title: string };

  if (!type || !title) {
    res.status(400).json({ error: 'type and title are required' });
    return;
  }

  try {
    const slot = await prisma.parkingSlot.findUnique({ where: { id } });
    if (!slot) {
      res.status(404).json({ error: `Slot ${id} not found` });
      return;
    }
    if (slot.status === 'ERROR') {
      res.status(409).json({ error: `Slot ${id} already has an active fault` });
      return;
    }

    const updatedSlot = await prisma.parkingSlot.update({
      where: { id },
      data: {
        status: 'ERROR',
        errorDetails: title,
        nodeHealth: Math.floor(Math.random() * 40),
        clockSpeed: type === 'THERMAL' ? Math.floor(slot.clockSpeed / 2) : slot.clockSpeed,
      },
    });

    // Log the fault to the audit ledger
    const log = await prisma.auditLog.create({
      data: {
        type: 'Hardware Fault',
        nodeId: id,
        hash: hashString('FAULT' + id + Date.now()),
      },
    });

    // Broadcast real-time updates to all connected clients
    const io = getIO();
    io.emit('slot:updated', { slot: updatedSlot });
    io.emit('log:created', { log });

    res.json({ slot: updatedSlot, log });
  } catch (err) {
    console.error('[PATCH /slots/:id/fault]', err);
    res.status(500).json({ error: 'Failed to inject fault' });
  }
});

// ─── PATCH /api/slots/resolve ─────────────────────────────────────────────────
// Resolve all active faults — simulates a system reboot.
router.patch('/resolve', async (_req: Request, res: Response) => {
  try {
    // Find all currently faulted slots
    const faultedSlots = await prisma.parkingSlot.findMany({
      where: { status: 'ERROR' },
    });

    if (faultedSlots.length === 0) {
      res.json({ resolved: 0, slots: [] });
      return;
    }

    // Restore each slot based on whether it had a vehicle
    const updatedSlots = await Promise.all(
      faultedSlots.map(async (slot) => {
        // Check if there's an open ticket for this slot
        const openTicket = await prisma.ticket.findFirst({
          where: { slotId: slot.id, exitTime: null },
        });

        return prisma.parkingSlot.update({
          where: { id: slot.id },
          data: {
            status: openTicket ? 'OCCUPIED' : 'FREE',
            nodeHealth: 100,
            errorDetails: null,
          },
        });
      })
    );

    const io = getIO();
    updatedSlots.forEach((slot) => io.emit('slot:updated', { slot }));

    res.json({ resolved: updatedSlots.length, slots: updatedSlots });
  } catch (err) {
    console.error('[PATCH /slots/resolve]', err);
    res.status(500).json({ error: 'Failed to resolve faults' });
  }
});

export default router;
