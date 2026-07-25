export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Orders</h1>
      <p className="mt-4 rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Coming next: paid orders pulled from Stripe and this store&apos;s
        database — customer, items, shipping, and totals. For now, your live
        orders are in the Stripe Dashboard.
      </p>
    </div>
  );
}
