import { describe, expect, it } from 'vitest';
import { priceLine, priceOrder, PricingError } from '@/features/orders/pricing';
import type { CatalogMeal } from '@/lib/types';

const meal: CatalogMeal = {
  id: 'm1', name: 'Chicken Sandwich', slug: 'chicken-sandwich', description: null, base_price: 250,
  image_url: null, is_available: true, preparation_minutes: 15,
  recipe_ingredients: [
    { ingredient_id: 'chicken', quantity_per_serving: 120, is_removable: false, ingredients: { name: 'Chicken' } },
    { ingredient_id: 'tomato', quantity_per_serving: 30, is_removable: true, ingredients: { name: 'Tomato' } },
  ],
  meal_addons: [
    { id: 'cheese', name: 'Extra cheese', additional_price: 30, ingredient_id: 'cheese-ing', quantity: 25, is_available: true, ingredients: { name: 'Cheese' } },
  ],
};
const base = { mealId: 'm1', quantity: 2, removedIngredientIds: [], addonIds: [] };

describe('pricing', () => {
  it('multiplies price by quantity', () => {
    expect(priceLine(meal, base).line_total).toBe(500);
  });

  it('adds extras to the unit price and to stock needs', () => {
    const line = priceLine(meal, { ...base, addonIds: ['cheese'] });
    expect(line.unit_price).toBe(280);
    expect(line.ingredients.find((i) => i.source === 'ADDON')?.total).toBe(50);
  });

  it('does not discount removed ingredients but flags them as removed', () => {
    const line = priceLine(meal, { ...base, removedIngredientIds: ['tomato'] });
    expect(line.unit_price).toBe(250);
    expect(line.ingredients.find((i) => i.ingredient_id === 'tomato')?.removed).toBe(true);
  });

  it('rejects removing a required ingredient', () => {
    expect(() => priceLine(meal, { ...base, removedIngredientIds: ['chicken'] })).toThrow(PricingError);
  });

  it('rejects unknown extras and unavailable meals', () => {
    expect(() => priceLine(meal, { ...base, addonIds: ['nope'] })).toThrow(PricingError);
    expect(() => priceLine({ ...meal, is_available: false }, base)).toThrow(PricingError);
  });

  it('reports every stale meal so the cart can be cleaned', () => {
    try {
      priceOrder([meal], [base, { ...base, mealId: 'gone-1' }, { ...base, mealId: 'gone-2' }], 0);
      throw new Error('expected failure');
    } catch (e) {
      expect(e).toBeInstanceOf(PricingError);
      expect((e as PricingError).mealIds).toEqual(['gone-1', 'gone-2']);
    }
  });

  it('avoids floating point drift in totals', () => {
    const cheap = { ...meal, base_price: 0.1 };
    const total = priceOrder([cheap], [{ ...base, quantity: 3 }], 0.2).total;
    expect(total).toBe(0.5);
  });
});
