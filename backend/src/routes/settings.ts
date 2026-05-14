import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getPrisma, isDatabaseConfigured } from '../db';
import { readDb, writeDb } from '../store';

const router = Router();

const settingsSchema = z.record(z.string(), z.unknown());

router.get('/', async (_req, res, next) => {
  try {
    const userId = _req.auth!.sub;
    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const setting = await prisma.setting.findUnique({
        where: { userId },
      });
      res.json({ settings: setting?.data ?? null });
      return;
    }

    const db = await readDb();
    res.json({ settings: db.settings[userId] ?? null });
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const settings = settingsSchema.parse(req.body);

    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const record = await prisma.setting.upsert({
        where: { userId },
        create: {
          userId,
          data: settings as Prisma.InputJsonValue,
        },
        update: {
          data: settings as Prisma.InputJsonValue,
        },
      });
      res.json({ settings: record.data });
      return;
    }

    const db = await readDb();
    db.settings[userId] = settings;
    await writeDb(db);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

export default router;
