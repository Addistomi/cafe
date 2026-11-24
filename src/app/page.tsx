import Link from 'next/link';
import { getProfile } from '@/features/auth/session';
import { listCategories, listMeals } from '@/features/menu/queries';
import { MealCard } from '@/components/meal-card';
import { Tower } from '@/components/tower';

export default async function HomePage() {
  const [profile, categories, meals] = await Promise.all([getProfile(), listCategories(), listMeals()]);
  const firstName = profile?.full_name.split(' ')[0];

  return (
    <div className="space-y-14">
      <section className="grid items-center gap-10 py-4 md:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold leading-[1.05] text-coffee sm:text-6xl">
            {firstName ? `${firstName}, lunch is` : 'Lunch is'} one floor away.
          </h1>
          <p className="max-w-[46ch] text-lg text-muted">
            Order from the café on the ground floor and we bring it to your door on floors 4 to 10. Take out what you
            don’t like, add what you do.
          </p>
          <form action="/menu" className="flex max-w-md gap-2" role="search">
            <input name="q" className="input" placeholder="Search sandwiches, tea, shiro…" aria-label="Search meals" />
            <button className="btn-primary">Search</button>
          </form>
          {profile?.account_status === 'PENDING' && (
            <p className="card max-w-md border-warning/40 bg-warning-soft p-3 text-sm text-warning">
              Your account is waiting for approval. You can browse the menu now and order as soon as the café approves you.
            </p>
          )}
          {!profile && (
            <p className="text-sm text-muted">
              Live in the building? <Link href="/register" className="font-semibold text-coffee underline">Create your account</Link>
            </p>
          )}
        </div>
        <div className="justify-self-center"><Tower readOnly value={profile?.floor ?? null} /></div>
      </section>

      <section aria-labelledby="menu-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="menu-heading" className="text-2xl font-bold">On the menu today</h2>
          <Link href="/menu" className="text-sm font-semibold text-coffee underline">See the full menu</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link key={c.id} href={`/menu?cat=${c.id}`} className="btn-ghost min-h-9 px-4">{c.name}</Link>
          ))}
        </div>
        {meals.length === 0 ? (
          <p className="card p-6 text-muted">The kitchen is setting up today’s menu. Check back soon.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meals.slice(0, 6).map((m) => <MealCard key={m.id} meal={m} />)}
          </div>
        )}
      </section>

      <section className="card grid gap-6 p-6 sm:grid-cols-4" aria-label="How ordering works">
        {[
          ['Choose', 'Pick meals and take out any ingredient you want gone.'],
          ['Send', 'We check the kitchen has everything and accept your order.'],
          ['Pay', 'Pay with Telebirr once we accept.'],
          ['Receive', 'We knock on your door.'],
        ].map(([title, text]) => (
          <div key={title}><h3 className="text-lg font-bold text-coffee">{title}</h3><p className="mt-1 text-sm text-muted">{text}</p></div>
        ))}
      </section>
    </div>
  );
}
