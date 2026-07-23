import { PrismaClient } from "@prisma/client";

// Standard Next.js/serverless singleton pattern — prevents exhausting the
// Postgres connection pool from hot-reload-created PrismaClient instances
// in development (DATABASE_ARCHITECTURE.md §5). No query/business logic
// lives here; domain queries belong in packages/api.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
