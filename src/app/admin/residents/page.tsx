import type { Metadata } from 'next';
import { requireRole, MANAGERS } from '@/features/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { approveResident } from '@/features/orders/actions';
import type { Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Residents' };

export default async function ResidentsPage() {
  await requireRole(MANAGERS);
  const { data } = await createAdminClient().from('profiles').select('*').eq('role', 'CUSTOMER').order('created_at', { ascending: false });
  const residents = (data as Profile[]) ?? [];

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold text-coffee">Residents</h1>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-line text-muted"><tr><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Floor / apt</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {residents.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <td className="p-3 font-semibold">{r.full_name}</td><td className="p-3">{r.phone}</td>
                <td className="p-3">{r.floor} / {r.apartment_number}</td><td className="p-3">{r.account_status === 'ACTIVE' ? 'Approved' : r.account_status === 'PENDING' ? 'Waiting' : 'Suspended'}</td>
                <td className="p-3 text-right">
                  {r.account_status === 'PENDING' && (
                    <form action={approveResident.bind(null, r.id)}><button className="btn-primary min-h-9">Approve</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
