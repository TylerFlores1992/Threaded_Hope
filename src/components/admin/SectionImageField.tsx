"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

/**
 * Picks the photo for one section, uploaded straight to Blob storage from the
 * browser so a phone photo never has to fit in a request body. The value is the
 * resulting URL, stored on the section instance.
 */
export function SectionImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });
      onChange(blob.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo couldn't upload.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-xs text-ink-soft">
      <p>{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sand ring-1 ring-border">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-ink-soft">None</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            type="file"
            accept="image/*"
            aria-label={label}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="block w-full text-[11px] text-ink-soft file:mr-2 file:rounded-full file:border-0 file:bg-sand file:px-2 file:py-1 file:text-[11px] file:text-ink hover:file:bg-sage-deep hover:file:text-white"
          />
          {busy && <p className="mt-1">Uploading…</p>}
          {value && !busy && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="mt-1 text-[11px] text-red-700 hover:underline"
            >
              Remove photo
            </button>
          )}
          {error && <p className="mt-1 text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
