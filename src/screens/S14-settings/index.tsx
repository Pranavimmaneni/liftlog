import { useState } from 'react';
import { Link } from 'react-router';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ScreenHeader, SectionLabel } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { Stepper } from '@/components/Stepper';
import { Switch } from '@/components/Switch';
import { Icon } from '@/components/Icon';
import { en } from '@/copy/en';
import { applyTheme } from '@/app/theme';
import { setSetting, useSettings, type ThemePref } from '@/db/settings';
import { saveProfile, useGym, useProfile } from '@/db/repo';
import { formatClock } from '@/engine/timer';
import type { Units } from '@/engine/types';
import { DataSection } from './DataSection';

function Row({
  title,
  sub,
  value,
  to,
  onClick,
  right,
}: {
  title: string;
  sub?: string;
  value?: string;
  to?: string;
  onClick?: () => void;
  right?: React.ReactNode;
}) {
  const inner = (
    <>
      <span className="min-w-0 grow">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        {sub && <span className="mt-px block text-[12px] text-ink2">{sub}</span>}
      </span>
      {value && <span className="t-num text-[13px] text-ink2">{value}</span>}
      {right ?? <Icon name="chevronRight" className="text-ink2" />}
    </>
  );
  if (to)
    return (
      <Link to={to} className="ll-row no-underline">
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" className="ll-row w-full text-left" onClick={onClick}>
        {inner}
      </button>
    );
  return <div className="ll-row">{inner}</div>;
}

/** S14 Settings (FR-SET-1…4, FR-DATA-1…5). */
export default function Settings() {
  const settings = useSettings();
  const profile = useProfile();
  const gym = useGym();
  const [sheet, setSheet] = useState<null | 'units' | 'rest'>(null);
  const s = en.settings;

  const setTheme = (t: ThemePref) => {
    applyTheme(t);
    void setSetting('theme', t);
  };

  return (
    <main className="pb-[calc(24px+env(safe-area-inset-bottom))]">
      <ScreenHeader title={en.common.settings} backTo="/" />
      <SectionLabel>{s.appearance}</SectionLabel>
      <div className="px-5">
        <SegmentedControl<ThemePref>
          label={s.appearance}
          value={settings.theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: en.theme.system },
            { value: 'paper', label: en.theme.paper },
            { value: 'iron', label: en.theme.iron },
          ]}
        />
      </div>

      <SectionLabel>{s.training}</SectionLabel>
      <div className="ll-card mx-5">
        <Row
          title={s.units}
          value={profile?.units ?? 'kg'}
          onClick={profile ? () => setSheet('units') : undefined}
        />
        <Row
          title={s.rest}
          sub={s.restSub}
          value={`${formatClock(settings.restCompoundSec * 1000)} / ${formatClock(settings.restIsolationSec * 1000)}`}
          onClick={() => setSheet('rest')}
        />
        <Row
          title={s.warmups}
          sub={s.warmupsSub}
          right={
            <Switch
              checked={settings.warmups}
              onChange={(v) => void setSetting('warmups', v)}
              label={s.warmups}
            />
          }
        />
        <Row
          title={s.restAlert}
          sub={s.restAlertSub}
          right={
            <Switch
              checked={settings.restAlert}
              onChange={(v) => void setSetting('restAlert', v)}
              label={s.restAlert}
            />
          }
        />
        <label className="ll-row">
          <span className="grow text-[15px] font-semibold">{s.weekStart}</span>
          <select
            className="min-h-11 rounded-md border-[1.5px] border-line bg-card px-2 font-mono text-[13px] font-semibold"
            value={settings.weekStart}
            onChange={(e) => void setSetting('weekStart', Number(e.target.value))}
          >
            {s.days.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <SectionLabel>{s.you}</SectionLabel>
      <div className="ll-card mx-5">
        <Row
          title={s.profile}
          sub={
            profile
              ? `${en.levels[profile.experience]} · ${en.goals[profile.goal]} · ${profile.daysPerWeek} days`
              : undefined
          }
          to="/settings/profile"
        />
        <Row
          title={s.myGym}
          sub={
            gym
              ? s.gymSummary(
                  en.onboarding.s2.presets[gym.presetId] ?? gym.presetId,
                  gym.machineIds.filter((m) => m !== 'pullup-bar' && m !== 'dip-station').length,
                )
              : undefined
          }
          to="/settings/gym"
        />
        <Row title={s.bodyStats} sub={s.bodyStatsSub} to="/progress/body-stats" />
        <Row title={en.library.open} sub={en.library.openSub} to="/library" />
      </div>

      <SectionLabel>{s.data}</SectionLabel>
      <DataSection />

      <div className="flex items-center justify-between gap-4 px-5 pt-5">
        <span className="t-mono text-[11px] uppercase text-ink2">{s.footer(__APP_VERSION__)}</span>
        <Link to="/install" className="ll-link">
          {s.installHelp}
        </Link>
      </div>

      <Sheet open={sheet === 'units'} onClose={() => setSheet(null)} title={s.units}>
        <SegmentedControl<Units>
          label={s.units}
          height={52}
          value={profile?.units ?? 'kg'}
          onChange={(u) => void saveProfile({ units: u })}
          options={[
            { value: 'kg', label: en.units.kg },
            { value: 'lb', label: en.units.lb },
          ]}
        />
        <p className="mt-3 text-[13px] text-ink2">{s.unitsNote}</p>
      </Sheet>

      <Sheet open={sheet === 'rest'} onClose={() => setSheet(null)} title={s.restSheetTitle}>
        <p className="t-label mb-1.5">{s.restCompound}</p>
        <Stepper
          id="rest-compound"
          value={settings.restCompoundSec}
          onChange={(v) => void setSetting('restCompoundSec', v)}
          step={15}
          min={15}
          max={600}
          decimals={0}
          unitLabel="s"
          srLabel={s.restCompound}
          srUnit="seconds"
        />
        <p className="t-label mb-1.5 mt-4">{s.restIsolation}</p>
        <Stepper
          id="rest-isolation"
          value={settings.restIsolationSec}
          onChange={(v) => void setSetting('restIsolationSec', v)}
          step={15}
          min={15}
          max={600}
          decimals={0}
          unitLabel="s"
          srLabel={s.restIsolation}
          srUnit="seconds"
        />
      </Sheet>
    </main>
  );
}
