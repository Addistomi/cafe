import { createClient } from '@/lib/supabase/server';
import type { OrderRow } from '@/lib/types';

const ORDER_SELECT = `id, order_number, status, subtotal, delivery_fee, total_amount, customer_name_snapshot,
  floor_snapshot, apartment_snapshot, note, created_at, reservation_expires_at,
  payments(status, signature_verified),
  order_items(id, meal_name_snapshot, quantity, line_total, note,
    order_item_ingredients(ingredient_name_snapshot, was_removed, source_type))`;

export async function listOrders(filter: { statuses?: string[]; limit?: number } = {}): Promise<OrderRow[]> {
  const supabase = await createClient(); // RLS limits residents to their own orders
  let q = supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(filter.limit ?? 50);
  if (filter.statuses) q = q.in('status', filter.statuses);
  const { data } = await q;
  return (data as unknown as OrderRow[]) ?? [];
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).single();
  return (data as unknown as OrderRow | null) ?? null;
}

export const isPaid = (o: OrderRow) => !!o.payments?.some((p) => p.status === 'SUCCESS' && p.signature_verified);

/** What the kitchen needs to read at a glance: "No tomato · Extra: cheese". */
export function describeCustomisation(item: NonNullable<OrderRow['order_items']>[number]): string[] {
  const ings = item.order_item_ingredients;
  const removed = ings.filter((i) => i.was_removed).map((i) => i.ingredient_name_snapshot);
  const extras = ings.filter((i) => i.source_type === 'ADDON').map((i) => i.ingredient_name_snapshot);
  return [
    removed.length ? `Remove: ${removed.join(', ')}` : '',
    extras.length ? `Add: ${extras.join(', ')}` : '',
    item.note ? `Note: ${item.note}` : '',
  ].filter(Boolean);
}
