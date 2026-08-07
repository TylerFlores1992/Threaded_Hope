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
  { key: "sageDeep", label: "Primary (buttons, links)", cssVar: "--sage-deep", default: "#4f6a4d" },
  { key: "sage", label: "Primary hover", cssVar: "--sage", default: "#3f5640" },
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

/**
 * Content blocks you can add to the page. Unlike the five built-ins above,
 * these carry their OWN copy and images in the instance's settings — so two
 * text blocks say two different things. That's what makes "Add section" useful.
 */
export const CONTENT_SECTIONS = [
  { id: "richtext", label: "Text block", help: "A heading, paragraph, and optional button." },
  { id: "imageText", label: "Image with text", help: "A photo beside copy and a button." },
  { id: "banner", label: "Image banner", help: "A wide photo with a headline over it." },
  { id: "products", label: "Featured products", help: "Products from a collection you pick." },
  { id: "quote", label: "Quote", help: "A customer quote or short testimonial." },
  { id: "iconColumns", label: "Icon columns", help: "Up to four short selling points." },
  { id: "faq", label: "FAQ", help: "Up to six expandable questions." },
  { id: "spacer", label: "Spacer / divider", help: "Blank space, with an optional line." },
] as const;

/** Every placeable section type — the built-ins plus the content blocks. */
export const SECTION_LIBRARY: { id: string; label: string; help: string }[] = [
  ...HOME_SECTIONS,
  ...CONTENT_SECTIONS,
];

/** Types that can be added (Shopify's "Add section"). */
export const ADDABLE_SECTIONS: string[] = [
  "collections",
  "story",
  "instagram",
  "newsletter",
  ...CONTENT_SECTIONS.map((s) => s.id),
];

/**
 * Site-text keys surfaced inside a section's settings panel, so copy is edited
 * where the section lives (like Shopify). These are global strings, so they're
 * shown on the first instance of a type only.
 */
export const SECTION_TEXT_FIELDS: Record<string, string[]> = {
  hero: [
    "home_hero_badge",
    "home_hero_heading",
    "home_hero_subtitle",
    "home_hero_cta_primary",
    "home_hero_cta_secondary",
  ],
  collections: ["home_collections_heading"],
  story: [
    "home_story_heading",
    "home_story_body_1",
    "home_story_body_2",
    "home_story_cta",
  ],
  newsletter: ["newsletter_heading", "newsletter_pitch"],
};


/** Per-section settings (Shopify's "section settings" panel). */
export type SectionSetting =
  | { key: string; label: string; type: "text"; default: string; placeholder?: string }
  | { key: string; label: string; type: "textarea"; default: string; placeholder?: string }
  | { key: string; label: string; type: "image"; default: string }
  | { key: string; label: string; type: "toggle"; default: boolean }
  | { key: string; label: string; type: "select"; default: string; options: { value: string; label: string }[]; dynamic?: "collections" }
  | { key: string; label: string; type: "number"; default: number; min: number; max: number };

/**
 * Background applies to every section, so the page can alternate bands without
 * touching the global palette. "default" keeps whatever the section ships with.
 */
const background = (dflt = "default"): SectionSetting => ({
  key: "background",
  label: "Background",
  type: "select",
  default: dflt,
  options: [
    { value: "default", label: "Default" },
    { value: "cream", label: "Page background" },
    { value: "sand", label: "Sand" },
    { value: "white", label: "White" },
  ],
});

const padding: SectionSetting = {
  key: "padding",
  label: "Section height",
  type: "select",
  default: "normal",
  options: [
    { value: "compact", label: "Compact" },
    { value: "normal", label: "Normal" },
    { value: "tall", label: "Tall" },
  ],
};

const align: SectionSetting = {
  key: "align",
  label: "Text alignment",
  type: "select",
  default: "center",
  options: [
    { value: "center", label: "Centered" },
    { value: "left", label: "Left" },
  ],
};

/** Button label + link, used by several content blocks. */
const buttonFields = (label = ""): SectionSetting[] => [
  { key: "buttonLabel", label: "Button label (blank = no button)", type: "text", default: label },
  { key: "buttonHref", label: "Button link", type: "text", default: "/shop", placeholder: "/shop" },
];

