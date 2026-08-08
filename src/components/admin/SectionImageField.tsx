"use client";

import Image from "next/image";
import { useState } from "react";
import { upload } from "@vercel/blob/client";

/**
 * Picks the photo for one section, uploaded straight to Blob storage from the
 * browser so a phone photo never has to fit in a request body. The value is the
 * resulting URL, stored on the section instance.
 *
 * `choices` offers photos the shop already has — for a collection, its own
 * products. Uploading a file is the long way round when the right picture is
 * already in the catalogue.
 */
export function SectionImageField({
  label,
  value,
  onChange,
  choices = [],
  choicesLabel = "Or use a photo you already have",
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  choices?: string[];
  choicesLabel?: string;
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
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sand ring-1 ring-border">
          {value ? (
            /* Through the optimizer: these are full-size camera originals, and
               this is a 56px square. */
            <Image src={value} alt="" fill sizes="56px" className="object-cover" />
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

      {choices.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px]">{choicesLabel}</p>
          <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1">
            {choices.map((src) => {
              const active = src === value;
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => onChange(src)}
                  aria-label="Use this photo"
                  aria-pressed={active}
                  className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 transition ${
                    active
                      ? "ring-2 ring-sage-deep"
                      : "ring-border hover:ring-sage-deep/60"
                  }`}
                >
                  <Image src={src} alt="" fill sizes="48px" className="object-cover" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
