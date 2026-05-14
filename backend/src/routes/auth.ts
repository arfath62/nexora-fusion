import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { signAccessToken } from '../auth';
import { getPrisma, isDatabaseConfigured } from '../db';
import { requireAuth } from '../middleware/requireAuth';
import { readDb, writeDb } from '../store';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(parsed.password, 10);

    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
      if (existing) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const user = await prisma.user.create({
        data: {
          email: parsed.email,
          name: parsed.name,
          passwordHash,
        },
      });

      const token = signAccessToken({ sub: user.id, email: user.email });
      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
      return;
    }

    const db = await readDb();
    const existing = Object.values(db.users).find((u) => u.email === parsed.email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const id = uuid();
    db.users[id] = {
      id,
      email: parsed.email,
      name: parsed.name,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    await writeDb(db);

    const token = signAccessToken({ sub: id, email: parsed.email });
    res.status(201).json({
      token,
      user: { id, email: parsed.email, name: parsed.name ?? null },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);

    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({ where: { email: parsed.email } });
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const isValid = await bcrypt.compare(parsed.password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = signAccessToken({ sub: user.id, email: user.email });
      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
      return;
    }

    const db = await readDb();
    const user = Object.values(db.users).find((u) => u.email === parsed.email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signAccessToken({ sub: user.id, email: user.email });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name ?? null },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.sub;

    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ user: { id: user.id, email: user.email, name: user.name } });
      return;
    }

    const db = await readDb();
    const user = db.users[userId];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name ?? null } });
  } catch (error) {
    next(error);
  }
});

export default router;
