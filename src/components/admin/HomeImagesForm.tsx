"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { HOME_IMAGE_SLOTS } from "@/lib/home-image-slots";
import { saveHomeImages } from "@/app/admin/(panel)/home/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

function Slot({
  slotKey,
  label,
  help,
  current,
}: {
  slotKey: string;
  label: string;
  help: string;
  current?: string;
}) {
  const [preview, setPreview] = useState<string | undefined>(current);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-border sm:flex-row sm:items-center">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand ring-1 ring-border">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="px-2 text-center text-xs text-ink-soft">Default</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-ink-soft">{help}</p>
        <input
          type="file"
          name={slotKey}
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPreview(URL.createObjectURL(f));
          }}
          className="mt-2 block text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-sage-deep file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-sage"
        />
        {current && (
          <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" name={`${slotKey}__clear`} />
            Remove (revert to default)
          </label>
        )}
      </div>
    </div>
  );
}

export function HomeImagesForm({
  current,
}: {
  current: Record<string, string | undefined>;
}) {
  return (
    <form action={saveHomeImages} className="max-w-2xl space-y-4">
      {HOME_IMAGE_SLOTS.map((s) => (
        <Slot
          key={s.key}
          slotKey={s.key}
          label={s.label}
          help={s.help}
          current={current[s.key]}
        />
      ))}
      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
