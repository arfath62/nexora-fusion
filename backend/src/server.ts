import app from './app';
import { config } from './config';
import { isDatabaseConfigured } from './db';

async function start() {
  if (isDatabaseConfigured()) {
    console.log('Connected to PostgreSQL via Prisma.');
  } else {
    console.log('DATABASE_URL not set. Using local JSON datastore mode.');
  }

  app.listen(config.port, () => {
    console.log(`Nexora backend listening on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});
