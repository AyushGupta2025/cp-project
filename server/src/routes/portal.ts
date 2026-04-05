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

// ─── POST /api/portal/entry ───────────────────────────────────────────────────
// Register a vehicle entering the facility. Assigns the nearest free slot.
// Body: { licensePlate: string }
router.post('/entry', async (req: Request, res: Response) => {
  const { licensePlate } = req.body as { licensePlate: string };

  if (!licensePlate) {
    res.status(400).json({ error: 'licensePlate is required' });
    return;
  }

  const plate = licensePlate.toUpperCase().trim();

  try {
    // Check if vehicle is already in the facility
    const existing = await prisma.ticket.findFirst({
      where: { licensePlate: plate, exitTime: null },
    });
    if (existing) {
      res.status(409).json({ error: `Vehicle ${plate} is already parked in slot ${existing.slotId}` });
      return;
    }

    // Find the first free slot (sorted alphabetically: A1, A2, ...)
    const freeSlot = await prisma.parkingSlot.findFirst({
      where: { status: 'FREE' },
      orderBy: { id: 'asc' },
    });

    if (!freeSlot) {
      res.status(404).json({ error: 'Facility is full. No free slots available.' });
      return;
    }

    // Create the parking ticket
    const ticket = await prisma.ticket.create({
      data: {
        slotId: freeSlot.id,
        licensePlate: plate,
      },
    });

    // Mark slot as OCCUPIED
    const updatedSlot = await prisma.parkingSlot.update({
      where: { id: freeSlot.id },
      data: { status: 'OCCUPIED' },
    });

    // Write audit log entry
    const log = await prisma.auditLog.create({
      data: {
        type: 'Vehicle Entry',
        nodeId: freeSlot.id,
        licensePlate: plate,
        hash: hashString(plate + freeSlot.id + Date.now()),
      },
    });

    // Broadcast real-time updates
    const io = getIO();
    io.emit('slot:updated', { slot: updatedSlot });
    io.emit('log:created', { log });

    res.status(201).json({ ticket, slot: updatedSlot, log });
  } catch (err) {
    console.error('[POST /portal/entry]', err);
    res.status(500).json({ error: 'Failed to register vehicle entry' });
  }
});

// ─── POST /api/portal/exit ────────────────────────────────────────────────────
// Register a vehicle exiting the facility. Calculates fee and frees the slot.
// Body: { licensePlate: string }
router.post('/exit', async (req: Request, res: Response) => {
  const { licensePlate } = req.body as { licensePlate: string };

  if (!licensePlate) {
    res.status(400).json({ error: 'licensePlate is required' });
    return;
  }

  const plate = licensePlate.toUpperCase().trim();

  try {
    // Find the open ticket for this vehicle
    const ticket = await prisma.ticket.findFirst({
      where: { licensePlate: plate, exitTime: null },
      include: { slot: true },
    });

    if (!ticket) {
      res.status(404).json({ error: `Vehicle ${plate} not found in the facility.` });
      return;
    }

    // Calculate parking fee: $2/hr, min $5
    const now = new Date();
    const durationMs = now.getTime() - ticket.entryTime.getTime();
    const durationHrs = durationMs / (1000 * 60 * 60);
    const fee = Math.max(5, parseFloat((durationHrs * 2).toFixed(2)));

    // Close the ticket
    const closedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { exitTime: now, fee },
    });

    // Free the slot
    const updatedSlot = await prisma.parkingSlot.update({
      where: { id: ticket.slotId },
      data: { status: 'FREE' },
    });

    // Write audit log entry
    const log = await prisma.auditLog.create({
      data: {
        type: 'Vehicle Exit',
        nodeId: ticket.slotId,
        licensePlate: plate,
        hash: hashString(plate + ticket.slotId + Date.now()),
      },
    });

    // Broadcast real-time updates
    const io = getIO();
    io.emit('slot:updated', { slot: updatedSlot });
    io.emit('log:created', { log });

    res.json({ ticket: closedTicket, slot: updatedSlot, log, fee });
  } catch (err) {
    console.error('[POST /portal/exit]', err);
    res.status(500).json({ error: 'Failed to register vehicle exit' });
  }
});

export default router;
