'use client';

import { useMemo, useState, useTransition } from 'react';
import { saveMeal, setMealAvailability, type MealEditorInput } from '@/features/admin/actions';
import { formatETB } from '@/lib/money';

interface Category { id: string; name: string }
interface Ingredient { id: string; name: string; base_unit: string }
interface RecipeIngredient { ingredient_id: string; quantity_per_serving: number; is_removable: boolean }
interface MenuMeal {
  id: string; name: string; slug: string; description: string | null; category_id: string;
  base_price: number; preparation_minutes: number | null; image_url: string | null; is_available: boolean;
  recipe_ingredients: RecipeIngredient[];
}

type Draft = {
  id: string | null; name: string; slug: string; category_id: string; description: string;
  base_price: string; preparation_minutes: string; image_url: string; is_available: boolean;
  recipe: Record<string, { enabled: boolean; quantity: string; removable: boolean }>;
};

const emptyDraft = (): Draft => ({
  id: null, name: '', slug: '', category_id: '', description: '', base_price: '', preparation_minutes: '15',
  image_url: '', is_available: true, recipe: {},
});

function fromMeal(meal: MenuMeal): Draft {
  const recipe: Draft['recipe'] = {};
  for (const row of meal.recipe_ingredients ?? []) {
    recipe[row.ingredient_id] = {
      enabled: true, quantity: String(row.quantity_per_serving), removable: row.is_removable,
    };
  }
  return {
    id: meal.id, name: meal.name, slug: meal.slug, category_id: meal.category_id,
    description: meal.description ?? '', base_price: String(meal.base_price),
    preparation_minutes: meal.preparation_minutes ? String(meal.preparation_minutes) : '',
    image_url: meal.image_url ?? '', is_available: meal.is_available, recipe,
  };
}

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function MenuManager({ categories, ingredients, meals }: {
  categories: Category[]; ingredients: Ingredient[]; meals: MenuMeal[];
}) {
  const [draft, setDraft] = useState<Draft>(() => meals[0] ? fromMeal(meals[0]) : emptyDraft());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const selectedMeal = useMemo(() => meals.find((meal) => meal.id === draft.id), [meals, draft.id]);

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function chooseMeal(meal: MenuMeal | null) {
    setDraft(meal ? fromMeal(meal) : emptyDraft());
    setMessage(null); setError(null);
  }

  function submit() {
    setError(null); setMessage(null);
    if (!draft.name.trim() || !draft.category_id || !Number(draft.base_price) || Number(draft.base_price) <= 0) {
      setError('Enter a meal name, category and valid price.');
      return;
    }
    const recipe = Object.entries(draft.recipe)
      .filter(([, value]) => value.enabled)
      .map(([ingredient_id, value]) => ({
        ingredient_id, quantity_per_serving: Number(value.quantity), is_removable: value.removable,
      }));
    if (!recipe.length || recipe.some((row) => !Number.isFinite(row.quantity_per_serving) || row.quantity_per_serving <= 0)) {
      setError('Choose at least one ingredient and give each one a quantity greater than zero.');
      return;
    }

    const payload: MealEditorInput = {
      id: draft.id,
      name: draft.name.trim(),
      slug: slugify(draft.slug || draft.name),
      category_id: draft.category_id,
      description: draft.description.trim() || null,
      base_price: Number(draft.base_price),
      preparation_minutes: draft.preparation_minutes ? Number(draft.preparation_minutes) : null,
      image_url: draft.image_url.trim() || '',
      is_available: draft.is_available,
      recipe,
    };

    start(async () => {
      const result = await saveMeal(payload);
      if (!result.ok) return setError(result.error);
      setMessage(draft.id ? 'Meal and recipe updated.' : 'Meal created successfully.');
      window.location.reload();
    });
  }

  function toggleAvailability(meal: MenuMeal) {
    start(async () => {
      const result = await setMealAvailability(meal.id, !meal.is_available);
      if (!result.ok) setError(result.error);
      else window.location.reload();
    });
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.95fr)]">
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div><p className="eyebrow">Current catalogue</p><h2 className="text-xl font-extrabold text-coffee">Meals and prices</h2></div>
          <button type="button" className="btn-primary min-h-9 px-3" onClick={() => chooseMeal(null)}>+ Add meal</button>
        </div>
        {meals.length === 0 && <p className="card p-5 text-sm text-muted">No meals yet. Create the first one using the editor.</p>}
        <div className="space-y-2">
          {meals.map((meal) => (
            <article key={meal.id} className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${draft.id === meal.id ? 'border-coffee/50 ring-2 ring-coffee/10' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-bold text-coffee">{meal.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meal.is_available ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>{meal.is_available ? 'Available' : 'Hidden'}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{meal.recipe_ingredients?.length ?? 0} recipe ingredients · {formatETB(meal.base_price)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => chooseMeal(meal)}>Edit</button>
                <button type="button" className="btn-ghost min-h-9 px-3" disabled={pending} onClick={() => toggleAvailability(meal)}>{meal.is_available ? 'Hide' : 'Publish'}</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="eyebrow">Menu editor</p><h2 className="text-xl font-extrabold text-coffee">{selectedMeal ? 'Edit meal' : 'Create a meal'}</h2><p className="mt-1 text-xs text-muted">Every meal needs a recipe so stock can be calculated correctly.</p></div>
          {selectedMeal && <button type="button" className="text-xs font-semibold text-coffee underline" onClick={() => chooseMeal(null)}>New meal instead</button>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="meal-name">Meal name</label><input id="meal-name" className="input" value={draft.name} onChange={(e) => { patch('name', e.target.value); if (!draft.slug || draft.slug === slugify(draft.name)) patch('slug', slugify(e.target.value)); }} placeholder="Chicken sandwich" /></div>
          <div><label className="label" htmlFor="meal-category">Category</label><select id="meal-category" className="input" value={draft.category_id} onChange={(e) => patch('category_id', e.target.value)}><option value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          <div><label className="label" htmlFor="meal-price">Price (ETB)</label><input id="meal-price" className="input" type="number" min="0.01" step="0.01" value={draft.base_price} onChange={(e) => patch('base_price', e.target.value)} placeholder="250" /></div>
          <div><label className="label" htmlFor="meal-time">Preparation (minutes)</label><input id="meal-time" className="input" type="number" min="1" max="360" value={draft.preparation_minutes} onChange={(e) => patch('preparation_minutes', e.target.value)} /></div>
          <div><label className="label" htmlFor="meal-slug">Menu URL name</label><input id="meal-slug" className="input" value={draft.slug} onChange={(e) => patch('slug', slugify(e.target.value))} placeholder="chicken-sandwich" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="meal-image">Image URL (optional)</label><input id="meal-image" className="input" type="url" value={draft.image_url} onChange={(e) => patch('image_url', e.target.value)} placeholder="https://…" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="meal-description">Description</label><textarea id="meal-description" className="input py-2" rows={2} maxLength={500} value={draft.description} onChange={(e) => patch('description', e.target.value)} placeholder="Describe the meal…" /></div>
        </div>

        <div className="space-y-2">
          <div><h3 className="font-display font-bold text-coffee">Recipe ingredients</h3><p className="helper">Set the quantity used for one serving. Choose whether the resident may remove it.</p></div>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {ingredients.map((ingredient) => {
              const row = draft.recipe[ingredient.id] ?? { enabled: false, quantity: '1', removable: false };
              return (
                <div key={ingredient.id} className={`rounded-field border p-3 ${row.enabled ? 'border-coffee/30 bg-coffee-soft/30' : 'border-line'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex flex-1 items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" className="size-4 accent-[#70452F]" checked={row.enabled} onChange={(e) => setDraft((current) => ({ ...current, recipe: { ...current.recipe, [ingredient.id]: { ...row, enabled: e.target.checked } } }))} />
                      {ingredient.name}
                    </label>
                    {row.enabled && (
                      <>
                        <label className="flex items-center gap-1 text-xs text-muted">Qty <input className="input min-h-9 w-20 px-2" type="number" min="0.001" step="0.001" value={row.quantity} onChange={(e) => setDraft((current) => ({ ...current, recipe: { ...current.recipe, [ingredient.id]: { ...row, quantity: e.target.value } } }))} /></label>
                        <label className="flex items-center gap-1 text-xs font-medium text-muted"><input type="checkbox" className="size-4 accent-[#70452F]" checked={row.removable} onChange={(e) => setDraft((current) => ({ ...current, recipe: { ...current.recipe, [ingredient.id]: { ...row, removable: e.target.checked } } }))} /> Removable</label>
                      </>
                    )}
                  </div>
                  {row.enabled && <p className="helper mt-1 pl-6">Unit: {ingredient.base_unit.toLowerCase()}</p>}
                </div>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[#70452F]" checked={draft.is_available} onChange={(e) => patch('is_available', e.target.checked)} /> Show this meal on the customer menu</label>
        {error && <p role="alert" className="rounded-field bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        {message && <p role="status" className="rounded-field bg-success-soft p-3 text-sm text-success">{message}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-primary flex-1" disabled={pending || categories.length === 0 || ingredients.length === 0} onClick={submit}>{pending ? 'Saving…' : selectedMeal ? 'Save changes' : 'Create meal'}</button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => chooseMeal(null)}>Clear</button>
        </div>
        {(categories.length === 0 || ingredients.length === 0) && <p className="helper">Add at least one active category and ingredient in Supabase before creating meals.</p>}
      </section>
    </div>
  );
}
