import { ImageResponse } from "next/og";
import { store } from "@/data/store";

/**
 * Default social preview card. Applies to every page that doesn't define its
 * own image (products supply their photo), so advertised links always preview
 * with something branded instead of a bare URL.
 *
 * Drawn rather than photographed: no asset to keep in sync, and it renders the
 * same whether or not the database is reachable.
 */
export const runtime = "edge";
export const alt = `${store.name} — handmade bags, pouches & faith-based gifts`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f1e7",
          color: "#3a352c",
          padding: 80,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 88, letterSpacing: -2 }}>{store.name}</div>
        <div style={{ width: 120, height: 4, background: "#5b6b52", margin: "28px 0" }} />
        <div style={{ fontSize: 34, color: "#6a6456", maxWidth: 900 }}>
          Handmade bags, pouches, keychains &amp; faith-based gifts
        </div>
        <div style={{ fontSize: 26, color: "#8a8272", marginTop: 24 }}>
          {store.tagline}
        </div>
      </div>
    ),
    size,
  );
}
