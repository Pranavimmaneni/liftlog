import { ScreenHeader } from '@/components/ScreenHeader';
import { en } from '@/copy/en';
import { saveGym, saveProfile, useGym, useProfile } from '@/db/repo';
import { GymEditor } from '../onboarding/S02Gym';

/** Settings → My gym (FR-GYM-1, FR-GYM-5): the same editor as S02, saved as you tap. */
export default function GymSettings() {
  const gym = useGym();
  const profile = useProfile();
  if (!gym || !profile) return null;
  return (
    <main className="pb-10">
      <ScreenHeader title={en.settings.myGym} backTo="/settings" />
      <GymEditor
        showUnits={false}
        value={{ ...gym, limitations: profile.limitations, units: profile.units }}
        onChange={(p) => {
          const { limitations, units: _u, ...rest } = p;
          if (limitations) void saveProfile({ limitations });
          if (Object.keys(rest).length)
            void saveGym({
              presetId: gym.presetId,
              equipmentIds: gym.equipmentIds,
              machineIds: gym.machineIds,
              ...rest,
            });
        }}
      />
      <p className="mx-5 mt-4 text-[13px] text-ink2">{en.settings.gymNote}</p>
    </main>
  );
}
