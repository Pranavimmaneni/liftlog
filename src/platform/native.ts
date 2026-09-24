import { webPlatform } from './web';
import type { Platform } from './types';

/**
 * Capacitor adapter (M6 fills this in). Until then it behaves like the web adapter,
 * minus the service worker, which the native build disables.
 */
export const nativePlatform: Platform = {
  ...webPlatform,
  kind: 'native',
};
