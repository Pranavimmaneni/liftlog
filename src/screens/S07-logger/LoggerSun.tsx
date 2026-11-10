import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/Button';
import { muscleName } from '@/components/ExerciseRow';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { Ring } from '@/components/sun/Ring';
import { toast } from '@/components/Toast';
import { MuscleMap, Pictogram } from '@/illustration/Pictogram';
import { poseDef } from '@/illustration/svg';
import { en } from '@/copy/en';
import { formatReason, list } from '@/copy/format';
import { useRest } from '@/app/rest-store';
import { setEffort, setHurts, swapInSession } from '@/db/workout';
import type { SetRow } from '@/db/types';
import { ADJUST_MS, formatClock, restSecondsFor } from '@/engine/timer';
import { displayNumber, formatLoad, hasLoad, toDisplay } from '@/engine/units';
import { platform } from '@/platform';
import { MachinePanel } from '../S08-machine/MachinePanel';
import { SwapSheet } from '../S23-swap/SwapSheet';
import { OverrideSheet } from '../S24-override/OverrideSheet';
import { useRemaining } from '../S25-timer/RestTimer';
import { EditSetSheet } from './EditSetSheet';
import { calibrationStart, EFFORTS, replaceInRoutine, repsText, type LoggerReady } from './useLogger';

