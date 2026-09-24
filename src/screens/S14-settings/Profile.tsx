import { ScreenHeader, SectionLabel } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ToggleChip } from '@/components/Chip';
import { en } from '@/copy/en';
import { saveProfile, useProfile } from '@/db/repo';
import { EXPERIENCES, GOAL_KINDS, type Experience } from '@/engine/types';
import { coachCall } from '@/engine/prescription';

/** Settings → Profile (FR-SET-4): changes regenerate future goals, never rewrite history. */
export default function ProfileSettings() {
  const profile = useProfile();
  if (!profile) return null;
  const call = coachCall(profile);
  const r = (a: [number, number]) => (a[0] === a[1] ? `${a[0]}` : `${a[0]}–${a[1]}`);
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
