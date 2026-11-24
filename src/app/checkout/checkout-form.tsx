'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { placeOrder } from '@/features/orders/actions';
import { useCart } from '@/features/cart/cart-store';
import { formatETB } from '@/lib/money';
import { Tower } from '@/components/tower';

interface Props { name: string; phone: string; defaultFloor: number | null; defaultApartment: string }

export function CheckoutForm({ name, phone, defaultFloor, defaultApartment }: Props) {
  const router = useRouter();
  const { lines, subtotal, clear, removeMeals } = useCart();
  const [floor, setFloor] = useState<number | null>(defaultFloor);
  const [apartment, setApartment] = useState(defaultApartment);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (lines.length === 0) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-extrabold text-coffee">Nothing to check out</h1>
        {error && <p role="alert" className="mt-3 rounded-field bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        <Link href="/menu" className="btn-primary mt-4">Browse the menu</Link>
      </div>
    );
  }

  const submit = () => {
    if (!floor || !apartment.trim()) return setError('Choose your floor and enter your apartment number.');
    setError(null);
    start(async () => {
      const result = await placeOrder({
        floor, apartment: apartment.trim(), note,
        lines: lines.map((l) => ({
          mealId: l.mealId, quantity: l.quantity, note: l.note,
          removedIngredientIds: l.removed.map((r) => r.id), addonIds: l.addons.map((a) => a.id),
        })),
      });
      if (!result.ok) {
        const stale = result.staleMealIds ?? [];
        if (stale.length) {
          const names = [...new Set(lines.filter((l) => stale.includes(l.mealId)).map((l) => l.mealName))];
          removeMeals(stale);
          return setError(`${names.join(', ')} changed or is no longer on the menu, so we removed it from your cart. Add it again from the menu.`);
        }
        return setError(result.error);
      }
      clear();
      router.push(`/orders/${result.orderId}`);
    });
  };

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold text-coffee">Where should we bring it?</h1>
        <p className="text-muted">{name}{phone && ` · ${phone}`}</p>
        <div className="grid items-start gap-6 sm:grid-cols-[300px_1fr]">
          <Tower value={floor} onChange={setFloor} />
          <div className="space-y-4">
            <div>
              <label htmlFor="apt" className="label">Apartment number</label>
              <input id="apt" className="input" value={apartment} maxLength={10} onChange={(e) => setApartment(e.target.value)} />
            </div>
            <div>
              <label htmlFor="dnote" className="label">Delivery note (optional)</label>
              <textarea id="dnote" className="input py-2" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Leave at the door, ring twice…" />
            </div>
          </div>
        </div>
      </div>

      <aside className="card h-fit space-y-3 p-5 md:sticky md:top-24">
        <h2 className="text-lg font-bold">Your order</h2>
        <ul className="space-y-1 text-sm">
          {lines.map((l) => (
            <li key={l.key} className="flex justify-between gap-2"><span>{l.quantity} × {l.mealName}</span><span>{formatETB(l.unitPrice * l.quantity)}</span></li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-line pt-3 font-semibold"><span>Subtotal</span><span>{formatETB(subtotal)}</span></div>
        <p className="helper">The café confirms the final total when it accepts. You pay after that, not now.</p>
        {error && <p role="alert" className="rounded-field bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full" onClick={submit} disabled={pending}>{pending ? 'Sending…' : 'Send order to café'}</button>
      </aside>
    </div>
  );
}
