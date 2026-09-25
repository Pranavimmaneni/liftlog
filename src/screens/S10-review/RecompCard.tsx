import { Chip } from '@/components/Chip';
import { Sparkline } from '@/components/Chart';
import { en } from '@/copy/en';
import type { RecompStatus } from '@/engine/review';
import type { Point } from '@/engine/strength';
import { displayNumber } from '@/engine/units';
import type { Units } from '@/engine/types';

/**
 * FR-REV-3 recomp check: bodyweight and average e1RM as two single-series sparklines (never a dual
 * axis), with the §6.8 status and one line of explanation when it's "Watch".
 */
export function RecompCard({
  recomp,
  bodyweight,
  strength,
  units,
}: {
  recomp: RecompStatus;
  bodyweight: Point[];
  strength: Point[];
  units: Units;
}) {
  const r = en.review;
  const bw = [...bodyweight].sort((a, b) => a.at - b.at);
  const first = bw[0];
  const last = bw[bw.length - 1];
  const change = recomp.status === 'empty' ? null : recomp.strengthChange;
  return (
    <section className="ll-card px-3.5 py-3" aria-labelledby="recomp-h">
      <div className="flex items-start justify-between gap-2">
        <h2 id="recomp-h" className="t-label !text-accent">
          {r.recomp}
        </h2>
        {recomp.status !== 'empty' && (
          <Chip variant={recomp.status === 'on_track' ? 'plain' : 'outline-red'}>
            {recomp.status === 'on_track' ? r.onTrack : r.watch}
          </Chip>
        )}
      </div>
      {recomp.status === 'empty' ? (
        <p className="mt-2 text-[14px] text-ink2">{r.recompEmpty(recomp.weighIns)}</p>
      ) : (
        <>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className="text-[12px] text-ink2">{r.bodyweight}</p>
              <p className="t-mono text-[15px] font-semibold">
                {first && last
                  ? `${displayNumber(first.value, units)} → ${displayNumber(last.value, units)} ${units}`
                  : '–'}
              </p>
              <Sparkline values={bw.map((p) => p.value)} label={r.bodyweight} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] text-ink2">{r.strengthAvg}</p>
              <p className="t-mono text-[15px] font-semibold">
                {change === null ? '–' : `${change >= 0 ? '+' : ''}${Math.round(change * 100)}%`}
              </p>
              <Sparkline values={strength.map((p) => p.value)} label={r.strengthAvg} strong />
            </div>
          </div>
          {recomp.status === 'watch' && <p className="mt-2 text-[14px]">{r.recompReason[recomp.reason]}</p>}
        </>
      )}
    </section>
  );
}
