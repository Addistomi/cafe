'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile, requireRole, MANAGERS, STAFF } from '@/features/auth/session';
import { priceOrder, PricingError } from './pricing';
import type { CatalogMeal } from '@/lib/types';
import { verifyTelebirrReceiptForOrder, type TelebirrVerification } from '@/lib/telebirr/receipt';

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
function receiptPaymentFields(verification: TelebirrVerification) {
  const verified = verification.outcome === 'VERIFIED';
  const failed = verification.outcome === 'REJECTED';
  const receipt = verification.receipt;

  return {
    status: verified ? 'SUCCESS' : failed ? 'FAILED' : 'PENDING',
    signature_verified: false,
    receipt_verified: verified,
    receipt_verified_at: verified ? new Date().toISOString() : null,
    receipt_verification_message: verified
      ? 'The Telebirr public receipt matched the order reference, recipient and settled amount.'
      : verification.reason,
    verified_recipient_name: receipt?.creditedPartyName ?? null,
    verified_settled_amount: receipt?.settledAmount ?? null,
    transaction_id: verified ? receipt?.receiptNo ?? null : null,
    paid_at: verified ? new Date().toISOString() : null,
  };
}

/**
 * Resident receipt intake and official Telebirr receipt verification.
 * The screenshot is stored first so the owner can inspect it even when the
 * upstream Telebirr receipt service is temporarily unavailable.
 */
export async function submitPaymentReceipt(
  orderId: string,
  formData: FormData,
): Promise<ActionResult<{ verification: 'VERIFIED' | 'REJECTED' | 'PENDING'; message: string }>> {
  const profile = await getProfile();
  if (!profile || profile.role !== 'CUSTOMER' || profile.account_status !== 'ACTIVE')
    return { ok: false, error: 'An active resident account is required.' };
  if (!z.string().uuid().safeParse(orderId).success)
    return { ok: false, error: 'Invalid order.' };

  const reference = String(formData.get('reference') ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(reference))
    return { ok: false, error: 'Enter the 10-character Telebirr transaction reference shown on your receipt.' };

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

  const { data: successful } = await db.from('payments').select('id, signature_verified, receipt_verified')
    .eq('order_id', orderId).eq('status', 'SUCCESS');
  if ((successful ?? []).some((payment) => payment.signature_verified || payment.receipt_verified))
    return { ok: false, error: 'This order has already been paid.' };

  const { data: pending } = await db.from('payments').select('id')
    .eq('order_id', orderId).eq('status', 'PENDING')
    .not('receipt_storage_path', 'is', null).maybeSingle();
  if (pending) return { ok: false, error: 'A receipt is already submitted for this order and is awaiting verification. The café can retry the Telebirr check from Admin → Payments.' };

  const storagePath = profile.id + '/' + orderId + '/' + randomUUID() + '.' + extension;
  const { error: uploadError } = await db.storage.from('payment-receipts').upload(storagePath, file, {
    contentType: file.type, cacheControl: '3600', upsert: false,
  });
  if (uploadError) return { ok: false, error: 'The receipt could not be uploaded. Please try again.' };

  // Never trust the user-supplied screenshot, OCR, or QR as proof. Query
  // Telebirr by the reference and compare its own receipt with this order.
  const verification = await verifyTelebirrReceiptForOrder(reference, Number(order.total_amount));
  const verificationFields = receiptPaymentFields(verification);
  const insertPayload = {
    order_id: orderId,
    provider: 'TELEBIRR',
    merchant_order_id: 'RECEIPT-' + randomUUID(),
    amount: order.total_amount,
    currency: order.currency ?? 'ETB',
    receipt_reference: reference,
    receipt_storage_path: storagePath,
    ...verificationFields,
  };

  const { error: insertError } = await db.from('payments').insert(insertPayload);
  if (insertError) {
    // Preserve the screenshot for the owner even if a reference has already
    // been submitted or a concurrent submission won the unique-index race.
    if (insertError.code === '23505') {
      const duplicatePayload = {
        order_id: orderId,
        provider: 'TELEBIRR',
        merchant_order_id: 'RECEIPT-' + randomUUID(),
        amount: order.total_amount,
        currency: order.currency ?? 'ETB',
        status: 'FAILED',
        signature_verified: false,
        receipt_verified: false,
        receipt_reference: null,
        receipt_storage_path: storagePath,
        receipt_verification_message: 'This transaction reference has already been submitted. The screenshot has been saved for owner review.',
      };
      const { error: duplicateSaveError } = await db.from('payments').insert(duplicatePayload);
      if (duplicateSaveError) {
        await db.storage.from('payment-receipts').remove([storagePath]);
        return { ok: false, error: 'This reference was already submitted and the additional screenshot could not be saved.' };
      }
      for (const path of ['/admin', '/admin/payments', '/orders', '/orders/' + orderId]) revalidatePath(path);
      return {
        ok: true,
        verification: 'REJECTED',
        message: 'This transaction reference has already been submitted. The screenshot was saved for the café to review.',
      };
    }

    await db.storage.from('payment-receipts').remove([storagePath]);
    return { ok: false, error: 'Your receipt could not be saved. Please try again.' };
  }

  for (const path of ['/admin', '/admin/orders', '/admin/payments', '/kitchen', '/orders', '/orders/' + orderId]) {
    revalidatePath(path);
  }

  return {
    ok: true,
    verification: verification.outcome,
    message: verification.outcome === 'VERIFIED'
      ? 'Telebirr confirmed your payment. Your order is now marked as paid.'
      : verification.reason,
  };
}

