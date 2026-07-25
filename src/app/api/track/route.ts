import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** Records a storefront page view for the admin traffic dashboard. */
export async function POST(req: Request) {
  if (!prisma) return NextResponse.json({ ok: false });
  try {
    const { path, referrer } = await req.json();
    if (typeof path !== "string" || path.startsWith("/admin")) {
      return NextResponse.json({ ok: false });
    }
    await prisma.pageview.create({
      data: {
        path: path.slice(0, 512),
        referrer:
          typeof referrer === "string" && referrer
            ? referrer.slice(0, 512)
            : null,
      },
    });
  } catch {
    // best-effort; never surface tracking errors to visitors
  }
  return NextResponse.json({ ok: true });
}
