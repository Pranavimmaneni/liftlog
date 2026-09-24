import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { useExerciseMap } from '@/db/catalog';
import { updateRoutineSessions, useActiveRoutine, useGym, useProfile } from '@/db/repo';
import { presetGym } from '@/engine/suggest';
import type { RoutineSession } from '@/db/types';
import { splitById } from '@/engine/split';
import { RoutineBuilder } from '../S04-routine/RoutineBuilder';

/** S04 reached from the Plan tab: edit the active routine's sessions. */
export default function EditRoutine() {
  const { index = '0' } = useParams();
  const routine = useActiveRoutine();
  const profile = useProfile();
  const exMap = useExerciseMap();
  const gym = useGym();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<RoutineSession[] | null>(null);
  useEffect(() => {
    if (routine && !sessions) setSessions(routine.sessions);
  }, [routine, sessions]);
  if (!routine || !profile || !exMap || !sessions) return null;
  return (
    <main className="flex min-h-dvh flex-col">
      <ScreenHeader title={en.plan.editTitle} backTo="/plan" />
      <RoutineBuilder
        splitName={splitById(routine.splitId)?.name ?? ''}
        sessions={sessions}
        onChange={setSessions}
        exercises={exMap}
        profile={profile}
        initialTab={Number(index) || 0}
        coverageCtx={{
          gym: gym ?? presetGym('full-gym'),
          daysPerWeek: profile.daysPerWeek,
          limitations: profile.limitations,
        }}
      />
      <div className="sticky bottom-0 mt-auto bg-paper px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3">
        <Button
          onClick={async () => {
            await updateRoutineSessions(routine.id, sessions);
            toast(en.plan.saved);
            navigate('/plan');
          }}
        >
          {en.routine.save}
        </Button>
      </div>
    </main>
  );
}
