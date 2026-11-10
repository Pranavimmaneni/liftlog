import { useState } from 'react';
import { Link } from 'react-router';
import { Button, LinkButton } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import { platform } from '@/platform';

type Os = 'ios' | 'android';

/** Simple line illustrations for each step (token colours, no images). */
function StepArt({ os, step, className = 'h-14 w-14' }: { os: Os; step: number; className?: string }) {
  const ink = 'var(--ll-ink)';
  const accent = 'var(--ll-accent)';
  return (
    <svg viewBox="0 0 64 64" className={`${className} shrink-0`} aria-hidden="true" fill="none">
      <rect x="16" y="4" width="32" height="56" rx="6" stroke={ink} strokeWidth="3" />
      {step === 1 && <circle cx="32" cy="30" r="9" stroke={accent} strokeWidth="3" />}
      {step === 2 && os === 'ios' && (
        <path
          d="M32 48V36M26 41l6-6 6 6M24 44v6h16v-6"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {step === 2 && os === 'android' && (
        <path d="M40 10h.01M40 15h.01M40 20h.01" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      )}
      {step === 3 && (
        <>
          <rect x="24" y="22" width="16" height="16" rx="3" stroke={accent} strokeWidth="3" />
          <path d="M32 26v8M28 30h8" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** S21 install help (FR-PLT-8): 3 illustrated steps for iOS Safari or Android Chrome, plus data note. */
export default function InstallHelp() {
  const t = en.install;
  const caps = platform.capabilities();
  const [os, setOs] = useState<Os>(platform.os === 'ios' ? 'ios' : 'android');
  const [canPrompt, setCanPrompt] = useState(caps.installPrompt);
  const steps = os === 'ios' ? t.iosSteps : t.androidSteps;
  const sun = useDesign() === 'sun';
  const install = async () => {
    const r = await platform.promptInstall();
    if (r !== 'dismissed') setCanPrompt(false);
  };
  // Rising Sun (FR-DSN-10, HW1S21): the steps as one numbered glass card, the data note on a second.
  if (sun)
    return (
      <main className="pb-[calc(24px+env(safe-area-inset-bottom))]">
        <ScreenHeader title={t.title} backTo="/settings" />
        <div className="px-5 pt-4">
          <SegmentedControl<Os>
            label={t.platform}
            value={os}
            onChange={setOs}
            height={44}
            options={[
              { value: 'ios', label: t.ios },
              { value: 'android', label: t.android },
            ]}
          />
        </div>
        <section
          className="sun-glass mx-5 mt-3 rounded-[18px] px-[18px] pb-1.5 pt-[18px]"
          aria-labelledby="steps-h"
        >
          <h2 id="steps-h" className="text-[17px] font-bold">
            {en.sun.setup.install.stepsFor[os]}
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-ink2">{caps.installed ? t.installed : t.intro}</p>
          <ol className="mt-3">
            {steps.map((text, i) => (
              <li key={i} className="flex items-center gap-3.5 border-t border-rule py-3">
                <span
                  className="sun-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-[14px] text-paper"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <p className="min-w-0 grow text-[16px] leading-snug">
                  <span className="sr-only">{t.step(i + 1)}: </span>
                  {text}
                </p>
                <StepArt os={os} step={i + 1} className="h-11 w-11" />
              </li>
            ))}
          </ol>
        </section>
        <section className="sun-glass mx-5 mt-3 rounded-[14px] p-4" aria-labelledby="sep-h">
          <h2 id="sep-h" className="text-[16px] font-bold">
            {t.separateTitle}
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-ink2">{t.separate}</p>
        </section>
        <div className="flex flex-col gap-3 px-5 pt-3">
          <LinkButton to="/settings" variant="secondary">
            {t.backup}
          </LinkButton>
          {canPrompt && !caps.installed && <Button onClick={install}>{t.installNow}</Button>}
        </div>
      </main>
    );
  return (
    <main className="pb-10">
      <ScreenHeader title={t.title} backTo="/settings" />
      <p className="px-5 pt-2 text-[15px] leading-snug text-ink2">{caps.installed ? t.installed : t.intro}</p>
      {canPrompt && !caps.installed && (
        <div className="px-5 pt-3">
          <Button onClick={install}>{t.installNow}</Button>
        </div>
      )}
      <div className="px-5 pt-4">
        <SegmentedControl<Os>
          label={t.platform}
          value={os}
          onChange={setOs}
          height={44}
          options={[
            { value: 'ios', label: t.ios },
            { value: 'android', label: t.android },
          ]}
        />
      </div>
      <ol className="mx-5 mt-3 flex flex-col gap-2.5">
        {steps.map((text, i) => (
          <li key={i} className="ll-card flex items-center gap-3.5 px-3.5 py-3">
            <StepArt os={os} step={i + 1} />
            <div>
              <p className="t-label">{t.step(i + 1)}</p>
              <p className="mt-0.5 text-[16px] leading-snug">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <section
        className="mx-5 mt-4 rounded-md border-[1.5px] border-brass bg-brass-wash px-3.5 py-3"
        aria-labelledby="sep-h"
      >
        <h2 id="sep-h" className="text-[15px] font-bold">
          {t.separateTitle}
        </h2>
        <p className="mt-1 text-[14px] leading-snug">{t.separate}</p>
        <Link to="/settings" className="ll-link mt-2 inline-flex min-h-11 items-center !text-ink">
          {t.backup}
        </Link>
      </section>
    </main>
  );
}
