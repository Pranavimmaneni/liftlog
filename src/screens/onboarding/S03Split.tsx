import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import type { OnboardingDraft } from '@/db/repo';
import { SPLITS } from '@/engine/data';
import { previewDays, recommendSplit, sessionsFor, shortName, weekLayout } from '@/engine/split';
import { BottomCta, StepHeader, SunIntro, Title } from './shared';
import { CustomDays } from './CustomDays';
import { dayName } from '@/engine/custom-split';

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
  const custom = draft.customDays ?? [];
  const example =
    chosen === 'custom' && custom.length
      ? dayName(custom[Math.min(2, custom.length - 1)]!, Math.min(2, custom.length - 1))
      : (sessionsFor(chosen, draft.daysPerWeek)[2]?.name ??
        sessionsFor(chosen, draft.daysPerWeek)[0]?.name ??
        '');
  const sun = useDesign() === 'sun';
  const body = s3.body(draft.daysPerWeek, en.levels[draft.experience]!.toLowerCase(), bestSplit.name);
  return (
    <main className="flex min-h-dvh flex-col">
      <StepHeader step={3} name={s3.name} onBack={onBack} />
      {sun ? (
        <div className="sun-glass mx-5 mt-3 rounded-[14px] p-4">
          <SunIntro title={s3.title}>{body}</SunIntro>
        </div>
      ) : (
        <Title sub={body}>{s3.title}</Title>
      )}

      <div
        role="radiogroup"
        aria-label={s3.title}
        className={sun ? 'flex flex-col gap-2.5 px-5 pt-3' : 'flex flex-col gap-2.5 px-5 pt-4'}
      >
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
              onClick={() =>
                onChange({
                  ...draft,
                  splitId: t.id,
                  // First time on "Build your own": one empty day per training day.
                  customDays:
                    t.id === 'custom' && !draft.customDays?.length
                      ? Array.from({ length: Math.max(1, draft.daysPerWeek) }, () => [])
                      : draft.customDays,
                })
              }
              className={
                sun
                  ? 'sun-glass sun-setup-option'
                  : `w-full rounded-lg bg-card px-3.5 py-3 text-left ${
                      on ? 'border-2 border-ink shadow-hard' : 'border-[1.5px] border-rule'
                    }`
              }
            >
              <span
                className={
                  sun ? 'flex items-center justify-between gap-2' : 'flex items-start justify-between gap-2'
                }
              >
                <span className={sun ? 'min-w-0 text-[17px] font-bold' : 't-display text-[26px]'}>
                  {t.name}
                </span>
                {t.id === best &&
                  (sun ? (
                    <span className="shrink-0 text-[13px] font-bold text-accent-text">
                      {s3.bestFit(draft.daysPerWeek)}
                    </span>
                  ) : (
                    <span className="ll-chip !px-2.5 !py-1.5" data-variant="red">
                      {s3.bestFit(draft.daysPerWeek)}
                    </span>
                  ))}
              </span>
              <span
                className={sun ? 'mt-0.5 block text-[14px] text-ink2' : 'mt-1 block text-[14px] text-ink2'}
              >
                {s3.desc[t.id]}
              </span>
              {showStrip && (
                <span className={sun ? 'mt-2.5 flex gap-1' : 'mt-2.5 flex gap-1.5'} aria-hidden="true">
                  {layout.map((onDay, i) => {
                    if (!onDay)
                      return (
                        <span
                          key={i}
                          className={
                            sun
                              ? 'h-6 min-w-0 flex-1 rounded-[7px] border border-dashed border-hairline'
                              : 'h-[22px] min-w-0 grow rounded-[3px] border-[1.5px] border-dashed border-rule'
                          }
                        />
                      );
                    const s = sessions[k++ % Math.max(1, sessions.length)];
                    return (
                      <span
                        key={i}
                        className={
                          sun
                            ? 'flex h-6 min-w-0 flex-1 items-center justify-center overflow-hidden whitespace-nowrap rounded-[7px] bg-ink text-[13px] font-semibold text-paper'
                            : 'flex h-[22px] min-w-0 grow items-center justify-center overflow-hidden rounded-[3px] bg-ink font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-card'
                        }
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

      {chosen === 'custom' && (
        <>
          <CustomDays
            days={
              draft.customDays?.length
                ? draft.customDays
                : Array.from({ length: Math.max(1, draft.daysPerWeek) }, () => [])
            }
            onChange={(customDays) => onChange({ ...draft, splitId: 'custom', customDays })}
          />
          {(draft.customDays ?? [[]]).some((d) => d.length === 0) &&
            (sun ? (
              <p className="sun-glass mx-5 mt-2.5 rounded-[14px] px-4 py-3 text-[13px] text-ink2">
                {s3.customDays.emptyHint}
              </p>
            ) : (
              <p className="px-5 pt-2 text-[13px] text-ink2">{s3.customDays.emptyHint}</p>
            ))}
        </>
      )}

      <div
        className={
          sun
            ? 'sun-glass mx-5 mt-3 flex gap-3 rounded-[14px] px-4 py-3 text-[14px] leading-snug'
            : 'mx-5 mt-3 flex gap-3 rounded-md bg-panel px-3.5 py-3 text-[14px] leading-snug'
        }
      >
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
