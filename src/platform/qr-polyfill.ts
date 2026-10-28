/**
 * FR-PLT-5: lazy QR fallback for browsers without BarcodeDetector (iOS Safari). Loaded only from the
 * scan screens (QR stickers, and food barcodes for PRD-1.2 FR-FOOD-4). The zxing-wasm reader is self-hosted (bundled by Vite), never fetched from a CDN
 * (NFR-SEC-1, DECISIONS D20).
 */
import { BarcodeDetector, setZXingModuleOverrides } from 'barcode-detector/ponyfill';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

let configured = false;

export async function createPolyfillDetector(formats: string[] = ['qr_code']): Promise<{
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>;
}> {
  if (!configured) {
    setZXingModuleOverrides({
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    });
    configured = true;
  }
  const det = new BarcodeDetector({ formats: formats as never });
  return {
    async detect(src) {
      const out = await det.detect(src as ImageBitmapSource);
      return out.map((b) => ({ rawValue: b.rawValue }));
    },
  };
}
