'use client';

import Link from 'next/link';
import { useCart } from '@/features/cart/cart-store';

export function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="btn-ghost relative min-h-9 px-3" aria-label={`Cart, ${count} items`}>
      Cart
      {count > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-ink">{count}</span>
      )}
    </Link>
  );
}
