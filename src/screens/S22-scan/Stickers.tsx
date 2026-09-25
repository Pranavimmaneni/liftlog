import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/Toast';
import { en } from '@/copy/en';
import { useExerciseMap } from '@/db/catalog';
import { machineInfo, useCustomMachines } from '@/db/machines';
import { useActiveRoutine, useGym } from '@/db/repo';
import { ExerciseThumb } from '@/illustration/Pictogram';
import { exerciseForMachine, stickerUrl } from '@/app/qr';

/** QR code as SVG path data (no external image, token colours). */
function qrSvg(text: string): { size: number; d: string } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return { size: n, d };
}

/** S22 sticker sheet: a printable 3 × 8 grid of QR stickers for every machine in My Gym. */
export default function Stickers() {
  const gym = useGym();
  const customs = useCustomMachines();
  const map = useExerciseMap();
  const routine = useActiveRoutine();
  const t = en.stickers;
  const machines = useMemo(() => {
    if (!gym || !customs) return null;
    const ids = [...new Set([...gym.machineIds, ...customs.map((c) => c.machineId)])].filter(
      (id) => id !== 'pullup-bar' && id !== 'dip-station',
    );
    return ids
      .map((id) => ({
        id,
        info: machineInfo(
          id,
          customs.find((c) => c.machineId === id),
        ),
      }))
      .filter((m) => m.info);
  }, [gym, customs]);
  if (!machines || !map) return null;
  const routineIds = (routine?.sessions ?? []).flatMap((s) => s.items.map((i) => i.exerciseId));
  const origin = window.location.origin;

  return (
    <main className="pb-10 print:p-0">
      <div className="print:hidden">
        <ScreenHeader title={t.title} backTo="/settings/gym" />
        <p className="px-5 pt-2 text-[15px] text-ink2">{t.intro}</p>
        {machines.length > 0 && (
          <div className="px-5 pt-3">
            <Button onClick={() => window.print()}>{t.print}</Button>
          </div>
        )}
      </div>
      {machines.length === 0 ? (
        <div className="px-5 pt-4">
          <EmptyState>{t.empty}</EmptyState>
        </div>
      ) : (
        <ul className="ll-stickers mt-4 grid grid-cols-3 gap-2 px-3 print:mt-0 print:gap-0 print:px-0">
          {machines.map(({ id, info }) => {
            const q = qrSvg(stickerUrl(id, origin));
            const ex = exerciseForMachine(id, map.values(), routineIds);
            return (
              <li
                key={id}
                className="flex break-inside-avoid flex-col items-center rounded-md border-[1.5px] border-dashed border-ink2 bg-card p-2 text-center print:rounded-none"
              >
                <svg
                  viewBox={`-2 -2 ${q.size + 4} ${q.size + 4}`}
                  className="h-auto w-full max-w-[120px]"
                  role="img"
                  aria-label={t.qrLabel(info!.name)}
                  shapeRendering="crispEdges"
                >
                  {/* QR codes stay black on white in both themes: scanners need the contrast. */}
                  <rect x="-2" y="-2" width={q.size + 4} height={q.size + 4} fill="white" />
                  <path d={q.d} fill="black" />
                </svg>
                <div className="mt-1 flex items-center gap-1">
                  {ex && <ExerciseThumb exercise={ex} className="h-[24px] w-[34px]" />}
                  <span className="text-[11px] font-bold leading-tight">{info!.name}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
