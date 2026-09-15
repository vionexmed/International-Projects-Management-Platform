/**
 * The operational environment, stated rather than inferred.
 *
 * `NODE_ENV` answers a build question — is this a development build, a test
 * run, or an optimised bundle — and Next and Node both set it themselves. It
 * cannot answer the question that actually matters here: *which deployment is
 * this?* On Vercel every preview build is `NODE_ENV=production`, so a guard
 * written against it treats a throwaway preview and the real thing as the same
 * place.
 *
 * `APP_ENV` answers that second question, and nothing else reads it.
 *
 * The rule that follows from having it is short and worth stating plainly:
 * **demonstration behaviour is declared, never inferred.** A missing database
 * URL, a missing secret or an unconfigured bucket are failures — they are not
 * an invitation to open the account chooser.
 */

export const APP_ENVIRONMENTS = [
  "development",
  "test",
  "demo",
  "preview",
  "staging",
  "production",
] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export function isAppEnvironment(value: unknown): value is AppEnvironment {
  return typeof value === "string" && (APP_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Environments where demonstration shortcuts are allowed: the passwordless
 * account chooser, the embedded database, seeded credentials.
 *
 * `preview` is deliberately absent. A preview URL is shareable and indexable
 * by accident, and it is built from the same code as production — treating it
 * as a playground is how a "temporary" open door becomes permanent.
 */
const DEMO_FRIENDLY: readonly AppEnvironment[] = ["development", "test", "demo"];

/** Environments that serve people outside the team. */
const REAL: readonly AppEnvironment[] = ["preview", "staging", "production"];

/**
 * Resolves the environment.
 *
 * The fallbacks exist so that adding this variable does not break every
 * deployment the moment it lands: Vercel already tells us which kind of
 * deployment this is, and `VERCEL_ENV` is a value the platform sets, not one a
 * person can forget. Nothing in this chain can produce `demo` — that one has
 * to be typed on purpose.
 */
export function appEnv(): AppEnvironment {
  const explicit = process.env.APP_ENV?.trim();
  if (explicit) {
    if (isAppEnvironment(explicit)) return explicit;
    throw new Error(
      `APP_ENV is "${explicit}", which is not one of: ${APP_ENVIRONMENTS.join(", ")}.`,
    );
  }

  const vercel = process.env.VERCEL_ENV?.trim();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "preview";

  if (process.env.NODE_ENV === "test") return "test";
  if (process.env.NODE_ENV === "production") {
    // A production build with no APP_ENV and no Vercel signal: somebody is
    // running `next start` somewhere real. Assume the strict side.
    return "production";
  }

  return "development";
}

/** Whether demonstration shortcuts may be used at all. */
export function allowsDemo(): boolean {
  return DEMO_FRIENDLY.includes(appEnv());
}

/** Whether this deployment serves anyone outside the team. */
export function isRealEnvironment(): boolean {
  return REAL.includes(appEnv());
}
