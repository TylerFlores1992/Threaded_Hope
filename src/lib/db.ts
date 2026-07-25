import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * The whole app is designed to run WITHOUT a database (browsing/cart fall back
 * to the static catalog in `src/data`), so this is created lazily and only when
 * `DATABASE_URL` is present. Use `isDbConfigured()` to guard DB-only paths and
 * `getPrisma()` to obtain the client (throws if the DB isn't configured).
 */
export const isDbConfigured = () =>
  Boolean(
    process.env.DATABASE_POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL,
  );

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient | null {
  if (!isDbConfigured()) return null;
  return new PrismaClient();
}

export const prisma: PrismaClient | null =
  globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}

/** Returns the Prisma client or throws — use in admin/API paths that require the DB. */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error(
      "DATABASE_URL is not set. Configure a Postgres database to use admin features.",
    );
  }
  return prisma;
}
