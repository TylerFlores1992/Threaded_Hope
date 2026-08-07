import { prisma, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Group raw referrer URLs into readable sources. Instagram in particular
 * arrives under several hostnames (`l.instagram.com` for the bio link,
 * `instagram.com` from the in-app browser), and they should read as one thing.
 */
function sourceOf(referrer: string | null): string {
  if (!referrer) return "Direct / app link";
  let host: string;
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "Other";
  }
  if (host.includes("instagram")) return "Instagram";
  if (host.includes("facebook") || host === "lm.facebook.com") return "Facebook";
  if (host.includes("google")) return "Google";
  if (host.includes("bing")) return "Bing";
  if (host.includes("pinterest")) return "Pinterest";
  if (host.includes("t.co") || host.includes("twitter") || host === "x.com")
    return "X / Twitter";
  if (host.includes("tiktok")) return "TikTok";
  if (host.includes("threaded-hope")) return "Within the site";
  return host;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-card p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
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

  const [today, week, total, topPages, referrers] = await Promise.all([
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
    prisma.pageview.groupBy({
      by: ["referrer"],
      where: { createdAt: { gte: weekAgo } },
      // `_all`, not `referrer`: counting a nullable column skips the nulls, and
      // the null group is direct traffic — the biggest bucket for app taps.
      _count: { _all: true },
    }),
  ]);

  // Roll the raw referrer URLs up into sources, then sort by visits.
  const bySource = new Map<string, number>();
  for (const row of referrers) {
    const key = sourceOf(row.referrer);
    bySource.set(key, (bySource.get(key) ?? 0) + row._count._all);
  }
  // Internal navigation isn't a traffic source — it's the same visitor moving
  // around, and leaving it in would drown out the channels that brought them.
  bySource.delete("Within the site");
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sourceTotal = sources.reduce((n, [, v]) => n + v, 0);

  return (
    <div>
      <p className="mt-1 text-sm text-ink-soft">
        Storefront page views (visits to admin pages aren&apos;t counted).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Last 24 hours" value={today.toLocaleString()} />
        <Stat label="Last 7 days" value={week.toLocaleString()} />
        <Stat label="All time" value={total.toLocaleString()} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold text-ink">
          Where visitors came from (last 7 days)
        </h2>
        {sources.length === 0 ? (
          <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
            No visits recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto admin-card">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-border text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium text-right">Views</th>
                  <th className="px-4 py-3 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sources.map(([name, count]) => (
                  <tr key={name}>
                    <td className="px-4 py-3 text-ink">{name}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      {count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      {sourceTotal ? Math.round((count / sourceTotal) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-ink-soft">
          Taps from the Instagram app usually report Instagram, but not always —
          some in-app browsers send nothing, and those land under “Direct / app
          link”.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold text-ink">
          Top pages (last 7 days)
        </h2>
        {topPages.length === 0 ? (
          <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
            No page views recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto admin-card">
            <table className="w-full text-left text-[13px]">
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
