"use client";

import { useState, useTransition } from "react";
import { saveGiftingConfig } from "@/app/admin/(panel)/collections/actions";

export type GiftingChoice = { slug: string; name: string };

/**
 * Which collection each of the Gifting page's two collection-driven guides
 * pulls from. The headings above them are edited under Site text → Gifting
 * page, so each dropdown is labelled with the heading it feeds.
 */
export function GiftingSettingsEditor({
  collections,
  guide2: initialGuide2,
  guide3: initialGuide3,
  guide2Heading,
  guide3Heading,
}: {
  collections: GiftingChoice[];
  guide2: string;
  guide3: string;
  /** The headings as they currently read, so the picker says what it affects. */
  guide2Heading: string;
  guide3Heading: string;
}) {
  const [guide2, setGuide2] = useState(initialGuide2);
  const [guide3, setGuide3] = useState(initialGuide3);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const touch = () => {
    setDirty(true);
    setSaved(false);
  };

  const save = () =>
    start(async () => {
      await saveGiftingConfig({ guide2, guide3 });
      setDirty(false);
      setSaved(true);
    });

  const select =
    "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-ink outline-none focus:ring-2 focus:ring-sage-deep";

  return (
    <section className="admin-card mt-4 max-w-3xl p-4">
      <h2 className="text-[13px] font-semibold text-ink">Gift guides</h2>
      <p className="mt-1 text-[12px] text-ink-soft">
        Which collection each guide draws its products from. The headings and
        wording are under{" "}
        <span className="font-medium">Site text → Gifting page</span>.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
