import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { config } from '../config';
import { signAccessToken } from '../auth';
import { disableDatabase, getPrisma, isDatabaseConfigured } from '../db';
import { requireAuth } from '../middleware/requireAuth';
import { readDb, writeDb } from '../store';

const router = Router();
const oauthProviders = ['google', 'microsoft', 'github'] as const;
type OAuthProvider = (typeof oauthProviders)[number];

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function getOAuthConfig(provider: OAuthProvider) {
  const redirectUri = `${config.oauthCallbackBaseUrl}/api/auth/oauth/${provider}/callback`;
  if (provider === 'google') {
    return {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      redirectUri,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      scope: 'openid email profile',
    };
  }
  if (provider === 'microsoft') {
    return {
      clientId: config.microsoftClientId,
      clientSecret: config.microsoftClientSecret,
      redirectUri,
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      scope: 'openid email profile User.Read',
    };
  }
  return {
    clientId: config.githubClientId,
    clientSecret: config.githubClientSecret,
    redirectUri,
    authUrl: 'https://github.com/login/oauth/authorize',
    scope: 'read:user user:email',
  };
}

function isProvider(value: string): value is OAuthProvider {
  return (oauthProviders as readonly string[]).includes(value);
}

async function createLocalUser(parsed: z.infer<typeof registerSchema>, passwordHash: string) {
  const db = await readDb();
  const existing = Object.values(db.users).find((u) => u.email === parsed.email);
  if (existing) return { status: 409 as const, error: 'Email already registered' };

  const id = uuid();
  db.users[id] = {
    id,
    email: parsed.email,
    name: parsed.name,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  await writeDb(db);

  return {
    status: 201 as const,
    token: signAccessToken({ sub: id, email: parsed.email }),
    user: { id, email: parsed.email, name: parsed.name ?? null },
  };
}

async function findLocalUserByEmail(email: string) {
  const db = await readDb();
  return Object.values(db.users).find((u) => u.email === email);
}

async function findLocalUserById(id: string) {
  const db = await readDb();
  return db.users[id];
}

router.get('/oauth/providers', (_req, res) => {
  res.json({
    providers: oauthProviders.map((provider) => {
      const oauth = getOAuthConfig(provider);
      return {
        id: provider,
        name: provider === 'github' ? 'GitHub' : provider[0].toUpperCase() + provider.slice(1),
        configured: Boolean(oauth.clientId && oauth.clientSecret),
      };
    }),
  });
});

router.get('/oauth/:provider/start', (req, res) => {
  const provider = req.params.provider;
  if (!isProvider(provider)) {
    res.status(404).json({ error: 'OAuth provider not supported' });
    return;
  }

  const oauth = getOAuthConfig(provider);
  if (!oauth.clientId || !oauth.clientSecret) {
    res.status(501).json({
      error: `${provider} OAuth is not configured. Add the provider client id/secret in backend/.env.`,
    });
    return;
  }

  const state = Buffer.from(
    JSON.stringify({
      provider,
      next: typeof req.query.next === 'string' ? req.query.next : '/app/chat',
      createdAt: Date.now(),
    })
  ).toString('base64url');

  const params = new URLSearchParams({
    client_id: oauth.clientId,
    redirect_uri: oauth.redirectUri,
    response_type: 'code',
    scope: oauth.scope,
    state,
  });

  res.redirect(`${oauth.authUrl}?${params.toString()}`);
});

router.get('/oauth/:provider/callback', (req, res) => {
  const provider = req.params.provider;
  if (!isProvider(provider)) {
    res.status(404).json({ error: 'OAuth provider not supported' });
    return;
  }
  if (!req.query.code) {
    res.redirect(`${config.publicAppUrl}/login?error=oauth_missing_code`);
    return;
  }
  res.redirect(`${config.publicAppUrl}/login?error=oauth_callback_not_finished&provider=${provider}`);
});

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(parsed.password, 10);

    if (isDatabaseConfigured()) {
      try {
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
      } catch (error) {
        disableDatabase(error);
      }
    }

    const localResult = await createLocalUser(parsed, passwordHash);
    if ('error' in localResult) {
      res.status(localResult.status).json({ error: localResult.error });
      return;
    }
    res.status(201).json({ token: localResult.token, user: localResult.user });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);

    if (isDatabaseConfigured()) {
      try {
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
      } catch (error) {
        disableDatabase(error);
      }
    }

    const user = await findLocalUserByEmail(parsed.email);
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
      try {
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          res.status(404).json({ error: 'User not found' });
          return;
        }
        res.json({ user: { id: user.id, email: user.email, name: user.name } });
        return;
      } catch (error) {
        disableDatabase(error);
      }
    }

    const user = await findLocalUserById(userId);
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
