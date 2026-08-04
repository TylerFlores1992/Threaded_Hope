"use client";

import { useState } from "react";

export type MetricSeries = {
  id: string;
  label: string;
  /** Formatted headline, e.g. "$294" or "3.52%". */
  display: string;
  /** Percent change vs. the previous period; null when there's no baseline. */
  delta: number | null;
  /** One value per day, oldest first, for the current and previous periods. */
  current: number[];
  previous: number[];
  /** Formats a single point for the tooltip. */
  unit: "count" | "money" | "percent";
};

const fmt = (v: number, unit: MetricSeries["unit"]) =>
  unit === "money"
    ? `$${(v / 100).toFixed(2)}`
    : unit === "percent"
      ? `${v.toFixed(2)}%`
      : String(Math.round(v));

/** Axis ticks are short — "$1.2K" rather than "$1,200.00" — so they always fit. */
const fmtAxis = (v: number, unit: MetricSeries["unit"]) => {
  if (unit === "percent") return `${v.toFixed(v < 10 ? 1 : 0)}%`;
  const n = unit === "money" ? v / 100 : v;
  const short =
    n >= 1000
      ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`
      : unit === "money" && n % 1 !== 0
        ? n.toFixed(2)
        : String(Math.round(n));
  return unit === "money" ? `$${short}` : short;
};

/**
 * A smooth curve through the points, scaled into the viewBox. Uses a cardinal
 * spline (each control point derived from the neighbours) so daily noise reads
 * as a trend rather than a zigzag — the way Shopify draws it.
 */
function pathFor(values: number[], max: number, w: number, h: number): string {
  if (values.length === 0) return "";
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pt = (i: number): [number, number] => [
    i * step,
    h - (max > 0 ? (values[i] / max) * h : 0),
  ];
  if (values.length === 1) {
    const [x, y] = pt(0);
    return `M${x},${y}`;
  }

  const TENSION = 0.2;
  let d = `M${pt(0)[0].toFixed(1)},${pt(0)[1].toFixed(1)}`;
  for (let i = 0; i < values.length - 1; i++) {
    const p0 = pt(Math.max(0, i - 1));
    const p1 = pt(i);
    const p2 = pt(i + 1);
    const p3 = pt(Math.min(values.length - 1, i + 2));
    const c1x = p1[0] + (p2[0] - p0[0]) * TENSION;
    const c1y = p1[1] + (p2[1] - p0[1]) * TENSION;
    const c2x = p2[0] - (p3[0] - p1[0]) * TENSION;
    const c2y = p2[1] - (p3[1] - p1[1]) * TENSION;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(
      1,
    )} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Round a max up to a friendly axis top (5, 10, 25, 50, 100 …). */
function axisMax(raw: number): number {
  if (raw <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (raw <= m * mag) return m * mag;
  }
  return 10 * mag;
}

/**
 * The headline metrics card: a row of selectable metrics above a chart of the
 * chosen one over time, with the previous period dotted behind it — the shape
 * Shopify's home page uses.
 */
export function MetricsCard({
  metrics,
  labels,
  rangeLabel,
  previousLabel,
}: {
  metrics: MetricSeries[];
  /** Date label per point, oldest first (same length as the series). */
  labels: string[];
  rangeLabel: string;
  previousLabel: string;
}) {
  const [selected, setSelected] = useState(metrics[0]?.id ?? "");
  const metric = metrics.find((m) => m.id === selected) ?? metrics[0];

  // Wide viewBox so the SVG fills the card at roughly Shopify's chart height
  // (it scales to the container width and takes its height from the ratio).
  const W = 1200;
  const H = 210;
  const max = axisMax(
    Math.max(1, ...(metric?.current ?? []), ...(metric?.previous ?? [])),
  );

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const step =
    metric && metric.current.length > 1 ? W / (metric.current.length - 1) : W;

  // Aim for ~6 evenly spaced date labels whatever the bucket count is, so a
  // year of months reads as cleanly as a month of days.
  const tickEvery = Math.max(1, Math.ceil(labels.length / 6));
  const tickIdx = labels.map((_, i) => i).filter((i) => i % tickEvery === 0);

  return (
    <div className="admin-card p-4">
      {/* Metric selector */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-3">
        {metrics.map((m) => {
          const active = m.id === metric?.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              aria-pressed={active}
              className={`min-w-[8.5rem] flex-1 rounded-lg px-3 py-2 text-left transition ${
                active ? "bg-black/[0.04] ring-1 ring-black/10" : "hover:bg-black/[0.03]"
              }`}
            >
              <span className="block text-[12px] text-ink-soft">{m.label}</span>
              <span className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[19px] font-semibold text-ink">
                  {m.display}
                </span>
                {m.delta != null && (
                  <span
                    className={`text-[11px] font-medium ${
                      m.delta >= 0 ? "text-[#0c5132]" : "text-[#8e1f0b]"
                    }`}
                  >
                    {m.delta >= 0 ? "↗" : "↘"} {Math.abs(Math.round(m.delta))}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="pt-4">
        <p className="text-[13px] font-medium text-ink">
          {metric?.label} over time
        </p>
        <svg
          viewBox={`-68 -10 ${W + 78} ${H + 46}`}
          className="mt-2 w-full"
          role="img"
          aria-label={`${metric?.label} over time, current period versus previous`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={0}
                x2={W}
                y1={H - t * H}
                y2={H - t * H}
                stroke="#e3e3e3"
                strokeWidth={1}
              />
              <text
                x={-10}
                y={H - t * H + 6}
                textAnchor="end"
                fontSize={16}
                fill="#616161"
              >
                {metric ? fmtAxis(max * t, metric.unit) : ""}
              </text>
            </g>
          ))}

          {/* Dates live inside the SVG so they line up with the points exactly. */}
          {tickIdx.map((i) => (
            <text
              key={`x${i}`}
              x={i * step}
              y={H + 28}
              textAnchor={i === 0 ? "start" : "middle"}
              fontSize={16}
              fill="#616161"
            >
              {labels[i]}
            </text>
          ))}
          {metric && (
            <>
              {/* Previous period, dotted behind */}
              <path
                d={pathFor(metric.previous, max, W, H)}
                fill="none"
                stroke="#9ec9f7"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
              {/* Current period */}
              <path
                d={pathFor(metric.current, max, W, H)}
                fill="none"
                stroke="#0094d5"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Invisible hover targets give every point a native tooltip. */}
              {metric.current.map((v, i) => (
                <rect
                  key={i}
                  x={i * step - step / 2}
                  y={0}
                  width={step}
                  height={H}
                  fill="transparent"
                >
                  <title>
                    {labels[i]}: {fmt(v, metric.unit)}
                  </title>
                </rect>
              ))}
            </>
          )}
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[#0094d5]" />
            {rangeLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[#9ec9f7]" />
            {previousLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
