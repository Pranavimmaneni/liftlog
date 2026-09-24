import { nativePlatform } from './native';
import { webPlatform } from './web';
import type { Platform } from './types';

export const isNative = import.meta.env.VITE_NATIVE === '1';

/** The only door to device APIs for feature code (CLAUDE.md "Platform APIs"). */
export const platform: Platform = isNative ? nativePlatform : webPlatform;

export type * from './types';
