import type { Metadata } from 'next';
import { requireRole, MANAGERS } from '@/features/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { CreateIngredientForm, StockAdjustmentForm } from './stock-adjustment-form';

export const metadata: Metadata = { title: 'Inventory' };

interface StockRow {
  id: string; name: string; base_unit: string; on_hand_quantity: number;
  reserved_quantity: number; available_quantity: number; minimum_stock_quantity: number;
}

const UNIT: Record<string, string> = { GRAM: 'g', MILLILITRE: 'ml', PIECE: 'pcs' };

export default async function IngredientsPage() {
  await requireRole(MANAGERS);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('ingredient_stock').select('*').order('name');
  const rows = (data as StockRow[]) ?? [];
  const lowCount = rows.filter((row) => Number(row.available_quantity) <= Number(row.minimum_stock_quantity)).length;

  return (
    <div className="space-y-5">
      <div><p className="eyebrow">Ingredient control</p><h2 className="mt-1 text-2xl font-extrabold text-coffee">Inventory</h2><p className="mt-1 text-sm text-muted">On hand is physical stock. Reserved is committed to accepted orders. Available is what the café can still sell.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Tracked ingredients</p><p className="mt-1 font-display text-2xl font-extrabold text-coffee">{rows.length}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Low stock alerts</p><p className="mt-1 font-display text-2xl font-extrabold text-warning">{lowCount}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Stock calculation</p><p className="mt-1 text-sm font-bold text-coffee">On hand − reserved</p></div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">\n        <CreateIngredientForm />\n        <StockAdjustmentForm ingredients={rows.map((row) => ({ id: row.id, name: row.name, base_unit: row.base_unit }))} />\n      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-5"><div><h3 className="font-display text-lg font-bold text-coffee">Current ingredient levels</h3><p className="helper mt-1">Low stock is highlighted against each ingredient’s minimum level.</p></div><span className="text-xs text-muted">{rows.length} ingredients</span></div>
        {error ? <p className="p-5 text-sm text-danger">Stock could not be loaded. Check the ingredient_stock database view.</p> : rows.length === 0 ? <p className="p-6 text-sm text-muted">No ingredients found. Add ingredient records in Supabase before creating meal recipes.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-coffee-soft/50 text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Ingredient</th><th className="p-3">On hand</th><th className="p-3">Reserved</th><th className="p-3">Available</th><th className="p-3">Minimum</th><th className="p-3">Status</th></tr></thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((row) => {
                  const available = Number(row.available_quantity);
                  const minimum = Number(row.minimum_stock_quantity);
                  const low = available <= minimum;
                  const unit = UNIT[row.base_unit] ?? row.base_unit.toLowerCase();
                  const ratio = minimum > 0 ? Math.min(100, Math.max(4, available / (minimum * 2) * 100)) : 100;
                  return <tr key={row.id}>
                    <td className="p-3 font-bold text-coffee">{row.name}</td>
                    <td className="p-3">{Number(row.on_hand_quantity).toLocaleString()} {unit}</td>
                    <td className="p-3 text-muted">{Number(row.reserved_quantity).toLocaleString()} {unit}</td>
                    <td className="p-3 font-semibold">{available.toLocaleString()} {unit}</td>
                    <td className="p-3 text-muted">{minimum.toLocaleString()} {unit}</td>
                    <td className="p-3"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${low ? 'bg-warning' : 'bg-success'}`} /><span className={`text-xs font-bold ${low ? 'text-warning' : 'text-success'}`}>{low ? 'Low stock' : 'Healthy'}</span></div><div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${low ? 'bg-warning' : 'bg-success'}`} style={{ width: `${ratio}%` }} /></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
