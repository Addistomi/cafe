import Link from 'next/link';
import type { Metadata } from 'next';
import { listCategories, listMeals } from '@/features/menu/queries';
import { MealCard } from '@/components/meal-card';

export const metadata: Metadata = { title: 'Menu' };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; sort?: string }> }) {
  const { q, cat, sort } = await searchParams;
  const [categories, meals] = await Promise.all([listCategories(), listMeals({ q, category: cat, sort })]);
  const chip = (active: boolean) => (active ? 'btn-primary min-h-9 px-4' : 'btn-ghost min-h-9 px-4');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-coffee">Our menu</h1>
      <form className="flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} className="input max-w-sm" placeholder="Search meals" aria-label="Search meals" />
        {cat && <input type="hidden" name="cat" value={cat} />}
        <select name="sort" defaultValue={sort ?? ''} className="input w-auto" aria-label="Sort">
          <option value="">Recommended</option>
          <option value="price-asc">Price, low to high</option>
          <option value="price-desc">Price, high to low</option>
        </select>
        <button className="btn-primary">Apply</button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Link href="/menu" className={chip(!cat)}>All</Link>
        {categories.map((c) => <Link key={c.id} href={`/menu?cat=${c.id}`} className={chip(cat === c.id)}>{c.name}</Link>)}
      </div>
      {meals.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">Nothing matches that search.</p>
          <Link href="/menu" className="mt-3 inline-block text-sm font-semibold text-coffee underline">Clear filters</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{meals.map((m) => <MealCard key={m.id} meal={m} />)}</div>
      )}
    </div>
  );
}
