import { Link } from 'react-router';
import { toast } from '@/components/Toast';
import { muscleName } from '@/components/ExerciseRow';
import { en } from '@/copy/en';
import { XP } from '@/engine/data';
import type { Motivation } from '@/db/motivation';
import type { BackupNudge } from '@/db/motivation';
import { getRawSetting, setRawSetting } from '@/db/settings';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '@/components/Icon';
import { platform } from '@/platform';
import type { Quest } from '@/engine/xp';

/** S05 header chips: weekly streak (FR-XP-4) and level (FR-XP-2), as in the mockup. */
export function HeaderChips({ m }: { m: Motivation | null | undefined }) {
  if (!m) return null;
  const x = en.xp;
  return (
    <>
      {m.streak.weeks > 0 && (
        <Link
          to="/progress/review"
          className="ll-chip min-h-11 no-underline"
          aria-label={x.streakLabel(m.streak.weeks, m.streak.passBanked)}
        >
          {x.streak(m.streak.weeks)}
        </Link>
      )}
      <Link
        to="/progress"
        className="ll-chip min-h-11 no-underline"
        data-variant="on"
        aria-label={x.levelLabel(m.level.level, m.level.title)}
      >
        {x.level(m.level.level)}
      </Link>
    </>
  );
}

export function questText(q: Quest): string {
  const x = en.xp;
  return q.kind === 'all_sessions'
    ? x.questAll(q.target)
    : q.kind === 'muscle'
      ? x.questMuscle(muscleName(q.muscle), q.target)
      : x.questProgress(q.target);
}

/** FR-XP-6: one weekly quest from last week's weak spot, completed automatically. */
export function QuestCard({ m }: { m: Motivation | null | undefined }) {
  if (!m) return null;
  const { quest, done, target, complete } = m.quest;
  const x = en.xp;
  return (
    <section className="ll-card mt-3 px-3.5 py-3" aria-labelledby="quest-h">
      <div className="flex items-center justify-between gap-2">
        <h2 id="quest-h" className="t-label">
          {x.quest}
        </h2>
        <span className="t-mono text-[11px] font-semibold text-brass-text">
          {x.questXp(XP.events.weeklyQuest)}
        </span>
      </div>
      <p className="mt-1 text-[15px] font-semibold">
        {complete ? `${x.questDone}: ${questText(quest)}` : questText(quest)}
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-panel"
        role="progressbar"
        aria-label={questText(quest)}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={done}
      >
        <div
          className={`h-full ${complete ? 'bg-brass' : 'bg-ink'}`}
          style={{ width: `${(done / target) * 100}%` }}
        />
      </div>
      <p className="t-mono mt-1 text-right text-[11px] text-ink2">
        {done} / {target}
      </p>
    </section>
  );
}

/** FR-DATA-2: backup nudge after 7 days without a backup and after every 10th session. */
export function BackupNudgeBanner({ nudge }: { nudge: BackupNudge | null | undefined }) {
  if (!nudge) return null;
  const n = en.nudge;
  return (
    <div role="status" className="mt-3 rounded-md border-[1.5px] border-brass bg-brass-wash px-3.5 py-2.5">
      <p className="text-[14px]">
        {nudge.reason === 'days' ? n.days(nudge.days) : n.sessions(nudge.sessions)}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="ll-chip min-h-11"
          data-variant="on"
          onClick={async () => {
            const { shareBackup } = await import('@/app/share-backup');
            const r = await shareBackup();
            if (r !== 'cancelled') toast(n.done);
          }}
        >
          {n.backup}
        </button>
        <button
          type="button"
          className="ll-chip min-h-11"
          onClick={() => void setRawSetting('backupNudgeDismissedAt', Date.now())}
        >
          {n.later}
        </button>
      </div>
    </div>
  );
}

/** FR-PLT-8: one-time "add to home screen" banner in the browser tab (not once installed). */
export function InstallBanner() {
  const dismissed = useLiveQuery(
    async () => (await getRawSetting<boolean>('installBannerDismissed')) ?? false,
    [],
  );
  if (dismissed !== false || platform.kind !== 'web' || platform.capabilities().installed) return null;
  const t = en.install;
  return (
    <div className="ll-card mt-3 flex items-center gap-2 px-3.5 py-2">
      <p className="grow text-[14px] leading-snug">{t.banner}</p>
      <Link to="/install" className="ll-chip min-h-11 shrink-0 no-underline">
        {t.bannerCta}
      </Link>
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-ink2"
        aria-label={t.dismiss}
        onClick={() => void setRawSetting('installBannerDismissed', true)}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
