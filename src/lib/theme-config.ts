/**
 * Theme (storefront appearance) configuration — colors, typography, layout, and
 * home-page section order/visibility. Plain module so the admin client editor
 * and server pages share it. The saved theme lives in the `Setting` table as one
 * JSON blob; see `lib/theme.ts` for the cached reader.
 *
 * Colors map 1:1 onto the CSS variables in globals.css, so overriding them
 * re-skins the whole site.
 */
export const THEME_KEY = "theme";
export const THEME_TAG = "site-theme";

export type ColorField = { key: string; label: string; cssVar: string; default: string };

export const COLOR_FIELDS: ColorField[] = [
  { key: "cream", label: "Page background", cssVar: "--cream", default: "#faf6ef" },
  { key: "sand", label: "Section background", cssVar: "--sand", default: "#f1e9db" },
  { key: "sandDeep", label: "Section background (deep)", cssVar: "--sand-deep", default: "#e6dac6" },
  { key: "ink", label: "Heading / body text", cssVar: "--ink", default: "#3d352c" },
  { key: "inkSoft", label: "Muted text", cssVar: "--ink-soft", default: "#6b6155" },
  { key: "sageDeep", label: "Primary (buttons, links)", cssVar: "--sage-deep", default: "#5f7a5d" },
  { key: "sage", label: "Primary hover", cssVar: "--sage", default: "#7f9b7c" },
  { key: "gold", label: "Accent", cssVar: "--gold", default: "#c39a45" },
  { key: "taupe", label: "Disabled / subtle", cssVar: "--taupe", default: "#c9bba8" },
  { key: "border", label: "Borders", cssVar: "--border", default: "#e4d9c7" },
];

export type FontOption = { id: string; name: string; stack: string; google?: string };

/** Curated pairings — `google` is the Google Fonts family name to load. */
export const HEADING_FONTS: FontOption[] = [
  { id: "default", name: "Fraunces (current)", stack: "var(--font-heading)" },
  { id: "playfair", name: "Playfair Display", stack: "'Playfair Display'", google: "Playfair+Display:wght@400;600;700" },
  { id: "lora", name: "Lora", stack: "Lora", google: "Lora:wght@400;600;700" },
  { id: "cormorant", name: "Cormorant Garamond", stack: "'Cormorant Garamond'", google: "Cormorant+Garamond:wght@400;600;700" },
  { id: "dmserif", name: "DM Serif Display", stack: "'DM Serif Display'", google: "DM+Serif+Display" },
  { id: "libre", name: "Libre Baskerville", stack: "'Libre Baskerville'", google: "Libre+Baskerville:wght@400;700" },
  { id: "poppins", name: "Poppins (sans)", stack: "Poppins", google: "Poppins:wght@400;600;700" },
];

export const BODY_FONTS: FontOption[] = [
  { id: "default", name: "Nunito Sans (current)", stack: "var(--font-body)" },
  { id: "inter", name: "Inter", stack: "Inter", google: "Inter:wght@400;500;600" },
  { id: "lato", name: "Lato", stack: "Lato", google: "Lato:wght@400;700" },
  { id: "worksans", name: "Work Sans", stack: "'Work Sans'", google: "Work+Sans:wght@400;500;600" },
  { id: "karla", name: "Karla", stack: "Karla", google: "Karla:wght@400;500;700" },
  { id: "source", name: "Source Sans 3", stack: "'Source Sans 3'", google: "Source+Sans+3:wght@400;600" },
];

export const RADIUS_OPTIONS = [
  { id: "sharp", label: "Sharp", scale: 0 },
  { id: "soft", label: "Soft (current)", scale: 1 },
  { id: "round", label: "Extra round", scale: 1.6 },
] as const;

export const WIDTH_OPTIONS = [
  { id: "narrow", label: "Narrow", px: 1024 },
  { id: "standard", label: "Standard (current)", px: 1152 },
  { id: "wide", label: "Wide", px: 1360 },
] as const;

