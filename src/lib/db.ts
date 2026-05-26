import { PrismaClient } from "@prisma/client";

// Supabase PostgreSQL - direct connection for local dev, pooler for Vercel
const isProduction = process.env.NODE_ENV === "production";

// Use Supabase connection pooler (port 6543) in production for Vercel compatibility
// Use direct connection (port 5432) in development
const DATABASE_URL = isProduction
  ? "postgresql://postgres.vbsrliluwytuyulpvflr:one%20day%20i%20will%20be%20rich@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  : "postgresql://postgres.one%20day%20i%20will%20be%20rich@db.vbsrliluwytuyulpvflr.supabase.co:5432/postgres";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: DATABASE_URL,
    log: ["error"],
  });

if (!isProduction) globalForPrisma.prisma = db;
