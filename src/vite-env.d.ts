/// <reference types="vite/client" />

/**
 * The build-time settings this app reads.
 *
 * Declared rather than left to `any` so a typo in `import.meta.env.VITE_...`
 * is a compile error instead of `undefined` discovered in a browser. Only
 * `VITE_`-prefixed names reach the bundle at all; everything else in a .env
 * file stays with the build machine.
 *
 * Every value here ships inside the JavaScript and is readable by anyone who
 * opens devtools. Nothing secret belongs in this interface.
 */
interface ImportMetaEnv {
  /**
   * Where the API lives. Defaults to `/api` - the same origin that served
   * this page - which is what keeps the session cookie simple.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
