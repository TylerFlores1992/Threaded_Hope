import "server-only";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * Named packaging presets (mailers/boxes) with a tare weight, managed in the
 * admin and chosen when buying a shipping label. Stored as JSON in the `Setting`
 * table; falls back to sensible defaults when none are configured.
 */
export type PackagingOption = { id: string; name: string; weightOz: number };

export const PACKAGING_KEY = "packaging_options";

export const DEFAULT_PACKAGING: PackagingOption[] = [
  { id: "poly-mailer", name: "Poly mailer", weightOz: 2 },
  { id: "small-box", name: "Small box", weightOz: 6 },
  { id: "medium-box", name: "Medium box", weightOz: 12 },
];

function normalize(raw: unknown): PackagingOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) =>
      o && typeof o === "object"
        ? {
            id: String((o as PackagingOption).id ?? ""),
            name: String((o as PackagingOption).name ?? "").trim(),
            weightOz: Math.max(0, Number((o as PackagingOption).weightOz) || 0),
          }
        : null,
    )
    .filter((o): o is PackagingOption => Boolean(o && o.id && o.name));
}

export async function getPackagingOptions(): Promise<PackagingOption[]> {
  const raw = await getSetting(PACKAGING_KEY);
  if (!raw) return DEFAULT_PACKAGING;
  try {
    const opts = normalize(JSON.parse(raw));
    return opts.length > 0 ? opts : DEFAULT_PACKAGING;
  } catch {
    return DEFAULT_PACKAGING;
  }
}

export async function savePackagingOptions(
  opts: PackagingOption[],
): Promise<void> {
  await setSetting(PACKAGING_KEY, JSON.stringify(normalize(opts)));
}