/** Home-page sections, in their default order. */
export const HOME_SECTIONS = [
  { id: "hero", label: "Hero", help: "Headline, buttons, and the image collage." },
  { id: "collections", label: "Shop by collection", help: "Collection tiles + View all." },
  { id: "story", label: "Story blurb", help: "“Stitched with hope” text and button." },
  { id: "instagram", label: "Instagram strip", help: "Latest posts or recent photos." },
  { id: "newsletter", label: "Newsletter signup", help: "Email capture band." },
] as const;

export type SectionId = (typeof HOME_SECTIONS)[number]["id"];


/** Per-section settings (Shopify's "section settings" panel). */
export type SectionSetting =
  | { key: string; label: string; type: "toggle"; default: boolean }
  | { key: string; label: string; type: "select"; default: string; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "number"; default: number; min: number; max: number };

export const SECTION_SETTINGS: Record<string, SectionSetting[]> = {
  hero: [
    { key: "align", label: "Text alignment", type: "select", default: "center", options: [
      { value: "center", label: "Centered" },
      { value: "left", label: "Left" },
    ] },
    { key: "showBadge", label: "Show badge pill", type: "toggle", default: true },
    { key: "padding", label: "Section height", type: "select", default: "normal", options: [
      { value: "compact", label: "Compact" },
      { value: "normal", label: "Normal" },
      { value: "tall", label: "Tall" },
    ] },
  ],
  collections: [
    { key: "tiles", label: "Number of tiles", type: "number", default: 7, min: 3, max: 11 },
    { key: "columns", label: "Columns (desktop)", type: "select", default: "4", options: [
      { value: "3", label: "3" },
      { value: "4", label: "4" },
    ] },
    { key: "showViewAll", label: "Show “View all” tile", type: "toggle", default: true },
  ],
  story: [
    { key: "imagePosition", label: "Image position", type: "select", default: "left", options: [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ] },
    { key: "showImage", label: "Show image", type: "toggle", default: true },
  ],
  instagram: [
    { key: "posts", label: "Number of posts", type: "number", default: 6, min: 3, max: 12 },
  ],
  newsletter: [
    { key: "background", label: "Card background", type: "select", default: "white", options: [
      { value: "white", label: "White" },
      { value: "sand", label: "Sand" },
    ] },
  ],
};

/** Defaults for one section's settings. */
export function defaultSectionSettings(id: string): Record<string, unknown> {
  return Object.fromEntries(
    (SECTION_SETTINGS[id] ?? []).map((s) => [s.key, s.default]),
  );
}

/** Ready-made color schemes (Shopify's "color schemes"). */
export const COLOR_PRESETS: { id: string; name: string; colors: Record<string, string> }[] = [
  {
    id: "original",
    name: "Threaded Hope (original)",
    colors: Object.fromEntries(COLOR_FIELDS.map((c) => [c.key, c.default])),
  },
  {
    id: "linen",
    name: "Linen & Clay",
    colors: { cream: "#faf7f2", sand: "#efe7dd", sandDeep: "#e2d5c6", ink: "#3a332e", inkSoft: "#6d635a", sageDeep: "#a2705a", sage: "#bf8b73", gold: "#c9a227", taupe: "#c8b8a6", border: "#e5dacd" },
  },
  {
    id: "sage-noir",
    name: "Sage Noir",
    colors: { cream: "#f6f6f3", sand: "#e8ebe4", sandDeep: "#d7ddd0", ink: "#23261f", inkSoft: "#5a5f52", sageDeep: "#46614a", sage: "#688a6b", gold: "#b08d3f", taupe: "#b6bdae", border: "#dbe0d3" },
  },
  {
    id: "dusty-rose",
    name: "Dusty Rose",
    colors: { cream: "#fdf7f5", sand: "#f6e7e3", sandDeep: "#ecd4cd", ink: "#3d2f2c", inkSoft: "#6f5b56", sageDeep: "#a45c62", sage: "#c07d83", gold: "#c8a15c", taupe: "#cdb6b1", border: "#eddcd7" },
  },
  {
    id: "coastal",
    name: "Coastal Blue",
    colors: { cream: "#f7fafb", sand: "#e6eef2", sandDeep: "#d2e0e7", ink: "#24333b", inkSoft: "#556a75", sageDeep: "#3f6b83", sage: "#5d8ba3", gold: "#c2954a", taupe: "#adc0c9", border: "#d8e4ea" },
  },
];

