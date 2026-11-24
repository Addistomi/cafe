import { notFound, redirect } from 'next/navigation';
import { getProfile } from '@/features/auth/session';
import { getOrder, isPaid } from '@/features/orders/queries';
import { StatusPill } from '@/components/status-pill';
import { OrderTimeline } from '@/components/timeline';
import { formatETB } from '@/lib/money';
import { PayPanel } from './pay-panel';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getProfile())) redirect('/login');
  const order = await getOrder(id); // RLS returns nothing for other residents' orders
  if (!order) notFound();
  const paid = isPaid(order);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-coffee">{order.order_number}</h1>
          <p className="text-muted">Floor {order.floor_snapshot}, apartment {order.apartment_snapshot}</p>
        </div>
        <StatusPill status={order.status} />
      </div>

      {order.status === 'AWAITING_PAYMENT' && !paid && (
        <PayPanel orderId={order.id} total={formatETB(order.total_amount)} expires={order.reservation_expires_at} mock={process.env.PAYMENTS_MODE === 'mock'} />
      )}
      {order.status === 'PENDING_ACCEPTANCE' && (
        <p className="card bg-warning-soft p-4 text-sm text-warning">The café is checking the kitchen. You’ll be able to pay as soon as it accepts.</p>
      )}
      {(order.status === 'REJECTED' || order.status === 'CANCELLED') && (
        <p className="card bg-danger-soft p-4 text-sm text-danger">This order was not completed. Contact the café if you have questions.</p>
      )}

      <section className="card p-5"><OrderTimeline order={order} /></section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">Items</h2>
        {order.order_items?.map((i) => (
          <div key={i.id} className="flex justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold">{i.quantity} × {i.meal_name_snapshot}</p>
              {i.order_item_ingredients.filter((x) => x.was_removed).length > 0 && (
                <p className="text-muted">No {i.order_item_ingredients.filter((x) => x.was_removed).map((x) => x.ingredient_name_snapshot.toLowerCase()).join(', ')}</p>
              )}
            </div>
            <span>{formatETB(i.line_total)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-line pt-3 text-sm"><span>Delivery</span><span>{formatETB(order.delivery_fee)}</span></div>
        <div className="flex justify-between font-semibold"><span>Total</span><span>{formatETB(order.total_amount)}</span></div>
      </section>
    </div>
  );
}
