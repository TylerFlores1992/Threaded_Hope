"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SearchOption = {
  value: string;
  /** What the shop owner types against and sees once chosen. */
  label: string;
  /** Second line in the list — a price, an email, an order count. */
  hint?: string;
};

/**
 * Type-to-search replacement for a `<select>` with too many options to scroll.
 *
 * The whole list is already on the page, so filtering happens here rather than
 * over the network — there's no request to wait for between keystrokes.
 *
 * The chosen value is mirrored into a hidden input, so a form containing this
 * posts exactly what a `<select name=…>` would have.
 */
export function SearchSelect({
  name,
  options,
  value,
  onChange,
  placeholder = "Search…",
  required,
  emptyText = "No matches.",
}: {
  name?: string;
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  emptyText?: string;
}) {
  /**
   * null means "not typing" — the field shows whatever is chosen. It only
   * holds a string while a search is actually being typed, so returning to the
   * field can't blank out a choice that has already been made.
   */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  const q = (query ?? "").trim().toLowerCase();
  const matches = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.hint ?? "").toLowerCase().includes(q),
      )
    : options;
  // A long unfiltered list is a scroll trap; searching narrows it.
  const shown = matches.slice(0, 50);

  /**
   * Clicking away closes the list without choosing. Abandoned typing is thrown
   * away too, so the field goes back to showing the current selection rather
   * than half a search term.
   */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setQuery(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /**
   * Clicking an option hands focus back to the input, which would re-open the
   * list on the very choice that just closed it — leaving the full list hanging
   * over the fields below. This suppresses that one focus event without
   * blurring, so the keyboard flow (type, arrow, Enter) keeps its place.
   */
  const justChose = useRef(false);

  const choose = (v: string) => {
    onChange(v);
    setQuery(null);
    setOpen(false);
    justChose.current = true;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return Math.max(0, Math.min(shown.length - 1, next));
      });
    } else if (e.key === "Enter" && open && shown[active]) {
      e.preventDefault();
      choose(shown[active].value);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(null);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      {name && (
        <input type="hidden" name={name} value={value} required={required} />
      )}
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={query ?? selected?.label ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        // Selecting the text means typing replaces the current choice, without
        // having to clear the field first — and without wiping it on a stray
        // click, the way blanking the value on focus would.
        onFocus={(e) => {
          if (justChose.current) {
            justChose.current = false;
            return;
          }
          e.target.select();
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink"
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-white py-1 shadow-lg"
        >
          {shown.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-soft">{emptyText}</li>
          )}
          {shown.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === active ? "bg-sand" : ""
                }`}
              >
                <span className="block text-ink">{o.label}</span>
                {o.hint && (
                  <span className="block text-xs text-ink-soft">{o.hint}</span>
                )}
              </button>
            </li>
          ))}
          {matches.length > shown.length && (
            <li className="px-3 py-1.5 text-xs text-ink-soft">
              {matches.length - shown.length} more — keep typing to narrow.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
