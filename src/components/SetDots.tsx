import { Icon } from './Icon';

type Dot = 'met' | 'bonus' | 'missed' | null;

/** S06 set dots: brass check = bonus, ink check = goal met, open ring = to do, red ring = current. */
export function SetDots({ dots, currentIdx }: { dots: Dot[]; currentIdx?: number }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {dots.map((d, i) => {
        const cur = currentIdx === i + 1 && d === null;
        if (d === 'met' || d === 'bonus')
          return (
            <span
              key={i}
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${
                d === 'bonus' ? 'bg-brass text-on-brass' : 'bg-ink text-card'
              }`}
            >
              <Icon name="check" size={11} strokeWidth={3.4} />
            </span>
          );
        if (d === 'missed')
          return <span key={i} className="h-[18px] w-[18px] rounded-full border-2 border-ink2 bg-panel" />;
        return (
          <span
            key={i}
            className={`h-[18px] w-[18px] rounded-full border-2 ${cur ? 'border-accent' : 'border-rule'}`}
          />
        );
      })}
    </span>
  );
}
