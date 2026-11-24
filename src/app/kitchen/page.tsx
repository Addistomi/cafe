import type { Metadata } from 'next';
import { requireRole, STAFF } from '@/features/auth/session';
import { describeCustomisation, isPaid, listOrders } from '@/features/orders/queries';
import { OrderActions } from '@/components/order-actions';

export const metadata: Metadata = { title: 'Kitchen' };

export default async function KitchenPage() {
  await requireRole(STAFF);
  const orders = (await listOrders({ statuses: ['AWAITING_PAYMENT', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'], limit: 80 })).reverse();
  const columns = [
    { title: 'Newly paid', match: (o: (typeof orders)[number]) => o.status === 'AWAITING_PAYMENT' && isPaid(o), note: 'Verified payments ready to cook' },
    { title: 'Preparing', match: (o: (typeof orders)[number]) => o.status === 'PREPARING', note: 'Currently being prepared' },
    { title: 'Ready for delivery', match: (o: (typeof orders)[number]) => o.status === 'READY', note: 'Waiting to leave the kitchen' },
    { title: 'Out for delivery', match: (o: (typeof orders)[number]) => o.status === 'OUT_FOR_DELIVERY', note: 'On the way to the apartment' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Live operations</p><h1 className="mt-1 text-3xl font-extrabold text-coffee">Kitchen board</h1><p className="mt-1 text-sm text-muted">Prepare paid orders and keep delivery status up to date.</p></div>
        <span className="rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success">{orders.length} active orders</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const list = orders.filter(column.match);
          return (
            <section key={column.title} className="min-w-0 space-y-3" aria-label={column.title}>
              <div className="border-b border-line pb-3">
                <div className="flex items-center justify-between gap-2"><h2 className="font-display text-lg font-bold text-coffee">{column.title}</h2><span className="rounded-full bg-coffee-soft px-2.5 py-1 text-xs font-bold text-coffee">{list.length}</span></div>
                <p className="mt-1 text-xs text-muted">{column.note}</p>
              </div>
              {list.length === 0 && <p className="card p-4 text-sm text-muted">No orders in this stage.</p>}
              {list.map((order) => (
                <article key={order.id} className="card space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-display text-lg font-extrabold text-coffee">Floor {order.floor_snapshot} · {order.apartment_snapshot}</p><p className="text-xs text-muted">{order.order_number}</p></div>
                    <p className="text-xs font-semibold text-muted">{new Date(order.created_at).toLocaleTimeString('en-GB', { timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</p>
                  </div>
                  <div className="space-y-3 border-y border-line py-3">
                    {order.order_items?.map((item) => (
                      <div key={item.id}>
                        <p className="font-semibold">{item.quantity} × {item.meal_name_snapshot}</p>
                        {describeCustomisation(item).map((detail) => <p key={detail} className="text-sm text-muted">{detail}</p>)}
                      </div>
                    ))}
                  </div>
                  <OrderActions orderId={order.id} status={order.status} paid={isPaid(order)} canManage={false} />
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
