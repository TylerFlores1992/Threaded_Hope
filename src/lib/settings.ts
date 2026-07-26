import "server-only";
import { getPrisma, isDbConfigured } from "@/lib/db";

/**
 * Tiny key/value settings store (the `Setting` table). Used for values that the
 * app needs to update at runtime — currently the self-refreshing Instagram token.
 * Reads are safe when no DB is configured (return null).
 */
export async function getSetting(key: string): Promise<string | null> {
  if (!isDbConfigured()) return null;
  try {
    const row = await getPrisma().setting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getPrisma().setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export const INSTAGRAM_TOKEN_KEY = "instagram_access_token";
export const INSTAGRAM_TOKEN_REFRESHED_AT = "instagram_token_refreshed_at";
