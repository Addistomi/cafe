import Link from 'next/link';
import type { Metadata } from 'next';
import { login } from '@/features/auth/actions';
import { AuthForm, Field } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-3xl font-extrabold text-coffee">Welcome back</h1>
      <AuthForm action={login} submitLabel="Sign in">
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />
      </AuthForm>
      <p className="text-center text-sm text-muted">New here? <Link href="/register" className="font-semibold text-coffee underline">Create an account</Link></p>
    </div>
  );
}
