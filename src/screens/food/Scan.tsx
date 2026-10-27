import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Icon } from '@/components/Icon';
import { en } from '@/copy/en';
import { platform } from '@/platform';
import { findByGtin } from '@/db/food';
import { carryParams, displayCode, resolveScan, type ScanResult } from './ScanLookup';

type State = 'starting' | 'scanning' | 'no-camera' | 'invalid' | { missing: string };

/**
 * PRD-1.2 FR-FOOD-4: scan a food barcode offline against the library. Same camera screen as S22
 * (FR-PLT-5): native BarcodeDetector where it reads EAN/UPC, else the self-hosted zxing-wasm reader.
 * A match opens Add food with the portion sheet; a miss offers "Create food" with the code filled in.
 */
export default function Scan() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>('starting');
  const [code, setCode] = useState('');
  const s = en.food.scan;

  const handle = (r: ScanResult): boolean => {
    if (r.kind === 'found') {
      navigate(`/food/add?${carryParams(params, { food: r.food.id })}`, { replace: true });
      return true;
    }
    if (r.kind === 'missing') setState({ missing: r.gtin });
    else setState('invalid');
    return false;
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await platform.openCamera();
        if (stopped) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const det = await platform.productCodeDetector();
        setState('scanning');
        const tick = async () => {
          if (stopped) return;
          try {
            if (v.readyState >= 2) {
              for (const raw of await det.detect(v)) {
                const r = await resolveScan(raw, findByGtin);
                if (r.kind === 'invalid') continue;
                stopped = true;
                handle(r);
                return;
              }
            }
          } catch {
            // A frame that can't be decoded is normal; keep scanning.
          }
          timer = window.setTimeout(() => void tick(), 250);
        };
        void tick();
      } catch {
        if (!stopped) setState('no-camera');
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // `handle` only navigates or sets state; re-running on its identity would restart the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    handle(await resolveScan(code, findByGtin));
  };

  const missing = typeof state === 'object' ? state.missing : null;
  const status =
    state === 'starting'
      ? s.loading
      : state === 'no-camera'
        ? s.noCamera
        : state === 'invalid'
          ? s.invalid
          : missing
            ? s.missing
            : s.hint;

  return (
    <main className="fixed inset-0 z-40 flex flex-col bg-ink text-paper" data-theme-fixed="dark">
      <video
        ref={video}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between px-4 pt-[calc(12px+env(safe-area-inset-top))]">
        <h1 className="t-display text-[28px]">{s.title}</h1>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-md bg-[rgba(0,0,0,0.5)]"
          aria-label={s.close}
          onClick={() => navigate(-1)}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="relative flex grow items-center justify-center">
        <div
          role="img"
          aria-label={s.viewfinder}
          className="h-[34vmin] w-[78vmin] rounded-lg border-[3px] border-[rgba(255,255,255,0.9)] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
        />
      </div>
      <div className="relative px-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <p role="status" className="text-center text-[16px] font-semibold">
          {status}
        </p>
        {missing && (
          <div className="mt-3 text-center">
            <p className="text-[14px]">{s.missingHint(displayCode(missing))}</p>
            <div className="mt-3 flex justify-center gap-3">
              <button
                type="button"
                className="min-h-11 rounded-md bg-paper px-5 font-semibold text-ink"
                onClick={() =>
                  navigate(`/food/new?${carryParams(params, { barcode: displayCode(missing) })}`, {
                    replace: true,
                  })
                }
              >
                {s.create}
              </button>
            </div>
          </div>
        )}
        <form className="mt-4 flex items-end gap-2" onSubmit={(e) => void submit(e)}>
          <label className="grow text-[13px]">
            {s.code}
            <input
              className="mt-1 block h-11 w-full rounded-md bg-paper px-3 text-[16px] text-ink"
              inputMode="numeric"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button type="submit" className="min-h-11 rounded-md bg-paper px-5 font-semibold text-ink">
            {s.find}
          </button>
        </form>
      </div>
    </main>
  );
}