export const SECTION_SETTINGS: Record<string, SectionSetting[]> = {
  hero: [
    align,
    { key: "showBadge", label: "Show badge pill", type: "toggle", default: true },
    padding,
    background(),
  ],
  collections: [
    { key: "heading", label: "Heading override (blank = use Site text)", type: "text", default: "" },
    { key: "tiles", label: "Number of tiles", type: "number", default: 7, min: 3, max: 11 },
    { key: "columns", label: "Columns (desktop)", type: "select", default: "4", options: [
      { value: "3", label: "3" },
      { value: "4", label: "4" },
    ] },
    { key: "showViewAll", label: "Show “View all” tile", type: "toggle", default: true },
    background(),
  ],
  story: [
    { key: "imagePosition", label: "Image position", type: "select", default: "left", options: [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ] },
    { key: "showImage", label: "Show image", type: "toggle", default: true },
    background("sand"),
  ],
  instagram: [
    { key: "posts", label: "Number of posts", type: "number", default: 6, min: 3, max: 12 },
    background(),
  ],
  newsletter: [
    { key: "cardBackground", label: "Card background", type: "select", default: "white", options: [
      { value: "white", label: "White" },
      { value: "sand", label: "Sand" },
    ] },
    background(),
  ],

  // ---- Content blocks: everything they show lives in these settings ----
  richtext: [
    { key: "heading", label: "Heading", type: "text", default: "A heading" },
    { key: "body", label: "Text", type: "textarea", default: "Tell your customers something here." },
    ...buttonFields(),
    align,
    padding,
    background(),
  ],
  imageText: [
    { key: "image", label: "Image", type: "image", default: "" },
    { key: "heading", label: "Heading", type: "text", default: "A heading" },
    { key: "body", label: "Text", type: "textarea", default: "Pair a photo with a few words about it." },
    ...buttonFields(),
    { key: "imagePosition", label: "Image position", type: "select", default: "left", options: [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ] },
    background(),
  ],
  banner: [
    { key: "image", label: "Image", type: "image", default: "" },
    { key: "heading", label: "Heading", type: "text", default: "A headline" },
    { key: "subheading", label: "Subheading", type: "text", default: "" },
    ...buttonFields("Shop now"),
    { key: "height", label: "Banner height", type: "select", default: "medium", options: [
      { value: "short", label: "Short" },
      { value: "medium", label: "Medium" },
      { value: "tall", label: "Tall" },
    ] },
    { key: "overlay", label: "Darken image (for readable text)", type: "toggle", default: true },
  ],
  products: [
    { key: "heading", label: "Heading", type: "text", default: "Featured" },
    { key: "collection", label: "Collection", type: "select", default: "", dynamic: "collections", options: [
      { value: "", label: "All products" },
    ] },
    { key: "count", label: "How many products", type: "number", default: 4, min: 2, max: 12 },
    { key: "columns", label: "Columns (desktop)", type: "select", default: "4", options: [
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
    ] },
    ...buttonFields("Shop all"),
    background(),
  ],
  quote: [
    { key: "quote", label: "Quote", type: "textarea", default: "Add a customer's kind words here." },
    { key: "attribution", label: "Who said it", type: "text", default: "" },
    padding,
    background("sand"),
  ],
  iconColumns: [
    { key: "heading", label: "Heading (blank = none)", type: "text", default: "" },
    { key: "icon1", label: "1 · Icon (emoji)", type: "text", default: "🧵" },
    { key: "title1", label: "1 · Title", type: "text", default: "Handmade" },
    { key: "body1", label: "1 · Text", type: "text", default: "Every piece sewn by hand." },
    { key: "icon2", label: "2 · Icon (emoji)", type: "text", default: "📦" },
    { key: "title2", label: "2 · Title", type: "text", default: "Ships quickly" },
    { key: "body2", label: "2 · Text", type: "text", default: "Most orders go out in two days." },
    { key: "icon3", label: "3 · Icon (emoji)", type: "text", default: "🎁" },
    { key: "title3", label: "3 · Title", type: "text", default: "Gift ready" },
    { key: "body3", label: "3 · Text", type: "text", default: "Add a free gift note at checkout." },
    { key: "icon4", label: "4 · Icon (emoji)", type: "text", default: "" },
    { key: "title4", label: "4 · Title (blank = hide)", type: "text", default: "" },
    { key: "body4", label: "4 · Text", type: "text", default: "" },
    background(),
  ],
  faq: [
    { key: "heading", label: "Heading", type: "text", default: "Common questions" },
    ...Array.from({ length: 6 }, (_, n): SectionSetting[] => [
      { key: `q${n + 1}`, label: `${n + 1} · Question (blank = hide)`, type: "text", default: "" },
      { key: `a${n + 1}`, label: `${n + 1} · Answer`, type: "textarea", default: "" },
    ]).flat(),
    background(),
  ],
  spacer: [
    { key: "size", label: "Height", type: "select", default: "medium", options: [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ] },
    { key: "divider", label: "Show a divider line", type: "toggle", default: false },
    background(),
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

/** One placed section on the page (a type can appear multiple times). */
export type SectionInstance = {
  key: string; // unique per instance
  type: string; // one of HOME_SECTIONS ids
  hidden?: boolean;
  settings: Record<string, unknown>;
};

export type Theme = {
  colors: Record<string, string>;
  headingFont: string;
  bodyFont: string;
  headingScale: number; // multiplier on heading sizes
  radius: string;
  width: string;
  /** Ordered, placed sections. */
  layout: SectionInstance[];
};

export function defaultTheme(): Theme {
  return {
    colors: Object.fromEntries(COLOR_FIELDS.map((c) => [c.key, c.default])),
    headingFont: "default",
    bodyFont: "default",
    headingScale: 1,
    radius: "soft",
    width: "standard",
    layout: HOME_SECTIONS.map((s) => ({
      key: s.id,
      type: s.id,
      settings: defaultSectionSettings(s.id),
    })),
  };
}

/** A fresh instance of a section type, with a unique key. */
export function newSectionInstance(type: string, seed: number): SectionInstance {
  return {
    key: `${type}-${seed.toString(36)}`,
    type,
    settings: defaultSectionSettings(type),
  };
}

/**
 * The greens the site shipped with before the accessibility pass. Both failed
 * WCAG AA — #5f7a5d measured 3.93:1 as text on the sand ground, and white
 * button labels on #7f9b7c measured 3.05:1.
 *
 * A saved theme keeps whatever it stored, so raising the defaults alone would
 * leave any shop that opened the theme editor once still serving the failing
 * colours. These two values are swapped for their accessible replacements on
 * read; anything else the shop actually chose is left exactly as it is.
 */
const SUPERSEDED_COLORS: Record<string, Record<string, string>> = {
  sageDeep: { "#5f7a5d": "#4f6a4d" },
  sage: { "#7f9b7c": "#3f5640" },
};

function upgradeColors(colors: Record<string, string>): Record<string, string> {
  const out = { ...colors };
  for (const [key, replacements] of Object.entries(SUPERSEDED_COLORS)) {
    const current = out[key]?.toLowerCase();
    if (current && replacements[current]) out[key] = replacements[current];
  }
  return out;
}

/** Merge a stored partial theme over the defaults (forward-compatible). */
export function mergeTheme(raw: unknown): Theme {
  const base = defaultTheme();
  if (!raw || typeof raw !== "object") return base;
  const t = raw as Partial<Theme>;
  return {
    colors: upgradeColors({ ...base.colors, ...(t.colors ?? {}) }),
    headingFont: t.headingFont ?? base.headingFont,
    bodyFont: t.bodyFont ?? base.bodyFont,
    headingScale: Number(t.headingScale) || base.headingScale,
    radius: t.radius ?? base.radius,
    width: t.width ?? base.width,
    layout: normalizeLayout(raw as Record<string, unknown>, base),
  };
}

/**
 * Read the layout, upgrading the older {sectionOrder, hiddenSections, sections}
 * shape into placed instances so saved themes keep working.
 */
function normalizeLayout(
  t: Record<string, unknown>,
  base: Theme,
): SectionInstance[] {
  const known = new Set<string>(SECTION_LIBRARY.map((s) => s.id));

  if (Array.isArray(t.layout)) {
    const layout = (t.layout as SectionInstance[])
      .filter((i) => i && known.has(i.type))
      .map((i, n) => ({
        key: String(i.key || `${i.type}-${n}`),
        type: i.type,
        hidden: Boolean(i.hidden),
        settings: { ...defaultSectionSettings(i.type), ...(i.settings ?? {}) },
      }));
    return layout.length > 0 ? layout : base.layout;
  }

  // Legacy shape: only the five built-ins ever existed here.
  const order = Array.isArray(t.sectionOrder)
    ? (t.sectionOrder as string[]).filter((id) => known.has(id))
    : [];
  if (order.length === 0) return base.layout;
  const hidden = new Set(
    Array.isArray(t.hiddenSections) ? (t.hiddenSections as string[]) : [],
  );
  const settings = (t.sections ?? {}) as Record<string, Record<string, unknown>>;
  return order.map((id) => ({
    key: id,
    type: id,
    hidden: hidden.has(id),
    settings: { ...defaultSectionSettings(id), ...(settings[id] ?? {}) },
  }));
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
