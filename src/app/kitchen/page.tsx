import type { Metadata } from 'next';
import { requireRole, STAFF } from '@/features/auth/session';
import { describeCustomisation, isPaid, listOrders } from '@/features/orders/queries';
import { OrderActions } from '@/components/order-actions';

export const metadata: Metadata = { title: 'Kitchen' };

export default async function KitchenPage() {
  await requireRole(STAFF);
  const orders = (await listOrders({ statuses: ['AWAITING_PAYMENT', 'PREPARING', 'READY'], limit: 60 })).reverse();
  const columns = [
    { title: 'Newly paid', match: (o: (typeof orders)[number]) => o.status === 'AWAITING_PAYMENT' && isPaid(o) },
    { title: 'Preparing', match: (o: (typeof orders)[number]) => o.status === 'PREPARING' },
    { title: 'Ready for delivery', match: (o: (typeof orders)[number]) => o.status === 'READY' },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold text-coffee">Kitchen</h1>
      <div className="grid gap-5 lg:grid-cols-3">
        {columns.map((col) => {
          const list = orders.filter(col.match);
          return (
            <section key={col.title} className="space-y-3" aria-label={col.title}>
              <h2 className="font-display text-lg font-bold">{col.title} <span className="text-muted">({list.length})</span></h2>
              {list.length === 0 && <p className="card p-4 text-sm text-muted">Nothing here.</p>}
              {list.map((o) => (
                <article key={o.id} className="card space-y-2 p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="font-display text-xl font-extrabold text-coffee">Floor {o.floor_snapshot} · {o.apartment_snapshot}</p>
                    <p className="text-xs text-muted">{o.order_number.split('-').pop()}</p>
                  </div>
                  {o.order_items?.map((i) => (
                    <div key={i.id} className="text-base">
                      <p className="font-semibold">{i.quantity} × {i.meal_name_snapshot}</p>
                      {describeCustomisation(i).map((d) => <p key={d} className="text-sm text-muted">{d}</p>)}
                    </div>
                  ))}
                  <OrderActions orderId={o.id} status={o.status} paid={isPaid(o)} canManage={false} />
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
