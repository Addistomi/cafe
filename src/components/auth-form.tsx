'use client';

import { useActionState } from 'react';
import type { FormState } from '@/features/auth/actions';

export function AuthForm({ action, submitLabel, children }: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="card space-y-4 p-6">
      {children}
      {state.error && <p role="alert" className="rounded-field bg-danger-soft p-3 text-sm text-danger">{state.error}</p>}
      {state.message && <p role="status" className="rounded-field bg-success-soft p-3 text-sm text-success">{state.message}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? 'One moment…' : submitLabel}</button>
    </form>
  );
}

export function Field({ label, name, type = 'text', hint, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: string }) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} className="input" required {...rest} />
      {hint && <p className="helper mt-1">{hint}</p>}
    </div>
  );
}
