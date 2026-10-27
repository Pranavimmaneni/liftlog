import type { Capabilities, OS, Platform, QrDetector, ShareFile, ShareResult } from './types';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}

export function detectOS(ua: string, maxTouchPoints = 0): OS {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  // iPadOS 13+ reports as Mac with touch.
  if (/macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios';
  return 'other';
}

let deferredInstall: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
  });
}

let audioCtx: AudioContext | null = null;
let wakeLock: WakeLockSentinelLike | null = null;
let wantAwake = false;

function onVisibility() {
  if (wantAwake && document.visibilityState === 'visible' && (!wakeLock || wakeLock.released)) {
    void requestWakeLock();
  }
}

async function requestWakeLock(): Promise<boolean> {
  const nav = navigator as Navigator & {
    wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
  };
  if (!nav.wakeLock) return false;
  try {
    wakeLock = await nav.wakeLock.request('screen');
    return true;
  } catch {
    return false;
  }
}

function beep(ctx: AudioContext) {
  const t0 = ctx.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    const start = t0 + i * 0.22;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.16);
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export function download(file: ShareFile): void {
  const url = URL.createObjectURL(file.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** PRD-1.2 FR-FOOD-4: barcodes printed on food packs. */
export const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/**
 * Native BarcodeDetector when it exists and supports the formats, else the lazy self-hosted
 * zxing-wasm polyfill (FR-PLT-5). Feature-detected, never assumed (iOS has none).
 */
async function detector(formats: string[]): Promise<QrDetector> {
  type Det = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
  type DetCtor = (new (opts: { formats: string[] }) => Det) & {
    getSupportedFormats?: () => Promise<string[]>;
  };
  const native = (window as unknown as { BarcodeDetector?: DetCtor }).BarcodeDetector;
  let det: Det | null = null;
  if (native) {
    const supported = native.getSupportedFormats
      ? await native.getSupportedFormats().catch(() => formats)
      : formats;
    if (formats.every((f) => supported.includes(f))) det = new native({ formats });
  }
  if (!det) {
    const mod = await import('./qr-polyfill');
    det = await mod.createPolyfillDetector(formats);
  }
  const d = det;
  return {
    async detect(source) {
      const codes = await d.detect(source);
      return codes.map((c) => c.rawValue);
    },
  };
}

export const webPlatform: Platform = {
  kind: 'web',
  os: typeof navigator === 'undefined' ? 'other' : detectOS(navigator.userAgent, navigator.maxTouchPoints),

  capabilities(): Capabilities {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    const probe = new File([''], 'probe.json', { type: 'application/json' });
    return {
      vibrate: !!nav && typeof nav.vibrate === 'function',
      wakeLock: !!nav && 'wakeLock' in nav,
      barcodeDetector: typeof window !== 'undefined' && 'BarcodeDetector' in window,
      shareFiles: !!nav && typeof nav.canShare === 'function' && nav.canShare({ files: [probe] }),
      lockScreenAlerts: false,
      installPrompt: deferredInstall !== null,
      installed: isStandalone(),
    };
  },

  async keepAwake(on) {
    wantAwake = on;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
      if (on) document.addEventListener('visibilitychange', onVisibility);
    }
    if (!on) {
      if (wakeLock && !wakeLock.released) await wakeLock.release().catch(() => undefined);
      wakeLock = null;
      return false;
    }
    return requestWakeLock();
  },

  unlockAudio() {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      audioCtx ??= new Ctor();
      if (audioCtx.state === 'suspended') void audioCtx.resume();
      // A silent buffer finishes the iOS unlock inside the gesture.
      const buf = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);
    } catch {
      audioCtx = null;
    }
  },

  async alert(opts) {
    if (opts?.sound !== false && audioCtx) {
      try {
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        beep(audioCtx);
      } catch {
        /* no sound available */
      }
    }
    if (typeof navigator.vibrate === 'function') navigator.vibrate([200, 100, 200]);
  },

  async scheduleRestEnd() {
    /* FR-PLT-4: web builds can't alert on the lock screen, and don't claim to. */
  },
  async cancelRestEnd() {},

  tap() {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(15);
  },

  async share(file): Promise<ShareResult> {
    const f = new File([file.data], file.name, { type: file.mime });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: file.title ?? file.name });
        return 'shared';
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      }
    }
    download(file);
    return 'downloaded';
  },

  async qrDetector(): Promise<QrDetector> {
    return detector(['qr_code']);
  },

  async productCodeDetector(): Promise<QrDetector> {
    return detector(PRODUCT_FORMATS);
  },

  async openCamera() {
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  },

  async persist() {
    try {
      if (navigator.storage?.persist) return await navigator.storage.persist();
    } catch {
      /* ignore */
    }
    return false;
  },

  statusBar(theme, background) {
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      document.head.appendChild(m);
    }
    // A forced theme must beat the media-query variants, so every tag gets the same colour.
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      m.content = background;
    });
    const apple = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-status-bar-style"]',
    );
    if (apple) apple.content = theme === 'iron' ? 'black' : 'default';
  },

  async promptInstall() {
    if (!deferredInstall) return 'unavailable';
    await deferredInstall.prompt();
    const choice = await deferredInstall.userChoice;
    deferredInstall = null;
    return choice.outcome;
  },
};
