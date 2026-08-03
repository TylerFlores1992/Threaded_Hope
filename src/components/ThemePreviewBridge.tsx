"use client";

import { useEffect } from "react";

/**
 * Live-preview receiver for the admin theme editor. When the storefront is
 * rendered inside the editor's iframe, it listens for draft theme values and
 * applies them to `:root` instantly — so colors/fonts update as you drag,
 * exactly like a theme customizer. No-ops on the real site (top-level window).
 */
export function ThemePreviewBridge() {
  useEffect(() => {
    if (window.self === window.top) return; // only inside the editor iframe

    const onMessage = (e: MessageEvent) => {
      // Same-origin only: the editor and storefront are the same deployment.
      if (e.origin !== window.location.origin) return;
      const data = e.data as {
        type?: string;
        vars?: Record<string, string>;
        fonts?: string | null;
        hidden?: string[];
      };
      // Scroll to + flash a section when it's selected in the editor.
      if (data?.type === "th-focus-section") {
        const el = document.querySelector<HTMLElement>(
          `[data-section="${(data as { id?: string }).id}"]`,
        );
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.style.outline = "2px solid var(--sage-deep)";
        el.style.outlineOffset = "-2px";
        window.setTimeout(() => {
          el.style.outline = "";
          el.style.outlineOffset = "";
        }, 1200);
        return;
      }

      if (data?.type !== "th-theme-preview") return;

      for (const [k, v] of Object.entries(data.vars ?? {})) {
        document.documentElement.style.setProperty(k, v);
      }

      if (data.fonts) {
        let link = document.getElementById(
          "th-preview-fonts",
        ) as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement("link");
          link.id = "th-preview-fonts";
          link.rel = "stylesheet";
          document.head.appendChild(link);
        }
        if (link.href !== data.fonts) link.href = data.fonts;
      }

      // Section visibility preview.
      for (const el of document.querySelectorAll<HTMLElement>("[data-section]")) {
        const id = el.dataset.section ?? "";
        el.style.display = (data.hidden ?? []).includes(id) ? "none" : "";
      }
    };

    window.addEventListener("message", onMessage);
    // Tell the editor we're ready for the first draft.
    window.parent.postMessage(
      { type: "th-preview-ready" },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
