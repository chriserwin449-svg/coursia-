import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Production (Vercel): Supabase PostgreSQL via connection pooler
// Development (local preview): SQLite (sandbox can't reach Supabase ports)
function getDatabaseUrl(): string {
  // If DATABASE_URL is set to postgres, use it (production / real local)
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && (envUrl.startsWith("postgresql://") || envUrl.startsWith("postgres://"))) {
    return envUrl;
  }
  // Fallback: SQLite for sandbox preview
  return "file:./db/custom.db";
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: getDatabaseUrl(),
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
