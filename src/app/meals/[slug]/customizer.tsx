'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/features/cart/cart-store';
import { formatETB } from '@/lib/money';
import type { CatalogMeal } from '@/lib/types';

export function MealCustomizer({ meal }: { meal: CatalogMeal }) {
  const router = useRouter();
  const { add } = useCart();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [addons, setAddons] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  const toggle = (set: Set<string>, id: string, on: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    on(next);
  };

  // Display only. The server recalculates every price at checkout.
  const unit = useMemo(
    () => Number(meal.base_price) + meal.meal_addons.filter((a) => addons.has(a.id)).reduce((s, a) => s + Number(a.additional_price), 0),
    [meal, addons],
  );

  return (
    <div className="space-y-6 pt-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 font-display text-lg font-bold">What’s in it</legend>
        {meal.recipe_ingredients.map((r) => {
          const locked = !r.is_removable;
          const included = !removed.has(r.ingredient_id);
          return (
            <label key={r.ingredient_id} className={`card flex min-h-11 items-center gap-3 px-3 ${locked ? 'bg-coffee-soft/50' : 'cursor-pointer'}`}>
              <input
                type="checkbox" className="size-5 accent-[#70452F]" checked={included} disabled={locked}
                onChange={() => toggle(removed, r.ingredient_id, setRemoved)}
              />
              <span className="font-medium">{r.ingredients.name}</span>
              <span className="helper ml-auto">{locked ? 'Always included' : included ? 'Included' : 'Removed'}</span>
            </label>
          );
        })}
      </fieldset>

      {meal.meal_addons.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-1 font-display text-lg font-bold">Extras</legend>
          {meal.meal_addons.map((a) => (
            <label key={a.id} className="card flex min-h-11 cursor-pointer items-center gap-3 px-3">
              <input type="checkbox" className="size-5 accent-[#70452F]" checked={addons.has(a.id)} onChange={() => toggle(addons, a.id, setAddons)} />
              <span className="font-medium">{a.name}</span>
              <span className="ml-auto text-sm font-semibold text-accent">+{formatETB(a.additional_price)}</span>
            </label>
          ))}
        </fieldset>
      )}

      <div>
        <label htmlFor="note" className="label">Note for the kitchen</label>
        <textarea id="note" className="input py-2" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cut in half, extra napkins…" />
      </div>

      <div className="flex items-center gap-3">
        <div className="card flex items-center" role="group" aria-label="Quantity">
          <button type="button" className="min-h-11 w-11 text-xl" aria-label="Fewer" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
          <span className="w-8 text-center font-semibold" aria-live="polite">{quantity}</span>
          <button type="button" className="min-h-11 w-11 text-xl" aria-label="More" onClick={() => setQuantity((q) => Math.min(20, q + 1))}>+</button>
        </div>
        <button
          className="btn-primary flex-1"
          onClick={() => {
            add({
              mealId: meal.id, mealName: meal.name, slug: meal.slug, unitPrice: unit, quantity, note: note.trim(),
              removed: meal.recipe_ingredients.filter((r) => removed.has(r.ingredient_id)).map((r) => ({ id: r.ingredient_id, name: r.ingredients.name })),
              addons: meal.meal_addons.filter((a) => addons.has(a.id)).map((a) => ({ id: a.id, name: a.name })),
            });
            router.push('/cart');
          }}
        >
          Add to cart · {formatETB(unit * quantity)}
        </button>
      </div>
    </div>
  );
}
