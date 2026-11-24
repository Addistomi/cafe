'use client';

import { useState, useTransition } from 'react';
import { adjustIngredientStock } from '@/features/admin/actions';

interface IngredientOption { id: string; name: string; base_unit: string }

export function StockAdjustmentForm({ ingredients }: { ingredients: IngredientOption[] }) {
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null); setSuccess(null);
    if (!ingredientId || !Number(quantity) || Number(quantity) <= 0) {
      setError('Choose an ingredient and enter a quantity greater than zero.');
      return;
    }
    if (direction === 'OUT' && !note.trim()) {
      setError('Enter a reason when removing stock.');
      return;
    }
    start(async () => {
      const result = await adjustIngredientStock({ ingredientId, quantity: Number(quantity), direction, note: note.trim() });
      if (!result.ok) return setError(result.error);
      setSuccess(direction === 'IN' ? 'Stock added and purchase movement recorded.' : 'Stock removed and adjustment movement recorded.');
      setQuantity(''); setNote('');
      window.location.reload();
    });
  }

  return (
    <section className="card space-y-4 p-5">
      <div><p className="eyebrow">Stock movement</p><h3 className="mt-1 font-display text-lg font-bold text-coffee">Record an adjustment</h3><p className="helper mt-1">Every adjustment updates on-hand stock and creates an inventory ledger entry.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="stock-ingredient">Ingredient</label><select id="stock-ingredient" className="input" value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>{ingredients.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.base_unit.toLowerCase()})</option>)}</select></div>
        <div><label className="label" htmlFor="stock-direction">Movement</label><select id="stock-direction" className="input" value={direction} onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}><option value="IN">Add stock / Purchase</option><option value="OUT">Remove stock / Adjustment</option></select></div>
        <div><label className="label" htmlFor="stock-quantity">Quantity</label><input id="stock-quantity" className="input" type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 250" /></div>
        <div><label className="label" htmlFor="stock-note">{direction === 'OUT' ? 'Reason (required)' : 'Purchase note (optional)'}</label><input id="stock-note" className="input" value={note} maxLength={240} onChange={(e) => setNote(e.target.value)} placeholder={direction === 'OUT' ? 'Wastage, damaged stock…' : 'Supplier or receipt reference'} /></div>
      </div>
      {error && <p role="alert" className="rounded-field bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      {success && <p role="status" className="rounded-field bg-success-soft p-3 text-sm text-success">{success}</p>}
      <button type="button" className="btn-primary" disabled={pending || ingredients.length === 0} onClick={submit}>{pending ? 'Recording…' : 'Record stock movement'}</button>
      {ingredients.length === 0 && <p className="helper">There are no active ingredients to adjust.</p>}
    </section>
  );
}
