import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { LinkButton } from '@/components/Button';
import { EmptyState } from '@/components/Toast';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import { db } from '@/db/schema';
import { getExerciseMap } from '@/db/catalog';
import { machineInfo } from '@/db/machines';
import { addToSession, getActiveSession } from '@/db/workout';
import { exerciseForMachine } from '@/app/qr';

/**
 * `/m/<machineId>` (S22 web fallback): with a workout open, adds that machine's exercise if needed
 * and opens its logger (S08); otherwise opens the exercise detail (S16).
 */
export default function MachineLink() {
  const { machineId = '' } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string | null>(null);
  const sun = useDesign() === 'sun';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const note = await db.machineNotes.get(machineId);
      const info = machineInfo(machineId, note);
      if (!info) return !cancelled && setProblem(en.scan.noMachine);
      const map = await getExerciseMap();
      const routine = await db.routines.where('active').equals(1).first();
      const routineIds = (routine?.sessions ?? []).flatMap((s) => s.items.map((i) => i.exerciseId));
      const session = await getActiveSession();
      const inSession = session?.plan
        .map((p) => map.get(p.exerciseId))
        .find((e) => e?.machineId === machineId);
      const ex = inSession ?? exerciseForMachine(machineId, map.values(), routineIds);
      if (!ex) return !cancelled && setProblem(en.scan.noExercise(info.name));
      if (cancelled) return;
      if (session) {
        if (!inSession) await addToSession(session.id, ex.id);
        navigate(`/workout/${ex.id}`, { replace: true });
      } else {
        navigate(`/library/${ex.id}`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [machineId, navigate]);

  return (
    <main className="px-5 pt-6">
      {problem && sun ? (
        // Rising Sun (FR-DSN-10, S26a): a centred glass card with the way on as its button.
        <div className="sun-glass rounded-[18px] p-[18px] text-center">
          <p className="text-[17px] font-bold leading-snug">{problem}</p>
          <LinkButton to="/scan" className="mt-4">
            {en.scan.title}
          </LinkButton>
        </div>
      ) : problem ? (
        <EmptyState
          action={
            <Link to="/scan" className="ll-link">
              {en.scan.title}
            </Link>
          }
        >
          {problem}
        </EmptyState>
      ) : (
        <p
          role="status"
          className={
            sun ? 'sun-glass rounded-[14px] px-4 py-3.5 text-[15px] text-ink2' : 'text-[15px] text-ink2'
          }
        >
          {en.scan.resolving}
        </p>
      )}
    </main>
  );
}
