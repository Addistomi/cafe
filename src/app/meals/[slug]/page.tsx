import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMealBySlug } from '@/features/menu/queries';
import { MealCustomizer } from './customizer';

export default async function MealPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meal = await getMealBySlug(slug);
  if (!meal) notFound();

  return (
    <div className="space-y-4">
      <Link href="/menu" className="text-sm font-semibold text-coffee underline">Back to menu</Link>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-card bg-coffee-soft">
          {meal.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meal.image_url} alt={meal.name} className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-8xl font-extrabold text-coffee/30" aria-hidden>{meal.name.slice(0, 1)}</span>
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-coffee">{meal.name}</h1>
          <p className="text-muted">{meal.description}</p>
          {meal.preparation_minutes && <p className="helper">Ready in about {meal.preparation_minutes} minutes</p>}
          <MealCustomizer meal={meal} />
        </div>
      </div>
    </div>
  );
}
