import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';
import { platform } from '@/platform';
import { parseMachineCode } from '@/app/qr';

type State = 'starting' | 'scanning' | 'unknown' | 'no-camera';

/**
 * S22 QR scan (FR-PLT-5): full-screen camera with a viewfinder. BarcodeDetector where available,
 * otherwise the self-hosted zxing-wasm fallback, loaded only here. A match opens `/m/<machineId>`.
 */
export default function Scan() {
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>('starting');
  const s = en.scan;
  // Rising Sun (FR-DSN-10, HW1S22): same dark camera screen, with the look's type and round shapes.
  const sun = useDesign() === 'sun';

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    let unknownUntil = 0;
    (async () => {
      try {
        stream = await platform.openCamera();
        if (stopped) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const det = await platform.qrDetector();
        setState('scanning');
        const tick = async () => {
          if (stopped) return;
          try {
            if (v.readyState >= 2) {
              const codes = await det.detect(v);
              for (const raw of codes) {
                const id = parseMachineCode(raw, window.location.origin);
                if (id) {
                  stopped = true;
                  navigate(`/m/${encodeURIComponent(id)}`, { replace: true });
                  return;
                }
                unknownUntil = Date.now() + 2500;
                setState('unknown');
              }
              if (!codes.length && Date.now() > unknownUntil) setState('scanning');
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
  }, [navigate]);

  return (
    <main
      className={
        sun
          ? 'fixed inset-0 z-40 flex flex-col bg-[rgb(0_0_0)] text-[rgb(255_255_255)]'
          : 'fixed inset-0 z-40 flex flex-col bg-black text-white'
      }
      data-theme-fixed="dark"
    >
      <video
        ref={video}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between px-4 pt-[calc(12px+env(safe-area-inset-top))]">
        <h1 className={sun ? 'text-[17px] font-bold' : 't-display text-[28px]'}>{s.title}</h1>
        <button
          type="button"
          className={
            sun
              ? 'flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(0,0,0,0.5)]'
              : 'flex h-11 w-11 items-center justify-center rounded-md bg-[rgba(0,0,0,0.5)]'
          }
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
          className={
            sun
              ? 'h-[62vmin] w-[62vmin] rounded-[28px] border-2 border-[rgba(255,255,255,0.9)] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]'
              : 'h-[62vmin] w-[62vmin] rounded-lg border-[3px] border-[rgba(255,255,255,0.9)] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]'
          }
        />
      </div>
      <div className="relative px-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-center">
        <p role="status" className="text-[16px] font-semibold">
          {state === 'starting'
            ? s.loading
            : state === 'unknown'
              ? s.unknown
              : state === 'no-camera'
                ? s.noCamera
                : s.hint}
        </p>
        <Link
          to="/scan/stickers"
          className={
            sun
              ? 'mt-4 flex min-h-12 items-center justify-center rounded-full border border-[rgba(255,255,255,0.9)] px-5 text-[15px] font-semibold !text-[rgb(255_255_255)] no-underline'
              : 't-mono mt-3 inline-flex min-h-11 items-center text-[12px] font-semibold uppercase tracking-[0.08em] text-white underline'
          }
        >
          {s.stickers}
        </Link>
      </div>
    </main>
  );
}
