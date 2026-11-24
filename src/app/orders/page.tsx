import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getProfile } from '@/features/auth/session';
import { listOrders } from '@/features/orders/queries';
import { StatusPill } from '@/components/status-pill';
import { formatETB } from '@/lib/money';

export const metadata: Metadata = { title: 'My orders' };

export default async function OrdersPage() {
  if (!(await getProfile())) redirect('/login');
  const orders = await listOrders();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-extrabold text-coffee">My orders</h1>
      {orders.length === 0 ? (
        <div className="card p-8 text-center"><p className="text-muted">No orders yet.</p><Link href="/menu" className="btn-primary mt-4">See the menu</Link></div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="card flex items-center justify-between gap-3 p-4 hover:bg-coffee-soft/40">
                <div>
                  <p className="font-display font-bold">{o.order_number}</p>
                  <p className="text-sm text-muted">{new Date(o.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</p>
                </div>
                <div className="text-right"><StatusPill status={o.status} /><p className="mt-1 text-sm font-semibold">{formatETB(o.total_amount)}</p></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