function SetMark({ kind }: { kind: 'done' | 'missed' | 'open' | 'warm' }) {
  if (kind === 'open')
    return (
      <span
        className="h-[22px] w-[22px] shrink-0 rounded-full shadow-[inset_0_0_0_2px_var(--ll-ink)]"
        aria-hidden="true"
      />
    );
  return (
    <span
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
        kind === 'done'
          ? 'bg-sage text-on-sage'
          : kind === 'missed'
            ? 'text-ink2 shadow-[inset_0_0_0_1.5px_var(--ll-ink2)]'
            : 'border border-dashed border-ink2 text-ink2'
      }`}
      aria-hidden="true"
    >
      {kind !== 'warm' && <Icon name="check" size={13} strokeWidth={3.2} />}
    </span>
  );
}

function SetLine({
  mark,
  label,
  bold = false,
  value,
  tag,
  onClick,
  ariaLabel,
}: {
  mark: ReactNode;
  label: string;
  bold?: boolean;
  value: string;
  tag?: string;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-2.5">
        {mark}
        <span className={bold ? 'font-bold' : 'font-medium'}>{label}</span>
      </span>
      <span>
        <b className="tabular-nums">{value}</b>
        {tag && <span className="text-[13px] text-ink2"> {tag}</span>}
      </span>
    </>
  );
  const cls =
    'flex min-h-11 w-full items-center justify-between gap-3 border-t border-hairline text-left text-[15px]';
  return onClick ? (
    <li>
      <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel}>
        {inner}
      </button>
    </li>
  ) : (
    <li className={cls}>{inner}</li>
  );
}

/**
 * S07 Logging a set and S25 Rest timer in the Rising Sun look (FR-DSN-6, FR-DSN-7; handoff §7).
 * One screen, two states. Logging: pictogram and muscle map, today's sets, weight and reps
 * steppers, the "Last session" and "Today's goal" tiles, the planned rest in the header, one Log
 * button. Resting (a rest timer is running): ring countdown with Skip, the sets, "How did set N
 * feel?" and "Start set N now". What the mockups drop for calm stays reachable from the options
 * sheet: rest −15 s / +15 s, "Hurts", swap and form tips (handoff §8.1). Behaviour is the classic
 * logger's (FR-WRK-4/5/6/7/9/14, FR-TMR-1…4, FR-GOAL-5).
 */
export function LoggerSun({ L }: { L: LoggerReady }) {
  const { sessionId, model, navigate, skipRest, item, units, ex, g, lt, done, idx } = L;
  const [options, setOptions] = useState(false);
  const remaining = useRemaining();
  const timer = useRest((s) => s.timer);
  const adjust = useRest((s) => s.adjust);
  const t = en.sun.logger;
  const r = en.sun.rest;

  const resting = remaining !== null;
  const restOver = remaining === 0;
  const position = model.items.findIndex((i) => i.exercise.id === ex.id) + 1;
  const lastWork: SetRow | undefined = item.work[item.work.length - 1];
  const nextItem = model.current && model.current.exercise.id !== ex.id ? model.current : undefined;
  const hasPose = !!poseDef(ex.poseId);
  const withLoad = hasLoad(lt);
  const repUnit = lt === 'timed' ? en.logger.seconds : en.logger.reps;
  const setValue = (s: Pick<SetRow, 'loadKg' | 'reps'>) =>
    withLoad ? `${displayNumber(s.loadKg, units)} × ${s.reps}` : `${s.reps}${lt === 'timed' ? ' s' : ''}`;
  const draft = withLoad
    ? `${L.load === null ? '–' : displayNumber(L.load, 'kg')} × ${L.reps ?? '–'}`
    : `${L.reps ?? '–'}${lt === 'timed' ? ' s' : ''}`;
  const setLabel = `${idx > g.sets ? en.logger.extraSet : en.logger.set(idx)}${item.nextSide ? ` ${item.nextSide}` : ''}`;
  const lastSets = item.last?.sets.filter((s) => s.kind !== 'warmup') ?? [];

  const sets = (
    <ul aria-label={t.sets} className="w-full">
      {item.warmupsLogged.map((w) => (
        <SetLine
          key={w.id}
          mark={<SetMark kind="done" />}
          label={t.warmup}
          value={setValue(w)}
          onClick={() => L.setEditing(w)}
          ariaLabel={`${en.logger.editSet}: ${t.warmup}, ${setValue(w)}`}
        />
      ))}
      {!done &&
        !resting &&
        L.pendingWarmups.map((w, i) => (
          <SetLine
            key={`pw${i}`}
            mark={<SetMark kind="warm" />}
            label={t.warmup}
            value={setValue(w)}
            tag={en.logger.tapToLog.toLowerCase()}
            onClick={() => void L.logWarmup(w)}
            ariaLabel={`${en.logger.logWarm} ${displayNumber(w.loadKg, units)} ${units} × ${w.reps}`}
          />
        ))}
      {item.work.map((s) => {
        const label = `${s.kind === 'extra' ? en.logger.extraSet : en.logger.set(s.idx)}${s.side ? ` ${s.side}` : ''}`;
        const tags = [
          s.id === item.prSetId ? t.record : '',
          s.bonusReps > 0 ? `+${s.bonusReps}` : '',
          s.effort ? en.logger.effort[s.effort].toLowerCase() : '',
          s.hurts ? en.logger.hurts.toLowerCase() : '',
        ].filter(Boolean);
        return (
          <SetLine
            key={s.id}
            mark={<SetMark kind={s.goalMet ? 'done' : 'missed'} />}
            label={label}
            value={setValue(s)}
            tag={tags.join(' · ')}
            onClick={() => L.setEditing(s)}
            ariaLabel={`${en.logger.editSet}: ${label}, ${setValue(s)}${
              s.id === item.prSetId ? `, ${en.logger.newPr}` : ''
            }`}
          />
        );
      })}
      {!done && (
        <SetLine
          mark={<SetMark kind="open" />}
          label={setLabel}
          bold
          value={draft}
          tag={resting ? t.next : t.now}
        />
      )}
    </ul>
  );

  const nextTime = done && item.next && (
    <p className="mt-3 text-[15px] leading-snug" data-testid="next-time">
      <b>
        {en.logger.nextTime}{' '}
        {withLoad && item.next.loadKg !== null ? `${formatLoad(item.next.loadKg, lt, units)} × ` : ''}
        {item.next.repMax}.
      </b>{' '}
      {formatReason(item.next.reason, units, lt)}.
    </p>
  );

  const extraButton = done && (
    <button type="button" className="sun-pill mt-3 self-start" onClick={() => L.setExtra(true)}>
      + {en.logger.extraSet}
    </button>
  );

  return (
    <main className="flex grow flex-col">
      <header className="sun-bar sun-glass">
        <Link
          to="/workout"
          className="flex min-h-11 min-w-0 items-center gap-0.5 justify-self-start font-medium !text-ink no-underline"
        >
          <Icon name="back" size={20} />
          <span className="sr-only">{en.common.back}: </span>
          <span className="truncate">{model.session.name}</span>
        </Link>
        <h1 className="min-w-0 break-words text-center text-[17px] font-bold leading-tight">{ex.name}</h1>
        <div className="flex items-center justify-end gap-0.5">
          <span className="whitespace-nowrap text-[15px] text-ink2">
            {t.position(position, model.items.length)}
          </span>
          <button
            type="button"
            className="flex h-11 w-9 items-center justify-center text-ink"
            aria-label={t.optionsFor(ex.name)}
            onClick={() => setOptions(true)}
          >
            <Icon name="dots" strokeWidth={3} />
          </button>
        </div>
      </header>

      <section
        className="sun-glass mx-5 mt-4 flex grow flex-col rounded-[18px] px-[18px] py-5"
        aria-label={resting ? r.label : setLabel}
      >
        {resting ? (
          <>
            <Ring
              value={timer && timer.durationMs > 0 ? remaining / timer.durationMs : 0}
              size={200}
              stroke={8}
              color="var(--ll-accent)"
              className="mx-auto"
            >
              <span className="text-[15px] text-ink2">{restOver ? en.timer.done : r.label}</span>
              <span
                className={`sun-display text-[51px] ${restOver ? 'sun-rest-over text-accent-text' : ''}`}
                role="timer"
                aria-live="off"
                aria-label={r.ring(formatClock(remaining))}
              >
                {formatClock(remaining)}
              </span>
              <button
                type="button"
                className="mt-0.5 min-h-11 px-4 text-[15px] font-semibold"
                aria-label={en.timer.skip}
                onClick={skipRest}
              >
                {en.common.skip}
              </button>
            </Ring>
            <div className="mt-5">{sets}</div>
            {nextTime}
            {extraButton}
            {lastWork && (
              <div className="mt-auto pt-5">
                <p className="mb-2.5 font-semibold" id="feel-q">
                  {r.feel(lastWork.idx)}
                </p>
                {/* FR-WRK-6: optional one-tap effort right after logging. */}
                <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="feel-q">
                  {EFFORTS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="sun-pill"
                      aria-pressed={lastWork.effort === e}
                      onClick={() => void setEffort(lastWork.id, lastWork.effort === e ? undefined : e)}
                    >
                      {en.logger.effort[e]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold">
                {done
                  ? t.allDone(item.work.length)
                  : idx > g.sets
                    ? setLabel
                    : `${t.setOf(idx, g.sets)}${item.nextSide ? ` · ${en.logger.side[item.nextSide]}` : ''}`}
              </p>
              <span className="text-[14px] text-ink2">
                {t.rest(formatClock(restSecondsFor(ex.role, model.settings) * 1000))}
              </span>
            </div>
            <div className="sun-picto mt-2.5 flex items-center justify-center gap-3.5">
              {hasPose && (
                <Pictogram
                  poseId={ex.poseId!}
                  animate
                  label={ex.name}
                  className="h-[106px] w-[150px] shrink-0"
                />
              )}
              <MuscleMap
                primary={ex.primary}
                secondary={ex.secondary}
                label={t.muscles(
                  list(ex.primary.map((m) => muscleName(m).toLowerCase())),
                  list(ex.secondary.map((m) => muscleName(m).toLowerCase())),
                )}
                className={hasPose ? 'h-[75px] w-[92px] shrink-0' : 'h-[106px] w-[131px] shrink-0'}
              />
            </div>
            <div className="mt-2">{sets}</div>
            {nextTime}
            {extraButton}

            {!done && (
              <div className="mt-auto flex flex-col gap-2 pt-4">
                {withLoad && (
                  <Stepper
                    id="load"
                    value={L.load}
                    onChange={L.setLoad}
                    step={L.incDisplay}
                    unitLabel={L.unitLabel}
                    srLabel={en.logger.loadLabel}
                    srUnit={
                      lt === 'dumbbell'
                        ? `${units === 'kg' ? 'kilograms' : 'pounds'} per hand`
                        : units === 'kg'
                          ? 'kilograms'
                          : 'pounds'
                    }
                    emptyStart={calibrationStart(ex, units)}
                  />
                )}
                <Stepper
                  id="reps"
                  value={L.reps}
                  onChange={L.setReps}
                  step={lt === 'timed' ? 5 : 1}
                  decimals={0}
                  min={0}
                  unitLabel={repUnit}
                  srLabel={lt === 'timed' ? en.logger.secondsLabel : en.logger.repsLabel}
                  srUnit={lt === 'timed' ? 'seconds' : 'reps'}
                />
                {L.showNudge && L.nudgeText && (
                  <div
                    className="flex items-center gap-2 rounded-[14px] bg-brass-wash px-3 py-2"
                    role="status"
                  >
                    <span className="grow text-[13px]">{L.nudgeText}</span>
                    <button
                      type="button"
                      className="sun-pill !min-h-11 shrink-0"
                      onClick={() => {
                        L.setLoad(Math.round(toDisplay(L.nudge!.loadKg, units) * 10) / 10);
                        L.setNudgeUsed(L.key);
                      }}
                    >
                      {en.logger.use(L.nudgeValue)}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className={`grid grid-cols-2 gap-2.5 ${done ? 'mt-auto pt-4' : 'pt-4'}`}>
              <div className="rounded-[14px] bg-sage px-3.5 py-2.5 text-on-sage">
                <span className="block text-[13px]">{t.lastSession}</span>
                {lastSets.length ? (
                  <>
                    <p className="mt-0.5">
                      {withLoad ? (
                        <>
                          <span className="sun-display text-[19px]">
                            {displayNumber(lastSets[0]!.loadKg, units)}
                          </span>{' '}
                          <span className="text-[13px]">{L.unitLabel}</span>
                        </>
                      ) : (
                        <span className="sun-display text-[19px]">{lastSets.length} ×</span>
                      )}
                    </p>
                    <b className="text-[14px]">
                      {t.repsLine(lastSets.map((s) => s.reps).join(' · '), repUnit)}
                    </b>
                  </>
                ) : (
                  <b className="mt-1 block text-[14px]">{t.noLast}</b>
                )}
              </div>
              <button
                type="button"
                className="rounded-[14px] bg-soft px-3.5 py-2.5 text-left shadow-[inset_0_0_0_1.5px_var(--ll-accent)]"
                aria-label={`${en.override.edit}: ${g.sets} × ${repsText(g)}`}
                onClick={() => L.setOverrideOpen(true)}
              >
                <span className="block text-[13px] font-bold">
                  {item.overridden ? t.yourGoal : t.todaysGoal}
                </span>
                <span className="mt-0.5 block">
                  {withLoad && g.loadKg !== null ? (
                    <>
                      <span className="sun-display text-[19px]">{displayNumber(g.loadKg, units)}</span>{' '}
                      <span className="text-[13px] text-ink2">{L.unitLabel}</span>
                    </>
                  ) : (
                    <span className="sun-display text-[19px]">
                      {withLoad ? en.logger.firstTime : formatLoad(0, lt, units)}
                    </span>
                  )}
                </span>
                <b className="text-[14px]">
                  {g.sets} × {t.repsLine(repsText(g), repUnit)}
                </b>
              </button>
            </div>
            {/* FR-GOAL-5: the reason line always accompanies the target (DECISIONS D45). */}
            <p className="pt-2 text-[13px] text-ink2" data-testid="goal-reason">
              {formatReason(g.reason, units, lt)}
              {g.calibration ? ` · ${en.logger.calibration}` : ''}
            </p>
          </>
        )}
      </section>

      {L.isMachine && !resting && <MachinePanel exercise={ex} units={units} />}

      <div className="sticky bottom-0 mt-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3.5">
        {done ? (
          nextItem ? (
            <Button onClick={() => navigate(`/workout/${nextItem.exercise.id}`)}>
              {r.nextLift(nextItem.exercise.name)}
            </Button>
          ) : (
            <Button onClick={() => navigate('/workout')}>{en.logger.backToWorkout}</Button>
          )
        ) : resting ? (
          <Button onClick={skipRest}>
            {item.nextSide
              ? r.startSide(idx, en.logger.side[item.nextSide])
              : idx > g.sets
                ? r.startExtra
                : r.startNow(idx)}
          </Button>
        ) : (
          <Button onClick={L.log} disabled={L.busy || (withLoad && L.load === null)}>
            {item.nextSide
              ? en.logger.logSide(idx, en.logger.side[item.nextSide])
              : idx > g.sets
                ? en.logger.logExtra
                : en.logger.logSet(idx)}
          </Button>
        )}
      </div>

      {/* Handoff §8.1: what the mockups leave out lives here. */}
      <Sheet open={options} onClose={() => setOptions(false)} title={t.options}>
        <div className="flex flex-col gap-2.5">
          {resting && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  variant="ghost"
                  className="h-12"
                  aria-label={en.timer.minus}
                  onClick={() => adjust(-ADJUST_MS)}
                >
                  −15 s
                </Button>
                <Button
                  variant="ghost"
                  className="h-12"
                  aria-label={en.timer.plus}
                  onClick={() => adjust(ADJUST_MS)}
                >
                  +15 s
                </Button>
              </div>
              {!platform.capabilities().lockScreenAlerts && (
                <p className="text-[13px] text-ink2">{en.timer.lockNote}</p>
              )}
            </>
          )}
          <Button
            variant="ghost"
            className="h-12"
            onClick={() => {
              setOptions(false);
              L.setSwap(true);
            }}
          >
            <Icon name="swap" /> {t.swap}
          </Button>
          <Button
            variant="ghost"
            className="h-12"
            onClick={() => {
              setOptions(false);
              L.setOverrideOpen(true);
            }}
          >
            {t.changeGoal}
          </Button>
          {lastWork && !lastWork.hurts && (
            <Button
              variant="destructive"
              className="!h-12"
              onClick={() => {
                void setHurts(lastWork.id, true);
                setOptions(false);
                toast(en.logger.hurtsNote);
                L.setSwap(true);
              }}
            >
              {en.logger.hurts}
            </Button>
          )}
          {ex.instructions.length > 0 && (
            <>
              <h3 className="mt-2 font-bold">{en.logger.formTips}</h3>
              <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-snug">
                {ex.instructions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      </Sheet>
      <OverrideSheet
        open={L.overrideOpen}
        onClose={() => L.setOverrideOpen(false)}
        exercise={ex}
        goal={g}
        coachGoal={item.coachGoal}
        overridden={item.overridden}
        units={units}
      />
      <EditSetSheet
        set={L.editing}
        exercise={ex}
        target={g}
        units={units}
        bodyweightKg={model.bodyweightKg}
        onClose={() => L.setEditing(null)}
      />
      <SwapSheet
        open={L.swap}
        current={ex}
        inWorkout
        exclude={model.items.map((i) => i.exercise.id)}
        onClose={() => L.setSwap(false)}
        onChoose={async (to, scope) => {
          L.setSwap(false);
          await swapInSession(sessionId, ex.id, to.id);
          if (scope === 'routine') await replaceInRoutine(model.session.routineSessionId, ex.id, to.id);
          skipRest();
          navigate(`/workout/${to.id}`, { replace: true });
        }}
      />
    </main>
  );
}
