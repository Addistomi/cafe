'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireRole, MANAGERS } from '@/features/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

const recipeRow = z.object({
  ingredient_id: z.string().uuid(),
  quantity_per_serving: z.number().positive().max(100000),
  is_removable: z.boolean(),
});
const addonRow = z.object({
  name: z.string().trim().min(1).max(80),
  additional_price: z.number().min(0).max(100000),
  ingredient_id: z.string().uuid(),
  quantity: z.number().positive().max(100000),
  is_available: z.boolean(),
});

const mealSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(2).max(90),
  slug: z.string().trim().min(2).max(110).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category_id: z.string().uuid(),
  description: z.string().max(500).nullable(),
  base_price: z.number().positive().max(1000000),
  preparation_minutes: z.number().int().min(1).max(360).nullable(),
  image_url: z.string().url().max(1000).or(z.literal('')).nullable(),
  is_available: z.boolean(),
  recipe: z.array(recipeRow).min(1).max(60),
  addons: z.array(addonRow).max(30),
});

export type MealEditorInput = z.infer<typeof mealSchema>;

export async function saveMeal(input: unknown) {
  await requireRole(MANAGERS);
  const parsed = mealSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Check the meal details.' };

  const db = createAdminClient();
  const { data, error } = await db.rpc('upsert_meal', {
    p_meal_id: parsed.data.id,
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_category_id: parsed.data.category_id,
    p_description: parsed.data.description,
    p_base_price: parsed.data.base_price,
    p_preparation_minutes: parsed.data.preparation_minutes,
    p_image_url: parsed.data.image_url,
    p_is_available: parsed.data.is_available,
    p_recipe: parsed.data.recipe,
    p_addons: parsed.data.addons,
  });
  if (error) {
    const message = error.message.includes('meals_slug_key') ? 'That meal URL is already used. Choose another name.' :
      error.message.includes('MEAL_RECIPE_REQUIRED') ? 'Add at least one ingredient to the recipe.' :
      error.message.includes('ADDON_') ? 'Check each extra name, price, ingredient and quantity.' :
      'The meal could not be saved. Check the category, ingredients and unique meal URL.';
    return { ok: false as const, error: message };
  }

  revalidatePath('/'); revalidatePath('/menu'); revalidatePath('/admin'); revalidatePath('/admin/menu');
  return { ok: true as const, mealId: data as string };
}

export async function setMealAvailability(mealId: string, available: boolean) {
  await requireRole(MANAGERS);
  if (!z.string().uuid().safeParse(mealId).success) return { ok: false as const, error: 'Invalid meal.' };
  const { error } = await createAdminClient().from('meals').update({ is_available: available }).eq('id', mealId).is('archived_at', null);
  if (error) return { ok: false as const, error: 'Meal availability could not be changed.' };
  revalidatePath('/'); revalidatePath('/menu'); revalidatePath('/admin/menu');
  return { ok: true as const };
}

export async function createIngredient(input: {
  name: string; baseUnit: 'GRAM' | 'MILLILITRE' | 'PIECE'; initialQuantity: number; minimumQuantity: number;
}) {
  const actor = await requireRole(MANAGERS);
  const schema = z.object({
    name: z.string().trim().min(2).max(80),
    baseUnit: z.enum(['GRAM', 'MILLILITRE', 'PIECE']),
    initialQuantity: z.number().min(0).max(100000000),
    minimumQuantity: z.number().min(0).max(100000000),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'Enter a name, unit and valid stock quantities.' };
  const { data, error } = await createAdminClient().rpc('create_ingredient', {
    p_name: parsed.data.name, p_unit: parsed.data.baseUnit,
    p_initial_quantity: parsed.data.initialQuantity, p_minimum_quantity: parsed.data.minimumQuantity,
    p_actor: actor.id,
  });
  if (error) {
    const message = error.code === '23505' ? 'An ingredient with that name already exists.' :
      'Ingredient could not be created. Apply migration 0002_admin_tools.sql if it has not been applied.';
    return { ok: false as const, error: message };
  }
  revalidatePath('/admin'); revalidatePath('/admin/ingredients'); revalidatePath('/admin/menu');
  return { ok: true as const, ingredientId: data as string };
}

export async function adjustIngredientStock(input: {
  ingredientId: string; quantity: number; direction: 'IN' | 'OUT'; note: string;
}) {
  const actor = await requireRole(MANAGERS);
  const schema = z.object({
    ingredientId: z.string().uuid(), quantity: z.number().positive().max(1000000),
    direction: z.enum(['IN', 'OUT']), note: z.string().trim().max(240),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'Enter a valid quantity and note.' };
  if (parsed.data.direction === 'OUT' && !parsed.data.note) return { ok: false as const, error: 'A reason is required when removing stock.' };

  const { error } = await createAdminClient().rpc('adjust_ingredient_stock', {
    p_ingredient_id: parsed.data.ingredientId, p_quantity: parsed.data.quantity,
    p_direction: parsed.data.direction, p_note: parsed.data.note, p_actor: actor.id,
  });
  if (error) {
    const message = error.message.includes('INSUFFICIENT_AVAILABLE_STOCK') ? 'That adjustment would remove stock already reserved for accepted orders.' :
      error.message.includes('INGREDIENT_NOT_FOUND') ? 'Ingredient not found.' :
      'Stock could not be updated. Apply migration 0002_admin_tools.sql if it has not been applied.';
    return { ok: false as const, error: message };
  }
  revalidatePath('/admin'); revalidatePath('/admin/ingredients');
  return { ok: true as const };
}
