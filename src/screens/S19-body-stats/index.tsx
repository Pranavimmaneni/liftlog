import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Stepper } from '@/components/Stepper';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { saveProfile, saveWeighIn, useBodyweights, useProfile } from '@/db/repo';
import { dateKey } from '@/engine/week';
import { fromDisplay, toDisplay } from '@/engine/units';
import type { Sex } from '@/engine/strength';

/**
 * S19 body stats (FR-STR-3): sex, birth year and bodyweight, each optional, each explained. Shown the
 * first time S11 opens. "Skip" records "prefer not to say" so it doesn't ask again.
 */
export default function BodyStats() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/progress?tab=body';
  const profile = useProfile();
  const weights = useBodyweights();
  const b = en.bodyStats;
  const [sex, setSex] = useState<Sex>('unspecified');
  const [year, setYear] = useState('');
  const [bw, setBw] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const thisYear = new Date().getFullYear();
  const minYear = thisYear - 100;
  const maxYear = thisYear - 12;

  useEffect(() => {
    if (loaded || !profile || !weights) return;
    setSex(profile.sex ?? 'unspecified');
    setYear(profile.birthYear ? String(profile.birthYear) : '');
    const last = [...weights].sort((a, c) => a.date.localeCompare(c.date)).pop();
    setBw(last ? Math.round(toDisplay(last.kg, profile.units) * 10) / 10 : null);
    setLoaded(true);
  }, [profile, weights, loaded]);

  // Render only once the saved values are in, so a quick first tap can't be overwritten by them.
  if (!profile || !loaded) return null;
  const units = profile.units;
  const yearNum = year.trim() ? Number(year) : null;
  const yearBad = yearNum !== null && (!Number.isInteger(yearNum) || yearNum < minYear || yearNum > maxYear);

  const save = async () => {
    if (yearBad) return;
    await saveProfile({ sex, birthYear: yearNum ?? undefined });
    const last = [...(weights ?? [])].sort((a, c) => a.date.localeCompare(c.date)).pop();
    if (bw !== null) {
      const kg = fromDisplay(bw, units);
      if (!last || Math.abs(last.kg - kg) > 0.01) await saveWeighIn(dateKey(Date.now()), kg);
    }
    toast(b.saved);
    navigate(next, { replace: true });
  };

  return (
    <main className="pb-[calc(24px+env(safe-area-inset-bottom))]">
      <ScreenHeader title={b.title} backTo="/progress?tab=body" />
      <p className="px-5 pt-2 text-[15px] leading-snug text-ink2">{b.intro}</p>
      <div className="flex flex-col gap-5 px-5 pt-4">
        <div>
          <p className="t-label">{b.sex}</p>
          <SegmentedControl<Sex>
            className="mt-1.5"
            label={b.sex}
            value={sex}
            onChange={setSex}
            height={44}
            options={[
              { value: 'male', label: b.male },
              { value: 'female', label: b.female },
              { value: 'unspecified', label: b.unspecified },
            ]}
          />
          <p className="mt-1.5 text-[13px] text-ink2">{b.sexWhy}</p>
        </div>
        <div>
          <label className="block">
            <span className="t-label">{b.birthYear}</span>
            <input
              className="ll-input mt-1.5"
              inputMode="numeric"
              autoComplete="bday-year"
              value={year}
              aria-invalid={yearBad}
              aria-describedby="year-why"
              onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>
          <p
            id="year-why"
            className={`mt-1.5 text-[13px] ${yearBad ? 'text-accent' : 'text-ink2'}`}
            role={yearBad ? 'alert' : undefined}
          >
            {yearBad ? b.invalidYear(minYear, maxYear) : b.birthYearWhy}
          </p>
        </div>
        <div>
          <span className="t-label">{b.bodyweight}</span>
          <div className="mt-1.5">
            <Stepper
              id="bw"
              value={bw}
              onChange={setBw}
              step={units === 'kg' ? 0.1 : 0.2}
              min={20}
              unitLabel={units}
              srLabel={b.bodyweight}
              srUnit={units === 'kg' ? 'kilograms' : 'pounds'}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-ink2">{b.bodyweightWhy}</p>
        </div>
        <Button onClick={save} disabled={yearBad}>
          {b.save}
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            if (!profile.sex) await saveProfile({ sex: 'unspecified' });
            navigate(next, { replace: true });
          }}
        >
          {b.skip}
        </Button>
      </div>
    </main>
  );
}
