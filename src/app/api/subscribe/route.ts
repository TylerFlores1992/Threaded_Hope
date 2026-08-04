import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Newsletter signup. Records the address so it shows on the Customers page.
 * Idempotent: signing up twice re-subscribes rather than erroring.
 */
export async function POST(request: Request) {
  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  // No database configured → accept quietly rather than showing an error.
  if (!prisma) return NextResponse.json({ ok: true });

  try {
    await prisma.subscriber.upsert({
      where: { email },
      create: { email },
      update: { unsubscribedAt: null },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't sign you up." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
