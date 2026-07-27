"use server";

import { revalidatePath } from "next/cache";
import {
  getPackagingOptions,
  savePackagingOptions,
  DEFAULT_PACKAGING,
} from "@/lib/packaging";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Add a packaging preset (name + tare weight in oz). */
export async function addPackagingOption(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const weightOz = Math.max(0, Number(formData.get("weightOz")) || 0);
  if (!name) return;

  // Seed from defaults on first customization so the list isn't suddenly empty.
  const raw = await getPackagingOptions();
  const current = raw === DEFAULT_PACKAGING ? [...DEFAULT_PACKAGING] : raw;

  const base = slugify(name) || "pkg";
  let id = base;
  let n = 1;
  const taken = new Set(current.map((o) => o.id));
  while (taken.has(id)) id = `${base}-${++n}`;

  current.push({ id, name, weightOz });
  await savePackagingOptions(current);
  revalidatePath("/admin/orders/packaging");
}

/** Delete a packaging preset by id. */
export async function deletePackagingOption(id: string): Promise<void> {
  const current = await getPackagingOptions();
  await savePackagingOptions(current.filter((o) => o.id !== id));
  revalidatePath("/admin/orders/packaging");
}
