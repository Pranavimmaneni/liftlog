/**
 * Platform adapter contract (PRD §11, FR-PLT-*). Feature code talks to this interface only.
 * Implementations: web.ts (PWA) and native.ts (Capacitor). Always feature-detect.
 */
export type ResolvedTheme = 'paper' | 'iron';

export interface Capabilities {
  /** navigator.vibrate exists (Android Chrome). iOS has none. */
  vibrate: boolean;
  /** Screen Wake Lock API (Android, iOS 18.4+ installed). */
  wakeLock: boolean;
  /** Native BarcodeDetector; otherwise the zxing-wasm polyfill is loaded lazily. */
  barcodeDetector: boolean;
  /** Web Share API level 2 with files. */
  shareFiles: boolean;
  /** Lock-screen alerts are only possible in the APK (FR-PLT-4). */
  lockScreenAlerts: boolean;
  /** beforeinstallprompt was captured (Android Chrome, not installed yet). */
  installPrompt: boolean;
  /** Running as an installed app (standalone display mode or native). */
  installed: boolean;
}

export type OS = 'ios' | 'android' | 'other';

export interface ShareFile {
  name: string;
  mime: string;
  data: Blob;
  title?: string;
}

export type ShareResult = 'shared' | 'downloaded' | 'saved' | 'cancelled';

export interface QrDetector {
  detect(source: CanvasImageSource): Promise<string[]>;
}

export interface Platform {
  kind: 'web' | 'native';
  os: OS;
  capabilities(): Capabilities;
  /** FR-PLT-2: keep the screen on during a session. Returns true when a lock is held. */
  keepAwake(on: boolean): Promise<boolean>;
  /** FR-PLT-3: create/resume the audio context. Must be called from a user gesture ("Start workout"). */
  unlockAudio(): void;
  /** FR-PLT-3: rest-end alert while the app is open: sound + vibration/haptics where available. */
  alert(opts?: { sound?: boolean }): Promise<void>;
  /** FR-PLT-4: schedule a lock-screen notification (native only; web is a no-op). */
  scheduleRestEnd(atMs: number, body: string): Promise<void>;
  cancelRestEnd(): Promise<void>;
  /** A short tap feedback for logging a set (haptics on native, vibrate on Android web). */
  tap(): void;
  /** FR-PLT-6 */
  share(file: ShareFile): Promise<ShareResult>;
  /** FR-PLT-5: returns a QR detector (native BarcodeDetector or the lazy WASM polyfill). */
  qrDetector(): Promise<QrDetector>;
  /** PRD-1.2 FR-FOOD-4: an EAN/UPC detector for food packs, from the same two sources. */
  productCodeDetector(): Promise<QrDetector>;
  /** FR-PLT-5: rear camera stream for the scan screen. */
  openCamera(): Promise<MediaStream>;
  /** FR-PLT-7 */
  persist(): Promise<boolean>;
  /** FR-PLT-9 */
  statusBar(theme: ResolvedTheme, background: string): void;
  /** FR-PLT-8: show the captured install prompt (Android Chrome). */
  promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'>;
}
