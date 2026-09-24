import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ToggleChip } from '@/components/Chip';
import { en } from '@/copy/en';
import type { OnboardingDraft } from '@/db/repo';
import { canNudge, coachCall, repsInReserve } from '@/engine/prescription';
import { EXPERIENCES, GOAL_KINDS } from '@/engine/types';
import { BottomCta, StepHeader, Title } from './shared';

const range = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);

/** S01 Onboarding 1: experience, goal, days per week, and the Coach's call with Easier/Harder (FR-ONB-2). */
export function S01About({
  draft,
  onChange,
  onNext,
}: {
  draft: OnboardingDraft;
  onChange: (d: OnboardingDraft) => void;
  onNext: () => void;
}) {
  const call = coachCall(draft);
  const [rirLo, rirHi] = repsInReserve(call.effort);
  const set = (patch: Partial<OnboardingDraft>) => onChange({ ...draft, ...patch });
  return (
    <main className="flex min-h-dvh flex-col">
      <StepHeader step={1} name={en.onboarding.s1.name} />
      <Title sub={en.onboarding.s1.body}>{en.onboarding.s1.title}</Title>

      <div role="radiogroup" aria-label={en.onboarding.s1.title} className="flex flex-col gap-2 px-5 pt-3.5">
        {EXPERIENCES.map((lvl) => {
          const on = draft.experience === lvl;
          const e = en.experience[lvl];
          return (
            <button
              key={lvl}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set({ experience: lvl, nudge: 0 })}
              className={`flex min-h-14 w-full items-center gap-3 rounded-lg bg-card px-3.5 py-2 text-left ${
                on ? 'border-2 border-ink shadow-hard' : 'border-[1.5px] border-rule'
              }`}
            >
              <span className="grow">
                <span className="t-display-800 block text-[22px]">{e.name}</span>
                <span className="mt-px block text-[13px] text-ink2">{e.desc}</span>
              </span>
              {on ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-card">
                  <Icon name="check" size={14} strokeWidth={3} />
                </span>
              ) : (
                <span className="h-6 w-6 shrink-0 rounded-full border-2 border-rule" />
              )}
            </button>
          );
        })}
      </div>

      <div className="px-5 pt-4">
        <h2 className="t-label" id="goal-label">
          {en.onboarding.s1.goal}
        </h2>
        <div role="group" aria-labelledby="goal-label" className="mt-2.5 flex flex-wrap gap-2">
          {GOAL_KINDS.map((g) => (
            <ToggleChip key={g} on={draft.goal === g} onClick={() => set({ goal: g })}>
              {en.goals[g]}
            </ToggleChip>
          ))}
        </div>
      </div>

      <div className="px-5 pt-3.5">
        <h2 className="t-label" id="days-label">
          {en.onboarding.s1.days}
        </h2>
        <div role="group" aria-labelledby="days-label" className="mt-2.5 flex gap-2">
          {[2, 3, 4, 5, 6].map((d) => {
            const on = draft.daysPerWeek === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => set({ daysPerWeek: d })}
                className={`t-display-800 h-12 grow rounded-lg border-[1.5px] text-[24px] ${
                  on ? 'border-ink bg-ink text-card' : 'border-line bg-card text-ink'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pt-3.5">
        <div className="ll-card flex items-center gap-3 px-3.5 py-2.5">
          <div className="grow" aria-live="polite">
            <p className="t-label !text-accent">{en.onboarding.s1.coach}</p>
            <p className="mt-1.5 text-[15px] font-bold">
              {en.onboarding.s1.coachLine(range(call.sets), range(call.reps), range(call.rest))}
            </p>
            <p className="mt-0.5 text-[12px] text-ink2">{en.onboarding.s1.rir(rirLo, rirHi)}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              className="ll-chip min-h-11 justify-center"
              disabled={!canNudge(draft.experience, draft.nudge, 1)}
              aria-pressed={draft.nudge === 1}
              data-variant={draft.nudge === 1 ? 'on' : 'plain'}
              onClick={() => set({ nudge: draft.nudge === -1 ? 0 : 1 })}
            >
              {en.onboarding.s1.harder}
            </button>
            <button
              type="button"
              className="ll-chip min-h-11 justify-center"
              disabled={!canNudge(draft.experience, draft.nudge, -1)}
              aria-pressed={draft.nudge === -1}
              data-variant={draft.nudge === -1 ? 'on' : 'plain'}
              onClick={() => set({ nudge: draft.nudge === 1 ? 0 : -1 })}
            >
              {en.onboarding.s1.easier}
            </button>
          </div>
        </div>
      </div>

      <BottomCta>
        <Button onClick={onNext}>{en.onboarding.s1.cta}</Button>
      </BottomCta>
    </main>
  );
}
