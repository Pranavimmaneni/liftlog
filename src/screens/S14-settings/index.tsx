import { SegmentedControl } from '@/components/SegmentedControl';
import { ScreenHeader, SectionLabel } from '@/components/ScreenHeader';
import { en } from '@/copy/en';
import { setSetting, useSettings, type ThemePref } from '@/db/settings';
import { applyTheme } from '@/app/theme';

/** S14 Settings. M0: appearance (FR-SET-1). The rest arrives in M1. */
export default function Settings() {
  const settings = useSettings();
  const setTheme = (t: ThemePref) => {
    applyTheme(t);
    void setSetting('theme', t);
  };
  return (
    <main className="pb-8">
      <ScreenHeader title={en.common.settings} backTo="/" />
      <SectionLabel>Appearance</SectionLabel>
      <div className="px-5">
        <SegmentedControl<ThemePref>
          label="Appearance"
          value={settings.theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: en.theme.system },
            { value: 'paper', label: en.theme.paper },
            { value: 'iron', label: en.theme.iron },
          ]}
        />
      </div>
    </main>
  );
}
