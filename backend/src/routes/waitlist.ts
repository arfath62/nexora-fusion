import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const DATA_FILE = path.join(process.cwd(), 'data', 'waitlist.json');

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
});

type Entry = { email: string; name?: string; createdAt: string };

async function readEntries(): Promise<Entry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendEntry(entry: Entry): Promise<void> {
  const list = await readEntries();
  list.push(entry);
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

router.post('/', async (req, res, next) => {
  try {
    const parsed = bodySchema.parse(req.body);
    await appendEntry({
      email: parsed.email.toLowerCase().trim(),
      name: parsed.name?.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
