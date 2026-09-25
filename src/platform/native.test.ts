import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
const ln = {
  checkPermissions: vi.fn(async () => ({ display: 'prompt' })),
  requestPermissions: vi.fn(async () => ({ display: 'granted' })),
  schedule: vi.fn(async () => ({})),
  cancel: vi.fn(async () => undefined),
};
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: ln }));
vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: {
    keepAwake: vi.fn(async () => calls.push('awake')),
    allowSleep: vi.fn(async () => calls.push('sleep')),
  },
}));
vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(async () => calls.push('impact')),
    notification: vi.fn(async () => calls.push('notification')),
  },
  ImpactStyle: { Light: 'LIGHT' },
  NotificationType: { Warning: 'WARNING' },
}));
const fsWrites: { path: string; directory: string }[] = [];
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE', Documents: 'DOCUMENTS' },
  Filesystem: {
    writeFile: vi.fn(async (o: { path: string; directory: string }) => {
      fsWrites.push(o);
      return { uri: `file:///${o.directory}/${o.path}` };
    }),
  },
}));
let shareImpl: () => Promise<unknown> = async () => ({});
vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn((...a: unknown[]) => (calls.push(`share ${JSON.stringify(a[0])}`), shareImpl())) },
}));
const sb = { setBackgroundColor: vi.fn(async () => undefined), setStyle: vi.fn(async () => undefined) };
vi.mock('@capacitor/status-bar', () => ({ StatusBar: sb, Style: { Dark: 'DARK', Light: 'LIGHT' } }));

const { nativePlatform, REST_NOTIFICATION_ID } = await import('./native');

describe('native platform adapter (M6)', () => {
  beforeEach(() => {
    calls.length = 0;
    fsWrites.length = 0;
    vi.clearAllMocks();
  });

  it('reports APK capabilities: installed, lock-screen alerts, vibrate', () => {
    expect(nativePlatform.kind).toBe('native');
    expect(nativePlatform.capabilities()).toMatchObject({
      installed: true,
      lockScreenAlerts: true,
      vibrate: true,
      installPrompt: false,
    });
  });

  it('FR-PLT-4: schedules one rest-end notification (asking permission once) and cancels it', async () => {
    const at = Date.now() + 90_000;
    await nativePlatform.scheduleRestEnd(at, 'Rest over');
    await nativePlatform.scheduleRestEnd(at + 1000, 'Rest over');
    expect(ln.requestPermissions).toHaveBeenCalledTimes(1);
    expect(ln.schedule).toHaveBeenCalledTimes(2);
    const n = (
      ln.schedule.mock.calls[0] as unknown as [{ notifications: { id: number; schedule: { at: Date } }[] }]
    )[0].notifications[0]!;
    expect(n.id).toBe(REST_NOTIFICATION_ID);
    expect(n.schedule.at.getTime()).toBe(at);
    await nativePlatform.cancelRestEnd();
    expect(ln.cancel).toHaveBeenLastCalledWith({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    // Rest already over: nothing to schedule.
    await nativePlatform.scheduleRestEnd(Date.now() - 1, 'x');
    expect(ln.schedule).toHaveBeenCalledTimes(0 + 2);
  });

  it('FR-PLT-2: keep-awake on and off', async () => {
    expect(await nativePlatform.keepAwake(true)).toBe(true);
    expect(await nativePlatform.keepAwake(false)).toBe(false);
    expect(calls).toEqual(['awake', 'sleep']);
  });

  it('FR-PLT-6: share writes the file to the cache and opens the share sheet; cancel is reported', async () => {
    const file = {
      name: 'liftlog-2026-09-25.liftlog.json',
      mime: 'application/json',
      data: new Blob(['{}']),
      title: 'Backup',
    };
    expect(await nativePlatform.share(file)).toBe('shared');
    expect(fsWrites[0]).toMatchObject({ path: file.name, directory: 'CACHE' });
    expect(calls.at(-1)).toContain('file:///CACHE/liftlog-2026-09-25.liftlog.json');
    shareImpl = async () => {
      throw new Error('Share canceled');
    };
    expect(await nativePlatform.share(file)).toBe('cancelled');
    shareImpl = async () => {
      throw new Error('No activity found');
    };
    expect(await nativePlatform.share(file)).toBe('saved');
    expect(fsWrites.at(-1)).toMatchObject({ directory: 'DOCUMENTS' });
    shareImpl = async () => ({});
  });

  it('FR-PLT-9: status bar colour and icon style follow the theme; haptic tap', async () => {
    nativePlatform.statusBar('iron', '#151412');
    nativePlatform.tap();
    await vi.waitFor(() => expect(sb.setStyle).toHaveBeenCalledWith({ style: 'DARK' }));
    expect(sb.setBackgroundColor).toHaveBeenCalledWith({ color: '#151412' });
    await vi.waitFor(() => expect(calls).toContain('impact'));
  });
});
