import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { formatPrice } from "@/lib/format";
import { StatStrip } from "@/components/admin/StatStrip";
import { PayoutForm } from "@/components/admin/PayoutForm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const date = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Sum one side of the balance for a currency (Stripe splits it per source). */
const sumUsd = (buckets: { amount: number; currency: string }[]) =>
  buckets.filter((b) => b.currency === "usd").reduce((n, b) => n + b.amount, 0);

const STATUS_TONE: Record<string, string> = {
  paid: "bg-[#cdfee1] text-[#0c5132]",
  in_transit: "bg-[#e3e3e3] text-[#4a4a4a]",
  pending: "bg-[#ffd6a4] text-[#5e4200]",
  failed: "bg-[#ffd6d6] text-[#8e1f0b]",
  canceled: "bg-[#ffd6d6] text-[#8e1f0b]",
};

export default async function StripePage() {
  if (!isStripeConfigured()) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-ink">Stripe</h1>
        <p className="mt-4 rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
          Add your Stripe keys to see your balance and payouts here.
        </p>
      </div>
    );
  }

  const stripe = getStripe();

  let balance: Stripe.Balance | null = null;
  let payouts: Stripe.Payout[] = [];
  let account: Stripe.Account | null = null;
  let error: string | null = null;

  try {
    const [b, p] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.payouts.list({ limit: 10 }),
    ]);
    balance = b;
    payouts = p.data;
    // The payout schedule lives on the account. Called with no id, Stripe
    // returns the account the API key belongs to — the types insist on an id,
    // hence the cast. A failure here shouldn't hide the balance, so it's
    // fetched separately and allowed to come back null.
    try {
      const retrieveOwn = stripe.accounts.retrieve as unknown as () => Promise<
        Stripe.Account
      >;
      account = await retrieveOwn.call(stripe.accounts);
    } catch {
      account = null;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Couldn't reach Stripe.";
  }

  if (error || !balance) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-ink">Stripe</h1>
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-[13px] text-red-700">
          {error ?? "Couldn't load your Stripe balance."}
        </p>
      </div>
    );
  }

  const available = sumUsd(balance.available);
  const pending = sumUsd(balance.pending);
  const inTransit = sumUsd(balance.instant_available ?? []);

  const schedule = account?.settings?.payouts?.schedule;
  const isManual = schedule?.interval === "manual";
  const scheduleLabel = !schedule
    ? "—"
    : schedule.interval === "manual"
      ? "Manual"
      : schedule.interval === "daily"
        ? "Daily (automatic)"
        : `${schedule.interval[0].toUpperCase()}${schedule.interval.slice(1)} (automatic)`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">Stripe</h1>
        <a
          href="https://dashboard.stripe.com/payments"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-black/[0.03]"
        >
          Open Stripe Dashboard ↗
        </a>
      </div>

      <StatStrip
        period="Balance"
        stats={[
          {
            label: "Available now",
            value: formatPrice(available / 100),
            help: "Ready to pay out",
          },
          {
            label: "Pending",
            value: formatPrice(pending / 100),
            help: "Still settling",
          },
          {
            label: "Instant available",
            value: formatPrice(inTransit / 100),
          },
          { label: "Payout schedule", value: scheduleLabel },
        ]}
      />

      <section className="admin-card mt-4 max-w-2xl p-4">
        <h2 className="text-[13px] font-semibold text-ink">Pay out to bank</h2>
        {isManual ? (
          <>
            <p className="mb-3 mt-1 text-[13px] text-ink-soft">
              Moves your available balance to the bank account on file. It
              usually lands in one to two business days.
            </p>
            <PayoutForm availableCents={available} />
          </>
        ) : (
          <p className="mt-1 text-[13px] text-ink-soft">
            Your payouts are on an <strong>{scheduleLabel.toLowerCase()}</strong>{" "}
            schedule, so Stripe sends the money to your bank on its own — there&apos;s
            nothing to do here. To pay out by hand instead, switch the schedule to
            manual in Stripe under Settings → Payouts, and this becomes a button.
          </p>
        )}
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-[13px] font-semibold text-ink">
          Recent payouts
        </h2>
        {payouts.length === 0 ? (
          <p className="rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
            No payouts yet. They appear once Stripe sends your first one.
          </p>
        ) : (
          <div className="overflow-x-auto admin-card">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-border text-ink-soft">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    Created
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    Arrives
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th className="w-full px-3 py-2.5 font-medium">Destination</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">
                      {date(p.created)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">
                      {date(p.arrival_date)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`inline-block whitespace-nowrap rounded-lg px-2 py-0.5 text-[12px] font-medium capitalize ${
                          STATUS_TONE[p.status] ?? STATUS_TONE.pending
                        }`}
                      >
                        {p.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">
                      {p.description ?? "Bank account"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-ink">
                      {formatPrice(p.amount / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-3 text-[11px] text-ink-soft">
        Refunds, disputes and card details stay in the Stripe Dashboard — those
        are safer handled where Stripe can verify it&apos;s you.
      </p>
    </div>
  );
}
