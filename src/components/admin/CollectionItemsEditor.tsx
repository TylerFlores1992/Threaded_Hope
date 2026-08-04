"use client";

import { useState, useTransition } from "react";
import { placeholderImage } from "@/lib/placeholder";
import { saveCollectionOrder } from "@/app/admin/(panel)/collections/actions";

export type CollectionItem = {
  id: string;
  name: string;
  image?: string;
};

/**
 * Arrange the products in a collection by dragging, exactly like Shopify's
 * "Collection items" grid. Only used when the collection's sort mode is manual;
 * every other mode is computed at render time and can't be hand-arranged.
 */
export function CollectionItemsEditor({
  collectionSlug,
  items,
  manual,
}: {
  collectionSlug: string;
  items: CollectionItem[];
  manual: boolean;
}) {
  const [order, setOrder] = useState<CollectionItem[]>(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = order.filter((i) => i.id !== dragId);
    const moved = order.find((i) => i.id === dragId);
    if (!moved) return;
    next.splice(
      next.findIndex((i) => i.id === targetId),
      0,
      moved,
    );
    setOrder(next);
    setDirty(true);
    setSaved(false);
    setDragId(null);
    setOverId(null);
  };

  /** Keyboard/touch fallback — dragging isn't reachable for everyone. */
  const nudge = (id: string, dir: -1 | 1) => {
    const i = order.findIndex((x) => x.id === id);
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
      await saveCollectionOrder(
        collectionSlug,
        order.map((i) => i.id),
      );
      setDirty(false);
      setSaved(true);
    });

  if (items.length === 0) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        No products in this collection yet. Add one from a product&apos;s edit
        page.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">
          {manual
            ? "Drag a product to move it. The first one shows first in the shop."
            : "This collection sorts automatically, so the order can't be arranged by hand. Switch its sort to “Manually” above to rearrange."}
        </p>
        {manual && (
          <span className="flex items-center gap-3">
            {saved && !dirty && (
              <span className="text-xs text-sage-deep">Saved ✓</span>
            )}
            <button
              onClick={onSave}
              disabled={!dirty || pending}
              className="rounded-lg bg-sage-deep px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save order"}
            </button>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {order.map((item, i) => (
          <div
            key={item.id}
            draggable={manual}
            onDragStart={() => setDragId(item.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(item.id);
            }}
            onDragLeave={() => setOverId((o) => (o === item.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(item.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            className={`rounded-xl bg-white p-2 ring-1 transition ${
              overId === item.id && dragId !== item.id
                ? "ring-2 ring-sage-deep"
                : "ring-border"
            } ${dragId === item.id ? "opacity-50" : ""} ${
              manual ? "cursor-grab active:cursor-grabbing" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.image || placeholderImage(item.name, 145)}
              alt=""
              className="aspect-square w-full rounded-lg object-cover"
              loading="lazy"
            />
            <p className="mt-2 truncate text-xs text-ink" title={item.name}>
              {i + 1}. {item.name}
            </p>
            {manual && (
              <div className="mt-1 flex justify-center gap-1">
                <button
                  onClick={() => nudge(item.id, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${item.name} earlier`}
                  className="rounded px-1.5 text-xs text-ink-soft hover:bg-sand disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  onClick={() => nudge(item.id, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${item.name} later`}
                  className="rounded px-1.5 text-xs text-ink-soft hover:bg-sand disabled:opacity-30"
                >
                  →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
