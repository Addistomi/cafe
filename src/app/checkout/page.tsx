import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getProfile } from '@/features/auth/session';
import { CheckoutForm } from './checkout-form';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (profile.role !== 'CUSTOMER' || profile.account_status !== 'ACTIVE') {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-extrabold text-coffee">Almost there</h1>
        <p className="mt-2 text-muted">The café needs to approve your account before you can order. This is usually quick.</p>
      </div>
    );
  }
  return (
    <CheckoutForm
      name={profile.full_name} phone={profile.phone ?? ''}
      defaultFloor={profile.floor} defaultApartment={profile.apartment_number ?? ''}
    />
  );
}