export type Theme = {
  colors: Record<string, string>;
  headingFont: string;
  bodyFont: string;
  headingScale: number; // multiplier on heading sizes
  radius: string;
  width: string;
  /** Ordered section ids; omitted ids are appended, hidden ones live in `hidden`. */
  sectionOrder: string[];
  hiddenSections: string[];
  /** Per-section settings, keyed by section id. */
  sections: Record<string, Record<string, unknown>>;
};

export function defaultTheme(): Theme {
  return {
    colors: Object.fromEntries(COLOR_FIELDS.map((c) => [c.key, c.default])),
    headingFont: "default",
    bodyFont: "default",
    headingScale: 1,
    radius: "soft",
    width: "standard",
    sectionOrder: HOME_SECTIONS.map((s) => s.id),
    hiddenSections: [],
    sections: Object.fromEntries(
      HOME_SECTIONS.map((s) => [s.id, defaultSectionSettings(s.id)]),
    ),
  };
}

/** Merge a stored partial theme over the defaults (forward-compatible). */
export function mergeTheme(raw: unknown): Theme {
  const base = defaultTheme();
  if (!raw || typeof raw !== "object") return base;
  const t = raw as Partial<Theme>;
  return {
    colors: { ...base.colors, ...(t.colors ?? {}) },
    headingFont: t.headingFont ?? base.headingFont,
    bodyFont: t.bodyFont ?? base.bodyFont,
    headingScale: Number(t.headingScale) || base.headingScale,
    radius: t.radius ?? base.radius,
    width: t.width ?? base.width,
    sectionOrder: Array.isArray(t.sectionOrder) && t.sectionOrder.length
      ? Array.from(new Set([...t.sectionOrder, ...base.sectionOrder]))
      : base.sectionOrder,
    hiddenSections: Array.isArray(t.hiddenSections) ? t.hiddenSections : [],
    sections: Object.fromEntries(
      HOME_SECTIONS.map((s) => [
        s.id,
        { ...defaultSectionSettings(s.id), ...((t.sections ?? {})[s.id] ?? {}) },
      ]),
    ),
  };
}

/** The CSS custom properties a theme produces (shared by SSR and live preview). */
export function themeCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const f of COLOR_FIELDS) {
    const v = theme.colors[f.key];
    if (v) vars[f.cssVar] = v;
  }
  const heading = HEADING_FONTS.find((f) => f.id === theme.headingFont);
  const body = BODY_FONTS.find((f) => f.id === theme.bodyFont);
  if (heading && heading.id !== "default") {
    vars["--font-serif"] = `${heading.stack}, Georgia, serif`;
  }
  if (body && body.id !== "default") {
    vars["--font-sans"] = `${body.stack}, system-ui, sans-serif`;
  }
  const radius = RADIUS_OPTIONS.find((r) => r.id === theme.radius);
  if (radius) vars["--radius-scale"] = String(radius.scale);
  const width = WIDTH_OPTIONS.find((w) => w.id === theme.width);
  if (width) vars["--container-max"] = `${width.px}px`;
  vars["--heading-scale"] = String(theme.headingScale);
  return vars;
}

/** Google Fonts stylesheet URL for the chosen fonts (null when both default). */
export function googleFontsHref(theme: Theme): string | null {
  const families = [
    HEADING_FONTS.find((f) => f.id === theme.headingFont)?.google,
    BODY_FONTS.find((f) => f.id === theme.bodyFont)?.google,
  ].filter(Boolean) as string[];
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families
    .map((f) => `family=${f}`)
    .join("&")}&display=swap`;
}
