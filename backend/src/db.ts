import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;
let databaseDisabledReason = '';

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL) && !databaseDisabledReason;
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export function disableDatabase(reason: unknown): void {
  databaseDisabledReason = reason instanceof Error ? reason.message : String(reason);
  console.warn(`Database disabled for this backend process. Falling back to local JSON store. Reason: ${databaseDisabledReason}`);
}
