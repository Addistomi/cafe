'use client';

import { useState, useTransition } from 'react';
import { adjustIngredientStock, createIngredient } from '@/features/admin/actions';

interface IngredientOption { id: string; name: string; base_unit: string }

export function CreateIngredientForm() {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<'GRAM' | 'MILLILITRE' | 'PIECE'>('GRAM');
  const [initial, setInitial] = useState('0');
  const [minimum, setMinimum] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    if (name.trim().length < 2 || Number(initial) < 0 || Number(minimum) < 0) {
      setError('Enter an ingredient name and valid opening and minimum quantities.'); return;
    }
    start(async () => {
      const result = await createIngredient({ name: name.trim(), baseUnit: unit, initialQuantity: Number(initial), minimumQuantity: Number(minimum) });
      if (!result.ok) return setError(result.error);
      window.location.reload();
    });
  }

  return (
    <section className="card space-y-4 p-5">
      <div><p className="eyebrow">Ingredient catalogue</p><h3 className="mt-1 font-display text-lg font-bold text-coffee">Add an ingredient</h3><p className="helper mt-1">Use grams, millilitres or pieces as the base unit. Opening stock is recorded in the inventory ledger.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="new-ingredient-name">Ingredient name</label><input id="new-ingredient-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Avocado" /></div>
        <div><label className="label" htmlFor="new-ingredient-unit">Base unit</label><select id="new-ingredient-unit" className="input" value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}><option value="GRAM">Gram (g)</option><option value="MILLILITRE">Millilitre (ml)</option><option value="PIECE">Piece (pcs)</option></select></div>
        <div><label className="label" htmlFor="new-ingredient-initial">Opening stock</label><input id="new-ingredient-initial" className="input" type="number" min="0" step="0.001" value={initial} onChange={(e) => setInitial(e.target.value)} /></div>
        <div><label className="label" htmlFor="new-ingredient-min">Minimum stock level</label><input id="new-ingredient-min" className="input" type="number" min="0" step="0.001" value={minimum} onChange={(e) => setMinimum(e.target.value)} /></div>
      </div>
      {error && <p role="alert" className="rounded-field bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <button type="button" className="btn-primary" disabled={pending} onClick={submit}>{pending ? 'Creating…' : 'Create ingredient'}</button>
    </section>
  );
}

export function StockAdjustmentForm({ ingredients }: { ingredients: IngredientOption[] }) {
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    if (!ingredientId || !Number(quantity) || Number(quantity) <= 0) {
      setError('Choose an ingredient and enter a quantity greater than zero.'); return;
    }
    if (direction === 'OUT' && !note.trim()) {
      setError('Enter a reason when removing stock.'); return;
    }
    start(async () => {
      const result = await adjustIngredientStock({ ingredientId, quantity: Number(quantity), direction, note: note.trim() });
      if (!result.ok) return setError(result.error);
      window.location.reload();
    });
  }

  return (
    <section className="card space-y-4 p-5">
      <div><p className="eyebrow">Stock movement</p><h3 className="mt-1 font-display text-lg font-bold text-coffee">Record a stock adjustment</h3><p className="helper mt-1">Every adjustment updates on-hand stock and creates a permanent inventory ledger entry. Reserved quantities cannot be removed.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="stock-ingredient">Ingredient</label><select id="stock-ingredient" className="input" value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>{ingredients.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.base_unit.toLowerCase()})</option>)}</select></div>
        <div><label className="label" htmlFor="stock-direction">Movement</label><select id="stock-direction" className="input" value={direction} onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}><option value="IN">Add stock / Purchase</option><option value="OUT">Remove stock / Adjustment</option></select></div>
        <div><label className="label" htmlFor="stock-quantity">Quantity</label><input id="stock-quantity" className="input" type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 250" /></div>
        <div><label className="label" htmlFor="stock-note">{direction === 'OUT' ? 'Reason (required)' : 'Purchase note (optional)'}</label><input id="stock-note" className="input" value={note} maxLength={240} onChange={(e) => setNote(e.target.value)} placeholder={direction === 'OUT' ? 'Wastage, damaged stock…' : 'Supplier or receipt reference'} /></div>
      </div>
      {error && <p role="alert" className="rounded-field bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <button type="button" className="btn-primary" disabled={pending || ingredients.length === 0} onClick={submit}>{pending ? 'Recording…' : 'Record stock movement'}</button>
      {ingredients.length === 0 && <p className="helper">Create an ingredient above before recording stock movements.</p>}
    </section>
  );
}
