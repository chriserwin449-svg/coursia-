import { PrismaClient } from "@prisma/client";

// Supabase PostgreSQL connection - hardcoded so it works on Vercel without env vars
const DATABASE_URL = "postgresql://postgres.one%20day%20i%20will%20be%20rich@db.vbsrliluwytuyulpvflr.supabase.co:5432/postgres";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: DATABASE_URL,
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
