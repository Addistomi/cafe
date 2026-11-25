import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AuthForm, Field } from '@/components/auth-form';
import { submitResidentKyc } from '@/features/residents/actions';

export const metadata: Metadata = { title: 'Resident identity verification' };

export default async function ResidentVerificationPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (profile.role !== 'CUSTOMER') redirect('/');
  if (profile.account_status === 'ACTIVE') redirect('/menu');

  const supabase = await createClient();
  const { data: application } = await supabase.from('resident_kyc')
    .select('status, review_note, created_at')
    .eq('user_id', profile.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="eyebrow">Resident onboarding · Step 2 of 2</p>
        <h1 className="mt-1 text-3xl font-extrabold text-coffee">Verify your identity</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          To protect residents and deliveries, Fana Cafe checks each resident account before ordering is enabled.
          Submit your details and a clear photo or scan of your identity document.
        </p>
      </div>

      {application?.status === 'PENDING' ? (
        <section className="card space-y-3 p-6">
          <span className="inline-flex rounded-full bg-warning-soft px-3 py-1 text-xs font-bold text-warning">KYC under review</span>
          <h2 className="text-xl font-extrabold text-coffee">Your documents have been received</h2>
          <p className="text-sm leading-relaxed text-muted">The café team is reviewing your identity information. You can browse the menu, but ordering stays locked until approval.</p>
          <p className="text-xs text-muted">Submitted {new Date(application.created_at).toLocaleDateString('en-GB')}</p>
        </section>
      ) : (
        <>
          {application?.status === 'REJECTED' && (
            <div className="rounded-card border border-danger/25 bg-danger-soft p-4">
              <p className="font-bold text-danger">Please correct your application</p>
              <p className="mt-1 text-sm text-danger">{application.review_note || 'The café needs a clearer identity document. Please submit again.'}</p>
            </div>
          )}
          <AuthForm action={submitResidentKyc} submitLabel="Submit identity verification">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full legal name" name="legal_name" autoComplete="name" defaultValue={profile.full_name} />
              <Field label="Date of birth" name="date_of_birth" type="date" autoComplete="bday" />
              <Field label="Nationality" name="nationality" defaultValue="Ethiopian" />
              <div>
                <label htmlFor="resident_type" className="label">Your relationship to the building</label>
                <select id="resident_type" name="resident_type" className="input" required defaultValue="">
                  <option value="" disabled>Select one</option>
                  <option value="OWNER">Apartment owner</option>
                  <option value="TENANT">Tenant</option>
                  <option value="FAMILY_MEMBER">Family member</option>
                  <option value="EMPLOYEE">Building employee</option>
                </select>
              </div>
              <div>
                <label htmlFor="id_document_type" className="label">Identity document type</label>
                <select id="id_document_type" name="id_document_type" className="input" required defaultValue="">
                  <option value="" disabled>Select document</option>
                  <option value="FAYDA">Fayda ID</option>
                  <option value="KEBELE_ID">Kebele ID</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVER_LICENSE">Driving licence</option>
                  <option value="OTHER">Other government ID</option>
                </select>
              </div>
              <Field label="Last 2–4 characters of ID number" name="id_document_last4" maxLength={4} hint="We store only the last characters here. Your full number remains visible only on your private document image." />
            </div>

            <div className="rounded-field border border-line bg-coffee-soft/40 p-4">
              <h2 className="font-bold text-coffee">Identity document</h2>
              <p className="helper mt-1">Upload a clear, readable front image or PDF. JPG, PNG or PDF · maximum 5 MB per file.</p>
              <div className="mt-3 space-y-3">
                <Field label="Front of ID (required)" name="id_front" type="file" accept="image/jpeg,image/png,application/pdf" />
                <Field label="Back of ID (optional)" name="id_back" type="file" accept="image/jpeg,image/png,application/pdf" required={false} />
                <Field label="Proof of residence (optional)" name="residence_proof" type="file" accept="image/jpeg,image/png,application/pdf" required={false} hint="For example, a lease or building residence letter." />
              </div>
            </div>

            <div>
              <h2 className="font-bold text-coffee">Emergency contact (optional)</h2>
              <p className="helper mt-1">Only used if the café needs to reach someone about a delivery or resident safety issue.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Contact full name" name="emergency_contact_name" required={false} />
                <Field label="Contact phone" name="emergency_contact_phone" type="tel" placeholder="0912345678" required={false} />
                <Field label="Relationship" name="emergency_contact_relation" required={false} />
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              By submitting, you confirm that these details belong to you and that Fana Cafe may use them to verify your resident account.
              Identity files are kept in private storage and are available only to authorized café managers for review.
            </p>
          </AuthForm>
        </>
      )}
    </div>
  );
}
