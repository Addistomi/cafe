import type { OrderRow } from '@/lib/types';
import { isPaid } from '@/features/orders/queries';

const RANK: Record<string, number> = {
  PENDING_ACCEPTANCE: 1, ACCEPTED: 2, AWAITING_PAYMENT: 2,
  PREPARING: 4, READY: 5, OUT_FOR_DELIVERY: 6, DELIVERED: 7,
};

export function OrderTimeline({ order }: { order: OrderRow }) {
  const rank = RANK[order.status] ?? 0;
  const paid = isPaid(order);
  const steps = [
    { label: 'Order sent', done: rank >= 1 },
    { label: 'Café accepted', done: rank >= 2 },
    { label: 'Payment verified', done: paid || rank >= 4 },
    { label: 'Preparing your food', done: rank >= 4 },
    { label: 'Ready for delivery', done: rank >= 5 },
    { label: 'Out for delivery', done: rank >= 6 },
    { label: 'Delivered to your apartment', done: rank >= 7 },
  ];
  const current = steps.findIndex((step) => !step.done);

  return (
    <div className="space-y-1">
      <div className="mb-4"><p className="eyebrow">Order progress</p><h2 className="mt-1 font-display text-lg font-bold text-coffee">Follow your order</h2></div>
      <ol className="space-y-0">
        {steps.map((step, index) => (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2 ${step.done ? 'border-success bg-success' : index === current ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
                {step.done && <span className="text-[9px] font-black text-white">✓</span>}
              </span>
              {index < steps.length - 1 && <span className={`min-h-7 w-0.5 flex-1 ${step.done ? 'bg-success' : 'bg-line'}`} />}
            </div>
            <p className={`pb-4 text-sm ${step.done ? 'font-semibold text-ink' : index === current ? 'font-semibold text-coffee' : 'text-muted'}`}>
              {step.label}{index === current && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-accent">Next</span>}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
