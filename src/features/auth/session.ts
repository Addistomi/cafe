import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Role } from '@/lib/types';

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return (data as Profile | null) ?? null;
}

/** Server-side gate. Hiding a button is not security — every protected page and action calls this. */
export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (profile.account_status !== 'ACTIVE' || !roles.includes(profile.role)) redirect('/');
  return profile;
}

export const STAFF: Role[] = ['OWNER', 'MANAGER', 'KITCHEN'];
export const MANAGERS: Role[] = ['OWNER', 'MANAGER'];
