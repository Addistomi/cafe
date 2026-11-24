import type { Metadata } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import { CartProvider } from '@/features/cart/cart-store';
import { Header } from '@/components/header';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Fana Cafe', template: '%s · Fana Cafe' },
  description: 'Fresh meals from the café on the ground floor, delivered to floors 4 to 10.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <CartProvider>
          <Header />
          <main className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 sm:px-6">{children}</main>
        </CartProvider>
      </body>
    </html>
  );
}
