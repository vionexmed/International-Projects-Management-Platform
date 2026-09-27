/**
 * Shape of the demo snapshot module, which `npm run demo:snapshot` writes into
 * the git-ignored `snapshot/` folder at build time.
 *
 * Declared here so the typecheck does not depend on a build having run first:
 * CI typechecks a fresh checkout before `npm run build`, where the generated
 * file does not exist yet, and failed on every push.
 */
declare module "@/server/demo/snapshot/data" {
  /** Base64 of the PGlite data directory; empty in builds that carry no demo. */
  export const DEMO_SNAPSHOT_BASE64: string;
}
