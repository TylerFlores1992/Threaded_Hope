import { prisma, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-5 ring-1 ring-border">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 font-serif text-3xl text-ink">{value}</p>
    </div>
  );
}

export default async function TrafficPage() {
  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to see traffic.
      </p>
    );
  }

  // Per-request "now" for the time windows (server component, runs each request).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [today, week, total, topPages] = await Promise.all([
    prisma.pageview.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.pageview.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.pageview.count(),
    prisma.pageview.groupBy({
      by: ["path"],
      where: { createdAt: { gte: weekAgo } },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 10,
    }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Traffic</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Storefront page views (visits to admin pages aren&apos;t counted).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Last 24 hours" value={today.toLocaleString()} />
        <Stat label="Last 7 days" value={week.toLocaleString()} />
        <Stat label="All time" value={total.toLocaleString()} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-serif text-xl text-ink">
          Top pages (last 7 days)
        </h2>
        {topPages.length === 0 ? (
          <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
            No page views recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white/70 ring-1 ring-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Page</th>
                  <th className="px-4 py-3 font-medium text-right">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topPages.map((row) => (
                  <tr key={row.path}>
                    <td className="px-4 py-3 font-mono text-ink">{row.path}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      {row._count.path.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
