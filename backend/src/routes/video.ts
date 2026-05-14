import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getPrisma, isDatabaseConfigured } from '../db';
import { queueVideoJob } from '../services/videoWorker';
import { readDb, writeDb } from '../store';
import { VideoJob, VideoProject } from '../types';

const router = Router();
const makeKey = (userId: string, id: string) => `${userId}::${id}`;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});


const projectSchema = z.object({
  id: z.string().min(1),
  updatedAt: z.string().min(1),
  clips: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['video', 'audio', 'text', 'image']),
      start: z.number(),
      end: z.number(),
      track: z.number(),
      name: z.string(),
      color: z.string(),
      url: z.string().optional()
    })
  ),
  commandHistory: z.array(z.string()),
  videoDuration: z.number(),
});

const jobSchema = z.object({
  projectId: z.string().min(1),
  command: z.string().min(1),
});

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    res.status(201).json({
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

router.get('/projects/:id', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const project = await prisma.videoProject.findFirst({
        where: { id: req.params.id, userId },
      });
      if (!project) {
        res.status(404).json({ error: 'Video project not found' });
        return;
      }
      res.json({
        project: {
          ...project,
          clips: project.clips,
          commandHistory: project.commandHistory,
          updatedAt: project.updatedAt.toISOString(),
        },
      });
      return;
    }

    const db = await readDb();
    const project = db.videoProjects[makeKey(userId, req.params.id)];
    if (!project) {
      res.status(404).json({ error: 'Video project not found' });
      return;
    }
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

router.get('/projects', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const projects = await prisma.videoProject.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      res.json({
        projects: projects.map((project) => ({
          ...project,
          clips: project.clips,
          commandHistory: project.commandHistory,
          updatedAt: project.updatedAt.toISOString(),
        })),
      });
      return;
    }

    const db = await readDb();
    const projects = Object.entries(db.videoProjects)
      .filter(([key]) => key.startsWith(`${userId}::`))
      .map(([, value]) => value)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

router.put('/projects/:id', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const parsed = projectSchema.parse({ ...req.body, id: req.params.id });

    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const existing = await prisma.videoProject.findUnique({ where: { id: parsed.id } });
      if (existing && existing.userId !== userId) {
        res.status(409).json({ error: 'Video project id is already in use' });
        return;
      }
      const project = existing
        ? await prisma.videoProject.update({
            where: { id: parsed.id },
            data: {
              updatedAt: new Date(parsed.updatedAt),
              clips: parsed.clips as Prisma.InputJsonValue,
              commandHistory: parsed.commandHistory as Prisma.InputJsonValue,
              videoDuration: parsed.videoDuration,
            },
          })
        : await prisma.videoProject.create({
            data: {
              id: parsed.id,
              updatedAt: new Date(parsed.updatedAt),
              clips: parsed.clips as Prisma.InputJsonValue,
              commandHistory: parsed.commandHistory as Prisma.InputJsonValue,
              videoDuration: parsed.videoDuration,
              userId,
            },
          });
      res.json({
        project: {
          ...project,
          clips: project.clips,
          commandHistory: project.commandHistory,
          updatedAt: project.updatedAt.toISOString(),
        },
      });
      return;
    }

    const db = await readDb();
    const key = makeKey(userId, parsed.id);
    db.videoProjects[key] = parsed as VideoProject;
    await writeDb(db);
    res.json({ project: db.videoProjects[key] });
  } catch (error) {
    next(error);
  }
});

router.post('/jobs', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const parsed = jobSchema.parse(req.body);

    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const project = await prisma.videoProject.findFirst({
        where: { id: parsed.projectId, userId },
      });
      if (!project) {
        res.status(404).json({ error: 'Video project not found' });
        return;
      }

      const job = await prisma.videoJob.create({
        data: {
          id: uuid(),
          projectId: parsed.projectId,
          command: parsed.command,
          status: 'queued',
          createdAt: new Date(),
        },
      });

      await queueVideoJob({ jobId: job.id, command: parsed.command, isPrisma: true });

      res.status(202).json({
        job: {
          ...job,
          createdAt: job.createdAt.toISOString(),
          finishedAt: job.finishedAt?.toISOString(),
        },
      });
      return;
    }

    const db = await readDb();
    const localProject = db.videoProjects[makeKey(userId, parsed.projectId)];
    if (!localProject) {
      res.status(404).json({ error: 'Video project not found' });
      return;
    }

    const id = uuid();
    const createdAt = new Date().toISOString();

    const job: VideoJob = {
      id,
      projectId: parsed.projectId,
      command: parsed.command,
      status: 'queued',
      createdAt,
    };

    db.videoJobs[id] = job;
    await writeDb(db);
    await queueVideoJob({ jobId: id, command: parsed.command, isPrisma: false });

    res.status(202).json({ job });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    if (isDatabaseConfigured()) {
      const prisma = getPrisma();
      const job = await prisma.videoJob.findUnique({
        where: { id: req.params.id },
      });
      if (!job) {
        res.status(404).json({ error: 'Video job not found' });
        return;
      }
      const project = await prisma.videoProject.findFirst({
        where: { id: job.projectId, userId },
      });
      if (!project) {
        res.status(404).json({ error: 'Video job not found' });
        return;
      }
      res.json({
        job: {
          ...job,
          createdAt: job.createdAt.toISOString(),
          finishedAt: job.finishedAt?.toISOString(),
        },
      });
      return;
    }

    const db = await readDb();
    const job = db.videoJobs[req.params.id];
    if (!job) {
      res.status(404).json({ error: 'Video job not found' });
      return;
    }
    res.json({ job });
  } catch (error) {
    next(error);
  }
});

export default router;
