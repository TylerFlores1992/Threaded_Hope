"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getPrisma } from "@/lib/db";
import { setSetting } from "@/lib/settings";
import {
  SITE_TEXT_FIELDS,
  SITE_TEXT_TAG,
  textSettingKey,
} from "@/lib/site-text-fields";

/**
 * Save edited site copy. A field left blank (or matching its default) stores an
 * empty value, which falls back to the built-in default — so "clear to reset"
 * works without a separate control.
 */
export async function saveSiteText(formData: FormData): Promise<void> {
  getPrisma(); // clear error if no DB

  for (const field of SITE_TEXT_FIELDS) {
    const raw = String(formData.get(field.key) ?? "").trim();
    const value = raw === field.default.trim() ? "" : raw;
    await setSetting(textSettingKey(field.key), value);
  }

  revalidateTag(SITE_TEXT_TAG, "max");
  revalidatePath("/", "layout");
  revalidatePath("/our-story");
  revalidatePath("/shop");
  revalidatePath("/admin/text");
}
