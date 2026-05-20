import dotenv from 'dotenv';

dotenv.config();

const transcriptionProvider =
  process.env.TRANSCRIPTION_PROVIDER ??
  (process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.OPENAI_API_KEY ? 'openai' : 'local');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? 'change-this-in-production',
  jwtTtl: process.env.JWT_TTL ?? '7d',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  openRouterModel: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  publicAppUrl: process.env.PUBLIC_APP_URL ?? process.env.CORS_ORIGIN?.split(',')[0]?.trim() ?? 'http://localhost:5173',
  oauthCallbackBaseUrl: process.env.OAUTH_CALLBACK_BASE_URL ?? `http://localhost:${Number(process.env.PORT ?? 4000)}`,
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID ?? '',
  microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
  githubClientId: process.env.GITHUB_CLIENT_ID ?? '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
  transcriptionProvider,
  transcriptionModel:
    process.env.TRANSCRIPTION_MODEL ??
    (transcriptionProvider === 'openrouter'
      ? 'openai/whisper-large-v3'
      : transcriptionProvider === 'local'
        ? 'base.en'
        : 'whisper-1'),
};
