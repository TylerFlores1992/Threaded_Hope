export const dynamic = "force-dynamic";

export default function InventoryPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Inventory</h1>
      <p className="mt-4 rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Coming next: stock counts per product with low-stock and out-of-stock
        flags, and automatic decrement when an order is paid. You can already
        set a stock number and the in-stock toggle when editing a product.
      </p>
    </div>
  );
}
