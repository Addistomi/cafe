import type { OrderRow } from '@/lib/types';
import { isPaid } from '@/features/orders/queries';

const RANK: Record<string, number> = {
  PENDING_ACCEPTANCE: 1, ACCEPTED: 2, AWAITING_PAYMENT: 2, PREPARING: 4, READY: 5, OUT_FOR_DELIVERY: 5, DELIVERED: 6,
};

export function OrderTimeline({ order }: { order: OrderRow }) {
  const rank = RANK[order.status] ?? 0;
  const paid = isPaid(order);
  const steps = [
    { label: 'Order sent', done: rank >= 1 },
    { label: 'Café accepted', done: rank >= 2 },
    { label: 'Payment verified', done: paid || rank >= 4 },
    { label: 'Preparing', done: rank >= 4 },
    { label: 'Ready', done: rank >= 5 },
    { label: 'Delivered', done: rank >= 6 },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={`mt-1 size-3.5 rounded-full border-2 ${s.done ? 'border-success bg-success' : i === current ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`} />
            {i < steps.length - 1 && <span className={`w-0.5 flex-1 ${s.done ? 'bg-success' : 'bg-line'}`} />}
          </div>
          <p className={`pb-4 text-sm ${s.done ? 'font-semibold' : i === current ? 'font-semibold text-coffee' : 'text-muted'}`}>
            {s.label}{i === current && <span className="ml-2 text-xs font-normal text-muted">Up next</span>}
          </p>
        </li>
      ))}
    </ol>
  );
}
