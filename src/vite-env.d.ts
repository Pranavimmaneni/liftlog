/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
/** LiftLog's site (package.json homepage): where the APK downloads the food catalogue (D123). */
declare const __SITE_URL__: string;
interface ImportMetaEnv {
  readonly VITE_NATIVE?: string;
}
