'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile, requireRole, MANAGERS, STAFF } from '@/features/auth/session';
import { priceOrder, PricingError } from './pricing';
import type { CatalogMeal } from '@/lib/types';

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; staleMealIds?: string[] };

const placeSchema = z.object({
  floor: z.number().int().min(4).max(10),
  apartment: z.string().trim().min(1).max(10),
  note: z.string().max(300).optional(),
  lines: z.array(z.object({
    mealId: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
    removedIngredientIds: z.array(z.string().uuid()),
    addonIds: z.array(z.string().uuid()),
    note: z.string().max(200).optional(),
  })).min(1).max(30),
});

const MEAL_SELECT = `id, name, slug, description, base_price, image_url, is_available, preparation_minutes,
  recipe_ingredients(ingredient_id, quantity_per_serving, is_removable, ingredients(name)),
  meal_addons(id, name, additional_price, ingredient_id, quantity, is_available, ingredients(name))`;

export async function placeOrder(input: unknown): Promise<ActionResult<{ orderId: string }>> {
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Check your delivery details and cart.' };

  const profile = await getProfile();
  if (!profile) return { ok: false, error: 'Sign in to place an order.' };
  if (profile.role !== 'CUSTOMER' || profile.account_status !== 'ACTIVE')
    return { ok: false, error: 'Your account is waiting for café approval.' };

  const db = createAdminClient();
  const { data: meals, error: loadError } = await db.from('meals').select(MEAL_SELECT)
    .in('id', parsed.data.lines.map((line) => line.mealId)).is('archived_at', null);
  if (loadError) return { ok: false, error: 'Could not load the menu. Try again.' };

  try {
    const priced = priceOrder(meals as unknown as CatalogMeal[], parsed.data.lines, Number(process.env.DELIVERY_FEE_ETB ?? 0));
    const { data: orderId, error } = await db.rpc('create_order', {
      p_customer: profile.id, p_order: { ...priced, floor: parsed.data.floor, apartment: parsed.data.apartment, note: parsed.data.note ?? '' },
    });
    if (error) return { ok: false, error: 'Could not place your order. Try again.' };
    revalidatePath('/orders'); revalidatePath('/admin'); revalidatePath('/admin/orders');
    return { ok: true, orderId: orderId as string };
  } catch (error) {
    if (error instanceof PricingError) return { ok: false, error: error.message, staleMealIds: error.mealIds };
    throw error;
  }
}

const friendly = (message: string): string => {
  if (message.startsWith('INSUFFICIENT_STOCK')) return message.replace('INSUFFICIENT_STOCK: ', 'Not enough stock: ');
  const messages: Record<string, string> = {
    ORDER_NOT_PENDING: 'This order was already handled.',
    REASON_REQUIRED: 'Enter a reason first.',
    PAYMENT_NOT_VERIFIED: 'Payment is not verified yet.',
    ORDER_NOT_READY_TO_PREPARE: 'This order is not ready to prepare.',
  };
  return messages[message] ?? 'Something went wrong. Try again.';
};

