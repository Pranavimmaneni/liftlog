/**
 * FR-GYM-2: machine photos are compressed to a max 800 px long edge, JPEG q≈0.8, stored as a Blob.
 * Pure canvas work (no device API), so it lives here rather than in src/platform.
 */
export const MAX_EDGE = 800;
export const JPEG_QUALITY = 0.8;

/** Target size for an image so the long edge is at most `max`. Never upscales. */
export function fitWithin(w: number, h: number, max = MAX_EDGE): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

async function decode(
  file: Blob,
): Promise<{ source: CanvasImageSource; w: number; h: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch {
      /* some engines can't decode every type this way: fall back to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/** Photos this small are kept as they are if the browser can't re-encode them. */
const KEEP_IF_UNDER = 1.5 * 1024 * 1024;

export async function compressImage(file: Blob, max = MAX_EDGE, quality = JPEG_QUALITY): Promise<Blob> {
  try {
    return await reencode(file, max, quality);
  } catch (e) {
    if (file.size <= KEEP_IF_UNDER) return file;
    throw e;
  }
}

async function reencode(file: Blob, max: number, quality: number): Promise<Blob> {
  const { source, w, h, done } = await decode(file);
  try {
    const size = fitWithin(w, h, max);
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(source, 0, 0, size.w, size.h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return blob ?? file;
  } finally {
    done();
  }
}
