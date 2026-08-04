"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { upload } from "@vercel/blob/client";
import { HOME_IMAGE_SLOTS, type ImageSlot } from "@/lib/home-image-slots";
import { saveHomeImages } from "@/app/admin/(panel)/home/actions";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage disabled:opacity-60"
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
  onBusyChange,
}: {
  slotKey: string;
  label: string;
  help: string;
  current?: string;
  onBusyChange: (key: string, busy: boolean) => void;
}) {
  const [preview, setPreview] = useState<string | undefined>(current);
  // Set once the browser has uploaded the new photo; the form submits this URL
  // instead of the file, so a big photo never has to fit in the request body.
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setError(null);
    setBusy(true);
    onBusyChange(slotKey, true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });
      setUploadedUrl(blob.url);
    } catch (err) {
      setPreview(current);
      setError(err instanceof Error ? err.message : "That photo couldn't upload.");
    } finally {
      setBusy(false);
      onBusyChange(slotKey, false);
    }
  };

  return (
    <div className="flex flex-col gap-3 admin-card p-4 sm:flex-row sm:items-center">
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
        <input type="hidden" name={slotKey} value={uploadedUrl} />
        <input
          type="file"
          accept="image/*"
          aria-label={label}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = ""; // allow re-picking the same file
          }}
          className="mt-2 block text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-sage-deep file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-sage"
        />
        {busy && (
          <p className="mt-1 text-xs text-ink-soft" aria-live="polite">
            Uploading…
          </p>
        )}
        {!busy && uploadedUrl && (
          <p className="mt-1 text-xs text-sage-deep">
            Uploaded — save to apply.
          </p>
        )}
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
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
  collectionSlots = [],
}: {
  current: Record<string, string | undefined>;
  /** One hero slot per collection (added below the site-wide slots). */
  collectionSlots?: ImageSlot[];
}) {
  // Saving mid-upload would drop that photo, so hold the button until every
  // slot has finished.
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const onBusyChange = (key: string, busy: boolean) =>
    setBusySlots((prev) =>
      busy ? [...new Set([...prev, key])] : prev.filter((k) => k !== key),
    );

  return (
    <form action={saveHomeImages} className="max-w-2xl space-y-4">
      {HOME_IMAGE_SLOTS.map((s) => (
        <Slot
          key={s.key}
          slotKey={s.key}
          label={s.label}
          help={s.help}
          current={current[s.key]}
          onBusyChange={onBusyChange}
        />
      ))}

      {collectionSlots.length > 0 && (
        <>
          <h2 className="pt-4 text-[13px] font-semibold text-ink">
            Collection banners
          </h2>
          <p className="-mt-2 text-sm text-ink-soft">
            The wide image behind each collection page’s title. Empty slots use a
            generated pattern in the collection’s color.
          </p>
          {collectionSlots.map((s) => (
            <Slot
              key={s.key}
              slotKey={s.key}
              label={s.label}
              help={s.help}
              current={current[s.key]}
              onBusyChange={onBusyChange}
            />
          ))}
        </>
      )}

      <div className="pt-2">
        <SubmitButton disabled={busySlots.length > 0} />
      </div>
    </form>
  );
}