async function staffRpc(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const { error } = await createAdminClient().rpc(fn, args);
  for (const path of ['/admin', '/admin/orders', '/admin/payments', '/kitchen', '/orders']) revalidatePath(path);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function acceptOrder(orderId: string) {
  const actor = await requireRole(MANAGERS);
  return staffRpc('accept_order', { p_order: orderId, p_actor: actor.id, p_hold_minutes: Number(process.env.RESERVATION_HOLD_MINUTES ?? 30) });
}
export async function rejectOrder(orderId: string, reason: string) {
  const actor = await requireRole(MANAGERS);
  return staffRpc('reject_order', { p_order: orderId, p_actor: actor.id, p_reason: reason });
}
export async function cancelOrder(orderId: string, reason: string) {
  const actor = await requireRole(MANAGERS);
  return staffRpc('transition_order', { p_order: orderId, p_to: 'CANCELLED', p_actor: actor.id, p_reason: reason });
}
export async function startPreparing(orderId: string) {
  const actor = await requireRole(STAFF);
  return staffRpc('start_preparing', { p_order: orderId, p_actor: actor.id });
}
export async function advanceOrder(orderId: string, to: 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED') {
  const actor = await requireRole(STAFF);
  return staffRpc('transition_order', { p_order: orderId, p_to: to, p_actor: actor.id });
}
export async function approveResident(userId: string): Promise<void> {
  await requireRole(MANAGERS);
  const { error } = await createAdminClient().from('profiles')
    .update({ account_status: 'ACTIVE' }).eq('id', userId).eq('role', 'CUSTOMER');
  if (error) throw new Error('The resident could not be approved.');
  revalidatePath('/admin');
  revalidatePath('/admin/residents');
}

/**
 * Resident receipt intake only. This deliberately creates a PENDING payment record.
 * OCR text/reference is user-correctable and is NOT proof of payment. A verified
 * Telebirr query/callback must be implemented before any record becomes SUCCESS.
 */
export async function submitPaymentReceipt(orderId: string, formData: FormData): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile || profile.role !== 'CUSTOMER' || profile.account_status !== 'ACTIVE')
    return { ok: false, error: 'An active resident account is required.' };
  if (!z.string().uuid().safeParse(orderId).success)
    return { ok: false, error: 'Invalid order.' };

  const reference = String(formData.get('reference') ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{5,63}$/.test(reference))
    return { ok: false, error: 'Enter the transaction reference shown on your receipt.' };

  const file = formData.get('receipt');
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: 'Choose your Telebirr payment screenshot.' };
  const allowed = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
  const extension = allowed.get(file.type);
  if (!extension) return { ok: false, error: 'Upload a JPG, PNG or WebP image.' };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: 'The screenshot must be 5 MB or smaller.' };
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const validImage =
    (file.type === 'image/jpeg' && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) ||
    (file.type === 'image/png' && header.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') ||
    (file.type === 'image/webp' && String.fromCharCode(...header.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...header.slice(8, 12)) === 'WEBP');
  if (!validImage) return { ok: false, error: 'The uploaded file does not match a supported image format.' };

  const db = createAdminClient();
  const { data: order, error: orderError } = await db.from('orders')
    .select('id, customer_id, status, total_amount, currency')
    .eq('id', orderId).single();
  if (orderError || !order || order.customer_id !== profile.id || order.status !== 'AWAITING_PAYMENT')
    return { ok: false, error: 'This order is not available for payment submission.' };

  const { data: successful } = await db.from('payments').select('id')
    .eq('order_id', orderId).eq('status', 'SUCCESS').eq('signature_verified', true).maybeSingle();
  if (successful) return { ok: false, error: 'This order has already been paid.' };

  const { data: pending } = await db.from('payments').select('id')
    .eq('order_id', orderId).eq('status', 'PENDING').not('receipt_storage_path', 'is', null).maybeSingle();
  if (pending) return { ok: false, error: 'A receipt is already submitted for this order and is awaiting verification.' };

  const storagePath = `${profile.id}/${orderId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await db.storage.from('payment-receipts').upload(storagePath, file, {
    contentType: file.type, cacheControl: '3600', upsert: false,
  });
  if (uploadError) return { ok: false, error: 'The receipt could not be uploaded. Please try again.' };

  const { error: insertError } = await db.from('payments').insert({
    order_id: orderId,
    provider: 'TELEBIRR',
    merchant_order_id: `RECEIPT-${randomUUID()}`,
    amount: order.total_amount,
    currency: order.currency ?? 'ETB',
    status: 'PENDING',
    signature_verified: false,
    receipt_reference: reference,
    receipt_storage_path: storagePath,
  });
  if (insertError) {
    await db.storage.from('payment-receipts').remove([storagePath]);
    const message = insertError.code === '23505'
      ? 'This Telebirr reference has already been submitted. Check the reference and contact the café if you believe this is an error.'
      : 'Your receipt could not be saved. Please try again.';
    return { ok: false, error: message };
  }

  for (const path of ['/admin', '/admin/payments', '/orders', `/orders/${orderId}`]) revalidatePath(path);
  return { ok: true };
}

/** Development-only payment simulator. Never enabled in production. */
export async function simulatePayment(orderId: string): Promise<ActionResult> {
  if (process.env.PAYMENTS_MODE !== 'mock' || process.env.NODE_ENV === 'production')
    return { ok: false, error: 'Mock payments are disabled.' };
  const profile = await getProfile();
  if (!profile || profile.role !== 'CUSTOMER' || profile.account_status !== 'ACTIVE') return { ok: false, error: 'An active resident account is required.' };

  const db = createAdminClient();
  const { data: order } = await db.from('orders').select('id, customer_id, status, total_amount, currency').eq('id', orderId).single();
  if (!order || order.customer_id !== profile.id || order.status !== 'AWAITING_PAYMENT') return { ok: false, error: 'This order cannot be paid right now.' };

  const { data: existing } = await db.from('payments').select('id').eq('order_id', orderId).eq('status', 'SUCCESS').eq('signature_verified', true).maybeSingle();
  if (existing) return { ok: false, error: 'This order has already been paid.' };

  const ref = 'MOCK-' + orderId.slice(0, 8) + '-' + Date.now();
  const { error } = await db.from('payments').insert({
    order_id: orderId, merchant_order_id: ref, transaction_id: ref, amount: order.total_amount,
    currency: order.currency ?? 'ETB', status: 'SUCCESS', signature_verified: true, paid_at: new Date().toISOString(),
  });
  for (const path of ['/admin', '/admin/orders', '/admin/payments', '/kitchen', '/orders/' + orderId]) revalidatePath(path);
  return error ? { ok: false, error: 'Payment could not be recorded. It may already have been paid.' } : { ok: true };
}