/** Owner/manager retry for a receipt that is still pending after an upstream timeout or parse issue. */
export async function retryPendingTelebirrReceipt(paymentId: string, _formData: FormData): Promise<void> {
  await requireRole(MANAGERS);
  if (!z.string().uuid().safeParse(paymentId).success) {
    throw new Error('Invalid payment record.');
  }

  const db = createAdminClient();
  const { data: payment, error: paymentError } = await db.from('payments')
    .select('id, order_id, receipt_reference, status, receipt_storage_path, orders(total_amount)')
    .eq('id', paymentId).single();

  if (paymentError || !payment || payment.status !== 'PENDING' ||
      !payment.receipt_reference || !payment.receipt_storage_path) {
    throw new Error('This payment is not a pending Telebirr receipt.');
  }

  const order = payment.orders as unknown as { total_amount: number } | null;
  if (!order) throw new Error('The order for this payment could not be found.');

  const verification = await verifyTelebirrReceiptForOrder(
    payment.receipt_reference,
    Number(order.total_amount),
  );

  const update = receiptPaymentFields(verification);
  const { error: updateError } = await db.from('payments')
    .update(update)
    .eq('id', paymentId)
    .eq('status', 'PENDING');

  if (updateError) {
    throw new Error(updateError.code === '23505'
      ? 'This transaction reference has already been used by another successful payment.'
      : 'The Telebirr verification result could not be saved.');
  }

  for (const path of ['/admin', '/admin/orders', '/admin/payments', '/kitchen', '/orders', '/orders/' + payment.order_id]) {
    revalidatePath(path);
  }
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

  const { data: existing } = await db.from('payments').select('id, signature_verified, receipt_verified')
    .eq('order_id', orderId).eq('status', 'SUCCESS');
  if ((existing ?? []).some((payment) => payment.signature_verified || payment.receipt_verified))
    return { ok: false, error: 'This order has already been paid.' };

  const ref = 'MOCK-' + orderId.slice(0, 8) + '-' + Date.now();
  const { error } = await db.from('payments').insert({
    order_id: orderId, merchant_order_id: ref, transaction_id: ref, amount: order.total_amount,
    currency: order.currency ?? 'ETB', status: 'SUCCESS', signature_verified: true, paid_at: new Date().toISOString(),
  });
  for (const path of ['/admin', '/admin/orders', '/admin/payments', '/kitchen', '/orders/' + orderId]) revalidatePath(path);
  return error ? { ok: false, error: 'Payment could not be recorded. It may already have been paid.' } : { ok: true };
}
