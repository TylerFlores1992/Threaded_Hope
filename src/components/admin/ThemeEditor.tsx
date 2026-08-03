"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  COLOR_FIELDS,
  HEADING_FONTS,
  BODY_FONTS,
  RADIUS_OPTIONS,
  WIDTH_OPTIONS,
  HOME_SECTIONS,
  SECTION_SETTINGS,
  SECTION_TEXT_FIELDS,
  ADDABLE_SECTIONS,
  COLOR_PRESETS,
  newSectionInstance,
  type SectionInstance,
  themeCssVars,
  googleFontsHref,
  defaultTheme,
  type Theme,
} from "@/lib/theme-config";
import {
  saveTheme,
  resetTheme,
  restoreVersion,
  type ThemeVersion,
} from "@/app/admin/(panel)/customize/actions";
import { SITE_TEXT_FIELDS } from "@/lib/site-text-fields";

type Tab = "sections" | "theme" | "history";
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
export function ThemeEditor({
  initial,
  initialText,
  versions,
}: {
  initial: Theme;
  initialText: Record<string, string>;
  versions: ThemeVersion[];
}) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [text, setText] = useState<Record<string, string>>(initialText);
  const [tab, setTab] = useState<Tab>("sections");
  const [device, setDevice] = useState<Device>("desktop");
  // On small screens the panel and preview can't sit side by side, so switch.
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Push the draft into the preview whenever it changes (and once on load).
  const push = (t: Theme) => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "th-theme-preview",
        vars: themeCssVars(t),
        fonts: googleFontsHref(t),
        hidden: t.layout.filter((i) => i.hidden).map((i) => i.key),
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

  const setLayout = (layout: SectionInstance[]) => set({ layout });

  /** Drag-and-drop reorder: drop `dragId` onto `targetKey`'s position. */
  const dropOn = (targetKey: string) => {
    if (!dragId || dragId === targetKey) return;
    const layout = theme.layout.filter((i) => i.key !== dragId);
    const moved = theme.layout.find((i) => i.key === dragId);
    if (!moved) return;
    layout.splice(layout.findIndex((i) => i.key === targetKey), 0, moved);
    setLayout(layout);
    setDragId(null);
    setOverId(null);
  };

  const move = (key: string, dir: -1 | 1) => {
    const layout = [...theme.layout];
    const i = layout.findIndex((s) => s.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= layout.length) return;
    [layout[i], layout[j]] = [layout[j], layout[i]];
    setLayout(layout);
  };

  const toggle = (key: string) =>
    setLayout(
      theme.layout.map((i) =>
        i.key === key ? { ...i, hidden: !i.hidden } : i,
      ),
    );

  const removeSection = (key: string) =>
    setLayout(theme.layout.filter((i) => i.key !== key));

  /** Unique instance key without relying on impure clocks during render. */
  const nextKey = (type: string) => {
    const used = new Set(theme.layout.map((i) => i.key));
    let n = 1;
    while (used.has(`${type}-${n}`)) n++;
    return `${type}-${n}`;
  };

  const addSection = (type: string) =>
    setLayout([
      ...theme.layout,
      { ...newSectionInstance(type, 0), key: nextKey(type) },
    ]);

  const duplicateSection = (key: string) => {
    const src = theme.layout.find((i) => i.key === key);
    if (!src) return;
    const copy: SectionInstance = {
      ...src,
      key: nextKey(src.type),
      settings: { ...src.settings },
    };
    const layout = [...theme.layout];
    layout.splice(layout.findIndex((i) => i.key === key) + 1, 0, copy);
    setLayout(layout);
  };

  const setSectionSetting = (key: string, sKey: string, value: unknown) =>
    setLayout(
      theme.layout.map((i) =>
        i.key === key ? { ...i, settings: { ...i.settings, [sKey]: value } } : i,
      ),
    );

  const setText_ = (k: string, v: string) => {
    setText((t) => ({ ...t, [k]: v }));
    setDirty(true);
    setSaved(false);
  };

  const applyPreset = (colors: Record<string, string>) =>
    set({ colors: { ...theme.colors, ...colors } });

  /** Scroll the preview to a section and flash an outline (like Shopify). */
  const focusInPreview = (key: string) =>
    iframeRef.current?.contentWindow?.postMessage(
      { type: "th-focus-section", id: key },
      window.location.origin,
    );

  const discard = () => {
    setTheme(initial);
    setText(initialText);
    setDirty(false);
    setSaved(false);
  };

  const reloadPreview = () => {
    const f = iframeRef.current;
    if (f) f.src = f.src;
  };

  const onSave = () =>
    start(async () => {
      await saveTheme(theme, text, new Date().toISOString());
      setDirty(false);
      setSaved(true);
      // Colors/fonts/visibility preview live, but section settings are
      // server-rendered — reload the preview so they show too.
      reloadPreview();
    });

  const onReset = () =>
    start(async () => {
      await resetTheme(new Date().toISOString());
      const d = defaultTheme();
      setTheme(d);
      setDirty(false);
      setSaved(true);
      reloadPreview();
    });

  return (
    <div className="flex h-[calc(100svh-7rem)] min-h-[32rem] flex-col overflow-hidden rounded-2xl ring-1 ring-border md:h-[calc(100vh-8rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-white/70 px-4 py-2">
        {/* Mobile: swap between the settings panel and the preview. */}
        <div className="flex gap-1 rounded-lg bg-sand p-1 text-xs md:hidden">
          {(["edit", "preview"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className={`rounded px-3 py-1 capitalize ${
                mobileView === v ? "bg-white font-medium text-ink" : "text-ink-soft"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {/* Desktop: preview width toggle. */}
        <div className="hidden gap-1 rounded-lg bg-sand p-1 text-xs md:flex">
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
          {dirty && (
            <button
              onClick={discard}
              className="rounded-lg px-3 py-1.5 text-xs text-ink-soft hover:bg-sand"
            >
              Discard
            </button>
          )}
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
        <aside
          className={`w-full flex-col border-border bg-white/60 md:flex md:w-80 md:border-r ${
            mobileView === "preview" ? "hidden" : "flex"
          }`}
        >
          <div className="flex border-b border-border text-sm">
            {(["sections", "theme", "history"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-2 ${
                  tab === t
                    ? "border-b-2 border-sage-deep font-medium text-ink"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {t === "sections"
                  ? "Sections"
                  : t === "theme"
                    ? "Theme"
                    : "History"}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "history" ? (
              <div>
                <p className="mb-3 text-xs text-ink-soft">
                  The last {versions.length} saved versions. Restoring replaces
                  the current design (the current one is snapshotted first).
                </p>
                {versions.length === 0 ? (
                  <p className="text-xs text-ink-soft">
                    No previous versions yet — they appear after your next save.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {versions.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 text-xs ring-1 ring-border"
                      >
                        <span className="text-ink-soft">
                          {new Date(v.savedAt).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        <button
                          onClick={() =>
                            start(async () => {
                              await restoreVersion(v.id, new Date().toISOString());
                              setTheme(v.theme);
                              setDirty(false);
                              setSaved(true);
                              reloadPreview();
                            })
                          }
                          disabled={pending}
                          className="rounded px-2 py-1 font-medium text-sage-deep hover:bg-sand disabled:opacity-50"
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : tab === "sections" ? (
              <div>
                <p className="mb-3 text-xs text-ink-soft">
                  Drag to reorder, tap a section to open its settings.
                </p>
                <ul className="space-y-2">
                  {theme.layout.map((inst, i) => {
                    const open = openId === inst.key;
                    const settings = SECTION_SETTINGS[inst.type] ?? [];
                    // Global copy shows on the first instance of a type only.
                    const firstOfType =
                      theme.layout.findIndex((x) => x.type === inst.type) === i;
                    const textKeys = firstOfType
                      ? (SECTION_TEXT_FIELDS[inst.type] ?? [])
                      : [];
                    return (
                      <li
                        key={inst.key}
                        draggable
                        onDragStart={() => setDragId(inst.key)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setOverId(inst.key);
                        }}
                        onDragLeave={() =>
                          setOverId((o) => (o === inst.key ? null : o))
                        }
                        onDrop={(e) => {
                          e.preventDefault();
                          dropOn(inst.key);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverId(null);
                        }}
                        className={`rounded-lg bg-white text-sm ring-1 transition ${
                          overId === inst.key && dragId !== inst.key
                            ? "ring-2 ring-sage-deep"
                            : "ring-border"
                        } ${dragId === inst.key ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center gap-2 p-3">
                          <span
                            aria-hidden
                            title="Drag to reorder"
                            className="cursor-grab select-none text-ink-soft active:cursor-grabbing"
                          >
                            ⠿
                          </span>
                          <button
                            onClick={() => {
                              setOpenId(open ? null : inst.key);
                              focusInPreview(inst.key);
                            }}
                            className={`flex-1 text-left ${inst.hidden ? "text-ink-soft line-through" : "text-ink"}`}
                          >
                            {sectionLabel(inst.type)}
                          </button>
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => move(inst.key, -1)}
                              disabled={i === 0}
                              aria-label="Move up"
                              className="rounded px-1.5 text-ink-soft hover:bg-sand disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => move(inst.key, 1)}
                              disabled={i === theme.layout.length - 1}
                              aria-label="Move down"
                              className="rounded px-1.5 text-ink-soft hover:bg-sand disabled:opacity-30"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => toggle(inst.key)}
                              aria-label={inst.hidden ? "Show section" : "Hide section"}
                              className="rounded px-1.5 text-ink-soft hover:bg-sand"
                            >
                              {inst.hidden ? "🙈" : "👁"}
                            </button>
                          </span>
                        </div>

                        {open && (
                          <div className="space-y-3 border-t border-border p-3">
                            <p className="text-[11px] text-ink-soft">
                              {sectionHelp(inst.type)}
                            </p>

                            {textKeys.map((k) => {
                              const f = SITE_TEXT_FIELDS.find((x) => x.key === k);
                              if (!f) return null;
                              return (
                                <label key={k} className="block text-xs text-ink-soft">
                                  {f.label}
                                  {f.multiline ? (
                                    <textarea
                                      rows={3}
                                      value={text[k] ?? f.default}
                                      onChange={(e) => setText_(k, e.target.value)}
                                      className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={text[k] ?? f.default}
                                      onChange={(e) => setText_(k, e.target.value)}
                                      className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
                                    />
                                  )}
                                </label>
                              );
                            })}

                            {settings.map((st) => {
                              const val = inst.settings[st.key];
                              if (st.type === "toggle") {
                                return (
                                  <label key={st.key} className="flex items-center gap-2 text-xs text-ink">
                                    <input
                                      type="checkbox"
                                      checked={typeof val === "boolean" ? val : st.default}
                                      onChange={(e) =>
                                        setSectionSetting(inst.key, st.key, e.target.checked)
                                      }
                                    />
                                    {st.label}
                                  </label>
                                );
                              }
                              if (st.type === "select") {
                                return (
                                  <label key={st.key} className="block text-xs text-ink-soft">
                                    {st.label}
                                    <select
                                      value={typeof val === "string" ? val : st.default}
                                      onChange={(e) =>
                                        setSectionSetting(inst.key, st.key, e.target.value)
                                      }
                                      className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
                                    >
                                      {st.options.map((o) => (
                                        <option key={o.value} value={o.value}>
                                          {o.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                );
                              }
                              if (st.type === "text") {
                                return (
                                  <label key={st.key} className="block text-xs text-ink-soft">
                                    {st.label}
                                    <input
                                      type="text"
                                      value={typeof val === "string" ? val : st.default}
                                      onChange={(e) =>
                                        setSectionSetting(inst.key, st.key, e.target.value)
                                      }
                                      className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-ink"
                                    />
                                  </label>
                                );
                              }
                              return (
                                <label key={st.key} className="block text-xs text-ink-soft">
                                  {st.label} ({Number(val ?? st.default)})
                                  <input
                                    type="range"
                                    min={st.min}
                                    max={st.max}
                                    step={1}
                                    value={Number(val ?? st.default)}
                                    onChange={(e) =>
                                      setSectionSetting(inst.key, st.key, Number(e.target.value))
                                    }
                                    className="mt-1 w-full"
                                  />
                                </label>
                              );
                            })}

                            <div className="flex gap-3 pt-1 text-xs">
                              {ADDABLE_SECTIONS.includes(inst.type) && (
                                <button
                                  onClick={() => duplicateSection(inst.key)}
                                  className="text-sage-deep hover:underline"
                                >
                                  Duplicate
                                </button>
                              )}
                              <button
                                onClick={() => removeSection(inst.key)}
                                className="text-red-700 hover:underline"
                              >
                                Remove section
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 rounded-lg border border-dashed border-border p-3">
                  <p className="mb-2 text-xs font-medium text-ink">Add section</p>
                  <div className="flex flex-wrap gap-2">
                    {HOME_SECTIONS.filter((sec) =>
                      ADDABLE_SECTIONS.includes(sec.id),
                    ).map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => addSection(sec.id)}
                        className="rounded-lg bg-sand px-2 py-1 text-xs text-ink hover:bg-sage-deep hover:text-white"
                      >
                        + {sec.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Color scheme
                  </h3>
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    {COLOR_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p.colors)}
                        className="rounded-lg border border-border bg-white p-2 text-left text-[11px] text-ink hover:border-sage-deep"
                      >
                        <span className="mb-1 flex gap-1">
                          {["cream", "sand", "sageDeep", "ink"].map((k) => (
                            <span
                              key={k}
                              className="h-4 w-4 rounded-full ring-1 ring-border"
                              style={{ background: p.colors[k] }}
                            />
                          ))}
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
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
        <div
          className={`min-h-0 flex-1 overflow-auto bg-sand p-3 md:block ${
            mobileView === "edit" ? "hidden" : "block"
          }`}
        >
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
