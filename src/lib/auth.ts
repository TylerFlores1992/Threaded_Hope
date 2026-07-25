import { SignJWT, jwtVerify } from "jose";

/**
 * Minimal single-admin auth: a signed session cookie gated by ADMIN_PASSWORD.
 * Edge-compatible (used by middleware and server actions). The signing key is
 * derived from ADMIN_PASSWORD via SHA-256, so no extra secret is required.
 */
export const ADMIN_COOKIE = "th_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

async function signingKey(): Promise<Uint8Array> {
  const pw = process.env.ADMIN_PASSWORD ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pw),
  );
  return new Uint8Array(digest);
}

export const isAdminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

/** Constant-time-ish password check against ADMIN_PASSWORD. */
export function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected || candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(await signingKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, await signingKey());
    return true;
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
