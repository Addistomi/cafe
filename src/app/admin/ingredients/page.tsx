import type { Metadata } from 'next';
import { requireRole, MANAGERS } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Stock' };

interface StockRow { id: string; name: string; base_unit: string; on_hand_quantity: number; reserved_quantity: number; available_quantity: number; minimum_stock_quantity: number }

const UNIT: Record<string, string> = { GRAM: 'g', MILLILITRE: 'ml', PIECE: 'pcs' };

export default async function IngredientsPage() {
  await requireRole(MANAGERS);
  const supabase = await createClient();
  const { data } = await supabase.from('ingredient_stock').select('*').order('name');
  const rows = (data as StockRow[]) ?? [];

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold text-coffee">Stock</h1>
      <p className="text-sm text-muted">Available = on hand minus ingredients reserved for accepted orders.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-line text-muted"><tr><th className="p-3">Ingredient</th><th className="p-3">On hand</th><th className="p-3">Reserved</th><th className="p-3">Available</th><th className="p-3">Minimum</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const low = Number(r.available_quantity) <= Number(r.minimum_stock_quantity);
              const u = UNIT[r.base_unit];
              return (
                <tr key={r.id} className="border-b border-line/60 last:border-0">
                  <td className="p-3 font-semibold">{r.name}</td>
                  <td className="p-3">{Number(r.on_hand_quantity)} {u}</td><td className="p-3">{Number(r.reserved_quantity)} {u}</td>
                  <td className="p-3">{Number(r.available_quantity)} {u}</td><td className="p-3">{Number(r.minimum_stock_quantity)} {u}</td>
                  <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${low ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>{low ? 'Low' : 'Good'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
