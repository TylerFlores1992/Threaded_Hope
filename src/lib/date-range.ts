/**
 * Reporting date ranges for the admin dashboard.
 *
 * Each range knows how to bucket itself: short ranges are read day by day,
 * long ones month by month, so a year of data doesn't become 365 points.
 * Every range is compared against the equivalent stretch immediately before it.
 */
export type RangeId =
  | "7d"
  | "30d"
  | "90d"
  | "6m"
  | "12m"
  | "ytd"
  | "lastyear";

export const RANGES: { id: RangeId; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "6m", label: "Last 6 months" },
  { id: "12m", label: "Last 12 months" },
  { id: "ytd", label: "This year" },
  { id: "lastyear", label: "Last year" },
];

export const DEFAULT_RANGE: RangeId = "30d";

export function isRangeId(v: unknown): v is RangeId {
  return typeof v === "string" && RANGES.some((r) => r.id === v);
}

export type Bucketing = "day" | "month";

export type ResolvedRange = {
  id: RangeId;
  label: string;
  bucketing: Bucketing;
  /** Bucket keys for the selected period and the one before it, oldest first. */
  currentKeys: string[];
  previousKeys: string[];
  /** Human labels for the current buckets (x-axis). */
  labels: string[];
  /** Query window covering both periods. */
  start: Date;
  /** Where the current period begins — anything earlier is the comparison. */
  currentStart: Date;
  rangeLabel: string;
  previousLabel: string;
};

const DAY_MS = 86_400_000;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

/** Which bucket a timestamp belongs to, for the given granularity. */
export function bucketKey(d: Date, bucketing: Bucketing): string {
  return bucketing === "month" ? monthKey(d) : dayKey(d);
}

const dayLabel = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });

/** UTC-safe month arithmetic — avoids the day-of-month clamping trap. */
function addMonths(d: Date, n: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 0, 0, 0, 0),
  );
}

function dayKeysEndingAt(end: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(end.getTime() - i * DAY_MS)));
  }
  return keys;
}

function monthKeysEndingAt(end: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(monthKey(addMonths(end, -i)));
  return keys;
}

/**
 * Turn a range id into everything the dashboard needs. `now` is passed in so
 * the caller owns the single impure clock read.
 */
export function resolveRange(id: RangeId, now: Date): ResolvedRange {
  const label = RANGES.find((r) => r.id === id)?.label ?? id;

  // Day-bucketed ranges are a straight count back from today.
  const days: Partial<Record<RangeId, number>> = { "7d": 7, "30d": 30, "90d": 90 };
  const n = days[id];
  if (n) {
    const currentKeys = dayKeysEndingAt(now, n);
    const previousKeys = dayKeysEndingAt(new Date(now.getTime() - n * DAY_MS), n);
    return {
      id,
      label,
      bucketing: "day",
      currentKeys,
      previousKeys,
      labels: currentKeys.map(dayLabel),
      start: new Date(`${previousKeys[0]}T00:00:00Z`),
      currentStart: new Date(`${currentKeys[0]}T00:00:00Z`),
      rangeLabel: `${dayLabel(currentKeys[0])} – ${dayLabel(currentKeys[n - 1])}`,
      previousLabel: `${dayLabel(previousKeys[0])} – ${dayLabel(previousKeys[n - 1])}`,
    };
  }

  // Month-bucketed ranges. "This year"/"Last year" are calendar-aligned; the
  // rolling ones end on the current month.
  let months: number;
  let endMonth: Date;
  if (id === "ytd") {
    months = now.getUTCMonth() + 1;
    endMonth = addMonths(now, 0);
  } else if (id === "lastyear") {
    months = 12;
    endMonth = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 1));
  } else {
    months = id === "6m" ? 6 : 12;
    endMonth = addMonths(now, 0);
  }

  const currentKeys = monthKeysEndingAt(endMonth, months);
  const previousKeys = monthKeysEndingAt(addMonths(endMonth, -months), months);
  return {
    id,
    label,
    bucketing: "month",
    currentKeys,
    previousKeys,
    labels: currentKeys.map(monthLabel),
    start: new Date(`${previousKeys[0]}-01T00:00:00Z`),
    currentStart: new Date(`${currentKeys[0]}-01T00:00:00Z`),
    rangeLabel: `${monthLabel(currentKeys[0])} – ${monthLabel(currentKeys[months - 1])}`,
    previousLabel: `${monthLabel(previousKeys[0])} – ${monthLabel(previousKeys[months - 1])}`,
  };
}
