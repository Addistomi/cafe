import Link from 'next/link';
import { formatETB } from '@/lib/money';
import type { Meal } from '@/lib/types';

/** Warm placeholder tile shown until the café uploads a real photo. Not a generated image. */
function PhotoSlot({ meal }: { meal: Meal }) {
  if (meal.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={meal.image_url} alt={meal.name} className="h-full w-full object-cover" loading="lazy" />;
  }
  return (
    <div className="grid h-full w-full place-items-center bg-coffee-soft font-display text-5xl font-extrabold text-coffee/40" aria-hidden>
      {meal.name.slice(0, 1)}
    </div>
  );
}

export function MealCard({ meal }: { meal: Meal }) {
  return (
    <Link href={`/meals/${meal.slug}`} className="group card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="aspect-[4/3] overflow-hidden"><PhotoSlot meal={meal} /></div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold leading-snug">{meal.name}</h3>
          <span className="shrink-0 font-display text-lg font-bold text-accent">{formatETB(meal.base_price)}</span>
        </div>
        <p className="line-clamp-2 text-sm text-muted">{meal.description}</p>
        <p className="mt-auto pt-2 text-xs text-muted">
          {meal.preparation_minutes ? `About ${meal.preparation_minutes} min` : 'Made to order'}
        </p>
      </div>
    </Link>
  );
}
