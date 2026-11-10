import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Stepper } from '@/components/Stepper';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { formatReason, shortDate } from '@/copy/format';
import type { ItemModel } from '@/app/session-model';
import { useDesign } from '@/app/design';
import { setEffort, setHurts, swapInSession } from '@/db/workout';
import { displayNumber, formatLoad, hasLoad, toDisplay } from '@/engine/units';
import { RestChip } from '../S25-timer/RestTimer';
import { SwapSheet } from '../S23-swap/SwapSheet';
import { EditSetSheet } from './EditSetSheet';
import { IllustrationPanel } from './IllustrationPanel';
import { MachinePanel } from '../S08-machine/MachinePanel';
import { OverrideSheet } from '../S24-override/OverrideSheet';
import { LoggerSun } from './LoggerSun';
import {
  calibrationStart,
  EFFORTS,
  replaceInRoutine,
  repsText,
  useLogger,
  type LoggerReady,
} from './useLogger';

function CheckCircle({ kind }: { kind: 'bonus' | 'met' | 'missed' }) {
  if (kind === 'missed')
    return (
      <span
        className="h-[22px] w-[22px] shrink-0 rounded-full border-[2.5px] border-ink2"
        aria-hidden="true"
      />
    );
  return (
    <span
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${kind === 'bonus' ? 'bg-brass text-on-brass' : 'bg-ink text-card'}`}
      aria-hidden="true"
    >
      <Icon name="check" size={13} strokeWidth={3.4} />
    </span>
  );
}

/** S07 / S08 set logger. The Rising Sun look has its own layout over the same state (FR-DSN-6). */
export default function Logger() {
  const L = useLogger();
  const sun = useDesign() === 'sun';
  if (L.status === 'gone') return <Navigate to="/" replace />;
  if (L.status === 'loading') return null;
  if (L.status === 'missing') return <MissingExercise />;
  return sun ? <LoggerSun L={L} /> : <LoggerClassic L={L} />;
}

/** S07 free weight / S08 machine: one component (PRD §4). FR-WRK-4/5/6/7/9/14, FR-TMR-1, FR-GOAL-5. */
function LoggerClassic({ L }: { L: LoggerReady }) {
  const {
    sessionId,
    model,
    navigate,
    skipRest,
    item,
    units,
    load,
    setLoad,
    reps,
    setReps,
    setExtra,
    editing,
    setEditing,
    menuFor,
    setMenuFor,
    swap,
    setSwap,
    busy,
    setNudgeUsed,
    overrideOpen,
    setOverrideOpen,
    key,
    nudge,
    ex,
    g,
    lt,
    isMachine,
    done,
    idx,
    pendingWarmups,
    unitLabel,
    incDisplay,
    doneCount,
    log,
    logWarmup,
    subtitle,
    lastLine,
    lastLoad,
    nudgeText,
    nudgeValue,
    showNudge,
  } = L;

  return (
    <main className="flex grow flex-col">
      <ScreenHeader
        title={ex.name}
        size={30}
        subtitle={subtitle}
        backTo="/workout"
        right={
          <button
            type="button"
            className="ll-icon-btn"
            aria-label={en.routine.swap(ex.name)}
            onClick={() => setSwap(true)}
          >
            <Icon name="swap" />
          </button>
        }
      />
      {isMachine && item.complete && (
        <div className="flex gap-2 px-5 pt-3">
          <Chip className="!px-4 !py-2.5">{en.logger.goalMet}</Chip>
        </div>
      )}

      <IllustrationPanel exercise={ex} />
      {isMachine && <MachinePanel exercise={ex} units={units} />}

      <div className="grid grid-cols-2 gap-2.5 px-5 pt-3">
        <button
          type="button"
          className="ll-card ll-card-hard px-3 py-2.5 text-left"
          aria-label={`${en.override.edit}: ${g.sets} × ${repsText(g)}`}
          onClick={() => setOverrideOpen(true)}
        >
          <span className="t-label block !text-accent">
            {item.overridden ? en.override.yours : en.logger.goalToday}
          </span>
          <span className="t-display mt-1.5 block text-[28px]">
            {g.sets} × {repsText(g)}
            {lt === 'timed' ? ' s' : ''}
          </span>
          <span className="t-mono mt-1 block text-[12px]">
            {hasLoad(lt)
              ? g.loadKg === null
                ? en.logger.firstTime
                : formatLoad(g.loadKg, lt, units)
              : formatLoad(0, lt, units)}
          </span>
        </button>
        <div className="ll-card px-3 py-2.5">
          <p className="t-label">
            {item.last ? en.logger.last(shortDate(item.last.at)) : en.logger.lastNone}
          </p>
          <p className="t-display mt-1.5 text-[28px] text-ink2">{lastLine || '–'}</p>
          <p className="t-mono mt-1 text-[12px] text-ink2">
            {lastLoad && hasLoad(lt) ? formatLoad(lastLoad.loadKg, lt, units) : ''}
          </p>
        </div>
      </div>
      {/* FR-GOAL-5: the reason line always accompanies the target (DECISIONS D45). */}
      <p className="px-5 pt-2 text-[13px] text-ink2" data-testid="goal-reason">
        {formatReason(g.reason, units, lt)}
        {g.calibration ? ` · ${en.logger.calibration}` : ''}
      </p>

      <section className="ll-card mx-5 mt-3" aria-labelledby="logbook">
        <div className="flex justify-between border-b-[1.5px] border-line px-3 py-2">
          <h2 id="logbook" className="t-label">
            {en.logger.logbook}
          </h2>
          <span className="t-label !text-ink">{en.logger.done(doneCount, g.sets)}</span>
        </div>

        {item.warmupsLogged.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setEditing(w)}
            className="flex min-h-[44px] w-full items-center gap-2.5 border-b border-rule px-3 text-left"
          >
            <span className="t-mono w-[22px] text-center text-[11px] font-semibold text-ink2">W</span>
            <span className="t-mono w-[42px] text-[11px] text-ink2">{en.logger.warm}</span>
            <span className="t-num grow text-[16px] text-ink2">
              {displayNumber(w.loadKg, units)} {units} × {w.reps}
            </span>
          </button>
        ))}
        {!done &&
          pendingWarmups.map((w, i) => (
            <button
              key={`pw${i}`}
              type="button"
              onClick={() => logWarmup(w)}
              aria-label={`${en.logger.logWarm} ${displayNumber(w.loadKg, units)} ${units} × ${w.reps}`}
              className="flex min-h-[44px] w-full items-center gap-2.5 border-b border-dashed border-rule px-3 text-left"
            >
              <span className="t-mono flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-dashed border-ink2 text-[11px] font-semibold text-ink2">
                W
              </span>
              <span className="t-mono w-[42px] text-[11px] text-ink2">{en.logger.warm}</span>
              <span className="t-num grow text-[16px] text-ink2">
                {displayNumber(w.loadKg, units)} {units} × {w.reps}
              </span>
              <span className="ll-chip" data-variant="soft">
                {en.logger.tapToLog}
              </span>
            </button>
          ))}

        {item.work.map((s, i) => {
          const status = s.goalMet ? (s.bonusReps > 0 ? 'bonus' : 'met') : 'missed';
          const isLatest = i === item.work.length - 1;
          const label = `${s.kind === 'extra' ? en.logger.extraSet : en.logger.set(s.idx)}${s.side ? ` ${s.side}` : ''}`;
          return (
            <div key={s.id} className="border-b border-rule">
              <div className="flex min-h-[44px] items-center gap-2.5 px-3">
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="flex min-h-[44px] grow items-center gap-2.5 text-left"
                  aria-label={`${en.logger.editSet}: ${label}, ${displayNumber(s.loadKg, units)} ${units} × ${s.reps}`}
                >
                  <CheckCircle kind={status} />
                  <span className="t-mono w-[42px] whitespace-nowrap text-[11px] text-ink2">{label}</span>
                  <span className="t-num grow text-[16px]">
                    {hasLoad(lt)
                      ? `${displayNumber(s.loadKg, units)} ${units} × ${s.reps}`
                      : `${s.reps}${lt === 'timed' ? ' s' : ''}`}
                  </span>
                </button>
                {s.id === item.prSetId && (
                  <span
                    className="t-display ll-stamp-anim rounded-[3px] border-[1.5px] border-brass bg-brass-wash px-1.5 text-[15px] text-brass-text"
                    style={{ transform: 'rotate(-8deg)' }}
                    aria-label={en.logger.newPr}
                  >
                    {en.summary.pr}
                  </span>
                )}
                {s.bonusReps > 0 && (
                  <Chip variant="brass" className="!px-2.5 !py-1.5">
                    +{s.bonusReps}
                  </Chip>
                )}
                {s.hurts && <Chip variant="outline-red">{en.logger.hurts}</Chip>}
                {s.effort && (
                  <button
                    type="button"
                    className="ll-chip min-h-9"
                    data-variant="soft"
                    onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
                  >
                    {en.logger.effort[s.effort]}
                  </button>
                )}
              </div>
              {/* FR-WRK-6: optional one-tap effort right after logging; "Hurts" behind the … menu. */}
              {((isLatest && !s.effort) || menuFor === s.id) && (
                <div
                  className="flex items-center gap-1.5 px-3 pb-2.5"
                  role="group"
                  aria-label={en.logger.effortPrompt}
                >
                  {EFFORTS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-pressed={s.effort === e}
                      className="ll-chip min-h-11 grow justify-center"
                      data-variant={s.effort === e ? 'on' : 'soft'}
                      onClick={() => {
                        void setEffort(s.id, s.effort === e ? undefined : e);
                        setMenuFor(null);
                      }}
                    >
                      {en.logger.effort[e]}
                    </button>
                  ))}
                  <HurtsMenu
                    onHurts={() => {
                      void setHurts(s.id, true);
                      setMenuFor(null);
                      toast(en.logger.hurtsNote);
                      setSwap(true);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {!done && (
          <div className="bg-card px-3 py-2.5">
            {/* The set label sits above the steppers so each gets half the row (FR-WRK-5a, D87). */}
            <div className="flex items-center gap-2.5">
              <span
                className="h-[22px] w-[22px] shrink-0 rounded-full border-[2.5px] border-accent"
                aria-hidden="true"
              />
              <span className="t-mono text-[11px] font-semibold uppercase text-accent">
                {idx > g.sets ? en.logger.extraShort : en.logger.set(idx)}
                {item.nextSide ? ` ${item.nextSide}` : ''}
              </span>
            </div>
            <div className="mt-2">
              <span className={`grid gap-1.5 ${hasLoad(lt) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {hasLoad(lt) && (
                  <Stepper
                    id="load"
                    value={load}
                    onChange={setLoad}
                    step={incDisplay}
                    unitLabel={unitLabel.replace(/ /g, '')}
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
                  value={reps}
                  onChange={setReps}
                  step={lt === 'timed' ? 5 : 1}
                  decimals={0}
                  min={0}
                  unitLabel={lt === 'timed' ? en.logger.seconds : en.logger.reps}
                  srLabel={lt === 'timed' ? en.logger.secondsLabel : en.logger.repsLabel}
                  srUnit={lt === 'timed' ? 'seconds' : 'reps'}
                />
              </span>
            </div>
            {showNudge && nudgeText && (
              <div
                className="mt-2.5 flex items-center gap-2 rounded-md border-[1.5px] border-brass bg-brass-wash px-2.5 py-2"
                role="status"
              >
                <span className="grow text-[13px] text-ink">{nudgeText}</span>
                <button
                  type="button"
                  className="ll-chip min-h-11 shrink-0"
                  onClick={() => {
                    setLoad(Math.round(toDisplay(nudge!.loadKg, units) * 10) / 10);
                    setNudgeUsed(key);
                  }}
                >
                  {en.logger.use(nudgeValue)}
                </button>
              </div>
            )}
          </div>
        )}
        {done && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <button type="button" className="ll-chip min-h-11" onClick={() => setExtra(true)}>
              + {en.logger.extraSet}
            </button>
          </div>
        )}
        {done && item.next && (
          <p className="border-t border-rule px-3 py-2.5 text-[15px] leading-snug" data-testid="next-time">
            <b>
              {en.logger.nextTime}{' '}
              {hasLoad(lt) && item.next.loadKg !== null
                ? `${formatLoad(item.next.loadKg, lt, units)} × `
                : ''}
              {item.next.repMax}.
            </b>{' '}
            {formatReason(item.next.reason, units, lt)}.
          </p>
        )}
      </section>

      <div className="sticky bottom-0 mt-auto flex items-center gap-2.5 bg-paper px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5">
        <RestChip />
        {done ? (
          <Button variant="secondary" onClick={() => navigate('/workout')}>
            {en.logger.backToWorkout}
          </Button>
        ) : (
          <Button onClick={log} disabled={busy || (hasLoad(lt) && load === null)}>
            {item.nextSide
              ? en.logger.logSide(idx, en.logger.side[item.nextSide])
              : idx > g.sets
                ? en.logger.logExtra
                : en.logger.logSet(idx)}
          </Button>
        )}
      </div>

      <OverrideSheet
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        exercise={ex}
        goal={g}
        coachGoal={item.coachGoal}
        overridden={item.overridden}
        units={units}
      />
      <EditSetSheet
        set={editing}
        exercise={ex}
        target={g}
        units={units}
        bodyweightKg={model.bodyweightKg}
        onClose={() => setEditing(null)}
      />
      <SwapSheet
        open={swap}
        current={ex}
        inWorkout
        exclude={model.items.map((i) => i.exercise.id)}
        onClose={() => setSwap(false)}
        onChoose={async (to, scope) => {
          setSwap(false);
          await swapInSession(sessionId, ex.id, to.id);
          if (scope === 'routine') await replaceInRoutine(model.session.routineSessionId, ex.id, to.id);
          skipRest();
          navigate(`/workout/${to.id}`, { replace: true });
        }}
      />
    </main>
  );
}

function MissingExercise() {
  const navigate = useNavigate();
  useEffect(() => {
    const t = window.setTimeout(() => navigate('/workout', { replace: true }), 1200);
    return () => window.clearTimeout(t);
  }, [navigate]);
  return null;
}

function HurtsMenu({ onHurts }: { onHurts: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        type="button"
        className="ll-icon-btn"
        aria-label={en.logger.moreOptions}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="dots" strokeWidth={3} />
      </button>
      {open && (
        <span className="absolute bottom-12 right-0 z-10 rounded-md border-[1.5px] border-line bg-card p-1 shadow-hard">
          <button
            type="button"
            className="ll-chip min-h-11 whitespace-nowrap"
            data-variant="outline-red"
            onClick={onHurts}
          >
            {en.logger.hurts}
          </button>
        </span>
      )}
    </span>
  );
}

export type { ItemModel };
