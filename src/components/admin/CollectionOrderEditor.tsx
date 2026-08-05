"use client";

import { useState, useTransition } from "react";
import { placeholderImage } from "@/lib/placeholder";
import { saveCollectionOrdering } from "@/app/admin/(panel)/collections/actions";

export type OrderableCollection = {
  id: string;
  name: string;
  image?: string;
  featured: boolean;
  hidden: boolean;
};

/**
 * Arrange the order collections appear in. The home page grid takes featured
 * collections first and then tops up from the rest, and the collections index
 * lists them straight through — both follow this order.
 */
export function CollectionOrderEditor({
  collections,
}: {
  collections: OrderableCollection[];
}) {
  const [order, setOrder] = useState(collections);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = order.filter((c) => c.id !== dragId);
    const moved = order.find((c) => c.id === dragId);
    if (!moved) return;
    next.splice(next.findIndex((c) => c.id === targetId), 0, moved);
    setOrder(next);
    setDirty(true);
    setSaved(false);
    setDragId(null);
    setOverId(null);
  };

  /** Keyboard and touch fallback — dragging isn't reachable for everyone. */
  const nudge = (id: string, dir: -1 | 1) => {
    const i = order.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setDirty(true);
    setSaved(false);
  };

  const onSave = () =>
    start(async () => {
      await saveCollectionOrdering(order.map((c) => c.id));
      setDirty(false);
      setSaved(true);
    });

  return (
    <div className="admin-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">
            Home page order
          </h2>
          <p className="text-[12px] text-ink-soft">
            Drag to arrange. Featured collections fill the home page grid first,
            in this order; the rest top it up.
          </p>
        </div>
        <span className="flex items-center gap-3">
          {saved && !dirty && (
            <span className="text-[12px] text-[#0c5132]">Saved ✓</span>
          )}
          <button
            onClick={onSave}
            disabled={!dirty || pending}
            className="rounded-lg bg-[#303030] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1a1a1a] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save order"}
          </button>
        </span>
      </div>

      <ol className="divide-y divide-border rounded-lg border border-border">
        {order.map((c, i) => (
          <li
            key={c.id}
            draggable
            onDragStart={() => setDragId(c.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(c.id);
            }}
            onDragLeave={() => setOverId((o) => (o === c.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(c.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            className={`flex cursor-grab items-center gap-3 bg-white px-3 py-2 transition active:cursor-grabbing ${
              overId === c.id && dragId !== c.id ? "ring-2 ring-inset ring-ink" : ""
            } ${dragId === c.id ? "opacity-50" : ""} ${c.hidden ? "opacity-60" : ""}`}
          >
            <span aria-hidden className="select-none text-ink-soft">
              ⠿
            </span>
            <span className="w-5 text-[12px] text-ink-soft">{i + 1}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.image || placeholderImage(c.name, 145)}
              alt=""
              className="h-8 w-8 shrink-0 rounded object-cover ring-1 ring-border"
              loading="lazy"
            />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
              {c.name}
            </span>
            {c.featured && (
              <span className="rounded-lg bg-[#e3e3e3] px-2 py-0.5 text-[11px] font-medium text-[#4a4a4a]">
                Featured
              </span>
            )}
            {c.hidden && (
              <span className="rounded-lg bg-[#e3e3e3] px-2 py-0.5 text-[11px] font-medium text-[#4a4a4a]">
                Hidden
              </span>
            )}
            <span className="flex shrink-0 gap-1">
              <button
                onClick={() => nudge(c.id, -1)}
                disabled={i === 0}
                aria-label={`Move ${c.name} up`}
                className="rounded px-1.5 text-[12px] text-ink-soft hover:bg-black/5 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => nudge(c.id, 1)}
                disabled={i === order.length - 1}
                aria-label={`Move ${c.name} down`}
                className="rounded px-1.5 text-[12px] text-ink-soft hover:bg-black/5 disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
