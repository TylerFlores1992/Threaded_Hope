import {
  themeCssVars,
  googleFontsHref,
  type Theme,
} from "@/lib/theme-config";

/**
 * Injects the saved theme as `:root` custom-property overrides (plus a Google
 * Fonts link when a non-default font is chosen). Rendered in the root layout so
 * it applies before paint — the base values still live in globals.css.
 */
export function ThemeStyle({ theme }: { theme: Theme }) {
  const vars = themeCssVars(theme);
  const css = `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
  const fonts = googleFontsHref(theme);

  return (
    <>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <style
        id="th-theme-vars"
        dangerouslySetInnerHTML={{ __html: css }}
      />
    </>
  );
}
