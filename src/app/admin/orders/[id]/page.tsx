import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireRole, MANAGERS } from '@/features/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatETB } from '@/lib/money';
import { StatusPill } from '@/components/status-pill';
import { OrderActions } from '@/components/order-actions';
import type { OrderStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Order details' };

type PaymentRecord = {
  id: string;
  provider: string;
  merchant_order_id: string;
  transaction_id: string | null;
  receipt_reference: string | null;
  receipt_storage_path: string | null;
  receipt_verified: boolean;
  receipt_verified_at: string | null;
  receipt_verification_message: string | null;
  verified_recipient_name: string | null;
  verified_settled_amount: number | null;
  amount: number;
  currency: string;
  status: string;
  signature_verified: boolean;
  paid_at: string | null;
  created_at: string;
};

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(MANAGERS);
  const { id } = await params;
  const db = createAdminClient();
  const { data: order, error } = await db.from('orders').select('*').eq('id', id).maybeSingle();
  if (error || !order) notFound();

  const [itemsResult, paymentsResult, historyResult, customerResult] = await Promise.all([
    db.from('order_items')
      .select('id, meal_name_snapshot, unit_price_snapshot, quantity, line_total, note, order_item_ingredients(id, ingredient_name_snapshot, quantity_per_serving_snapshot, total_quantity, was_removed, source_type)')
      .eq('order_id', id),
    db.from('payments').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    db.from('order_status_history').select('*').eq('order_id', id).order('created_at', { ascending: true }),
    db.from('profiles').select('full_name, phone, floor, apartment_number').eq('id', order.customer_id).maybeSingle(),
  ]);

  const items = itemsResult.data ?? [];
  const payments = (paymentsResult.data ?? []) as PaymentRecord[];
  const history = historyResult.data ?? [];
  const customer = customerResult.data;
  const paid = payments.some((payment) => payment.status === 'SUCCESS' && (payment.signature_verified || payment.receipt_verified));
  const actorIds = [...new Set(history.map((event) => event.changed_by).filter((value): value is string => Boolean(value)))];
  const { data: actors } = actorIds.length
    ? await db.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const actorNames = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name]));

  const paymentRows = await Promise.all(payments.map(async (payment) => {
    let screenshotUrl: string | null = null;
    if (payment.receipt_storage_path) {
      const { data } = await db.storage.from('payment-receipts')
        .createSignedUrl(payment.receipt_storage_path, 60 * 10);
      screenshotUrl = data?.signedUrl ?? null;
    }
    return { payment, screenshotUrl };
  }));

  const backTab = order.status === 'AWAITING_PAYMENT' ? 'payment'
    : ['DELIVERED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(order.status) ? 'done'
    : ['PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(order.status) ? 'kitchen'
    : 'new';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/admin/orders?tab=${backTab}`} className="text-xs font-bold text-coffee underline">← Back to orders</Link>
          <p className="eyebrow mt-3">Full order record</p>
          <h1 className="mt-1 text-3xl font-extrabold text-coffee">{order.order_number}</h1>
          <p className="mt-1 text-sm text-muted">Placed {new Date(order.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</p>
        </div>
        <div className="text-right"><StatusPill status={order.status as OrderStatus} /><p className="mt-2 font-display text-2xl font-extrabold text-coffee">{formatETB(order.total_amount)}</p></div>
      </div>

      <section className="card space-y-4 p-5">
        <div><p className="eyebrow">Resident & delivery</p><h2 className="mt-1 text-lg font-bold text-coffee">Customer information</h2></div>
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p><span className="block text-xs text-muted">Resident name</span><strong>{order.customer_name_snapshot || customer?.full_name || '—'}</strong></p>
          <p><span className="block text-xs text-muted">Phone number</span><strong>{order.phone_snapshot || customer?.phone || '—'}</strong></p>
          <p><span className="block text-xs text-muted">Floor</span><strong>{order.floor_snapshot}</strong></p>
          <p><span className="block text-xs text-muted">Apartment</span><strong>{order.apartment_snapshot}</strong></p>
        </div>
        {order.note && <div className="rounded-field bg-coffee-soft/40 p-3 text-sm"><p className="text-xs font-semibold text-muted">Order note</p><p className="mt-1">{order.note}</p></div>}
      </section>

      <section className="card space-y-4 p-5">
        <div><p className="eyebrow">Order contents</p><h2 className="mt-1 text-lg font-bold text-coffee">Items ordered</h2></div>
        {items.length === 0 ? <p className="text-sm text-muted">No item records were found.</p> : items.map((item) => {
          const ingredients = item.order_item_ingredients ?? [];
          const removed = ingredients.filter((ingredient: { was_removed: boolean }) => ingredient.was_removed);
          const extras = ingredients.filter((ingredient: { source_type: string }) => ingredient.source_type === 'ADDON');
          return (
            <div key={item.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
              <div className="flex justify-between gap-3">
                <div><p className="font-semibold text-coffee">{item.quantity} × {item.meal_name_snapshot}</p><p className="text-xs text-muted">{formatETB(item.unit_price_snapshot)} each</p></div>
                <p className="font-bold">{formatETB(item.line_total)}</p>
              </div>
              {removed.length > 0 && <p className="mt-2 text-xs text-muted">Remove: {removed.map((ingredient: { ingredient_name_snapshot: string }) => ingredient.ingredient_name_snapshot).join(', ')}</p>}
              {extras.length > 0 && <p className="mt-1 text-xs text-muted">Extras: {extras.map((ingredient: { ingredient_name_snapshot: string }) => ingredient.ingredient_name_snapshot).join(', ')}</p>}
              {item.note && <p className="mt-1 text-xs text-muted">Item note: {item.note}</p>}
            </div>
          );
        })}
        <div className="space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatETB(order.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Delivery fee</span><span>{formatETB(order.delivery_fee)}</span></div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-extrabold"><span>Total</span><span>{formatETB(order.total_amount)}</span></div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="eyebrow">Order workflow</p><h2 className="mt-1 text-lg font-bold text-coffee">Update order status</h2></div><StatusPill status={order.status as OrderStatus} /></div>
        <OrderActions orderId={order.id} status={order.status as OrderStatus} paid={paid} canManage />
        <div className="border-t border-line pt-4">
          <h3 className="mb-3 text-sm font-bold text-coffee">Status history</h3>
          {history.length === 0 ? <p className="text-sm text-muted">No status history recorded.</p> : (
            <ol className="space-y-3">
              {history.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                  <div><p className="font-semibold text-coffee">{event.from_status ? event.from_status.replaceAll('_', ' ') + ' → ' : ''}{event.to_status.replaceAll('_', ' ')}</p>
                    <p className="text-xs text-muted">{new Date(event.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })} · {event.changed_by ? actorNames.get(event.changed_by) ?? 'Staff member' : 'System / resident'}</p>
                    {event.reason && <p className="mt-1 text-xs text-muted">Reason: {event.reason}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-2"><div><p className="eyebrow">Payment history</p><h2 className="mt-1 text-lg font-bold text-coffee">Transactions for this order</h2></div><span className="rounded-full bg-coffee-soft px-2.5 py-1 text-xs font-bold text-coffee">{payments.length} record(s)</span></div>
        {paymentRows.length === 0 ? <p className="text-sm text-muted">No payment records have been submitted for this order.</p> : (
          <div className="space-y-4">
            {paymentRows.map(({ payment, screenshotUrl }) => {
              const officialReceiptUrl = payment.receipt_reference && /^[A-Z0-9]{10}$/.test(payment.receipt_reference)
                ? `https://transactioninfo.ethiotelecom.et/receipt/${payment.receipt_reference}`
                : null;
              return (
                <div key={payment.id} className="rounded-field border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-bold text-coffee">{payment.provider} · {payment.receipt_reference ?? payment.transaction_id ?? payment.merchant_order_id}</p><p className="mt-1 text-xs text-muted">{new Date(payment.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</p></div>
                    <div className="text-right"><p className="font-bold">{formatETB(payment.amount)}</p><p className={`mt-1 text-xs font-bold ${payment.status === 'SUCCESS' ? 'text-success' : payment.status === 'FAILED' ? 'text-danger' : 'text-warning'}`}>{payment.status}</p></div>
                  </div>
                  {payment.verified_recipient_name && <p className="mt-2 text-xs text-muted">Recipient: {payment.verified_recipient_name}</p>}
                  {payment.verified_settled_amount !== null && payment.verified_settled_amount !== undefined && <p className="text-xs text-muted">Settled amount: {formatETB(payment.verified_settled_amount)}</p>}
                  {payment.receipt_verification_message && <p className={`mt-2 text-xs ${payment.receipt_verification_message.startsWith('This appears to be a fake transaction.') ? 'font-semibold text-danger' : 'text-muted'}`}>{payment.receipt_verification_message}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {screenshotUrl && <a href={screenshotUrl} target="_blank" rel="noreferrer" className="block"><Image src={screenshotUrl} width={96} height={120} alt="Payment receipt screenshot" unoptimized className="h-24 w-20 rounded border border-line object-cover" /><span className="mt-1 block text-xs font-bold text-coffee underline">Open screenshot</span></a>}
                    {officialReceiptUrl && <a href={officialReceiptUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-coffee underline">Official Telebirr receipt ↗</a>}
                    <Link href={`/admin/payments/${payment.id}`} className="text-xs font-bold text-coffee underline">Open payment details →</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Link href="/admin/payments" className="btn-ghost inline-flex">Open full payment history</Link>
      </section>
    </div>
  );
}
