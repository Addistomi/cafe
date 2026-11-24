'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { simulatePayment } from '@/features/orders/actions';

export function PayPanel({ orderId, total, expires, mock }: { orderId: string; total: string; expires: string | null; mock: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="card space-y-3 border-accent bg-accent-soft p-5">
      <h2 className="text-lg font-bold">The café accepted your order</h2>
      <p className="text-sm">Pay {total} to start cooking.
        {expires && <> We’re holding your ingredients until {new Date(expires).toLocaleTimeString('en-GB', { timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}.</>}
      </p>
      {mock ? (
        <>
          <button className="btn-primary" disabled={pending} onClick={() => start(async () => {
            const r = await simulatePayment(orderId);
            if (!r.ok) setError(r.error); else router.refresh();
          })}>{pending ? 'Confirming…' : 'Simulate Telebirr payment'}</button>
          <p className="helper">Development mode. In production this button is replaced by the hosted Telebirr checkout, and “Paid” appears only after the verified callback.</p>
        </>
      ) : (
        <button className="btn-primary" disabled>Pay with Telebirr (coming in Phase 5)</button>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  );
}
