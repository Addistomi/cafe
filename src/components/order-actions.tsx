'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptOrder, advanceOrder, cancelOrder, rejectOrder, startPreparing, type ActionResult } from '@/features/orders/actions';
import type { OrderStatus } from '@/lib/types';

interface Props { orderId: string; status: OrderStatus; paid: boolean; canManage: boolean }

/** Buttons offered for the order's current state. The server re-checks role and state on every call. */
export function OrderActions({ orderId, status, paid, canManage }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<'reject' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error);
      setError(null); setReasonFor(null); setReason('');
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canManage && status === 'PENDING_ACCEPTANCE' && (
          <>
            <button className="btn-primary min-h-9" disabled={pending} onClick={() => run(() => acceptOrder(orderId))}>Accept</button>
            <button className="btn-danger min-h-9" onClick={() => setReasonFor('reject')}>Reject</button>
          </>
        )}
        {canManage && status === 'AWAITING_PAYMENT' && <button className="btn-danger min-h-9" onClick={() => setReasonFor('cancel')}>Cancel</button>}
        {status === 'AWAITING_PAYMENT' && paid && <button className="btn-accent min-h-9" disabled={pending} onClick={() => run(() => startPreparing(orderId))}>Start preparing</button>}
        {status === 'AWAITING_PAYMENT' && !paid && <span className="helper self-center">Waiting for payment</span>}
        {status === 'PREPARING' && <button className="btn-primary min-h-9" disabled={pending} onClick={() => run(() => advanceOrder(orderId, 'READY'))}>Mark ready</button>}
        {status === 'READY' && <button className="btn-primary min-h-9" disabled={pending} onClick={() => run(() => advanceOrder(orderId, 'DELIVERED'))}>Mark delivered</button>}
      </div>
      {reasonFor && (
        <div className="flex gap-2">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" aria-label="Reason" />
          <button className="btn-danger" disabled={pending || !reason.trim()} onClick={() => run(() => (reasonFor === 'reject' ? rejectOrder(orderId, reason) : cancelOrder(orderId, reason)))}>Confirm</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
