import Link from 'next/link';
import type { Metadata } from 'next';
import { requireRole, MANAGERS } from '@/features/auth/session';
import { describeCustomisation, isPaid, listOrders } from '@/features/orders/queries';
import { OrderActions } from '@/components/order-actions';
import { StatusPill } from '@/components/status-pill';
import { formatETB } from '@/lib/money';

export const metadata: Metadata = { title: 'Orders desk' };

const TABS: { id: string; label: string; statuses: string[] }[] = [
  { id: 'new', label: 'New', statuses: ['PENDING_ACCEPTANCE'] },
  { id: 'payment', label: 'Awaiting payment', statuses: ['AWAITING_PAYMENT'] },
  { id: 'kitchen', label: 'In the kitchen', statuses: ['PREPARING', 'READY', 'OUT_FOR_DELIVERY'] },
  { id: 'done', label: 'Finished', statuses: ['DELIVERED', 'REJECTED', 'CANCELLED', 'EXPIRED'] },
];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole(MANAGERS);
  const { tab = 'new' } = await searchParams;
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const orders = await listOrders({ statuses: active.statuses });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Order management</p>
          <h1 className="text-3xl font-extrabold text-coffee">Orders desk</h1>
          <p className="mt-1 text-sm text-muted">Select any order card to see its full details, items, status history and payment records.</p>
        </div>
        <div className="flex gap-2 text-sm font-semibold">
          <Link href="/admin/residents" className="btn-ghost min-h-9">Residents</Link>
          <Link href="/admin/ingredients" className="btn-ghost min-h-9">Stock</Link>
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto" aria-label="Order tabs">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/orders?tab=${t.id}`} className={t.id === active.id ? 'btn-primary min-h-9 shrink-0' : 'btn-ghost min-h-9 shrink-0'}>{t.label}</Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="card p-8 text-center text-muted">Nothing here right now.</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {orders.map((o) => (
            <li key={o.id} className="card space-y-3 p-4 transition-all hover:border-coffee/25 hover:shadow-md">
              <Link href={`/admin/orders/${o.id}`} className="group block space-y-3 rounded-field focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-coffee group-hover:underline">{o.order_number}</p>
                    <p className="text-sm text-muted">{o.customer_name_snapshot} · Floor {o.floor_snapshot}, apt {o.apartment_snapshot}</p>
                  </div>
                  <div className="text-right"><StatusPill status={o.status} /><p className="mt-1 text-sm font-semibold">{formatETB(o.total_amount)}</p></div>
                </div>
                <ul className="space-y-1 text-sm">
                  {o.order_items?.map((i) => (
                    <li key={i.id}><span className="font-semibold">{i.quantity} × {i.meal_name_snapshot}</span>
                      {describeCustomisation(i).map((d) => <span key={d} className="block text-muted">{d}</span>)}
                    </li>
                  ))}
                </ul>
                <p className="text-xs font-bold text-coffee">View full order details →</p>
              </Link>
              <div className="border-t border-line pt-3">
                <OrderActions orderId={o.id} status={o.status} paid={isPaid(o)} canManage />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
