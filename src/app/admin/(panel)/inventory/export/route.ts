import { prisma, isDbConfigured } from "@/lib/db";
import { sizeAxisOf, optionAxesOf } from "@/lib/stock";
import type { Variant } from "@/data/products";

export const dynamic = "force-dynamic";

/** CSV of every tracked count — one row per product, size, or option choice. */
const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  if (!isDbConfigured() || !prisma) {
    return new Response("Database not configured.", { status: 503 });
  }

  const rows = await prisma.product.findMany({ orderBy: { name: "asc" } });
  const headers = ["Product", "Status", "Option group", "Choice", "On hand"];
  const lines: string[] = [];

  for (const p of rows) {
    const variants = (Array.isArray(p.variants) ? p.variants : []) as Variant[];
    const sizeStock =
      p.sizeStock && typeof p.sizeStock === "object"
        ? (p.sizeStock as Record<string, number>)
        : {};
    const optionStock =
      p.optionStock && typeof p.optionStock === "object"
        ? (p.optionStock as Record<string, Record<string, number>>)
        : {};

    const axis = sizeAxisOf({ variants });
    const optionAxes = optionAxesOf({ variants });

    if (!axis && optionAxes.length === 0) {
      lines.push(
        [p.name, p.status, "", "", p.stock ?? "untracked"].map(cell).join(","),
      );
      continue;
    }
    if (axis) {
      for (const o of axis.options) {
        lines.push(
          [p.name, p.status, axis.name, o, sizeStock[o] ?? "untracked"]
            .map(cell)
            .join(","),
        );
      }
    }
    for (const v of optionAxes) {
      for (const o of v.options) {
        lines.push(
          [p.name, p.status, v.name, o, optionStock[v.name]?.[o] ?? "untracked"]
            .map(cell)
            .join(","),
        );
      }
    }
  }

  const csv = [headers.join(","), ...lines].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="threaded-hope-inventory-${today}.csv"`,
    },
  });
}
