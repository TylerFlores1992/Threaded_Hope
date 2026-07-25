// Runs at build time on Vercel. When a database is configured, it syncs the
// Prisma schema to the DB and seeds the catalog on first run. When no DB is
// configured (e.g. local build before setup), it does nothing so the app still
// builds and serves the static catalog fallback.
import { execSync } from "node:child_process";

const hasDb =
  process.env.DATABASE_POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL;

if (!hasDb) {
  console.log("No database configured — skipping schema sync (static fallback).");
  process.exit(0);
}

console.log("Syncing database schema (prisma db push)…");
execSync("prisma db push --skip-generate", { stdio: "inherit" });

console.log("Seeding catalog if empty…");
execSync("tsx prisma/seed.ts", { stdio: "inherit" });
