'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

const registerSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name'),
  phone: z.string().trim().regex(/^(\+251|0)?9\d{8}$/, 'Enter an Ethiopian mobile number, e.g. 0912345678'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
  floor: z.coerce.number().int().min(4, 'Floors 4 to 10 only').max(10, 'Floors 4 to 10 only'),
  apartment: z.string().trim().min(1, 'Enter your apartment number').max(10),
});

export type FormState = { error?: string; message?: string };

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Enter your email and password.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: 'Email or password is incorrect.' };
  redirect('/');
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, ...meta } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password, options: { data: meta } });
  if (error) return { error: error.message };
  return { message: 'Account created. The café will approve it shortly, then you can order.' };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
