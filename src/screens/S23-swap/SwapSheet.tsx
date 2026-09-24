import { useMemo, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { ExerciseRow } from '@/components/ExerciseRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Button } from '@/components/Button';
import { en } from '@/copy/en';
import { useExerciseMap } from '@/db/catalog';
import { useGym, useProfile } from '@/db/repo';
import { presetGym, swapAlternatives } from '@/engine/suggest';
import type { Exercise } from '@/engine/types';
import { ExercisePicker } from '../S13-library/ExercisePicker';

export type SwapScope = 'session' | 'routine';

/**
 * S23 swap sheet: up to 6 alternatives with the same primary muscle and pattern, filtered to My Gym,
 * ranked compound-first then last used. In a workout the user picks "this session only" or
 * "replace in routine".
 */
export function SwapSheet({
  open,
  current,
  lastUsed,
  inWorkout = false,
  onClose,
  onChoose,
  onRemove,
  exclude = [],
}: {
  open: boolean;
  current: Exercise | null;
  lastUsed?: Map<string, number>;
  inWorkout?: boolean;
  onClose: () => void;
  onChoose: (e: Exercise, scope: SwapScope) => void;
  onRemove?: () => void;
  exclude?: string[];
}) {
  const map = useExerciseMap();
  const gym = useGym();
  const profile = useProfile();
  const [scope, setScope] = useState<SwapScope>('session');
  const [browse, setBrowse] = useState(false);
  const alts = useMemo(() => {
    if (!current || !map || !profile) return [];
    return swapAlternatives(
      current,
      {
        exercises: [...map.values()].filter((e) => !e.deleted && !exclude.includes(e.id)),
        gym: gym ?? presetGym('full-gym'),
        profile,
      },
      lastUsed,
    );
  }, [current, map, gym, profile, lastUsed, exclude]);

  if (!current) return null;
  const s = en.swap;
  return (
    <>
      <Sheet open={open && !browse} onClose={onClose} title={s.title(current.name)}>
        {inWorkout && (
          <SegmentedControl<SwapScope>
            label={s.scope}
            value={scope}
            onChange={setScope}
            options={[
              { value: 'session', label: s.thisSession },
              { value: 'routine', label: s.inRoutine },
            ]}
          />
        )}
        <h3 className="t-label mt-3">{s.alternatives}</h3>
        <div className="ll-card mt-2 overflow-hidden">
          {alts.map((a) => (
            <ExerciseRow key={a.id} exercise={a} onClick={() => onChoose(a, inWorkout ? scope : 'routine')} />
          ))}
          {!alts.length && <p className="p-3 text-[15px] text-ink2">{s.none}</p>}
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button variant="secondary" onClick={() => setBrowse(true)}>
            {s.browse}
          </Button>
          {onRemove && (
            <Button variant="destructive" onClick={onRemove}>
              {s.remove}
            </Button>
          )}
        </div>
      </Sheet>
      <ExercisePicker
        open={open && browse}
        title={s.title(current.name)}
        exclude={[current.id, ...exclude]}
        onClose={() => setBrowse(false)}
        onPick={(e) => {
          setBrowse(false);
          onChoose(e, inWorkout ? scope : 'routine');
        }}
      />
    </>
  );
}
