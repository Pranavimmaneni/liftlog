import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { Stepper } from '@/components/Stepper';
import { toast } from '@/components/Toast';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import { shortDate } from '@/copy/format';
import { compressImage } from '@/app/image';
import {
  deleteMachineSetting,
  machineInfo,
  setMachineIncrement,
  setMachinePhoto,
  setMachineSetting,
  useMachineNote,
} from '@/db/machines';
import { fromDisplay, incrementIn, toDisplay } from '@/engine/units';
import type { Exercise, Units } from '@/engine/types';

function usePhotoUrl(blob: Blob | undefined, dataUrl: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setUrl(dataUrl ?? null);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob, dataUrl]);
  return url;
}

/**
 * S08 "Your machine" (FR-GYM-2/3): photo, named settings (Seat = 4) and the stack increment,
 * shown whenever this machine's exercise is open.
 */
export function MachinePanel({ exercise, units }: { exercise: Exercise; units: Units }) {
  const machineId = exercise.machineId!;
  const note = useMachineNote(machineId);
  const info = machineInfo(machineId, note);
  const url = usePhotoUrl(note?.photoBlob, note?.photoDataUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const [edit, setEdit] = useState<null | { key: string; value: string; oldKey?: string }>(null);
  const [incSheet, setIncSheet] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const inc = incrementIn(units, exercise.incrementKg, exercise.loadType);
  const [incValue, setIncValue] = useState<number | null>(inc);
  const m = en.machine;
  // Rising Sun (FR-DSN-10, HW1S08): a glass card under the logger card; the machine's name leads.
  const sun = useDesign() === 'sun';
  if (note === undefined) return null;
  const settings = Object.entries(note?.settings ?? {});

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const small = await compressImage(f);
      await setMachinePhoto(machineId, small);
      toast(m.photoSaved);
    } catch {
      toast(m.photoFailed);
    }
  };

  return (
    <section
      className={sun ? 'sun-glass mx-5 mt-3 rounded-[18px] px-[18px] py-4' : 'll-card mx-5 mt-3 px-3.5 py-3'}
      aria-labelledby="machine-h"
    >
      {sun ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="machine-h" className="text-[13px] font-medium text-ink2">
              {m.title}
            </h2>
            <p className="break-words text-[17px] font-bold leading-tight">{info?.name ?? exercise.name}</p>
          </div>
          {note?.updatedAt && (
            <span className="shrink-0 text-[13px] text-ink2">{m.saved(shortDate(note.updatedAt))}</span>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <h2 id="machine-h" className="t-label">
            {m.title}
          </h2>
          {note?.updatedAt && (
            <span className="t-mono text-[11px] text-ink2">{m.saved(shortDate(note.updatedAt))}</span>
          )}
        </div>
      )}
      <div className={sun ? 'mt-3 flex gap-3' : 'mt-2.5 flex gap-3'}>
        {url ? (
          <button
            type="button"
            className={
              sun
                ? 'h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[14px] border border-hairline'
                : 'h-24 w-24 shrink-0 overflow-hidden rounded-lg border-[1.5px] border-line'
            }
            aria-label={m.photoOptions(info?.name ?? exercise.name)}
            onClick={() => setPhotoSheet(true)}
          >
            <img
              src={url}
              alt={m.photoAlt(info?.name ?? exercise.name)}
              className="h-full w-full object-cover"
            />
          </button>
        ) : (
          <button
            type="button"
            className={
              sun
                ? 'flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-ink2 bg-soft text-[13px] font-semibold text-ink2'
                : 'flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-ink2 bg-panel font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-ink2'
            }
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="camera" />
            {m.addPhoto}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="machine-photo-input"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="grid min-w-0 grow grid-cols-2 content-start gap-2">
          {settings.map(([k, v]) => (
            <button
              key={k}
              type="button"
              className={
                sun
                  ? 'min-h-12 min-w-0 rounded-[12px] border border-hairline bg-soft px-2.5 py-2 text-left'
                  : 'min-h-11 rounded-md bg-panel px-2 py-1.5 text-left'
              }
              aria-label={m.editSetting(k, v)}
              onClick={() => setEdit({ key: k, value: v, oldKey: k })}
            >
              <span className={sun ? 'block break-words text-[13px] text-ink2' : 't-label block'}>{k}</span>
              <span
                className={
                  sun ? 'sun-display mt-1 block break-words text-[19px]' : 't-display block text-[24px]'
                }
              >
                {v}
              </span>
            </button>
          ))}
          {settings.length < 4 && (
            <button
              type="button"
              className={
                sun
                  ? 'flex min-h-12 items-center justify-center rounded-[12px] border border-dashed border-ink2 text-[14px] font-semibold text-ink2'
                  : 'flex min-h-11 items-center justify-center rounded-md border-[1.5px] border-dashed border-ink2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-ink2'
              }
              onClick={() => setEdit({ key: '', value: '' })}
            >
              + {m.addSetting}
            </button>
          )}
          <button
            type="button"
            className={
              sun
                ? 'col-span-2 min-h-12 rounded-[12px] border border-hairline bg-soft px-2.5 py-2 text-left'
                : 'col-span-2 min-h-11 rounded-md bg-panel px-2 py-1.5 text-left'
            }
            onClick={() => {
              setIncValue(inc);
              setIncSheet(true);
            }}
          >
            <span className={sun ? 'block text-[13px] text-ink2' : 't-label block'}>{m.stack}</span>
            <span
              className={sun ? 'block text-[14px] font-semibold' : 'mt-0.5 block text-[13px] font-semibold'}
            >
              {m.stackLine(inc, units)}
            </span>
          </button>
        </div>
      </div>

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.oldKey ? m.editTitle : m.addSetting}
        footer={
          <>
            <Button
              disabled={!edit?.key.trim()}
              onClick={async () => {
                if (!edit) return;
                await setMachineSetting(machineId, edit.key, edit.value, edit.oldKey);
                setEdit(null);
              }}
            >
              {en.common.save}
            </Button>
            {edit?.oldKey && (
              <Button
                variant="destructive"
                onClick={async () => {
                  await deleteMachineSetting(machineId, edit.oldKey!);
                  setEdit(null);
                }}
              >
                {en.common.delete}
              </Button>
            )}
          </>
        }
      >
        <label className="block">
          <span className="t-label">{m.settingName}</span>
          <input
            className="ll-input mt-1.5"
            placeholder={m.settingNameHint}
            value={edit?.key ?? ''}
            onChange={(e) => setEdit(edit && { ...edit, key: e.target.value })}
          />
        </label>
        <label className="mt-3 block">
          <span className="t-label">{m.settingValue}</span>
          <input
            className="ll-input mt-1.5"
            value={edit?.value ?? ''}
            onChange={(e) => setEdit(edit && { ...edit, value: e.target.value })}
          />
        </label>
      </Sheet>

      <Sheet
        open={incSheet}
        onClose={() => setIncSheet(false)}
        title={m.stack}
        footer={
          <>
            <Button
              disabled={!incValue || incValue <= 0}
              onClick={async () => {
                await setMachineIncrement(machineId, fromDisplay(incValue!, units));
                setIncSheet(false);
              }}
            >
              {en.common.save}
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await setMachineIncrement(machineId, undefined);
                setIncSheet(false);
              }}
            >
              {m.resetIncrement(
                Math.round(toDisplay(info?.defaultIncrementKg ?? exercise.incrementKg, units) * 10) / 10,
                units,
              )}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-[14px] text-ink2">{m.incrementBody}</p>
        <Stepper
          id="increment"
          value={incValue}
          onChange={setIncValue}
          step={units === 'kg' ? 0.5 : 1}
          min={0.5}
          unitLabel={units}
          srLabel={m.stack}
          srUnit={units === 'kg' ? 'kilograms' : 'pounds'}
        />
      </Sheet>

      <Sheet
        open={photoSheet}
        onClose={() => setPhotoSheet(false)}
        title={m.photo}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPhotoSheet(false);
                fileRef.current?.click();
              }}
            >
              {m.replacePhoto}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await setMachinePhoto(machineId, undefined);
                setPhotoSheet(false);
              }}
            >
              {m.removePhoto}
            </Button>
          </>
        }
      >
        {url && <img src={url} alt={m.photoAlt(info?.name ?? exercise.name)} className="w-full rounded-lg" />}
      </Sheet>
    </section>
  );
}
