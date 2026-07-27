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

/** Save uploaded home images and cleared slots, then revalidate the site. */
export async function saveHomeImages(formData: FormData): Promise<void> {
  getPrisma(); // throws a clear error if no DB is configured

  for (const slot of HOME_IMAGE_SLOTS) {
    if (formData.get(`${slot.key}__clear`) === "on") {
      await setSetting(slot.key, ""); // empty → falls back to the default
      continue;
    }
    const file = formData.get(slot.key) as File | null;
    if (file && file.size > 0) {
      const url = await uploadHomeImage(file, slot.key);
      await setSetting(slot.key, url);
    }
  }

  revalidateTag(HOME_IMAGES_TAG, "max");
  revalidatePath("/", "layout"); // header, footer, and home page
  revalidatePath("/our-story"); // Our Story page image
  revalidatePath("/admin/home");
}
