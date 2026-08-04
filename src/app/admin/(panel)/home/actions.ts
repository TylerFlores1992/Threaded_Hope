"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { getPrisma } from "@/lib/db";
import { setSetting } from "@/lib/settings";
import { HOME_IMAGE_SLOTS, HOME_IMAGES_TAG } from "@/lib/home-image-slots";

async function uploadHomeImage(file: File, key: string): Promise<string> {
  let body: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type || "image/png";
  let ext = (file.name.match(/\.([^.]+)$/)?.[1] ?? "jpg").toLowerCase();

  // Auto-trim the logo's transparent/uniform border so it displays as large as
  // possible in the header without manual cropping.
  if (key === "home_logo") {
    try {
      body = await sharp(body).trim().png().toBuffer();
      contentType = "image/png";
      ext = "png";
    } catch {
      /* if sharp can't process it, fall back to the raw upload */
    }
  }

  const blob = await put(`home/${key}-${Date.now()}.${ext}`, body, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return blob.url;
}

/**
 * Photos are uploaded to Blob storage from the browser, so what arrives here is
 * a URL. The logo still needs its border trimmed server-side, so for that slot
 * we pull the blob back, trim it, and store the trimmed copy; every other slot
 * keeps the uploaded URL as-is.
 */
async function resolveUploadedUrl(url: string, key: string): Promise<string> {
  if (key !== "home_logo") return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const trimmed = await sharp(Buffer.from(await res.arrayBuffer()))
      .trim()
      .png()
      .toBuffer();
    const blob = await put(`home/${key}-${Date.now()}.png`, trimmed, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
    });
    return blob.url;
  } catch {
    // If the trim fails, the untrimmed upload is still a perfectly good logo.
    return url;
  }
}

/** Save uploaded home images and cleared slots, then revalidate the site. */
export async function saveHomeImages(formData: FormData): Promise<void> {
  getPrisma(); // throws a clear error if no DB is configured

  // Slot keys are dynamic (static slots + one hero per collection), so drive off
  // the submitted fields rather than a fixed list. `<key>` = file upload,
  // `<key>__clear` = revert to default.
  const keys = new Set<string>(HOME_IMAGE_SLOTS.map((s) => s.key));
  for (const [field] of formData.entries()) {
    if (field.endsWith("__clear")) keys.add(field.slice(0, -"__clear".length));
    else keys.add(field);
  }

  for (const key of keys) {
    if (formData.get(`${key}__clear`) === "on") {
      await setSetting(key, ""); // empty → falls back to the default
      continue;
    }
    const value = formData.get(key);
    if (typeof value === "string" && value.startsWith("http")) {
      // Normal path: the browser already uploaded it and submitted the URL.
      await setSetting(key, await resolveUploadedUrl(value, key));
    } else if (value instanceof File && value.size > 0) {
      // Fallback for a plain (non-JS) submit — subject to the request size cap.
      await setSetting(key, await uploadHomeImage(value, key));
    }
  }

  revalidateTag(HOME_IMAGES_TAG, "max");
  revalidatePath("/", "layout"); // header, footer, and home page
  revalidatePath("/our-story"); // Our Story page image
  revalidatePath("/collections/[slug]", "page"); // collection hero banners
  revalidatePath("/admin/home");
}
