import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { Blob as NodeBlob } from 'node:buffer';

// fake-indexeddb clones with Node's structuredClone, which only understands Node's Blob
// (real browsers store DOM Blobs natively). Use Node's Blob so photo round-trips are testable.
globalThis.Blob = NodeBlob as unknown as typeof Blob;

afterEach(() => cleanup());

// jsdom lacks matchMedia.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
