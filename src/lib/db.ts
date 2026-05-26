import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || "";
  const isPostgres = dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://");

  return new PrismaClient({
    log: process.env.DEBUG_PRISMA ? ["query"] : ["error"],
    ...(isPostgres
      ? {
          datasourceUrl: dbUrl,
        }
      : {}),
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
