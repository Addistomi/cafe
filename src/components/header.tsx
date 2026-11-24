import Link from 'next/link';
import { getProfile } from '@/features/auth/session';
import { logout } from '@/features/auth/actions';
import { CartLink } from './cart-link';

export async function Header() {
  const profile = await getProfile();
  const isManager = profile?.role === 'OWNER' || profile?.role === 'MANAGER';
  const isStaff = isManager || profile?.role === 'KITCHEN';

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="font-display text-xl font-extrabold text-coffee">Fana Cafe</Link>
        <nav className="ml-2 hidden items-center gap-1 text-sm font-medium sm:flex" aria-label="Main">
          <Link className="rounded-field px-3 py-2 hover:bg-coffee-soft" href="/menu">Menu</Link>
          {profile && <Link className="rounded-field px-3 py-2 hover:bg-coffee-soft" href="/orders">My orders</Link>}
          {isManager && <Link className="rounded-field px-3 py-2 hover:bg-coffee-soft" href="/admin/orders">Orders desk</Link>}
          {isStaff && <Link className="rounded-field px-3 py-2 hover:bg-coffee-soft" href="/kitchen">Kitchen</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <CartLink />
          {profile ? (
            <form action={logout}><button className="btn-ghost min-h-9 px-3">Sign out</button></form>
          ) : (
            <Link href="/login" className="btn-primary min-h-9 px-4">Sign in</Link>
          )}
        </div>
      </div>
      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1 text-sm font-medium sm:hidden" aria-label="Main mobile">
        <Link className="rounded-field px-3 py-2" href="/menu">Menu</Link>
        {profile && <Link className="rounded-field px-3 py-2" href="/orders">My orders</Link>}
        {isManager && <Link className="rounded-field px-3 py-2" href="/admin/orders">Orders desk</Link>}
        {isStaff && <Link className="rounded-field px-3 py-2" href="/kitchen">Kitchen</Link>}
      </nav>
    </header>
  );
}
