import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { MenuManager } from './menu-manager';

export const metadata: Metadata = { title: 'Menu manager' };

export default async function MenuManagementPage() {
  const db = createAdminClient();
  const [categoryResult, ingredientResult, mealResult] = await Promise.all([
    db.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
    db.from('ingredients').select('id, name, base_unit').eq('is_active', true).order('name'),
    db.from('meals').select('id, name, slug, description, category_id, base_price, preparation_minutes, image_url, is_available, recipe_ingredients(ingredient_id, quantity_per_serving, is_removable), meal_addons(id, name, additional_price, ingredient_id, quantity, is_available)').is('archived_at', null).order('name'),
  ]);

  return (
    <div className="space-y-5">
      <div><p className="eyebrow">Catalogue and recipes</p><h2 className="mt-1 text-2xl font-extrabold text-coffee">Menu manager</h2><p className="mt-1 max-w-2xl text-sm text-muted">Create meals, set prices and define the exact ingredient quantities used for one serving. The recipe drives stock reservations and kitchen instructions.</p></div>
      <MenuManager categories={categoryResult.data ?? []} ingredients={ingredientResult.data ?? []} meals={(mealResult.data ?? []) as never} />
    </div>
  );
}
