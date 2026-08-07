import { NextResponse } from "next/server";
import { sendContactMessage } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Contact form receiver. Emails the shop owner with the customer's address as
 * the reply-to, so a reply goes straight back to them.
 *
 * If email isn't configured the send can't happen, and the customer must be
 * told — silently showing "thanks, we'll be in touch" while dropping the
 * message is worse than an honest error with the shop's address in it.
 */
export async function POST(request: Request) {
  let name = "";
  let email = "";
  let message = "";

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    name = str(body.name);
    email = str(body.email).toLowerCase();
    message = str(body.message);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (!name || !message) {
    return NextResponse.json(
      { error: "Please fill in your name and message." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (name.length > 200 || message.length > 5000) {
    return NextResponse.json(
      { error: "That message is a little too long — please shorten it." },
      { status: 400 },
    );
  }

  const sent = await sendContactMessage({ name, email, message });
  if (!sent) {
    return NextResponse.json(
      { error: "We couldn't send that just now. Please email us directly." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
