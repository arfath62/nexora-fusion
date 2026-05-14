import { Router } from 'express';
import { z } from 'zod';
import { getPrisma, isDatabaseConfigured } from '../db';
import { readDb, writeDb } from '../store';

const router = Router();

const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['Owner', 'Admin', 'Member', 'Viewer']),
  status: z.enum(['Active', 'Invited']),
});

const workspaceSchema = z.object({
  companyName: z.string().min(1).max(80),
  plan: z.enum(['Starter', 'Growth', 'Scale']),
  seats: z.number().int().min(1).max(250),
  monthlyCredits: z.number().int().min(100).max(1000000),
  members: z.array(memberSchema).max(250),
});

const settingKey = (userId: string) => `${userId}:workspace`;

function defaultWorkspace(user: { email: string; name?: string | null }) {
  return {
    companyName: user.name ? `${user.name}'s workspace` : 'Nexora workspace',
    plan: 'Growth' as const,
    seats: 5,
    monthlyCredits: 25000,
    members: [
      {
        id: 'owner',
        name: user.name || 'Workspace owner',
        email: user.email,
        role: 'Owner' as const,
        status: 'Active' as const,
      },
    ],
  };
}

function summarizeUsage(counts: {
  chats: number;
  workflows: number;
  videoProjects: number;
  videoJobs: number;
}) {
  const creditsUsed =
    counts.chats * 35 + counts.workflows * 120 + counts.videoProjects * 450 + counts.videoJobs * 900;

  return {
    creditsUsed,
    chats: counts.chats,
    workflows: counts.workflows,
    videoProjects: counts.videoProjects,
    videoJobs: counts.videoJobs,
    automationRuns: counts.workflows * 3 + counts.videoJobs,
  };
}

router.get('/overview', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;

    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const [chats, workflows, videoProjects, videoJobs, setting] = await Promise.all([
        prisma.chatSession.count({ where: { userId } }),
        prisma.workflow.count({ where: { userId } }),
        prisma.videoProject.count({ where: { userId } }),
        prisma.videoJob.count({ where: { project: { userId } } }),
        prisma.setting.findUnique({ where: { userId } }),
      ]);

      const stored = (setting?.data as { workspace?: unknown } | null)?.workspace;
      const parsedWorkspace = workspaceSchema.safeParse(stored);
      const workspace = parsedWorkspace.success ? parsedWorkspace.data : defaultWorkspace(user);

      res.json({
        workspace,
        usage: summarizeUsage({ chats, workflows, videoProjects, videoJobs }),
        user: { id: user.id, email: user.email, name: user.name },
      });
      return;
    }

    const db = await readDb();
    const user = db.users[userId];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const parsedWorkspace = workspaceSchema.safeParse(db.settings[settingKey(userId)]);
    const workspace = parsedWorkspace.success ? parsedWorkspace.data : defaultWorkspace(user);
    const prefix = `${userId}::`;
    const counts = {
      chats: Object.keys(db.chatSessions).filter((key) => key.startsWith(prefix)).length,
      workflows: Object.keys(db.workflows).filter((key) => key.startsWith(prefix)).length,
      videoProjects: Object.keys(db.videoProjects).filter((key) => key.startsWith(prefix)).length,
      videoJobs: Object.values(db.videoJobs).filter((job) => Boolean(db.videoProjects[`${userId}::${job.projectId}`]))
        .length,
    };

    res.json({
      workspace,
      usage: summarizeUsage(counts),
      user: { id: user.id, email: user.email, name: user.name ?? null },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/workspace', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const workspace = workspaceSchema.parse(req.body);

    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const existing = await prisma.setting.findUnique({ where: { userId } });
      const data = {
        ...((existing?.data as Record<string, unknown> | null) ?? {}),
        workspace,
      };
      const setting = await prisma.setting.upsert({
        where: { userId },
        create: { userId, data },
        update: { data },
      });
      res.json({ workspace: (setting.data as { workspace: unknown }).workspace });
      return;
    }

    const db = await readDb();
    db.settings[settingKey(userId)] = workspace;
    await writeDb(db);
    res.json({ workspace });
  } catch (error) {
    next(error);
  }
});

export default router;
