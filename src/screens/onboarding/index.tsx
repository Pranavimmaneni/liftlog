import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/Button';
import { en } from '@/copy/en';
import { getExerciseMap } from '@/db/catalog';
import {
  completeOnboarding,
  getOnboarding,
  saveDraft,
  type OnboardingDraft,
  type OnboardingStep,
} from '@/db/repo';
import { recommendSplit, splitById } from '@/engine/split';
import { suggestForSplit } from '@/engine/custom-split';
import type { Exercise } from '@/engine/types';
import { platform } from '@/platform';
import { RoutineBuilder, sessionsFromSuggestion } from '../S04-routine/RoutineBuilder';
import { BottomCta, DEFAULT_DRAFT } from './shared';
import { S01About } from './S01About';
import { S02Gym } from './S02Gym';
import { S03Split } from './S03Split';

const STEPS: OnboardingStep[] = ['about', 'gym', 'split', 'routine'];

/** FR-ONB-1/5: 3-step onboarding, then S04; the back button keeps the answers; leaving resumes. */
export default function Onboarding() {
  const { step = 'about' } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [exMap, setExMap] = useState<Map<string, Exercise> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getOnboarding().then(({ draft: d }) => setDraft(d ?? DEFAULT_DRAFT));
    void getExerciseMap().then(setExMap);
  }, []);

  if (!STEPS.includes(step as OnboardingStep)) return <Navigate to="/onboarding/about" replace />;
  if (!draft) return null;

  const current = step as OnboardingStep;
  const update = (d: OnboardingDraft) => {
    setDraft(d);
    void saveDraft(d, current);
  };
  const go = (to: OnboardingStep, d: OnboardingDraft = draft) => {
    void saveDraft(d, to);
    navigate(`/onboarding/${to}`);
    window.scrollTo(0, 0);
  };

  if (current === 'about') return <S01About draft={draft} onChange={update} onNext={() => go('gym')} />;
  if (current === 'gym')
    return <S02Gym draft={draft} onChange={update} onNext={() => go('split')} onBack={() => go('about')} />;
  if (current === 'split')
    return (
      <S03Split
        draft={draft}
        onChange={update}
        onBack={() => go('gym')}
        onNext={async () => {
          const map = exMap ?? (await getExerciseMap());
          const splitId = draft.splitId ?? recommendSplit(draft.daysPerWeek, draft.experience);
          const suggested = suggestForSplit(splitId, draft.daysPerWeek, draft.customDays, {
            exercises: [...map.values()],
            gym: draft,
            profile: draft,
          });
          const next = {
            ...draft,
            splitId,
            routine: { splitId, sessions: sessionsFromSuggestion(suggested) },
          };
          setDraft(next);
          go('routine', next);
        }}
      />
    );

  // S04 at the end of onboarding (FR-ONB-5).
  if (!draft.routine || !exMap) {
    if (!draft.routine) return <Navigate to="/onboarding/split" replace />;
    return null;
  }
  const routine = draft.routine;
  return (
    <main className="flex min-h-dvh flex-col">
      <RoutineBuilder
        splitName={splitById(routine.splitId)?.name ?? ''}
        sessions={routine.sessions}
        exercises={exMap}
        profile={draft}
        coverageCtx={{ gym: draft, daysPerWeek: draft.daysPerWeek, limitations: draft.limitations }}
        onChange={(sessions) => update({ ...draft, routine: { ...routine, sessions } })}
      />
      <BottomCta>
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await completeOnboarding(draft, routine);
            void platform.persist(); // FR-PLT-7: request durable storage once after onboarding.
            navigate('/', { replace: true });
          }}
        >
          {en.routine.save}
        </Button>
      </BottomCta>
    </main>
  );
}
