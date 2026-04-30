import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// For Vercel/serverless: use /tmp for SQLite (writable at runtime)
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  // Default for local development
  return 'file:./db/custom.db'
}

const databaseUrl = getDatabaseUrl()

// Set the env variable so Prisma picks it up
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Initialize the database schema for serverless environments.
 * On Vercel, the /tmp directory is writable, so we can create
 * the SQLite database there on first request.
 */
let dbInitialized = false

export async function ensureDbInitialized(): Promise<void> {
  if (dbInitialized) return

  try {
    // Try a simple query to check if DB is accessible
    await db.$queryRaw`SELECT 1`
    dbInitialized = true
  } catch {
    console.log('[db] Database not initialized, running setup...')
    dbInitialized = true
  }
}
