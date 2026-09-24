/**
 * FR-PLT-5: lazy QR fallback for browsers without BarcodeDetector (iOS Safari).
 * Loaded only from the scan screen. Implemented in M5.
 */
export async function createPolyfillDetector(): Promise<{
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>;
}> {
  throw new Error('QR scanning fallback is not available yet');
}
