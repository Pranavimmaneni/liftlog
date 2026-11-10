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
import { setDesign, setGlass, useDesign, useLook, type Design } from '@/app/design';
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
  // Rising Sun (FR-DSN-10, HW1S14): 52 px rows, 16 px label, 13 px sub-line, the value on the right.
  const sun = useDesign() === 'sun';
  const inner = sun ? (
    <>
      <span className="min-w-0 grow py-1">
        <span className="block text-[16px] font-medium text-ink">{title}</span>
        {sub && <span className="block text-[13px] leading-snug text-ink2">{sub}</span>}
      </span>
      {value && <span className="shrink-0 text-[15px] tabular-nums text-ink">{value}</span>}
      {right ?? <Icon name="chevronRight" size={16} className="shrink-0 text-ink2" />}
    </>
  ) : (
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

/** A list group: a labelled card in the classic look, a glass card named for screen readers in Rising Sun. */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const sun = useDesign() === 'sun';
  if (sun)
    return (
      <section className="ll-card mx-5 mt-3" aria-label={label}>
        {children}
      </section>
    );
  return (
    <>
      <SectionLabel>{label}</SectionLabel>
      <div className="ll-card mx-5">{children}</div>
    </>
  );
}

/** S14 Settings (FR-SET-1…4, FR-DATA-1…5). */
export default function Settings() {
  const settings = useSettings();
  const profile = useProfile();
  const gym = useGym();
  const [sheet, setSheet] = useState<null | 'units' | 'rest'>(null);
  const look = useLook();
  const sun = look.design === 'sun';
  const s = en.settings;

  const setTheme = (t: ThemePref) => {
    applyTheme(t);
    void setSetting('theme', t);
  };

  return (
    <main className="pb-[calc(24px+env(safe-area-inset-bottom))]">
      <ScreenHeader title={en.common.settings} backTo="/" />
      {/* One element in both looks, so switching the look keeps the control (and focus) in place. */}
      <div className={sun ? 'sun-glass sun-setup-group mx-5 mt-4 rounded-[14px]' : undefined}>
        <SectionLabel>{s.appearance}</SectionLabel>
        <div className="px-5">
          <SegmentedControl<ThemePref>
            label={s.appearance}
            value={settings.theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: en.theme.system },
              { value: 'paper', label: sun ? en.theme.light : en.theme.paper },
              { value: 'iron', label: sun ? en.theme.dark : en.theme.iron },
            ]}
          />
        </div>

        {/* FR-DSN-1: the Rising Sun look is opt-in until it is approved (D124). */}
        <SectionLabel>{en.look.title}</SectionLabel>
        <div className="px-5">
          <SegmentedControl<Design>
            label={en.look.title}
            value={look.design}
            onChange={(d) => void setDesign(d)}
            options={[
              { value: 'classic', label: en.look.classic },
              { value: 'sun', label: en.look.sun },
            ]}
          />
          <p className="mt-2 text-[13px] text-ink2">{en.look.note}</p>
        </div>
        {sun && (
          <div className="mt-3 border-t border-rule">
            <Row
              title={en.look.glass}
              sub={en.look.glassSub}
              right={<Switch checked={look.glass} onChange={(v) => void setGlass(v)} label={en.look.glass} />}
            />
          </div>
        )}
      </div>

      <Group label={s.training}>
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
          <span className={sun ? 'grow text-[16px] font-medium' : 'grow text-[15px] font-semibold'}>
            {s.weekStart}
          </span>
          <select
            className={
              sun
                ? 'min-h-11 max-w-[50%] rounded-[12px] border border-hairline bg-soft px-2.5 text-[15px] font-semibold text-ink'
                : 'min-h-11 rounded-md border-[1.5px] border-line bg-card px-2 font-mono text-[13px] font-semibold'
            }
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
      </Group>

      <Group label={s.you}>
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
      </Group>

      {!sun && <SectionLabel>{s.data}</SectionLabel>}
      <DataSection />

      {sun ? (
        <section className="ll-card mx-5 mt-3" aria-label={en.sun.setup.settings.about}>
          <Row title={s.installHelp} to="/install" />
          <p className="px-4 py-3.5 text-[13px] text-ink2">{s.footer(__APP_VERSION__)}</p>
        </section>
      ) : (
        <div className="flex items-center justify-between gap-4 px-5 pt-5">
          <span className="t-mono text-[11px] uppercase text-ink2">{s.footer(__APP_VERSION__)}</span>
          <Link to="/install" className="ll-link">
            {s.installHelp}
          </Link>
        </div>
      )}

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
