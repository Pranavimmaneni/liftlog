import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
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
  return (
    <div className="sticky bottom-0 mt-auto bg-paper px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3">
      {children}
    </div>
  );
}
