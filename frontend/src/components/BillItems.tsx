import { formatRupees } from '../lib/format';

export interface LineItem { item: string; group: string; brand: string; category: string; qty: number; value: number }

// Item-wise breakdown of a synced bill. Admin/superadmin surfaces only (Bills
// table, dealer card recent bills) — never rendered on any dealer screen.
export default function BillItems({ items }: { items: LineItem[] }) {
  return (
    <div className="bill-items">
      <table className="bi-table">
        <thead><tr><th>Item</th><th>Group</th><th>Brand</th><th>Cat</th><th className="t-num">Qty</th><th className="t-num">Value</th></tr></thead>
        <tbody>
          {items.map((li, i) => (
            <tr key={i}>
              <td className="t-mono">{li.item || '—'}</td>
              <td>{li.group || '—'}</td>
              <td className="hint">{li.brand || '—'}</td>
              <td className="hint">{li.category || '—'}</td>
              <td className="t-num">{li.qty}</td>
              <td className="t-num">{formatRupees(li.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
