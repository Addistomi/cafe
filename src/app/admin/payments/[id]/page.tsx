import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireRole, MANAGERS } from '@/features/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatETB } from '@/lib/money';
import { retryPendingTelebirrReceipt } from '@/features/orders/actions';

export const metadata: Metadata = { title: 'Payment details' };

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(MANAGERS);
  const { id } = await params;
  const db = createAdminClient();
  const { data: payment, error } = await db.from('payments').select('*').eq('id', id).maybeSingle();
  if (error || !payment) notFound();

  const [{ data: order }, { data: relatedPayments }, signedResult] = await Promise.all([
    db.from('orders').select('id, order_number, status, total_amount, customer_name_snapshot, phone_snapshot, floor_snapshot, apartment_snapshot, created_at').eq('id', payment.order_id).maybeSingle(),
    db.from('payments').select('id, provider, receipt_reference, transaction_id, amount, currency, status, created_at').eq('order_id', payment.order_id).order('created_at', { ascending: false }),
    payment.receipt_storage_path
      ? db.storage.from('payment-receipts').createSignedUrl(payment.receipt_storage_path, 60 * 10)
      : Promise.resolve({ data: null, error: null }),
  ]);
  const screenshotUrl = signedResult.data?.signedUrl ?? null;
  const verified = payment.status === 'SUCCESS' && (payment.signature_verified || payment.receipt_verified);
  const officialReceiptUrl = payment.receipt_reference && /^[A-Z0-9]{10}$/.test(payment.receipt_reference)
    ? `https://transactioninfo.ethiotelecom.et/receipt/${payment.receipt_reference}`
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/payments" className="text-xs font-bold text-coffee underline">← Back to payment history</Link>
          <p className="eyebrow mt-3">Transaction record</p>
          <h1 className="mt-1 text-3xl font-extrabold text-coffee">Payment details</h1>
          <p className="mt-1 break-all font-mono text-xs text-muted">{payment.id}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${verified ? 'bg-success-soft text-success' : payment.status === 'FAILED' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>{verified ? 'VERIFIED' : payment.status}</span>
      </div>

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Payment amount</p><p className="mt-1 font-display text-3xl font-extrabold text-coffee">{formatETB(payment.amount)}</p></div><p className="rounded-field bg-coffee-soft px-3 py-2 text-xs font-bold text-coffee">{payment.provider}</p></div>
        <div className="grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <p><span className="block text-xs text-muted">Transaction reference</span><strong className="break-all font-mono">{payment.receipt_reference ?? payment.transaction_id ?? 'Not provided'}</strong></p>
          <p><span className="block text-xs text-muted">Merchant order ID</span><strong className="break-all font-mono">{payment.merchant_order_id}</strong></p>
          <p><span className="block text-xs text-muted">Transaction ID</span><strong className="break-all font-mono">{payment.transaction_id ?? '—'}</strong></p>
          <p><span className="block text-xs text-muted">Payment status</span><strong>{payment.status}</strong></p>
          <p><span className="block text-xs text-muted">Created</span><strong>{new Date(payment.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</strong></p>
          <p><span className="block text-xs text-muted">Paid at</span><strong>{payment.paid_at ? new Date(payment.paid_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' }) : 'Not recorded'}</strong></p>
        </div>
        <div className="rounded-field bg-coffee-soft/40 p-4">
          <h2 className="font-bold text-coffee">Verification result</h2>
          <p className="mt-2 text-sm">{payment.receipt_verified ? 'Official Telebirr receipt matched' : payment.signature_verified ? 'Merchant signature verified' : 'No successful verification recorded'}</p>
          {payment.verified_recipient_name && <p className="mt-1 text-sm text-muted">Credited recipient: {payment.verified_recipient_name}</p>}
          {payment.verified_settled_amount !== null && payment.verified_settled_amount !== undefined && <p className="text-sm text-muted">Telebirr settled amount: {formatETB(payment.verified_settled_amount)}</p>}
          {payment.receipt_verified_at && <p className="text-xs text-muted">Verified at {new Date(payment.receipt_verified_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</p>}
          {payment.receipt_verification_message && (
            <p className={`mt-2 text-sm ${payment.receipt_verification_message.startsWith('This appears to be a fake transaction.') ? 'font-bold text-danger' : 'text-muted'}`}>
              {payment.receipt_verification_message.startsWith('This appears to be a fake transaction.') && 'FAKE TRANSACTION DETECTED · '}
              {payment.receipt_verification_message}
            </p>
          )}
        </div>
        {payment.status === 'PENDING' && payment.receipt_reference && (
          <form action={retryPendingTelebirrReceipt.bind(null, payment.id)}>
            <button className="btn-secondary" type="submit">Retry Telebirr verification</button>
          </form>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <div><p className="eyebrow">Submitted evidence</p><h2 className="mt-1 text-lg font-bold text-coffee">Payment screenshot</h2><p className="helper mt-1">Private image link expires after 10 minutes.</p></div>
        {screenshotUrl ? (
          <div className="flex flex-wrap items-start gap-4">
            <a href={screenshotUrl} target="_blank" rel="noreferrer"><Image src={screenshotUrl} width={320} height={400} alt="Resident submitted payment screenshot" unoptimized className="max-h-[420px] w-auto rounded-field border border-line object-contain" /></a>
            <a href={screenshotUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-coffee underline">Open full-size screenshot ↗</a>
          </div>
        ) : <p className="text-sm text-muted">No screenshot is attached to this payment record.</p>}
        {officialReceiptUrl && <a href={officialReceiptUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-coffee underline">Open official Telebirr receipt ↗</a>}
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="eyebrow">Linked order</p><h2 className="mt-1 text-lg font-bold text-coffee">{order?.order_number ?? 'Order unavailable'}</h2></div>{order && <Link href={`/admin/orders/${order.id}`} className="text-sm font-bold text-coffee underline">Open order details →</Link>}</div>
        {order ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p><span className="block text-xs text-muted">Resident</span><strong>{order.customer_name_snapshot}</strong></p>
            <p><span className="block text-xs text-muted">Phone</span><strong>{order.phone_snapshot ?? '—'}</strong></p>
            <p><span className="block text-xs text-muted">Delivery</span><strong>Floor {order.floor_snapshot}, Apartment {order.apartment_snapshot}</strong></p>
            <p><span className="block text-xs text-muted">Order total</span><strong>{formatETB(order.total_amount)}</strong></p>
            <p><span className="block text-xs text-muted">Order status</span><strong>{order.status.replaceAll('_', ' ')}</strong></p>
            <p><span className="block text-xs text-muted">Placed</span><strong>{new Date(order.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</strong></p>
          </div>
        ) : <p className="text-sm text-muted">The linked order could not be loaded.</p>}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold text-coffee">Other payments for this order</h2>
        {(relatedPayments ?? []).length === 0 ? <p className="text-sm text-muted">No other payment records.</p> : (relatedPayments ?? []).map((row) => (
          <Link key={row.id} href={`/admin/payments/${row.id}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
            <span><strong className="text-coffee">{row.receipt_reference ?? row.transaction_id ?? row.provider}</strong><span className="ml-2 text-xs text-muted">{new Date(row.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</span></span>
            <span className="font-semibold">{formatETB(row.amount)} · {row.status} →</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
