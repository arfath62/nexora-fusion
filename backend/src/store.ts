import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseShape } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const emptyDb = (): DatabaseShape => ({
  users: {},
  chatSessions: {},
  workflows: {},
  videoProjects: {},
  videoJobs: {},
  settings: {},
});

let writeQueue: Promise<void> = Promise.resolve();

export async function readDb(): Promise<DatabaseShape> {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(raw) as DatabaseShape;
  } catch {
    const initial = emptyDb();
    await writeDb(initial);
    return initial;
  }
}

export async function writeDb(next: DatabaseShape): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf8');
  });

  await writeQueue;
}
