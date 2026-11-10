import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ToggleChip } from '@/components/Chip';
import { Stepper } from '@/components/Stepper';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import type { OnboardingDraft } from '@/db/repo';
import { canNudge, coachCall, repsInReserve } from '@/engine/prescription';
import { EXPERIENCES, GOAL_KINDS } from '@/engine/types';
import { BottomCta, Pill, StepHeader, SunIntro, Title } from './shared';

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
  const sun = useDesign() === 'sun';
  const s1 = en.onboarding.s1;
  // Rising Sun (FR-DSN-10, HW1S01): one glass card of choices, the Coach's call on a second card.
  if (sun)
    return (
      <main className="flex min-h-dvh flex-col">
        <StepHeader step={1} name={s1.name} />
        <section className="sun-glass mx-5 mt-3 rounded-[18px] p-[18px]">
          <SunIntro id="exp-label" title={s1.title}>
            {s1.body}
          </SunIntro>
          <div role="radiogroup" aria-labelledby="exp-label" className="mt-3 flex flex-col gap-2">
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
                  className="sun-setup-choice"
                >
                  <span className="min-w-0 grow">
                    <span className="block text-[16px] font-semibold">{e.name}</span>
                    <span className="sun-setup-choice-sub">{e.desc}</span>
                  </span>
                  {on && <Icon name="check" size={18} strokeWidth={2.6} className="shrink-0" />}
                </button>
              );
            })}
          </div>

          <h2 className="mt-5 text-[15px] font-bold" id="goal-label">
            {s1.goal}
          </h2>
          <div role="group" aria-labelledby="goal-label" className="mt-2.5 flex flex-wrap gap-2">
            {GOAL_KINDS.map((g) => (
              <Pill key={g} on={draft.goal === g} onClick={() => set({ goal: g })}>
                {en.goals[g]}
              </Pill>
            ))}
          </div>

          <h2 className="mt-5 text-[15px] font-bold">{s1.days}</h2>
          <div className="mt-2.5">
            <Stepper
              id="days-per-week"
              value={draft.daysPerWeek}
              onChange={(d) => set({ daysPerWeek: d })}
              step={1}
              min={2}
              max={6}
              decimals={0}
              unitLabel={en.sun.setup.onboarding.daysUnit}
              srLabel={s1.days}
              srUnit={en.sun.setup.onboarding.daysSpoken}
            />
          </div>
        </section>

        <section className="sun-glass mx-5 mt-3 rounded-[14px] p-4" aria-labelledby="coach-label">
          <div aria-live="polite">
            <h2 id="coach-label" className="text-[13px] font-semibold text-accent-text">
              {s1.coach}
            </h2>
            <p className="mt-1 text-[16px] font-bold">
              {s1.coachLine(range(call.sets), range(call.reps), range(call.rest))}
            </p>
            <p className="mt-0.5 text-[13px] text-ink2">{s1.rir(rirLo, rirHi)}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Pill
              on={draft.nudge === -1}
              disabled={!canNudge(draft.experience, draft.nudge, -1)}
              onClick={() => set({ nudge: draft.nudge === 1 ? 0 : -1 })}
            >
              {s1.easier}
            </Pill>
            <Pill
              on={draft.nudge === 1}
              disabled={!canNudge(draft.experience, draft.nudge, 1)}
              onClick={() => set({ nudge: draft.nudge === -1 ? 0 : 1 })}
            >
              {s1.harder}
            </Pill>
          </div>
        </section>

        <BottomCta>
          <Button onClick={onNext}>{s1.cta}</Button>
        </BottomCta>
      </main>
    );
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
