"use client";

import { useFormStatus } from "react-dom";
import {
  SITE_TEXT_FIELDS,
  SITE_TEXT_GROUPS,
  type SiteText,
} from "@/lib/site-text-fields";
import { saveSiteText } from "@/app/admin/(panel)/text/actions";

const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-sage-deep";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save text"}
    </button>
  );
}

/** Grouped editor for every admin-editable string on the storefront. */
export function SiteTextForm({ current }: { current: SiteText }) {
  return (
    <form action={saveSiteText} className="max-w-2xl space-y-8">
      {SITE_TEXT_GROUPS.map((group) => (
        <section key={group}>
          <h2 className="mb-3 font-serif text-xl text-ink">{group}</h2>
          <div className="space-y-4 rounded-2xl bg-white/70 p-5 ring-1 ring-border">
            {SITE_TEXT_FIELDS.filter((f) => f.group === group).map((f) => (
              <label key={f.key} className="block text-xs text-ink-soft">
                {f.label}
                {f.multiline ? (
                  <textarea
                    name={f.key}
                    defaultValue={current[f.key] ?? f.default}
                    rows={f.key === "story_body" ? 10 : 3}
                    className={field}
                  />
                ) : (
                  <input
                    name={f.key}
                    type="text"
                    defaultValue={current[f.key] ?? f.default}
                    className={field}
                  />
                )}
                {f.help && (
                  <span className="mt-1 block text-[11px] text-ink-soft">
                    {f.help}
                  </span>
                )}
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 flex items-center gap-3">
        <SubmitButton />
        <span className="text-xs text-ink-soft">
          Clear a field to restore its original wording.
        </span>
      </div>
    </form>
  );
}
