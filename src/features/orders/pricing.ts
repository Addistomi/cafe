import { fromMinor, mulQty, toMinor } from '@/lib/money';
import type { CatalogMeal } from '@/lib/types';

/** `mealIds` lists cart meals that are stale (deleted, hidden or changed) so the client can drop them. */
export class PricingError extends Error {
  constructor(message: string, public readonly mealIds: string[] = []) {
    super(message);
  }
}

export interface CartLineInput {
  mealId: string;
  quantity: number;
  removedIngredientIds: string[];
  addonIds: string[];
  note?: string;
}

export interface PricedIngredient {
  ingredient_id: string;
  name: string;
  per_serving: number;
  total: number;
  removed: boolean;
  source: 'RECIPE' | 'ADDON';
}

export interface PricedLine {
  meal_id: string;
  meal_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  note: string;
  ingredients: PricedIngredient[];
}

/** Prices one cart line from catalog data loaded from the database. Nothing from the browser is trusted but ids. */
export function priceLine(meal: CatalogMeal | undefined, input: CartLineInput): PricedLine {
  if (!meal || !meal.is_available) throw new PricingError('A meal in your cart is no longer available.', [input.mealId]);
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 20)
    throw new PricingError(`Choose between 1 and 20 of ${meal.name}.`);

  const removed = new Set(input.removedIngredientIds);
  for (const id of removed) {
    const row = meal.recipe_ingredients.find((r) => r.ingredient_id === id);
    if (!row || !row.is_removable) throw new PricingError(`That ingredient can't be removed from ${meal.name}.`, [input.mealId]);
  }

  const addons = [...new Set(input.addonIds)].map((id) => {
    const addon = meal.meal_addons.find((a) => a.id === id && a.is_available);
    if (!addon) throw new PricingError(`An extra for ${meal.name} is no longer available.`, [input.mealId]);
    return addon;
  });

  // Removing an ingredient never discounts the price (owner rule); extras add to it.
  const unitMinor = toMinor(meal.base_price) + addons.reduce((sum, a) => sum + toMinor(a.additional_price), 0);

  const ingredients: PricedIngredient[] = [
    ...meal.recipe_ingredients.map((r) => ({
      ingredient_id: r.ingredient_id,
      name: r.ingredients.name,
      per_serving: Number(r.quantity_per_serving),
      total: mulQty(Number(r.quantity_per_serving), input.quantity),
      removed: removed.has(r.ingredient_id),
      source: 'RECIPE' as const,
    })),
    ...addons
      .filter((a) => a.ingredient_id && a.quantity)
      .map((a) => ({
        ingredient_id: a.ingredient_id as string,
        name: a.ingredients?.name ?? a.name,
        per_serving: Number(a.quantity),
        total: mulQty(Number(a.quantity), input.quantity),
        removed: false,
        source: 'ADDON' as const,
      })),
  ];

  return {
    meal_id: meal.id,
    meal_name: meal.name,
    unit_price: fromMinor(unitMinor),
    quantity: input.quantity,
    line_total: fromMinor(unitMinor * input.quantity),
    note: (input.note ?? '').trim().slice(0, 200),
    ingredients,
  };
}

export function priceOrder(catalog: CatalogMeal[], lines: CartLineInput[], deliveryFee: number) {
  if (lines.length === 0) throw new PricingError('Your cart is empty.');
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const items: PricedLine[] = [];
  const stale: string[] = [];
  for (const line of lines) {
    try {
      items.push(priceLine(byId.get(line.mealId), line));
    } catch (e) {
      if (e instanceof PricingError && e.mealIds.length) stale.push(...e.mealIds);
      else throw e;
    }
  }
  if (stale.length) throw new PricingError('Some items in your cart changed or are no longer available.', [...new Set(stale)]);
  const subtotalMinor = items.reduce((s, i) => s + toMinor(i.line_total), 0);
  return {
    items,
    subtotal: fromMinor(subtotalMinor),
    delivery_fee: deliveryFee,
    total: fromMinor(subtotalMinor + toMinor(deliveryFee)),
  };
}
