import { describe, expect, it } from 'vitest';
import { detectOS, webPlatform } from './web';

describe('web platform adapter (FR-PLT)', () => {
  it('detects iOS, iPadOS and Android', () => {
    expect(detectOS('Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X)')).toBe('ios');
    expect(detectOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(detectOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other');
    expect(detectOS('Mozilla/5.0 (Linux; Android 15; Pixel 8 Pro)')).toBe('android');
  });

  it('FR-PLT-4: web never claims lock-screen alerts', () => {
    expect(webPlatform.capabilities().lockScreenAlerts).toBe(false);
  });

  it('FR-PLT-2: keepAwake reports false when the Wake Lock API is missing', async () => {
    expect(await webPlatform.keepAwake(true)).toBe(false);
    expect(await webPlatform.keepAwake(false)).toBe(false);
  });

  it('FR-PLT-3: alert without audio or vibration does not throw', async () => {
    await expect(webPlatform.alert()).resolves.toBeUndefined();
  });
});
