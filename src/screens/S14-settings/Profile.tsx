import { ScreenHeader, SectionLabel } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ToggleChip } from '@/components/Chip';
import { Stepper } from '@/components/Stepper';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import { saveProfile, useProfile } from '@/db/repo';
import { EXPERIENCES, GOAL_KINDS, type Experience } from '@/engine/types';
import { coachCall } from '@/engine/prescription';
import { Pill } from '../onboarding/shared';

/** Settings → Profile (FR-SET-4): changes regenerate future goals, never rewrite history. */
export default function ProfileSettings() {
  const profile = useProfile();
  const sun = useDesign() === 'sun';
  if (!profile) return null;
  const call = coachCall(profile);
  const r = (a: [number, number]) => (a[0] === a[1] ? `${a[0]}` : `${a[0]}–${a[1]}`);
  const s1 = en.onboarding.s1;
  // Rising Sun (FR-DSN-10, after HW1S01): the same choices as pills and a stepper on glass cards.
  if (sun) {
    const head = 'text-[15px] font-bold';
    const nudges: [-1 | 0 | 1, string][] = [
      [-1, s1.easier],
      [0, s1.coach],
      [1, s1.harder],
    ];
    return (
      <main className="pb-10">
        <ScreenHeader title={en.settings.profile} backTo="/settings" />
        <section className="sun-glass mx-5 mt-4 rounded-[18px] p-[18px]">
          <h2 id="p-exp" className={head}>
            {en.settings.experience}
          </h2>
          <div role="group" aria-labelledby="p-exp" className="mt-2.5 flex flex-wrap gap-2">
            {EXPERIENCES.map((l) => (
              <Pill
                key={l}
                on={profile.experience === l}
                onClick={() => void saveProfile({ experience: l, nudge: 0 })}
              >
                {en.levels[l]}
              </Pill>
            ))}
          </div>
          <h2 id="p-goal" className={`${head} mt-5`}>
            {s1.goal}
          </h2>
          <div role="group" aria-labelledby="p-goal" className="mt-2.5 flex flex-wrap gap-2">
            {GOAL_KINDS.map((g) => (
              <Pill key={g} on={profile.goal === g} onClick={() => void saveProfile({ goal: g })}>
                {en.goals[g]}
              </Pill>
            ))}
          </div>
          <h2 className={`${head} mt-5`}>{s1.days}</h2>
          <div className="mt-2.5">
            <Stepper
              id="days-per-week"
              value={profile.daysPerWeek}
              onChange={(d) => void saveProfile({ daysPerWeek: d })}
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
        <section className="sun-glass mx-5 mt-3 rounded-[14px] p-4">
          <h2 id="p-coach" className={head}>
            {s1.coach}
          </h2>
          <p className="mt-1 text-[16px] font-bold" aria-live="polite">
            {s1.coachLine(r(call.sets), r(call.reps), r(call.rest))}
          </p>
          <div role="group" aria-labelledby="p-coach" className="mt-3 flex flex-wrap gap-2">
            {nudges.map(([v, label]) => (
              <Pill key={v} on={profile.nudge === v} onClick={() => void saveProfile({ nudge: v })}>
                {label}
              </Pill>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-ink2">{en.settings.profileNote}</p>
        </section>
      </main>
    );
  }
  return (
    <main className="pb-10">
      <ScreenHeader title={en.settings.profile} backTo="/settings" />
      <SectionLabel>{en.settings.experience}</SectionLabel>
      <div className="px-5">
        <SegmentedControl<Experience>
          label={en.settings.experience}
          height={48}
          value={profile.experience}
          onChange={(experience) => void saveProfile({ experience, nudge: 0 })}
          options={EXPERIENCES.map((l) => ({ value: l, label: en.levels[l]! }))}
        />
      </div>
      <SectionLabel>{en.onboarding.s1.goal}</SectionLabel>
      <div className="flex flex-wrap gap-2 px-5">
        {GOAL_KINDS.map((g) => (
          <ToggleChip key={g} on={profile.goal === g} onClick={() => void saveProfile({ goal: g })}>
            {en.goals[g]}
          </ToggleChip>
        ))}
      </div>
      <SectionLabel>{en.onboarding.s1.days}</SectionLabel>
      <div className="flex gap-2 px-5">
        {[2, 3, 4, 5, 6].map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={profile.daysPerWeek === d}
            onClick={() => void saveProfile({ daysPerWeek: d })}
            className={`t-display-800 h-12 grow rounded-lg border-[1.5px] text-[24px] ${
              profile.daysPerWeek === d ? 'border-ink bg-ink text-card' : 'border-line bg-card'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <SectionLabel>{en.onboarding.s1.coach}</SectionLabel>
      <div className="px-5">
        <SegmentedControl<'-1' | '0' | '1'>
          label={en.onboarding.s1.coach}
          value={String(profile.nudge) as '-1' | '0' | '1'}
          onChange={(v) => void saveProfile({ nudge: Number(v) as -1 | 0 | 1 })}
          options={[
            { value: '-1', label: en.onboarding.s1.easier },
            { value: '0', label: en.onboarding.s1.coach },
            { value: '1', label: en.onboarding.s1.harder },
          ]}
        />
        <p className="mt-3 text-[15px] font-bold">
          {en.onboarding.s1.coachLine(r(call.sets), r(call.reps), r(call.rest))}
        </p>
        <p className="mt-2 text-[13px] text-ink2">{en.settings.profileNote}</p>
      </div>
    </main>
  );
}
