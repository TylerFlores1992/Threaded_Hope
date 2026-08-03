"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  COLOR_FIELDS,
  HEADING_FONTS,
  BODY_FONTS,
  RADIUS_OPTIONS,
  WIDTH_OPTIONS,
  HOME_SECTIONS,
  themeCssVars,
  googleFontsHref,
  defaultTheme,
  type Theme,
} from "@/lib/theme-config";
import { saveTheme, resetTheme } from "@/app/admin/(panel)/customize/actions";

type Tab = "sections" | "theme";
type Device = "desktop" | "mobile";

const sectionLabel = (id: string) =>
  HOME_SECTIONS.find((s) => s.id === id)?.label ?? id;
const sectionHelp = (id: string) =>
  HOME_SECTIONS.find((s) => s.id === id)?.help ?? "";

/**
 * Storefront appearance editor, laid out like a theme customizer: a settings
 * panel on the left (Sections / Theme settings) and a live preview on the right.
 * Draft changes stream to the preview iframe over postMessage, so edits show
 * instantly; Save persists them for real visitors.
 */
export function ThemeEditor({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [tab, setTab] = useState<Tab>("sections");
  const [device, setDevice] = useState<Device>("desktop");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Push the draft into the preview whenever it changes (and once on load).
  const push = (t: Theme) => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "th-theme-preview",
        vars: themeCssVars(t),
        fonts: googleFontsHref(t),
        hidden: t.hiddenSections,
      },
      window.location.origin,
    );
  };

  useEffect(() => {
    const onReady = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if ((e.data as { type?: string })?.type === "th-preview-ready") push(theme);
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [theme]);

  useEffect(() => {
    push(theme);
  }, [theme]);

  const set = (patch: Partial<Theme>) => {
    setTheme((t) => ({ ...t, ...patch }));
    setDirty(true);
    setSaved(false);
  };

  const setColor = (key: string, value: string) =>
    set({ colors: { ...theme.colors, [key]: value } });

  const move = (id: string, dir: -1 | 1) => {
    const order = [...theme.sectionOrder];
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    set({ sectionOrder: order });
  };

  const toggle = (id: string) =>
    set({
      hiddenSections: theme.hiddenSections.includes(id)
        ? theme.hiddenSections.filter((s) => s !== id)
        : [...theme.hiddenSections, id],
    });

  const onSave = () =>
    start(async () => {
      await saveTheme(theme);
      setDirty(false);
      setSaved(true);
    });

  const onReset = () =>
    start(async () => {
      await resetTheme();
      const d = defaultTheme();
      setTheme(d);
      setDirty(false);
      setSaved(true);
    });

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[36rem] flex-col overflow-hidden rounded-2xl ring-1 ring-border">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-white/70 px-4 py-2">
        <div className="flex gap-1 rounded-lg bg-sand p-1 text-xs">
          {(["desktop", "mobile"] as Device[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`rounded px-2 py-1 capitalize ${
                device === d ? "bg-white font-medium text-ink" : "text-ink-soft"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {saved && !dirty && (
            <span className="text-xs text-sage-deep">Saved ✓</span>
          )}
          {dirty && <span className="text-xs text-ink-soft">Unsaved changes</span>}
          <button
            onClick={onReset}
            disabled={pending}
            className="rounded-lg px-3 py-1.5 text-xs text-ink-soft hover:bg-sand disabled:opacity-50"
          >
            Reset
          </button>
          <button
            onClick={onSave}
            disabled={pending || !dirty}
            className="rounded-lg bg-sage-deep px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Settings panel */}
        <aside className="flex w-full flex-col border-border bg-white/60 md:w-80 md:border-r">
          <div className="flex border-b border-border text-sm">
            {(["sections", "theme"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-2 ${
                  tab === t
                    ? "border-b-2 border-sage-deep font-medium text-ink"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {t === "sections" ? "Sections" : "Theme settings"}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "sections" ? (
              <div>
                <p className="mb-3 text-xs text-ink-soft">
                  Home page order. Use ↑ ↓ to rearrange, or hide a section.
                </p>
                <ul className="space-y-2">
                  {theme.sectionOrder.map((id, i) => {
                    const hidden = theme.hiddenSections.includes(id);
                    return (
                      <li
                        key={id}
                        className="rounded-lg bg-white p-3 text-sm ring-1 ring-border"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={hidden ? "text-ink-soft line-through" : "text-ink"}>
                            {sectionLabel(id)}
                          </span>
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => move(id, -1)}
                              disabled={i === 0}
                              aria-label="Move up"
                              className="rounded px-1.5 text-ink-soft hover:bg-sand disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => move(id, 1)}
                              disabled={i === theme.sectionOrder.length - 1}
                              aria-label="Move down"
                              className="rounded px-1.5 text-ink-soft hover:bg-sand disabled:opacity-30"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => toggle(id)}
                              aria-label={hidden ? "Show section" : "Hide section"}
                              className="rounded px-1.5 text-ink-soft hover:bg-sand"
                            >
                              {hidden ? "🙈" : "👁"}
                            </button>
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-ink-soft">
                          {sectionHelp(id)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-[11px] text-ink-soft">
                  Header and footer are always shown. Edit their wording under{" "}
                  <strong>Site text</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Colors
                  </h3>
                  <div className="space-y-2">
                    {COLOR_FIELDS.map((c) => (
                      <label
                        key={c.key}
                        className="flex items-center justify-between gap-2 text-sm text-ink"
                      >
                        <span className="text-xs text-ink-soft">{c.label}</span>
                        <span className="flex items-center gap-2">
                          <input
                            type="color"
                            value={theme.colors[c.key] ?? c.default}
                            onChange={(e) => setColor(c.key, e.target.value)}
                            className="h-7 w-10 cursor-pointer rounded border border-border bg-white"
                          />
                          <input
                            type="text"
                            value={theme.colors[c.key] ?? c.default}
                            onChange={(e) => setColor(c.key, e.target.value)}
                            className="w-20 rounded border border-border px-1.5 py-1 text-[11px]"
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Typography
                  </h3>
                  <label className="block text-xs text-ink-soft">
                    Heading font
                    <select
                      value={theme.headingFont}
                      onChange={(e) => set({ headingFont: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
                    >
                      {HEADING_FONTS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block text-xs text-ink-soft">
                    Body font
                    <select
                      value={theme.bodyFont}
                      onChange={(e) => set({ bodyFont: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
                    >
                      {BODY_FONTS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block text-xs text-ink-soft">
                    Heading size ({Math.round(theme.headingScale * 100)}%)
                    <input
                      type="range"
                      min="0.85"
                      max="1.3"
                      step="0.05"
                      value={theme.headingScale}
                      onChange={(e) =>
                        set({ headingScale: Number(e.target.value) })
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Layout
                  </h3>
                  <label className="block text-xs text-ink-soft">
                    Corner style
                    <select
                      value={theme.radius}
                      onChange={(e) => set({ radius: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
                    >
                      {RADIUS_OPTIONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block text-xs text-ink-soft">
                    Page width
                    <select
                      value={theme.width}
                      onChange={(e) => set({ width: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
                    >
                      {WIDTH_OPTIONS.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Live preview */}
        <div className="min-h-0 flex-1 overflow-auto bg-sand p-3">
          <div
            className={`mx-auto h-full bg-white shadow-sm ring-1 ring-border ${
              device === "mobile" ? "max-w-[420px]" : "w-full"
            }`}
          >
            <iframe
              ref={iframeRef}
              src="/"
              title="Storefront preview"
              className="h-full min-h-[32rem] w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
