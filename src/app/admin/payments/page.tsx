import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatETB } from '@/lib/money';
import Image from 'next/image';
import { retryPendingTelebirrReceipt } from '@/features/orders/actions';

export const metadata: Metadata = { title: 'Payments' };

export default async function PaymentsPage() {
  const db = createAdminClient();
  const { data, error } = await db.from('payments')
    .select('id, provider, merchant_order_id, transaction_id, receipt_reference, receipt_storage_path, receipt_verified, receipt_verified_at, receipt_verification_message, verified_recipient_name, verified_settled_amount, amount, currency, status, signature_verified, paid_at, created_at, orders(order_number, customer_name_snapshot, floor_snapshot, apartment_snapshot)')
    .order('created_at', { ascending: false }).limit(100);
  const payments = data ?? [];
  const verified = payments.filter((payment) => payment.status === 'SUCCESS' && (payment.signature_verified || payment.receipt_verified));
  const verifiedTotal = verified.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const pending = payments.filter((payment) => payment.status === 'PENDING').length;
  const rows = await Promise.all(payments.map(async (payment) => {
    let receiptUrl: string | null = null;
    if (payment.receipt_storage_path) {
      const { data: signed } = await db.storage.from('payment-receipts')
        .createSignedUrl(payment.receipt_storage_path, 60 * 10);
      receiptUrl = signed?.signedUrl ?? null;
    }
    return { payment, receiptUrl };
  }));

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Transactions</p>
        <h2 className="mt-1 text-2xl font-extrabold text-coffee">Payment register</h2>
        <p className="mt-1 text-sm text-muted">Resident screenshots and OCR references are evidence submitted for checking, not proof of payment. Only a matching Telebirr public receipt with the configured recipient and order amount can mark an order as paid.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Verified payments</p><p className="mt-2 font-display text-2xl font-extrabold text-coffee">{verified.length}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Verified total</p><p className="mt-2 font-display text-2xl font-extrabold text-coffee">{formatETB(verifiedTotal)}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Pending records</p><p className="mt-2 font-display text-2xl font-extrabold text-coffee">{pending}</p></div>
      </div>
      <section className="card overflow-hidden">
        <div className="border-b border-line p-5"><h3 className="font-display text-lg font-bold text-coffee">Recent transactions</h3><p className="helper mt-1">Latest 100 payment records · receipt images are private links</p></div>
        {error ? <p className="p-5 text-sm text-danger">Payment records could not be loaded. Apply migration 0003_payment_receipts.sql if this page was just updated.</p> : payments.length === 0 ? <p className="p-6 text-sm text-muted">No payment records yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-coffee-soft/50 text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Order / resident</th><th className="p-3">Submitted reference</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Verification</th><th className="p-3">Screenshot</th><th className="p-3">Official Telebirr receipt</th><th className="p-3">Date</th></tr></thead>
              <tbody className="divide-y divide-line/70">
                {rows.map(({ payment, receiptUrl }) => {
                  const order = payment.orders as unknown as { order_number: string; customer_name_snapshot: string; floor_snapshot: number; apartment_snapshot: string } | null;
                  const success = payment.status === 'SUCCESS' && (payment.signature_verified || payment.receipt_verified);
                  const officialReceiptUrl = payment.receipt_reference && /^[A-Z0-9]{10}$/.test(payment.receipt_reference)
                    ? `https://transactioninfo.ethiotelecom.et/receipt/${payment.receipt_reference}`
                    : null;
                  return <tr key={payment.id}>
                    <td className="p-3"><p className="font-bold text-coffee">{order?.order_number ?? 'Order unavailable'}</p><p className="text-xs text-muted">{order?.customer_name_snapshot ?? '—'} · Floor {order?.floor_snapshot ?? '—'}, apt {order?.apartment_snapshot ?? '—'}</p></td>
                    <td className="p-3"><p className="max-w-[190px] truncate font-mono text-xs">{payment.receipt_reference ?? payment.transaction_id ?? payment.merchant_order_id}</p><p className="text-[10px] text-muted">{payment.provider}</p></td>
                    <td className="p-3 font-semibold">{formatETB(payment.amount)}</td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${success ? 'bg-success-soft text-success' : payment.status === 'FAILED' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>{payment.status}</span></td>
                    <td className="max-w-[250px] p-3">
                      {payment.receipt_verified
                        ? <p className="font-semibold text-success">Telebirr public receipt matched</p>
                        : payment.signature_verified
                          ? <p className="font-semibold text-success">Merchant signature verified</p>
                          : <p className="text-warning">Not verified</p>}
                      {payment.verified_recipient_name && <p className="mt-1 text-xs text-muted">Recipient: {payment.verified_recipient_name}</p>}
                      {payment.verified_settled_amount !== null && payment.verified_settled_amount !== undefined && (
                        <p className="text-xs text-muted">Telebirr settled: {formatETB(payment.verified_settled_amount)}</p>
                      )}
                      {payment.receipt_verification_message && (
                        <p className="mt-1 text-xs text-muted">{payment.receipt_verification_message}</p>
                      )}
                      {payment.status === 'PENDING' && payment.receipt_reference && (
                        <form action={retryPendingTelebirrReceipt.bind(null, payment.id)} className="mt-2">
                          <button className="btn-secondary" type="submit">Retry Telebirr check</button>
                        </form>
                      )}
                    </td>
                    <td className="p-3">
                      {receiptUrl ? (
                        <a href={receiptUrl} target="_blank" rel="noreferrer" title="Open full payment screenshot">
                          <Image src={receiptUrl} width={88} height={104} alt="Resident payment receipt" unoptimized className="h-[76px] w-[64px] rounded border border-line object-cover" />
                        </a>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="p-3">{officialReceiptUrl ? <a className="font-semibold text-accent underline" href={officialReceiptUrl} target="_blank" rel="noreferrer">Open Telebirr receipt</a> : <span className="text-muted">—</span>}</td>
                    <td className="p-3 text-xs text-muted">{new Date(payment.paid_at ?? payment.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="helper">Screenshots and extracted references are stored privately. The screenshot preview is private and links expire after 10 minutes. Pending receipts can be checked again; only a matching Telebirr public receipt or a verified merchant callback marks an order paid.</p>
    </div>
  );
}
