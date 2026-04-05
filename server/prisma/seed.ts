import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// ── Generates 24 slots: A1–A6, B1–B6, C1–C6, D1–D6 ──────────────────────────
const ROWS = ['A', 'B', 'C', 'D'];
const COLS = [1, 2, 3, 4, 5, 6];

async function main() {
  console.log('🌱 Seeding ParkGuard database...');

  const slotData = ROWS.flatMap((row) =>
    COLS.map((col) => ({
      id: `${row}${col}`,
      status: 'FREE',
      nodeHealth: 100,
      clockSpeed: 1200 + Math.floor(Math.random() * 200),
    }))
  );

  // Upsert to be idempotent (safe to run multiple times)
  let count = 0;
  for (const slot of slotData) {
    await prisma.parkingSlot.upsert({
      where: { id: slot.id },
      update: {},
      create: slot,
    });
    count++;
    process.stdout.write(`\r  📦 Seeded ${count}/${slotData.length} slots...`);
  }

  console.log(`\n✅ Done! ${count} parking slots ready in the database.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
