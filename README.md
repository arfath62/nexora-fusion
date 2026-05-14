## Nexora Fusion

This app was created using https://getmocha.com.
Need help or want to join the community? Join our [Discord](https://discord.gg/shDEGBSe2d).

To run the devserver:
```
npm install
npm run dev
```

## Backend (launch foundation)

A production-style backend service now exists in `backend/`.

### Start backend

```bash
cd backend
npm install
npm run prisma:generate
npm run dev
```

API runs by default at `http://localhost:4000`.
Without `DATABASE_URL`, backend runs in local JSON mode.

### Use PostgreSQL (recommended for launch)

1. Copy `backend/.env.example` to `backend/.env`.
2. Set a valid `DATABASE_URL`.
3. Run migrations:

```bash
cd backend
npm run prisma:migrate
```

Then start backend with `npm run dev`.

### Connect Supabase

Supabase works through the existing Prisma/PostgreSQL backend. You do not need to put Supabase keys in the browser for the current app flow.

1. Create a Supabase project.
2. In Supabase, open **Project Settings > Database > Connection string**.
3. Copy the Postgres connection string and paste it into `backend/.env` as `DATABASE_URL`.
4. Replace `[YOUR-PASSWORD]` with your database password.
5. Set a strong `JWT_SECRET` in `backend/.env`.
6. Push the schema:

```bash
cd backend
npm run prisma:generate
npm run prisma:push
```

7. Start both apps from the repo root:

```bash
npm run dev:all
```

Keep the frontend `.env` pointing at the local API:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

### Connect frontend to backend

Create `.env` in the project root:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

Then run frontend as usual:

```bash
npm run dev
```

### Implemented backend routes

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET/PUT/DELETE /api/chat/sessions/:id`
- `GET /api/chat/sessions`
- `GET/PUT /api/workflows/:id`
- `GET /api/workflows`
- `GET/PUT /api/video/projects/:id`
- `POST /api/video/jobs`
- `GET /api/video/jobs/:id`
- `GET/PUT /api/settings`

Protected routes require:
`Authorization: Bearer <token>`

In local JSON mode (no `DATABASE_URL`), auth middleware allows a development guest user automatically.
