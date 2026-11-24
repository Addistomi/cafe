import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatETB } from '@/lib/money';

export const metadata: Metadata = { title: 'Payments' };

export default async function PaymentsPage() {
  const db = createAdminClient();
  const { data, error } = await db.from('payments')
    .select('id, provider, merchant_order_id, transaction_id, amount, currency, status, signature_verified, paid_at, created_at, orders(order_number, customer_name_snapshot, floor_snapshot, apartment_snapshot)')
    .order('created_at', { ascending: false }).limit(100);
  const payments = data ?? [];
  const verified = payments.filter((payment) => payment.status === 'SUCCESS' && payment.signature_verified);
  const verifiedTotal = verified.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const pending = payments.filter((payment) => payment.status === 'PENDING').length;

  return (
    <div className="space-y-5">
      <div><p className="eyebrow">Transactions</p><h2 className="mt-1 text-2xl font-extrabold text-coffee">Payment register</h2><p className="mt-1 text-sm text-muted">Payments are successful only when the server has recorded a verified provider response. A customer redirect is not proof of payment.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Verified payments</p><p className="mt-2 font-display text-2xl font-extrabold text-coffee">{verified.length}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Verified total</p><p className="mt-2 font-display text-2xl font-extrabold text-coffee">{formatETB(verifiedTotal)}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Pending records</p><p className="mt-2 font-display text-2xl font-extrabold text-coffee">{pending}</p></div>
      </div>
      <section className="card overflow-hidden">
        <div className="border-b border-line p-5"><h3 className="font-display text-lg font-bold text-coffee">Recent transactions</h3><p className="helper mt-1">Latest 100 payment records</p></div>
        {error ? <p className="p-5 text-sm text-danger">Payment records could not be loaded.</p> : payments.length === 0 ? <p className="p-6 text-sm text-muted">No payment records yet. Telebirr integration is not active until merchant credentials and callback verification are configured.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-coffee-soft/50 text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Order / resident</th><th className="p-3">Provider reference</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Verification</th><th className="p-3">Date</th></tr></thead>
              <tbody className="divide-y divide-line/70">
                {payments.map((payment) => {
                  const order = payment.orders as unknown as { order_number: string; customer_name_snapshot: string; floor_snapshot: number; apartment_snapshot: string } | null;
                  const success = payment.status === 'SUCCESS';
                  return <tr key={payment.id}>
                    <td className="p-3"><p className="font-bold text-coffee">{order?.order_number ?? 'Order unavailable'}</p><p className="text-xs text-muted">{order?.customer_name_snapshot ?? '—'} · Floor {order?.floor_snapshot ?? '—'}, apt {order?.apartment_snapshot ?? '—'}</p></td>
                    <td className="p-3"><p className="max-w-[190px] truncate font-mono text-xs">{payment.transaction_id ?? payment.merchant_order_id}</p><p className="text-[10px] text-muted">{payment.provider}</p></td>
                    <td className="p-3 font-semibold">{formatETB(payment.amount)}</td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${success ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>{payment.status}</span></td>
                    <td className="p-3">{payment.signature_verified ? <span className="font-semibold text-success">Verified</span> : <span className="text-warning">Not verified</span>}</td>
                    <td className="p-3 text-xs text-muted">{new Date(payment.paid_at ?? payment.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="helper">This screen is a read-only payment register. Payment records must only be created or updated by the verified Telebirr server callback/query integration, or by the explicitly enabled development mock mode.</p>
    </div>
  );
}
