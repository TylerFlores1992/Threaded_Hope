"use client";

import { useState, useTransition } from "react";
import { saveGiftingConfig } from "@/app/admin/(panel)/collections/actions";

export type GiftingChoice = { slug: string; name: string };

/**
 * Which collections the Gifting page draws from.
 *
 * Sits with the collection tools rather than in Site text, because it's a
 * choice of collections, not wording — the headings above these guides are
 * edited under Site text → Gifting page.
 */
export function GiftingSettingsEditor({
  collections,
  tiles: initialTiles,
  guide2: initialGuide2,
  guide3: initialGuide3,
  guide2Heading,
  guide3Heading,
}: {
  collections: GiftingChoice[];
  tiles: string[];
  guide2: string;
  guide3: string;
  /** The headings as they currently read, so the picker says what it affects. */
  guide2Heading: string;
  guide3Heading: string;
}) {
  const [tiles, setTiles] = useState<string[]>(initialTiles);
  const [guide2, setGuide2] = useState(initialGuide2);
  const [guide3, setGuide3] = useState(initialGuide3);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const touch = () => {
    setDirty(true);
    setSaved(false);
  };

  /** Checking adds to the end, so the tile order follows the order chosen. */
  const toggleTile = (slug: string) => {
    setTiles((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
    touch();
  };

  const save = () =>
    start(async () => {
      await saveGiftingConfig({ tiles, guide2, guide3 });
      setDirty(false);
      setSaved(true);
    });

  const select =
    "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-ink outline-none focus:ring-2 focus:ring-sage-deep";

  return (
    <section className="admin-card mt-4 max-w-3xl p-4">
      <h2 className="text-[13px] font-semibold text-ink">Gifting page</h2>
      <p className="mt-1 text-[12px] text-ink-soft">
        Which collections the Gifting page uses. The headings and wording are
        under <span className="font-medium">Site text → Gifting page</span>.
      </p>

      <div className="mt-4">
        <p className="text-[13px] font-medium text-ink">
          Tiles under &ldquo;Shop gifts by recipient&rdquo;
        </p>
        <p className="text-[12px] text-ink-soft">
          They appear in the order you tick them. Four fills the row.
        </p>
        <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {collections.map((c) => {
            const at = tiles.indexOf(c.slug);
            return (
              <label
                key={c.slug}
                className="flex items-center gap-2 text-[13px] text-ink"
              >
                <input
                  type="checkbox"
                  checked={at >= 0}
                  onChange={() => toggleTile(c.slug)}
                />
                {c.name}
                {at >= 0 && (
                  <span className="text-[11px] text-ink-soft">#{at + 1}</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-[13px] text-ink-soft">
          Products under &ldquo;{guide2Heading}&rdquo;
          <select
            value={guide2}
            onChange={(e) => {
              setGuide2(e.target.value);
              touch();
            }}
            className={select}
          >
            {collections.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] text-ink-soft">
          Products under &ldquo;{guide3Heading}&rdquo;
          <select
            value={guide3}
            onChange={(e) => {
              setGuide3(e.target.value);
              touch();
            }}
            className={select}
          >
            {collections.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-4 text-[12px] text-ink-soft">
        The first guide stays price-based — its limit is the &ldquo;price
        limit&rdquo; field under Site text.
      </p>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || pending}
          className="rounded-lg bg-[#303030] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1a1a1a] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save gifting page"}
        </button>
        {saved && !dirty && (
          <span className="text-[12px] text-[#0c5132]">Saved</span>
        )}
      </div>
    </section>
  );
}
