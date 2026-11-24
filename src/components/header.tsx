import Link from 'next/link';
import { getProfile } from '@/features/auth/session';
import { logout } from '@/features/auth/actions';
import { CartLink } from './cart-link';

export async function Header() {
  const profile = await getProfile();
  const isManager = profile?.account_status === 'ACTIVE' && (profile.role === 'OWNER' || profile.role === 'MANAGER');
  const isKitchen = profile?.account_status === 'ACTIVE' && profile.role === 'KITCHEN';
  const isCustomer = profile?.role === 'CUSTOMER';

  const desktopLink = 'rounded-field px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-coffee-soft hover:text-coffee';
  const mobileLink = 'shrink-0 rounded-field px-3 py-2 text-sm font-semibold text-muted hover:bg-coffee-soft hover:text-coffee';

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-cream/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Fana Cafe home">
          <span className="grid size-10 place-items-center rounded-xl bg-coffee font-display text-xl font-extrabold text-cream shadow-sm">F</span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-extrabold tracking-tight text-coffee">Fana Cafe</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.15em] text-muted sm:block">Good food, one floor away</span>
          </span>
        </Link>

        <nav className="ml-5 hidden items-center gap-1 xl:flex" aria-label="Main navigation">
          <Link className={desktopLink} href="/menu">Menu</Link>
          {isCustomer && <Link className={desktopLink} href="/orders">My orders</Link>}
          {isManager && (
            <>
              <Link className={desktopLink} href="/admin">Overview</Link>
              <Link className={desktopLink} href="/admin/orders">Orders</Link>
              <Link className={desktopLink} href="/admin/menu">Menu manager</Link>
              <Link className={desktopLink} href="/admin/ingredients">Stock</Link>
              <Link className={desktopLink} href="/admin/payments">Payments</Link>
              <Link className={desktopLink} href="/admin/residents">Residents</Link>
            </>
          )}
          {(isManager || isKitchen) && <Link className={desktopLink} href="/kitchen">Kitchen</Link>}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <CartLink />
          {profile ? (
            <>
              <span className="hidden max-w-36 truncate text-right text-xs font-semibold text-muted lg:block">
                {profile.full_name}
                {isCustomer && profile.floor ? <span className="block font-normal">Floor {profile.floor}</span> : null}
              </span>
              <form action={logout}>
                <button className="btn-ghost min-h-9 px-3" type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn-primary min-h-9 px-4">Sign in</Link>
          )}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-line/70 px-3 py-1.5 xl:hidden" aria-label="Mobile navigation">
        <Link className={mobileLink} href="/menu">Menu</Link>
        {isCustomer && <Link className={mobileLink} href="/orders">My orders</Link>}
        {isManager && (
          <>
            <Link className={mobileLink} href="/admin">Overview</Link>
            <Link className={mobileLink} href="/admin/orders">Orders</Link>
            <Link className={mobileLink} href="/admin/menu">Menu</Link>
            <Link className={mobileLink} href="/admin/ingredients">Stock</Link>
            <Link className={mobileLink} href="/admin/payments">Payments</Link>
            <Link className={mobileLink} href="/admin/residents">Residents</Link>
          </>
        )}
        {(isManager || isKitchen) && <Link className={mobileLink} href="/kitchen">Kitchen board</Link>}
      </nav>
    </header>
  );
}
