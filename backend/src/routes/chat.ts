import { Router } from 'express';
import { z } from 'zod';
import { Ollama } from 'ollama';
import { getPrisma, isDatabaseConfigured } from '../db';
import { readDb, writeDb } from '../store';
import { ChatSession } from '../types';

const ollama = new Ollama({ host: 'http://localhost:11434' });

const router = Router();
const makeKey = (userId: string, id: string) => `${userId}::${id}`;

const chatSessionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  isFavorite: z.boolean().optional().default(false),
  updatedAt: z.string().min(1),
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      timestamp: z.string(),
    })
  ),
});

router.get('/sessions', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const sessions = await prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });

      res.json({
        sessions: sessions.map((session) => ({
          ...session,
          messages: session.messages,
          updatedAt: session.updatedAt.toISOString(),
        })),
      });
      return;
    }

    const db = await readDb();
    const sessions = Object.entries(db.chatSessions)
      .filter(([key]) => key.startsWith(`${userId}::`))
      .map(([, value]) => value)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions/:id', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const session = await prisma.chatSession.findFirst({
        where: { id: req.params.id, userId },
      });
      if (!session) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }
      res.json({
        session: {
          ...session,
          messages: session.messages,
          updatedAt: session.updatedAt.toISOString(),
        },
      });
      return;
    }

    const db = await readDb();
    const session = db.chatSessions[makeKey(userId, req.params.id)];
    if (!session) {
      res.status(404).json({ error: 'Chat session not found' });
      return;
    }
    res.json({ session });
  } catch (error) {
    next(error);
  }
});

router.put('/sessions/:id', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const parsed = chatSessionSchema.parse({ ...req.body, id: req.params.id });

    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const existing = await prisma.chatSession.findUnique({ where: { id: parsed.id } });
      if (existing && existing.userId !== userId) {
        res.status(409).json({ error: 'Chat session id is already in use' });
        return;
      }
      const session = existing
        ? await prisma.chatSession.update({
            where: { id: parsed.id },
            data: {
              title: parsed.title,
              isFavorite: parsed.isFavorite,
              updatedAt: new Date(parsed.updatedAt),
              messages: parsed.messages,
            },
          })
        : await prisma.chatSession.create({
            data: {
              id: parsed.id,
              title: parsed.title,
              isFavorite: parsed.isFavorite,
              updatedAt: new Date(parsed.updatedAt),
              messages: parsed.messages,
              userId,
            },
          });

      res.json({
        session: {
          ...session,
          messages: session.messages,
          updatedAt: session.updatedAt.toISOString(),
        },
      });
      return;
    }

    const db = await readDb();
    const key = makeKey(userId, parsed.id);
    db.chatSessions[key] = parsed as ChatSession;
    await writeDb(db);
    res.json({ session: db.chatSessions[key] });
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      await prisma.chatSession.deleteMany({
        where: { id: req.params.id, userId },
      });
      res.status(204).send();
      return;
    }

    const db = await readDb();
    delete db.chatSessions[makeKey(userId, req.params.id)];
    await writeDb(db);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/sessions/:id/messages', async (req, res, next) => {
  try {
    const { messages } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    if (!messages || !Array.isArray(messages)) {
       res.write(`data: ${JSON.stringify({ error: 'Messages array is required' })}\n\n`);
       res.write('data: [DONE]\n\n');
       res.end();
       return;
    }
    
    try {
      const response = await ollama.chat({
        model: 'tinyllama', // Changed from llama3 to tinyllama for lower memory requirements
        messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
        stream: true,
      });

      for await (const chunk of response) {
        res.write(`data: ${JSON.stringify({ text: chunk.message.content })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (ollamaError: any) {
      console.error('Ollama Error:', ollamaError);
      res.write(`data: ${JSON.stringify({ text: '\n\n*(Error: Could not connect to local Ollama. Please ensure you have downloaded the model by running `ollama pull tinyllama` in a separate terminal.)*' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
