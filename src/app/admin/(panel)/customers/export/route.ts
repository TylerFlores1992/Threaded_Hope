import { isDbConfigured } from "@/lib/db";
import { getCustomers } from "@/lib/customers";

export const dynamic = "force-dynamic";

/** CSV export of the customer list — for mailing lists and bookkeeping. */
const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  if (!isDbConfigured()) {
    return new Response("Database not configured.", { status: 503 });
  }

  const customers = await getCustomers();
  const headers = [
    "Name",
    "Email",
    "Location",
    "Orders",
    "Total spent",
    "First order",
    "Last order",
    "Email subscription",
  ];

  const rows = customers.map((c) =>
    [
      c.name ?? "",
      c.email,
      c.location ?? "",
      c.orderCount,
      (c.totalSpentCents / 100).toFixed(2),
      c.firstOrderAt?.toISOString().slice(0, 10) ?? "",
      c.lastOrderAt?.toISOString().slice(0, 10) ?? "",
      c.subscribed ? "subscribed" : "not subscribed",
    ]
      .map(cell)
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="threaded-hope-customers-${today}.csv"`,
    },
  });
}
