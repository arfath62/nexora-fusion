import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { ZodError } from 'zod';
import { config } from './config';
import { requireAuth } from './middleware/requireAuth';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import workflowRoutes from './routes/workflow';
import videoRoutes from './routes/video';
import settingsRoutes from './routes/settings';
import waitlistRoutes from './routes/waitlist';
import accountRoutes from './routes/account';

const app = express();
const localDevOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin) || localDevOriginPattern.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'nexora-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/chat', requireAuth, chatRoutes);
app.use('/api/workflows', requireAuth, workflowRoutes);
app.use('/api/video', requireAuth, videoRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/account', requireAuth, accountRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.issues,
    });
    return;
  }

  if (typeof err === 'object' && err && 'status' in err && Number((err as { status?: unknown }).status) >= 400) {
    const status = Number((err as { status?: unknown }).status);
    const message = err instanceof Error && err.message ? err.message : status === 400 ? 'Invalid request body' : 'Request failed';
    res.status(status).json({ error: message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
