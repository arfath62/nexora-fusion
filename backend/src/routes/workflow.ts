import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getPrisma, isDatabaseConfigured } from '../db';
import { readDb, writeDb } from '../store';
import { AgentWorkflow } from '../types';
import { executeWorkflow } from '../services/workflowEngine';

const router = Router();
const makeKey = (userId: string, id: string) => `${userId}::${id}`;

const workflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  updatedAt: z.string().min(1),
  nodes: z.array(z.unknown()),
});

router.post('/execute', async (req, res, next) => {
  try {
    const { nodes } = req.body;
    const result = await executeWorkflow(nodes || []);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const workflows = await prisma.workflow.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      res.json({
        workflows: workflows.map((workflow) => ({
          ...workflow,
          nodes: workflow.nodes,
          updatedAt: workflow.updatedAt.toISOString(),
        })),
      });
      return;
    }

    const db = await readDb();
    const workflows = Object.entries(db.workflows)
      .filter(([key]) => key.startsWith(`${userId}::`))
      .map(([, value]) => value)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json({ workflows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const workflow = await prisma.workflow.findFirst({
        where: { id: req.params.id, userId },
      });
      if (!workflow) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }
      res.json({
        workflow: {
          ...workflow,
          nodes: workflow.nodes,
          updatedAt: workflow.updatedAt.toISOString(),
        },
      });
      return;
    }

    const db = await readDb();
    const workflow = db.workflows[makeKey(userId, req.params.id)];
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json({ workflow });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const parsed = workflowSchema.parse({ ...req.body, id: req.params.id });

    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const existing = await prisma.workflow.findUnique({ where: { id: parsed.id } });
      if (existing && existing.userId !== userId) {
        res.status(409).json({ error: 'Workflow id is already in use' });
        return;
      }
      const workflow = existing
        ? await prisma.workflow.update({
            where: { id: parsed.id },
            data: {
              name: parsed.name,
              updatedAt: new Date(parsed.updatedAt),
              nodes: parsed.nodes as Prisma.InputJsonValue,
            },
          })
        : await prisma.workflow.create({
            data: {
              id: parsed.id,
              name: parsed.name,
              updatedAt: new Date(parsed.updatedAt),
              nodes: parsed.nodes as Prisma.InputJsonValue,
              userId,
            },
          });
      res.json({
        workflow: {
          ...workflow,
          nodes: workflow.nodes,
          updatedAt: workflow.updatedAt.toISOString(),
        },
      });
      return;
    }

    const db = await readDb();
    const key = makeKey(userId, parsed.id);
    db.workflows[key] = parsed as AgentWorkflow;
    await writeDb(db);
    res.json({ workflow: db.workflows[key] });
  } catch (error) {
    next(error);
  }
});

export default router;
