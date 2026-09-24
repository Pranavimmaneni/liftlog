import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ToggleChip } from '@/components/Chip';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Stepper } from '@/components/Stepper';
import { Switch } from '@/components/Switch';
import { ScreenHeader, SectionLabel } from '@/components/ScreenHeader';
import { applyTheme } from '@/app/theme';
import { setSetting, useSettings, type ThemePref } from '@/db/settings';
import { en } from '@/copy/en';

/** /dev/components: visual test page for the design system in both themes (PRD §9). */
export default function DevComponents() {
  const settings = useSettings();
  const [load, setLoad] = useState<number | null>(26);
  const [reps, setReps] = useState<number | null>(8);
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const setTheme = (t: ThemePref) => {
    applyTheme(t);
    void setSetting('theme', t);
  };
  return (
    <main className="pb-10">
      <ScreenHeader title={en.dev.components} subtitle="/dev/components" backTo="/" />
      <SectionLabel>{en.dev.themeLabel}</SectionLabel>
      <div className="px-5">
        <SegmentedControl<ThemePref>
          label={en.dev.themeLabel}
          value={settings.theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: en.theme.system },
            { value: 'paper', label: en.theme.paper },
            { value: 'iron', label: en.theme.iron },
          ]}
        />
      </div>

      <SectionLabel>Buttons</SectionLabel>
      <div className="flex flex-col gap-3 px-5">
        <Button variant="primary">Log set 3</Button>
        <Button variant="secondary">Finish workout</Button>
        <div className="flex gap-3">
          <Button variant="ghost">Add from list</Button>
          <Button variant="ghost" disabled>
            Disabled
          </Button>
        </div>
        <Button variant="destructive">Delete all data</Button>
      </div>

      <SectionLabel>Cards</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5 px-5">
        <Card hard className="px-3 py-2.5">
          <p className="t-label !text-accent">Goal today</p>
          <p className="t-display mt-1.5 text-[28px]">3 × 8–10</p>
          <p className="t-mono mt-1 text-[12px]">26 kg / hand</p>
        </Card>
        <Card className="px-3 py-2.5">
          <p className="t-label">Last · Sep 17</p>
          <p className="t-display mt-1.5 text-[28px] text-ink2">10·10·9</p>
          <p className="t-mono mt-1 text-[12px] text-ink2">24 kg / hand</p>
        </Card>
      </div>

      <SectionLabel>Chips</SectionLabel>
      <div className="flex flex-wrap gap-2 px-5">
        <Chip>3-wk streak</Chip>
        <Chip variant="on">Lv 7</Chip>
        <Chip variant="brass">+1 rep</Chip>
        <Chip variant="red">Now</Chip>
        <Chip variant="soft">~55 min</Chip>
        <Chip variant="outline-red">+ Fix</Chip>
        <Chip variant="dashed">Guideline values</Chip>
        <ToggleChip on>Build muscle</ToggleChip>
        <ToggleChip on={false}>Recomp</ToggleChip>
      </div>

      <SectionLabel>Stepper</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5 px-5">
        <Stepper
          id="load"
          value={load}
          onChange={setLoad}
          step={2}
          unitLabel="kg/hand"
          srLabel="Load"
          srUnit="kilograms per hand"
        />
        <Stepper
          id="reps"
          value={reps}
          onChange={setReps}
          step={1}
          decimals={0}
          unitLabel="reps"
          srLabel="Reps"
          srUnit="reps"
        />
      </div>

      <SectionLabel>Switch + segmented</SectionLabel>
      <div className="flex items-center gap-4 px-5">
        <Switch checked={on} onChange={setOn} label="Warm-up sets" />
        <SegmentedControl
          className="grow"
          label="Demo"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'a', label: 'Lifts' },
            { value: 'b', label: 'Body' },
            { value: 'c', label: 'History' },
          ]}
        />
      </div>
    </main>
  );
}
