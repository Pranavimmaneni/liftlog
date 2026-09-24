/// <reference lib="webworker" />
/**
 * Service worker (injectManifest). FR-PLT-1 / NFR-OFF-1: precache the app shell and every
 * lazy chunk so all screens work offline after the first load. NFR-OFF-2: the new worker waits
 * until the page asks it to take over, so the app never reloads mid-session.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
