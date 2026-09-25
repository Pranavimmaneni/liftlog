/**
 * Capacitor adapter for the Android APK (PRD §2.2, M6). Plugins are imported lazily so the web bundle
 * never loads them. Everything else (audio beep, camera via getUserMedia, BarcodeDetector in the
 * Android WebView) is shared with the web adapter.
 */
import { webPlatform } from './web';
import type { Capabilities, Platform, ShareFile, ShareResult } from './types';

/** One fixed id: there is only ever one pending rest-end notification. */
export const REST_NOTIFICATION_ID = 7101;

let notifyAllowed: boolean | null = null;

async function ensureNotifyPermission(): Promise<boolean> {
  if (notifyAllowed !== null) return notifyAllowed;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  let p = await LocalNotifications.checkPermissions();
  if (p.display === 'prompt' || p.display === 'prompt-with-rationale')
    p = await LocalNotifications.requestPermissions();
  notifyAllowed = p.display === 'granted';
  return notifyAllowed;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** FR-PLT-6 (native): write the file to the cache folder, then open the Android share sheet. */
export async function shareNative(file: ShareFile): Promise<ShareResult> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const written = await Filesystem.writeFile({
    path: file.name,
    data: await blobToBase64(file.data),
    directory: Directory.Cache,
  });
  try {
    await Share.share({ title: file.title ?? file.name, files: [written.uri], dialogTitle: file.title });
    return 'shared';
  } catch (e) {
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return 'cancelled';
    // No share target: keep a copy in Documents so the backup still exists.
    await Filesystem.writeFile({
      path: file.name,
      data: await blobToBase64(file.data),
      directory: Directory.Documents,
    });
    return 'saved';
  }
}

export const nativePlatform: Platform = {
  ...webPlatform,
  kind: 'native',
  os: 'android',

  capabilities(): Capabilities {
    return {
      vibrate: true,
      wakeLock: true,
      barcodeDetector: typeof window !== 'undefined' && 'BarcodeDetector' in window,
      shareFiles: true,
      lockScreenAlerts: true,
      installPrompt: false,
      installed: true,
    };
  },

  /** FR-PLT-2: the keep-awake plugin holds the screen on for the whole session. */
  async keepAwake(on) {
    try {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      if (on) await KeepAwake.keepAwake();
      else await KeepAwake.allowSleep();
      return on;
    } catch {
      return webPlatform.keepAwake(on);
    }
  },

  /** FR-PLT-3: sound (shared with web) + a haptic pattern. */
  async alert(opts) {
    await webPlatform.alert({ ...opts, sound: opts?.sound });
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {
      /* no haptics hardware */
    }
  },

  /** FR-PLT-4: a local notification at rest end, shown even with the phone locked. */
  async scheduleRestEnd(atMs, body) {
    if (atMs <= Date.now()) return;
    if (!(await ensureNotifyPermission())) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_NOTIFICATION_ID,
          title: 'LiftLog',
          body,
          schedule: { at: new Date(atMs), allowWhileIdle: true },
          smallIcon: 'ic_stat_liftlog',
          iconColor: '#9E2B25',
        },
      ],
    });
  },

  async cancelRestEnd() {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    } catch {
      /* nothing scheduled */
    }
  },

  tap() {
    void import('@capacitor/haptics')
      .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
      .catch(() => undefined);
  },

  share: shareNative,

  /** Native WebView storage isn't evicted like a browser tab's (FR-PLT-7). */
  async persist() {
    return true;
  },

  /** FR-PLT-9: status bar colour and icon style follow Paper / Iron. */
  statusBar(theme, background) {
    void import('@capacitor/status-bar')
      .then(async ({ StatusBar, Style }) => {
        await StatusBar.setBackgroundColor({ color: background });
        // Style.Dark = light icons, for the dark Iron background.
        await StatusBar.setStyle({ style: theme === 'iron' ? Style.Dark : Style.Light });
      })
      .catch(() => undefined);
    webPlatform.statusBar(theme, background);
  },

  async promptInstall() {
    return 'unavailable';
  },
};
