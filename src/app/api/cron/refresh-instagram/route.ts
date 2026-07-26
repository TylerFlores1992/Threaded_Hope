import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { getInstagramToken } from "@/lib/instagram";
import {
  setSetting,
  INSTAGRAM_TOKEN_KEY,
  INSTAGRAM_TOKEN_REFRESHED_AT,
} from "@/lib/settings";

export const runtime = "nodejs";
// Never cache — this mutates the stored token.
export const dynamic = "force-dynamic";

/**
 * Scheduled by Vercel Cron (see vercel.json). Exchanges the current long-lived
 * Instagram token for a fresh 60-day one and stores it in the DB, so the home
 * page feed never lapses. Bootstraps from `INSTAGRAM_ACCESS_TOKEN` on the first
 * run, then keeps the DB copy current.
 *
 * Secured with `CRON_SECRET`: Vercel Cron sends it as a Bearer token. When the
 * secret is unset the route is left open (fine for local testing).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ skipped: "No database configured." });
  }

  const token = await getInstagramToken();
  if (!token) {
    return NextResponse.json({ skipped: "No Instagram token set." });
  }

  try {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!res.ok || !data.access_token) {
      console.error("Instagram token refresh failed:", data);
      return NextResponse.json(
        { error: "Refresh failed", status: res.status },
        { status: 502 },
      );
    }

    await setSetting(INSTAGRAM_TOKEN_KEY, data.access_token);
    await setSetting(INSTAGRAM_TOKEN_REFRESHED_AT, new Date().toISOString());

    return NextResponse.json({
      ok: true,
      // days until the new token expires (~60)
      expiresInDays: data.expires_in
        ? Math.round(data.expires_in / 86400)
        : undefined,
    });
  } catch (err) {
    console.error("Instagram token refresh error:", err);
    return NextResponse.json({ error: "Refresh error" }, { status: 500 });
  }
}
