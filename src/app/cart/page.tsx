'use client';

import Link from 'next/link';
import { useCart } from '@/features/cart/cart-store';
import { formatETB } from '@/lib/money';

export default function CartPage() {
  const { lines, subtotal, setQuantity, remove } = useCart();

  if (lines.length === 0) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-extrabold text-coffee">Your cart is empty</h1>
        <p className="mt-2 text-muted">Pick something from the menu and it will show up here.</p>
        <Link href="/menu" className="btn-primary mt-5">Browse the menu</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-extrabold text-coffee">Your cart</h1>
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.key} className="card space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/meals/${l.slug}`} className="font-display text-lg font-bold">{l.mealName}</Link>
              <span className="font-semibold">{formatETB(l.unitPrice * l.quantity)}</span>
            </div>
            {(l.removed.length > 0 || l.addons.length > 0 || l.note) && (
              <ul className="space-y-0.5 text-sm text-muted">
                {l.removed.length > 0 && <li>No {l.removed.map((r) => r.name.toLowerCase()).join(', ')}</li>}
                {l.addons.length > 0 && <li>Extra: {l.addons.map((a) => a.name).join(', ')}</li>}
                {l.note && <li>Note: {l.note}</li>}
              </ul>
            )}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center rounded-field border border-line">
                <button className="min-h-10 w-10" aria-label={`Fewer ${l.mealName}`} onClick={() => setQuantity(l.key, l.quantity - 1)}>−</button>
                <span className="w-8 text-center text-sm font-semibold">{l.quantity}</span>
                <button className="min-h-10 w-10" aria-label={`More ${l.mealName}`} onClick={() => setQuantity(l.key, l.quantity + 1)}>+</button>
              </div>
              <button className="text-sm font-semibold text-danger underline" onClick={() => remove(l.key)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="card space-y-1 p-4">
        <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatETB(subtotal)}</span></div>
        <p className="helper">Delivery fee and the final total are confirmed at checkout.</p>
      </div>
      <div className="flex gap-3">
        <Link href="/menu" className="btn-ghost flex-1">Keep browsing</Link>
        <Link href="/checkout" className="btn-primary flex-1">Go to checkout</Link>
      </div>
    </div>
  );
}
