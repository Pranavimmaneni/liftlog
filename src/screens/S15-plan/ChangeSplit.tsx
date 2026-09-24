import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { useExerciseMap } from '@/db/catalog';
import { replaceRoutine, useGym, useProfile, type OnboardingDraft } from '@/db/repo';
import type { RoutineSession } from '@/db/types';
import { buildRoutine } from '@/engine/coverage';
import { recommendSplit, sessionsFor, splitById } from '@/engine/split';
import { presetGym } from '@/engine/suggest';
import { RoutineBuilder, sessionsFromSuggestion } from '../S04-routine/RoutineBuilder';
import { BottomCta } from '../onboarding/shared';
import { S03Split } from '../onboarding/S03Split';

/**
 * S15 "Change split" (FR-RTN-6): re-runs S03 → S04 and archives the old routine. History, PRs and
 * goals for shared exercises are kept because they are derived from the log, not the routine.
 */
export default function ChangeSplit() {
  const navigate = useNavigate();
  const profile = useProfile();
  const gym = useGym();
  const exMap = useExerciseMap();
  const [splitId, setSplitId] = useState<string | undefined>();
  const [sessions, setSessions] = useState<RoutineSession[] | null>(null);
  if (!profile || !exMap) return null;
  const g = gym ?? presetGym('full-gym');
  const draft: OnboardingDraft = {
    experience: profile.experience,
    goal: profile.goal,
    daysPerWeek: profile.daysPerWeek,
    nudge: profile.nudge,
    presetId: gym?.presetId ?? 'full-gym',
    equipmentIds: g.equipmentIds,
    machineIds: g.machineIds,
    limitations: profile.limitations,
    units: profile.units,
    splitId,
  };

  if (!sessions) {
    return (
      <S03Split
        draft={draft}
        onChange={(d) => setSplitId(d.splitId)}
        onBack={() => navigate('/plan')}
        onNext={() => {
          const id = splitId ?? recommendSplit(profile.daysPerWeek, profile.experience);
          setSplitId(id);
          setSessions(
            sessionsFromSuggestion(
              buildRoutine(sessionsFor(id, profile.daysPerWeek), {
                exercises: [...exMap.values()].filter((e) => !e.deleted),
                gym: g,
                profile,
              }),
            ),
          );
        }}
      />
    );
  }
  const id = splitId ?? recommendSplit(profile.daysPerWeek, profile.experience);
  return (
    <main className="flex min-h-dvh flex-col">
      <RoutineBuilder
        splitName={splitById(id)?.name ?? ''}
        sessions={sessions}
        onChange={setSessions}
        exercises={exMap}
        profile={profile}
        coverageCtx={{ gym: g, daysPerWeek: profile.daysPerWeek, limitations: profile.limitations }}
      />
      <BottomCta>
        <Button
          onClick={async () => {
            await replaceRoutine({ splitId: id, sessions });
            toast(en.plan.splitChanged);
            navigate('/plan', { replace: true });
          }}
        >
          {en.routine.save}
        </Button>
      </BottomCta>
    </main>
  );
}
