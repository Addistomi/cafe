import Link from 'next/link';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatETB } from '@/lib/money';
import { StatusPill } from '@/components/status-pill';
import type { OrderStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Management overview' };

export default async function AdminDashboardPage() {
  const db = createAdminClient();
  const [ordersCount, pendingCount, mealsCount, stockResult, latestResult, paymentsResult] = await Promise.all([
    db.from('orders').select('id', { count: 'exact', head: true }),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_ACCEPTANCE'),
    db.from('meals').select('id', { count: 'exact', head: true }).eq('is_available', true).is('archived_at', null),
    db.from('ingredient_stock').select('id, name, available_quantity, minimum_stock_quantity').order('name'),
    db.from('orders').select('id, order_number, customer_name_snapshot, floor_snapshot, apartment_snapshot, status, total_amount, created_at').order('created_at', { ascending: false }).limit(6),
    db.from('payments').select('amount').eq('status', 'SUCCESS').eq('signature_verified', true),
  ]);

  const stock = stockResult.data ?? [];
  const lowStock = stock.filter((item) => Number(item.available_quantity) <= Number(item.minimum_stock_quantity));
  const revenue = (paymentsResult.data ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const latest = latestResult.data ?? [];
  const metrics = [
    { label: 'All orders', value: String(ordersCount.count ?? 0), note: 'Orders received', href: '/admin/orders' },
    { label: 'Need attention', value: String(pendingCount.count ?? 0), note: 'Waiting for acceptance', href: '/admin/orders?tab=new' },
    { label: 'Published meals', value: String(mealsCount.count ?? 0), note: 'Visible on the menu', href: '/admin/menu' },
    { label: 'Verified revenue', value: formatETB(revenue), note: 'Successful verified payments', href: '/admin/payments' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Today at a glance</p><h2 className="mt-1 text-2xl font-extrabold text-coffee">Cafe overview</h2><p className="mt-1 text-sm text-muted">A quick view of the café’s current operations.</p></div>
        <p className="text-xs text-muted">Times shown in Ethiopia time</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="card group p-5 transition-all hover:-translate-y-0.5 hover:border-coffee/25 hover:shadow-md">
            <p className="text-sm font-semibold text-muted">{metric.label}</p>
            <p className="mt-2 break-words font-display text-2xl font-extrabold text-coffee">{metric.value}</p>
            <p className="mt-1 text-xs text-muted">{metric.note}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line p-5">
            <div><p className="eyebrow">Latest activity</p><h3 className="mt-1 text-lg font-bold text-coffee">Recent orders</h3></div>
            <Link href="/admin/orders" className="text-xs font-bold text-coffee underline">View all</Link>
          </div>
          {latest.length === 0 ? <p className="p-6 text-sm text-muted">No orders have been received yet.</p> : (
            <div className="divide-y divide-line/70">
              {latest.map((order) => (
                <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0"><p className="font-bold text-coffee">{order.order_number}</p><p className="mt-0.5 truncate text-xs text-muted">{order.customer_name_snapshot} · Floor {order.floor_snapshot}, apt {order.apartment_snapshot}</p><p className="mt-1 text-[11px] text-muted">{new Date(order.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}</p></div>
                  <div className="flex items-center gap-3"><span className="font-semibold">{formatETB(order.total_amount)}</span><StatusPill status={order.status as OrderStatus} /></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-2"><div><p className="eyebrow">Inventory alerts</p><h3 className="mt-1 text-lg font-bold text-coffee">Low stock</h3></div><span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning">{lowStock.length}</span></div>
            {lowStock.length === 0 ? <p className="mt-4 text-sm text-muted">No ingredients are below their minimum level.</p> : (
              <ul className="mt-3 space-y-3">{lowStock.slice(0, 6).map((item) => <li key={item.id} className="flex justify-between gap-2 text-sm"><span className="font-semibold">{item.name}</span><span className="text-warning">{Number(item.available_quantity).toLocaleString()} available</span></li>)}</ul>
            )}
            <Link href="/admin/ingredients" className="btn-ghost mt-4 w-full">Manage inventory</Link>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Quick actions</p>
            <div className="mt-3 grid gap-2">
              <Link href="/admin/menu" className="admin-link"><span className="text-lg">＋</span> Add or edit a meal</Link>
              <Link href="/admin/orders?tab=new" className="admin-link"><span className="text-lg">↗</span> Review new orders</Link>
              <Link href="/admin/payments" className="admin-link"><span className="text-lg">◉</span> Check payment records</Link>
              <Link href="/admin/residents" className="admin-link"><span className="text-lg">♙</span> Approve residents</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
