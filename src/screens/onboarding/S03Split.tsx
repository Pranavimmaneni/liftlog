import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { en } from '@/copy/en';
import type { OnboardingDraft } from '@/db/repo';
import { SPLITS } from '@/engine/data';
import { previewDays, recommendSplit, sessionsFor, shortName, weekLayout } from '@/engine/split';
import { BottomCta, StepHeader, Title } from './shared';

/** S03 Onboarding 3: recommends a split via splits.json recommendRule; any split can be chosen (FR-ONB-4). */
export function S03Split({
  draft,
  onChange,
  onNext,
  onBack,
}: {
  draft: OnboardingDraft;
  onChange: (d: OnboardingDraft) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const best = recommendSplit(draft.daysPerWeek, draft.experience);
  const chosen = draft.splitId ?? best;
  const bestSplit = SPLITS.find((s) => s.id === best)!;
  const s3 = en.onboarding.s3;
  const example =
    sessionsFor(chosen, draft.daysPerWeek)[2]?.name ?? sessionsFor(chosen, draft.daysPerWeek)[0]?.name ?? '';
  return (
    <main className="flex min-h-dvh flex-col">
      <StepHeader step={3} name={s3.name} onBack={onBack} />
      <Title sub={s3.body(draft.daysPerWeek, en.levels[draft.experience]!.toLowerCase(), bestSplit.name)}>
        {s3.title}
      </Title>

      <div role="radiogroup" aria-label={s3.title} className="flex flex-col gap-2.5 px-5 pt-4">
        {SPLITS.map((t) => {
          const on = chosen === t.id;
          const days = previewDays(t, draft.daysPerWeek);
          const sessions = sessionsFor(t.id, days);
          const showStrip = t.id !== 'custom' && t.id !== 'body-part';
          const layout = weekLayout(days);
          let k = 0;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ ...draft, splitId: t.id })}
              className={`w-full rounded-lg bg-card px-3.5 py-3 text-left ${
                on ? 'border-2 border-ink shadow-hard' : 'border-[1.5px] border-rule'
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="t-display text-[26px]">{t.name}</span>
                {t.id === best && (
                  <span className="ll-chip !px-2.5 !py-1.5" data-variant="red">
                    {s3.bestFit(draft.daysPerWeek)}
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[14px] text-ink2">{s3.desc[t.id]}</span>
              {showStrip && (
                <span className="mt-2.5 flex gap-1.5" aria-hidden="true">
                  {layout.map((onDay, i) => {
                    if (!onDay)
                      return (
                        <span
                          key={i}
                          className="h-[22px] min-w-0 grow rounded-[3px] border-[1.5px] border-dashed border-rule"
                        />
                      );
                    const s = sessions[k++ % Math.max(1, sessions.length)];
                    return (
                      <span
                        key={i}
                        className="flex h-[22px] min-w-0 grow items-center justify-center overflow-hidden rounded-[3px] bg-ink font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-card"
                      >
                        {s ? shortName(s.name) : ''}
                      </span>
                    );
                  })}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mx-5 mt-3 flex gap-3 rounded-md bg-panel px-3.5 py-3 text-[14px] leading-snug">
        <Icon name="calendar" className="mt-0.5 shrink-0 text-accent" />
        <p>
          <b>{s3.rotateTitle}</b>
          {s3.rotateBody(example)}
        </p>
      </div>

      <BottomCta>
        <Button onClick={onNext}>{s3.cta}</Button>
      </BottomCta>
    </main>
  );
}
