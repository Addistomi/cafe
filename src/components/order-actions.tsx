'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptOrder, advanceOrder, cancelOrder, rejectOrder, startPreparing, type ActionResult } from '@/features/orders/actions';
import type { OrderStatus } from '@/lib/types';

interface Props { orderId: string; status: OrderStatus; paid: boolean; canManage: boolean }

export function OrderActions({ orderId, status, paid, canManage }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<'reject' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) return setError(result.error);
      setError(null);
      setReasonFor(null);
      setReason('');
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canManage && status === 'PENDING_ACCEPTANCE' && (
          <>
            <button className="btn-primary min-h-9" disabled={pending} onClick={() => run(() => acceptOrder(orderId))}>Accept order</button>
            <button className="btn-danger min-h-9" disabled={pending} onClick={() => setReasonFor('reject')}>Reject</button>
          </>
        )}
        {canManage && status === 'AWAITING_PAYMENT' && <button className="btn-danger min-h-9" disabled={pending} onClick={() => setReasonFor('cancel')}>Cancel order</button>}
        {status === 'AWAITING_PAYMENT' && paid && <button className="btn-accent min-h-9" disabled={pending} onClick={() => run(() => startPreparing(orderId))}>Start preparing</button>}
        {status === 'AWAITING_PAYMENT' && !paid && <span className="helper self-center">Waiting for verified payment</span>}
        {status === 'PREPARING' && <button className="btn-primary min-h-9" disabled={pending} onClick={() => run(() => advanceOrder(orderId, 'READY'))}>Mark ready</button>}
        {status === 'READY' && <button className="btn-primary min-h-9" disabled={pending} onClick={() => run(() => advanceOrder(orderId, 'OUT_FOR_DELIVERY'))}>Start delivery</button>}
        {status === 'OUT_FOR_DELIVERY' && <button className="btn-primary min-h-9" disabled={pending} onClick={() => run(() => advanceOrder(orderId, 'DELIVERED'))}>Mark delivered</button>}
      </div>
      {reasonFor && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (required)" aria-label="Reason" />
          <button className="btn-danger" disabled={pending || !reason.trim()} onClick={() => run(() => (reasonFor === 'reject' ? rejectOrder(orderId, reason) : cancelOrder(orderId, reason)))}>Confirm</button>
          <button className="btn-ghost" disabled={pending} onClick={() => { setReasonFor(null); setReason(''); }}>Keep order</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {pending && <p className="helper" aria-live="polite">Updating order…</p>}
    </div>
  );
}
