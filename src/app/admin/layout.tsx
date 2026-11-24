import Link from 'next/link';
import { requireRole, MANAGERS } from '@/features/auth/session';

const links = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/menu', label: 'Menu & recipes' },
  { href: '/admin/ingredients', label: 'Inventory' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/residents', label: 'Residents' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(MANAGERS);
  return (
    <div className="space-y-6">
      <div className="rounded-card bg-coffee px-5 py-5 text-cream sm:px-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Fana Cafe · Management</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <div><h1 className="font-display text-2xl font-extrabold">Owner workspace</h1><p className="mt-1 text-sm text-cream/65">Orders, menu, stock and payments in one place.</p></div>
          <Link href="/kitchen" className="rounded-field border border-white/20 px-3 py-2 text-xs font-bold text-cream hover:bg-white/10">Open kitchen board →</Link>
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto border-b border-line pb-3" aria-label="Admin sections">
        {links.map((link) => <Link key={link.href} href={link.href} className="shrink-0 rounded-field border border-line bg-surface px-3 py-2 text-xs font-bold text-muted transition-colors hover:border-coffee/30 hover:bg-coffee-soft hover:text-coffee">{link.label}</Link>)}
      </nav>
      {children}
    </div>
  );
}
