import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { payOptions } from "@/lib/payment-links";

/**
 * QR codes for the payment options in the invoice email.
 *
 * Email clients won't render an inline SVG or a data: URI reliably — Gmail
 * strips both — so the code has to be a plain PNG at a real URL.
 *
 * The key names one of *our* configured payment options; there's no way to ask
 * for arbitrary content. A QR endpoint that encodes whatever it's handed is a
 * gift to anyone wanting a trustworthy domain in front of their own link.
 */
export const dynamic = "force-static";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const option = payOptions().find((o) => o.id === key);
  if (!option) {
    return NextResponse.json({ error: "Unknown code." }, { status: 404 });
  }

  const png = await QRCode.toBuffer(option.url, {
    type: "png",
    width: 320,
    margin: 1,
    color: { dark: "#3a352cff", light: "#ffffffff" },
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // The handles change about never, and an emailed code may be opened
      // long after it was sent.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
