# Secrets Setup

## OpenAI API Key

Store OpenAI keys only in the backend environment file:

```env
OPENAI_API_KEY=replace-with-your-new-key
```

Use `backend/.env` for local development. This file is ignored by git.

Do not put OpenAI keys in:

- `src/`
- frontend `.env` files
- any variable starting with `VITE_`
- screenshots, commits, reports, or chat messages

## If A Key Was Exposed

If an API key was pasted into chat, committed, logged, or shared anywhere, treat it as compromised:

1. Revoke the exposed key in the provider dashboard.
2. Create a new key.
3. Store the new key in `backend/.env`.
4. Restart the backend server.

## Current Git Safety

The project `.gitignore` ignores:

- `.env`
- `.env.*`
- `backend/data`
- `backend/uploads`
- logs and build outputs

Only safe example files such as `.env.example` and `backend/.env.example` should be committed.
