/**
 * The metric row Shopify puts above its Orders / Products / Inventory lists:
 * one card, a period chip on the left, then evenly divided cells.
 */
export function StatStrip({
  period,
  stats,
}: {
  period: string;
  stats: { label: string; value: string; help?: string }[];
}) {
  return (
    <div className="admin-card flex flex-wrap items-stretch overflow-hidden">
      <div className="flex items-center gap-2 border-r border-border px-4 py-3 text-[13px] text-ink-soft">
        <span aria-hidden>◷</span>
        {period}
      </div>
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={`min-w-[9rem] flex-1 px-4 py-3 ${
            i < stats.length - 1 ? "border-r border-border" : ""
          }`}
        >
          <p className="text-[12px] text-ink-soft">{s.label}</p>
          <p className="mt-0.5 text-[17px] font-semibold text-ink">{s.value}</p>
          {s.help && <p className="text-[11px] text-ink-soft">{s.help}</p>}
        </div>
      ))}
    </div>
  );
}
