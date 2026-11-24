import type { OrderStatus } from '@/lib/types';

const STYLE: Record<OrderStatus, { label: string; cls: string }> = {
  PENDING_ACCEPTANCE: { label: 'Waiting for café', cls: 'bg-warning-soft text-warning' },
  ACCEPTED: { label: 'Accepted', cls: 'bg-success-soft text-success' },
  AWAITING_PAYMENT: { label: 'Ready for payment', cls: 'bg-accent-soft text-coffee' },
  PREPARING: { label: 'Preparing', cls: 'bg-coffee-soft text-coffee' },
  READY: { label: 'Ready', cls: 'bg-success-soft text-success' },
  OUT_FOR_DELIVERY: { label: 'On the way', cls: 'bg-success-soft text-success' },
  DELIVERED: { label: 'Delivered', cls: 'bg-success-soft text-success' },
  REJECTED: { label: 'Declined', cls: 'bg-danger-soft text-danger' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-danger-soft text-danger' },
  EXPIRED: { label: 'Expired', cls: 'bg-danger-soft text-danger' },
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const { label, cls } = STYLE[status];
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}
