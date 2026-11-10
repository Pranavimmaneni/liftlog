import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { useSessionModel } from '@/app/session-model';
import { useRest } from '@/app/rest-store';
import { addToSession, cancelSession, discardSession, finishSession } from '@/db/workout';
import { platform } from '@/platform';
import { ExercisePicker } from '../S13-library/ExercisePicker';

/** FR-WRK-16: how long "Undo" stays after Start workout. */
export const UNDO_START_MS = 10_000;

/**
 * State and actions of the active workout (S06), shared by the classic screen and the Rising Sun
 * one: finish (FR-WRK-11), cancel and undo (FR-WRK-16), add from list (FR-WRK-10).
 */
export function useWorkoutState() {
  const { sessionId } = useOutletContext<{ sessionId: string }>();
  const model = useSessionModel(sessionId);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const skipRest = useRest((s) => s.skip);
  const [finishing, setFinishing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = model?.session.startedAt;
  const logged = model ? model.items.reduce((n, i) => n + i.sets.length, 0) : 0;
  const undoLeft = startedAt === undefined || logged ? 0 : startedAt + UNDO_START_MS - now;
  useEffect(() => {
    if (undoLeft <= 0) return;
    const t = window.setTimeout(() => setNow(Date.now()), undoLeft);
    return () => window.clearTimeout(t);
  }, [undoLeft]);

  const finish = async () => {
    if (!model) return;
    const work = model.items.reduce((n, i) => n + i.work.length, 0);
    if (!work) return setConfirmDiscard(true);
    setFinishing(true);
    const r = await finishSession(sessionId);
    skipRest();
    void platform.keepAwake(false);
    navigate(r.status === 'finished' ? `/summary/${r.sessionId}` : '/', { replace: true });
  };

  // FR-WRK-16: a workout started by mistake goes without a trace; the Up next queue is untouched.
  const cancel = async (message?: string) => {
    await cancelSession(sessionId);
    skipRest();
    void platform.keepAwake(false);
    if (message) toast(message);
    navigate('/', { replace: true });
  };

  const discard = async () => {
    await discardSession(sessionId);
    skipRest();
    void platform.keepAwake(false);
    navigate('/', { replace: true });
  };

  return {
    sessionId,
    model,
    navigate,
    adding,
    setAdding,
    confirmDiscard,
    setConfirmDiscard,
    confirmCancel,
    setConfirmCancel,
    finishing,
    logged,
    undoLeft,
    finish,
    cancel,
    discard,
  };
}

export type WorkoutState = ReturnType<typeof useWorkoutState>;

/** The picker and the two confirmations (S26) behind the workout screen, in either look. */
export function WorkoutSheets({ w }: { w: WorkoutState }) {
  const { model, sessionId, navigate } = w;
  if (!model) return null;
  return (
    <>
      <ExercisePicker
        open={w.adding}
        title={en.workout.addFromList}
        exclude={model.items.map((i) => i.exercise.id)}
        onClose={() => w.setAdding(false)}
        onPick={async (e) => {
          w.setAdding(false);
          await addToSession(sessionId, e.id);
          navigate(`/workout/${e.id}`);
        }}
        onCreate={(name) => navigate('/library/new', { state: { addToWorkout: true, name } })}
      />
      <Sheet
        open={w.confirmDiscard}
        onClose={() => w.setConfirmDiscard(false)}
        title={en.workout.finishConfirmTitle}
        tone="danger"
        footer={
          <>
            <Button variant="destructive" onClick={() => void w.discard()}>
              {en.workout.discard}
            </Button>
            <Button variant="secondary" onClick={() => w.setConfirmDiscard(false)}>
              {en.workout.keepGoing}
            </Button>
          </>
        }
      >
        <p className="text-[15px]">{en.workout.finishConfirmBody}</p>
      </Sheet>
      <Sheet
        open={w.confirmCancel}
        onClose={() => w.setConfirmCancel(false)}
        title={en.workout.cancelTitle}
        tone="danger"
        footer={
          <>
            <Button variant="destructive" onClick={() => void w.cancel(en.workout.cancelled)}>
              {en.workout.cancel}
            </Button>
            <Button variant="secondary" onClick={() => w.setConfirmCancel(false)}>
              {en.workout.keepGoing}
            </Button>
          </>
        }
      >
        <p className="text-[15px]">{en.workout.cancelBody(w.logged, model.session.name)}</p>
      </Sheet>
    </>
  );
}
