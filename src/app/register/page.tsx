import Link from 'next/link';
import type { Metadata } from 'next';
import { register } from '@/features/auth/actions';
import { AuthForm, Field } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Create resident account' };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <p className="eyebrow">Resident onboarding · Step 1 of 2</p>
        <h1 className="mt-1 text-3xl font-extrabold text-coffee">Join Fana Cafe</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Create your resident login with your contact and apartment details. After confirming your email,
          sign in and complete identity verification by submitting your ID document.
        </p>
      </div>
      <AuthForm action={register} submitLabel="Create resident account">
        <Field label="Full legal name" name="full_name" autoComplete="name" />
        <Field label="Mobile number" name="phone" type="tel" autoComplete="tel" placeholder="0912345678" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="floor" className="label">Floor</label>
            <select id="floor" name="floor" className="input" required defaultValue="">
              <option value="" disabled>Choose</option>
              {[4, 5, 6, 7, 8, 9, 10].map((floor) => <option key={floor} value={floor}>{floor}</option>)}
            </select>
          </div>
          <Field label="Apartment" name="apartment" placeholder="604" maxLength={10} />
        </div>
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters." />
        <div className="rounded-field border border-line bg-coffee-soft/40 p-3 text-xs leading-relaxed text-muted">
          Step 2 asks for your date of birth, nationality, resident type, ID type and document image.
          Your account cannot order until a café manager approves the identity check.
        </div>
      </AuthForm>
      <p className="text-center text-sm text-muted">Already registered? <Link href="/login" className="font-semibold text-coffee underline">Sign in</Link></p>
    </div>
  );
}
