import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Issues short-lived tokens so the admin browser uploads photos STRAIGHT to
 * Vercel Blob instead of POSTing them through a server action.
 *
 * Why: serverless requests are capped at ~4.5 MB on Vercel regardless of
 * `serverActions.bodySizeLimit`, so a couple of phone photos overflowed the
 * request and the page died with "page couldn't load". Direct uploads bypass
 * the function entirely — only the resulting URLs come back through the form.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  // Only the token request comes from the admin's browser (and so carries the
  // session cookie). The upload-completed callback is signed by Vercel and has
  // no cookie, so gating it here would make every upload fail.
  if (body.type === "blob.generate-client-token") {
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (!token || !(await verifySessionToken(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/avif",
          "image/heic",
          "image/heif",
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 25 * 1024 * 1024,
      }),
      // Nothing to record — the form submits the returned URLs itself.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 },
    );
  }
}
