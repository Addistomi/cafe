import type { Metadata } from 'next';
import Image from 'next/image';
import { requireRole, MANAGERS } from '@/features/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { reviewResidentKyc } from '@/features/residents/actions';
import type { Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Resident KYC review' };

type KycRecord = {
  user_id: string;
  email: string;
  legal_name: string;
  date_of_birth: string;
  nationality: string;
  resident_type: string;
  id_document_type: string;
  id_document_last4: string;
  id_front_storage_path: string;
  id_back_storage_path: string | null;
  residence_proof_storage_path: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  review_note: string | null;
  created_at: string;
};

function DocumentLink({ label, path, url }: { label: string; path: string | null; url: string | null }) {
  if (!path || !url) return null;
  if (path.toLowerCase().endsWith('.pdf')) {
    return <a className="text-sm font-bold text-coffee underline" href={url} target="_blank" rel="noreferrer">{label} · Open PDF ↗</a>;
  }
  return (
    <a className="block" href={url} target="_blank" rel="noreferrer">
      <Image src={url} width={180} height={130} unoptimized alt={label} className="h-28 w-40 rounded-field border border-line object-cover" />
      <span className="mt-1 block text-xs font-semibold text-coffee underline">{label} · Open full image ↗</span>
    </a>
  );
}

export default async function ResidentsPage() {
  await requireRole(MANAGERS);
  const db = createAdminClient();
  const { data: profileRows, error } = await db.from('profiles')
    .select('id, full_name, phone, floor, apartment_number, account_status, created_at')
    .eq('role', 'CUSTOMER')
    .order('created_at', { ascending: false });
  const residents = (profileRows as Profile[] | null) ?? [];
  const ids = residents.map((resident) => resident.id);
  const { data: kycRows } = ids.length
    ? await db.from('resident_kyc').select('*').in('user_id', ids)
    : { data: [] as KycRecord[] };
  const kycByUser = new Map<string, KycRecord>((kycRows as KycRecord[] | null ?? []).map((row) => [row.user_id, row]));

  const rows = await Promise.all(residents.map(async (resident) => {
    const kyc = kycByUser.get(resident.id) ?? null;
    const pathEntries = [
      ['Front of ID', kyc?.id_front_storage_path ?? null],
      ['Back of ID', kyc?.id_back_storage_path ?? null],
      ['Proof of residence', kyc?.residence_proof_storage_path ?? null],
    ] as const;
    const documents = await Promise.all(pathEntries.map(async ([label, path]) => {
      if (!path) return { label, path, url: null as string | null };
      const { data } = await db.storage.from('resident-kyc').createSignedUrl(path, 60 * 10);
      return { label, path, url: data?.signedUrl ?? null };
    }));
    return { resident, kyc, documents };
  }));

  const pendingCount = rows.filter(({ kyc }) => kyc?.status === 'PENDING').length;
  const missingCount = rows.filter(({ kyc }) => !kyc).length;
  const approvedCount = rows.filter(({ kyc }) => kyc?.status === 'APPROVED').length;

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Resident access control</p>
        <h1 className="mt-1 text-3xl font-extrabold text-coffee">Residents & identity checks</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Review the resident’s account details and private identity documents before activating ordering access.
          Approving KYC also activates the resident account.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Waiting for review</p><p className="mt-1 text-2xl font-extrabold text-coffee">{pendingCount}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold text-muted">Approved residents</p><p className="mt-1 text-2xl font-extrabold text-coffee">{approvedCount}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold text-muted">KYC not submitted</p><p className="mt-1 text-2xl font-extrabold text-coffee">{missingCount}</p></div>
      </div>

      {error ? <p className="rounded-field bg-danger-soft p-4 text-sm text-danger">Resident records could not be loaded.</p> : rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No resident accounts have registered yet.</div>
      ) : (
        <div className="space-y-4">
          {rows.map(({ resident, kyc, documents }) => (
            <article key={resident.id} className="card space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-coffee">{kyc?.legal_name ?? resident.full_name}</h2>
                  <p className="mt-1 text-sm text-muted">{kyc?.email ?? 'Email is not yet verified'} · {resident.phone ?? 'No phone number'}</p>
                  <p className="mt-1 text-xs text-muted">Floor {resident.floor ?? '—'} · Apartment {resident.apartment_number ?? '—'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${kyc?.status === 'APPROVED' ? 'bg-success-soft text-success' : kyc?.status === 'REJECTED' ? 'bg-danger-soft text-danger' : kyc?.status === 'PENDING' ? 'bg-warning-soft text-warning' : 'bg-coffee-soft text-muted'}`}>
                  {kyc?.status ?? 'KYC NOT SUBMITTED'}
                </span>
              </div>

              {kyc && (
                <>
                  <div className="grid gap-3 rounded-field bg-coffee-soft/40 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <p><span className="text-muted">Date of birth</span><br /><strong>{new Date(kyc.date_of_birth + 'T00:00:00').toLocaleDateString('en-GB')}</strong></p>
                    <p><span className="text-muted">Nationality</span><br /><strong>{kyc.nationality}</strong></p>
                    <p><span className="text-muted">Resident type</span><br /><strong>{kyc.resident_type.replaceAll('_', ' ')}</strong></p>
                    <p><span className="text-muted">ID type</span><br /><strong>{kyc.id_document_type.replaceAll('_', ' ')}</strong></p>
                    <p><span className="text-muted">ID ending</span><br /><strong>•••• {kyc.id_document_last4}</strong></p>
                    <p><span className="text-muted">Submitted</span><br /><strong>{new Date(kyc.created_at).toLocaleDateString('en-GB')}</strong></p>
                    {kyc.emergency_contact_name && <p><span className="text-muted">Emergency contact</span><br /><strong>{kyc.emergency_contact_name}</strong></p>}
                    {kyc.emergency_contact_phone && <p><span className="text-muted">Emergency phone</span><br /><strong>{kyc.emergency_contact_phone}</strong></p>}
                    {kyc.emergency_contact_relation && <p><span className="text-muted">Relationship</span><br /><strong>{kyc.emergency_contact_relation}</strong></p>}
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-bold text-coffee">Private identity documents · links expire after 10 minutes</p>
                    <div className="flex flex-wrap gap-5">
                      {documents.map((document) => (
                        <DocumentLink key={document.label} label={document.label} path={document.path} url={document.url} />
                      ))}
                    </div>
                  </div>
                  {kyc.review_note && (
                    <p className="rounded-field bg-danger-soft p-3 text-sm text-danger"><strong>Previous review note:</strong> {kyc.review_note}</p>
                  )}
                  {kyc.status === 'PENDING' && (
                    <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end sm:justify-between">
                      <form action={reviewResidentKyc.bind(null, resident.id, 'REJECTED')} className="flex flex-1 flex-col gap-2 sm:max-w-lg">
                        <label htmlFor={`reason-${resident.id}`} className="label">Reason for rejection (required to reject)</label>
                        <input id={`reason-${resident.id}`} name="reason" className="input" placeholder="For example: ID image is blurry; upload a clearer copy." required minLength={5} />
                        <button className="btn-secondary min-h-10" type="submit">Reject and request correction</button>
                      </form>
                      <form action={reviewResidentKyc.bind(null, resident.id, 'APPROVED')}>
                        <button className="btn-primary min-h-10 w-full sm:w-auto" type="submit">Approve KYC & activate account</button>
                      </form>
                    </div>
                  )}
                </>
              )}
              {!kyc && <p className="rounded-field bg-warning-soft p-3 text-sm text-warning">The resident has created an account but has not submitted identity documents yet. Ordering remains disabled.</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
