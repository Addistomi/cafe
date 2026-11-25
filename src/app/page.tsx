import Link from 'next/link';
import { getProfile } from '@/features/auth/session';
import { listCategories, listMeals } from '@/features/menu/queries';
import { MealCard } from '@/components/meal-card';
import { Tower } from '@/components/tower';

export default async function HomePage() {
  const [profile, categories, meals] = await Promise.all([getProfile(), listCategories(), listMeals()]);
  const firstName = profile?.full_name.split(' ')[0];

  return (
    <div className="space-y-14 pb-8">
      <section className="rise-in relative overflow-hidden rounded-[26px] bg-coffee px-6 py-9 text-cream shadow-[0_18px_50px_rgba(79,47,32,0.16)] sm:px-10 sm:py-12 lg:grid lg:grid-cols-[1fr_330px] lg:items-center lg:gap-8">
        <div className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full border-[42px] border-white/[0.035]" />
        <div className="relative z-10 space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-cream/90">
            <span className="size-2 rounded-full bg-accent" /> Serving residents on floors 4–10
          </span>
          <div className="space-y-3">
            <p className="eyebrow !text-accent">Fresh from Fana Cafe</p>
            <h1 className="max-w-[720px] text-4xl font-extrabold leading-[1.02] sm:text-5xl lg:text-6xl">
              {firstName ? `${firstName}, good food is` : 'Good food is'} <span className="text-accent">closer than ever.</span>
            </h1>
            <p className="max-w-[52ch] text-base leading-relaxed text-cream/75 sm:text-lg">
              Browse today’s menu, make your meal just the way you like it, and have it brought right to your apartment.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/menu" className="btn-accent">Explore the menu <span aria-hidden>→</span></Link>
            {profile && <Link href="/orders" className="btn border border-white/20 bg-white/10 text-cream hover:bg-white/15">Track my order</Link>}
          </div>
          {profile?.account_status === 'PENDING' && (
            <div className="max-w-lg rounded-field border border-warning/30 bg-warning/15 p-3 text-sm text-cream">
              <p className="font-bold">Resident verification required</p>
              <p className="mt-1">Complete your identity check or view its review status. Ordering unlocks after manager approval.</p>
              <Link href="/resident/verification" className="mt-2 inline-block font-bold text-accent underline underline-offset-4">Open identity verification →</Link>
            </div>
          )}
          {!profile && (
            <p className="text-sm text-cream/70">
              Live in the building? <Link href="/register" className="font-bold text-accent underline underline-offset-4">Create your resident account</Link>
            </p>
          )}
        </div>
        <div className="relative z-10 mt-9 flex flex-col items-center gap-3 lg:mt-0">
          <div className="w-full max-w-[285px] rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-cream/65">Your building</span>
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold text-accent">4–10</span>
            </div>
            <Tower readOnly value={profile?.floor ?? null} />
          </div>
          <p className="max-w-[260px] text-center text-xs leading-relaxed text-cream/55">From the café downstairs to your door upstairs. No phone calls needed.</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="How Fana Cafe works">
        {[
          ['01', 'Choose your meal', 'Explore the menu and customize ingredients and extras.'],
          ['02', 'We confirm it', 'The café checks availability and accepts your order.'],
          ['03', 'Pay and enjoy', 'Pay after acceptance, then follow preparation and delivery.'],
        ].map(([number, title, text]) => (
          <div key={number} className="card flex gap-4 p-4 sm:p-5">
            <span className="font-display text-2xl font-extrabold text-accent">{number}</span>
            <div><h2 className="font-display text-lg font-bold text-coffee">{title}</h2><p className="mt-1 text-sm leading-relaxed text-muted">{text}</p></div>
          </div>
        ))}
      </section>

      <section aria-labelledby="menu-heading" className="space-y-5">
        <div className="section-heading">
          <div><p className="eyebrow">Made fresh for you</p><h2 id="menu-heading" className="mt-1 text-3xl font-extrabold text-coffee">On the menu today</h2></div>
          <Link href="/menu" className="text-sm font-bold text-coffee underline underline-offset-4">See the full menu →</Link>
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <Link key={category.id} href={`/menu?cat=${category.id}`} className="btn-ghost min-h-9 shrink-0 px-4">{category.name}</Link>
            ))}
          </div>
        )}
        {meals.length === 0 ? (
          <div className="card p-8 text-center"><p className="font-semibold text-coffee">Today’s menu is being prepared.</p><p className="mt-1 text-sm text-muted">Please check back soon.</p></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{meals.slice(0, 6).map((meal) => <MealCard key={meal.id} meal={meal} />)}</div>
        )}
      </section>

      <section className="flex flex-col items-start justify-between gap-4 rounded-card border border-accent/20 bg-accent-soft p-6 sm:flex-row sm:items-center sm:p-8">
        <div><p className="eyebrow">Your next favourite meal</p><h2 className="mt-1 text-2xl font-extrabold text-coffee">Ready when you are.</h2><p className="mt-1 text-sm text-muted">Order in a few taps. We’ll bring it to your floor.</p></div>
        <Link href="/menu" className="btn-primary shrink-0">Start an order</Link>
      </section>
    </div>
  );
}
