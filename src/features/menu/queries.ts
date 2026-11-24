import { createClient } from '@/lib/supabase/server';
import type { CatalogMeal, Meal } from '@/lib/types';

const CARD = 'id, name, slug, description, base_price, image_url, is_available, preparation_minutes, categories(name)';

export async function listCategories(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('id, name').order('sort_order');
  return data ?? [];
}

export async function listMeals(opts: { q?: string; category?: string; sort?: string } = {}): Promise<Meal[]> {
  const supabase = await createClient();
  let query = supabase.from('meals').select(CARD).eq('is_available', true);
  if (opts.category) query = query.eq('category_id', opts.category);
  if (opts.q) {
    const safe = opts.q.replace(/[%,()]/g, ' ').trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  if (opts.sort === 'price-asc') query = query.order('base_price', { ascending: true });
  else if (opts.sort === 'price-desc') query = query.order('base_price', { ascending: false });
  else query = query.order('name');
  const { data } = await query;
  return (data as unknown as Meal[]) ?? [];
}

export async function getMealBySlug(slug: string): Promise<CatalogMeal | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('meals')
    .select(`${CARD}, recipe_ingredients(ingredient_id, quantity_per_serving, is_removable, ingredients(name)),
             meal_addons(id, name, additional_price, ingredient_id, quantity, is_available, ingredients(name))`)
    .eq('slug', slug).single();
  return (data as unknown as CatalogMeal | null) ?? null;
}
