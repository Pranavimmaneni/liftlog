import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import type { OnboardingDraft } from '@/db/repo';
import { presetGym } from '@/engine/suggest';

export const DEFAULT_DRAFT: OnboardingDraft = {
  experience: 'intermediate',
  goal: 'build_muscle',
  daysPerWeek: 4,
  nudge: 0,
  presetId: 'full-gym',
  ...presetGym('full-gym'),
  limitations: [],
  units: 'kg',
};

/** S01–S03 header: back button, "Step n of 3 · Name", and the three progress bars. */
export function StepHeader({ step, name, onBack }: { step: 1 | 2 | 3; name: string; onBack?: () => void }) {
  const sun = useDesign() === 'sun';
  // Rising Sun (FR-DSN-10, HW1S01): the glass sub-screen bar with "Step n of 3"; the name is the title.
  if (sun)
    return (
      <>
        <header className="sun-bar sun-glass">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center justify-self-start rounded-full text-ink"
            aria-label={en.common.back}
            onClick={onBack}
            disabled={!onBack}
            style={onBack ? undefined : { visibility: 'hidden' }}
          >
            <Icon name="back" />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[17px] font-bold leading-tight">{en.sun.setup.onboarding.step(step)}</p>
            <div className="mx-auto mt-1.5 flex w-[84px] gap-1" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <span key={i} className={`h-1 grow rounded-full ${i <= step ? 'bg-ink' : 'bg-track'}`} />
              ))}
            </div>
          </div>
          <span />
        </header>
        <h1 className="sun-title break-words px-5 pt-5">{name}</h1>
      </>
    );
  return (
    <header className="flex items-center gap-3.5 px-5 pt-4">
      <button
        type="button"
        className="ll-icon-btn"
        aria-label={en.common.back}
        onClick={onBack}
        disabled={!onBack}
        style={onBack ? undefined : { visibility: 'hidden' }}
      >
        <Icon name="back" />
      </button>
      <div className="grow">
        <p className="t-label">{en.onboarding.step(step, name)}</p>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`h-[5px] grow rounded-[1px] ${i <= step ? 'bg-ink' : 'bg-rule'}`} />
          ))}
        </div>
      </div>
    </header>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="px-5 pt-[18px]">
      <h1 className="t-display text-[38px]">{children}</h1>
      {sub && <p className="mt-2.5 text-[15px] leading-[1.45] text-ink2">{sub}</p>}
    </div>
  );
}

/** Sticky bottom CTA area that clears the home indicator (FR-PLT-10, NFR-UX-1). */
export function BottomCta({ children }: { children: ReactNode }) {
  const sun = useDesign() === 'sun';
  // Rising Sun: no opaque band over the sun, only the button (as on the rebuilt logger).
  if (sun)
    return (
      <div className="sticky bottom-0 z-10 mt-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3.5">
        {children}
      </div>
    );
  return (
    <div className="sticky bottom-0 mt-auto bg-paper px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3">
      {children}
    </div>
  );
}

/** Rising Sun: the step's question and help text on a glass card (nothing but the title sits on the page). */
export function SunIntro({ title, children, id }: { title: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <>
      <h2 id={id} className="text-[17px] font-bold leading-snug">
        {title}
      </h2>
      {children && <p className="mt-1 text-[14px] leading-snug text-ink2">{children}</p>}
    </>
  );
}

/** Rising Sun toggle chip (handoff §4): a 48 px pill, ink fill when on. Lives on glass cards only. */
export function Pill({
  on,
  check = false,
  className = '',
  children,
  ...rest
}: {
  on: boolean;
  check?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" aria-pressed={on} className={`sun-pill ${className}`} {...rest}>
      {check && on && <Icon name="check" size={16} strokeWidth={2.6} />}
      {children}
    </button>
  );
}
