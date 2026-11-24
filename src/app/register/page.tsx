import Link from 'next/link';
import type { Metadata } from 'next';
import { register } from '@/features/auth/actions';
import { AuthForm, Field } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-3xl font-extrabold text-coffee">Join Fana Cafe</h1>
      <p className="text-muted">For residents of floors 4 to 10. The café approves each account before the first order.</p>
      <AuthForm action={register} submitLabel="Create account">
        <Field label="Full name" name="full_name" autoComplete="name" />
        <Field label="Mobile number" name="phone" type="tel" autoComplete="tel" placeholder="0912345678" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="floor" className="label">Floor</label>
            <select id="floor" name="floor" className="input" required defaultValue="">
              <option value="" disabled>Choose</option>
              {[4, 5, 6, 7, 8, 9, 10].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <Field label="Apartment" name="apartment" placeholder="604" maxLength={10} />
        </div>
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters." />
      </AuthForm>
      <p className="text-center text-sm text-muted">Already registered? <Link href="/login" className="font-semibold text-coffee underline">Sign in</Link></p>
    </div>
  );
}
