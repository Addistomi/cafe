'use client';

const FLOORS = [10, 9, 8, 7, 6, 5, 4];

interface TowerProps {
  value?: number | null;
  onChange?: (floor: number) => void;
  /** Static display (home hero) renders divs instead of radio buttons. */
  readOnly?: boolean;
}

/**
 * The building, drawn as the delivery picker: the café sits at street level and each
 * eligible floor (4–10) is a row. The chosen floor lights up.
 */
export function Tower({ value, onChange, readOnly }: TowerProps) {
  return (
    <div className="w-full max-w-[300px]" role={readOnly ? 'img' : 'radiogroup'} aria-label="Building floors 4 to 10">
      <div className="mx-auto h-2 w-24 rounded-t-full bg-coffee-dark" aria-hidden />
      <div className="overflow-hidden rounded-t-card border border-line bg-coffee-soft">
        {FLOORS.map((floor, i) => {
          const active = value === floor;
          const rowClass = `flex h-11 w-full items-center gap-3 border-b border-line/70 px-4 text-left text-sm transition-colors ${
            active ? 'bg-coffee text-cream' : 'text-ink'
          }`;
          const windows = (
            <span className="ml-auto flex gap-1.5" aria-hidden>
              {[0, 1, 2].map((w) => (
                <span
                  key={w}
                  className={`window h-4 w-3.5 rounded-[3px] ${active ? 'bg-accent' : (floor + w) % 3 === 0 ? 'bg-accent/70' : 'bg-line'}`}
                  style={{ animationDelay: `${i * 90 + w * 40}ms` }}
                />
              ))}
            </span>
          );
          const label = <span className="w-16 font-display font-bold">Floor {floor}</span>;
          return readOnly ? (
            <div key={floor} className={rowClass}>{label}{windows}</div>
          ) : (
            <button
              key={floor}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange?.(floor)}
              className={`${rowClass} hover:bg-accent-soft ${active ? 'hover:bg-coffee' : ''}`}
            >
              {label}
              {active && <span className="text-xs text-cream/80">Delivering here</span>}
              {windows}
            </button>
          );
        })}
        <div className="flex h-12 items-center gap-2 bg-coffee-dark px-4 text-cream">
          <span className="font-display font-bold">Fana Cafe</span>
          <span className="ml-auto text-xs text-cream/70">Ground floor</span>
        </div>
      </div>
    </div>
  );
}
