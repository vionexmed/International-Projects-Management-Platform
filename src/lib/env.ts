import { envSchema, type Env } from "@/lib/env-schema";

/**
 * Validated server environment.
 *
 * Validation runs on first *access*, not on import. That distinction matters
 * on a build machine: `next build` evaluates route modules to collect their
 * configuration, and those modules import this one. Validating at import time
 * would fail the build of a perfectly correct project simply because the
 * deployment's variables are not present yet — which is the normal state on a
 * first deploy, and on every preview build.
 *
 * Accessing a value still throws when the configuration is invalid, so the app
 * fails closed at request time rather than serving in a broken state.
 *
 * Never import this module from a client component.
 */
let cached: Env | null = null;

function load(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

export const env = new Proxy({} as Env, {
  get: (_target, property: string) => load()[property as keyof Env],
  has: (_target, property: string) => property in load(),
  ownKeys: () => Reflect.ownKeys(load()),
  getOwnPropertyDescriptor: (_target, property: string) => ({
    value: load()[property as keyof Env],
    enumerable: true,
    configurable: true,
  }),
});

/** Upload ceiling in bytes. A function so it is not computed at import. */
export function uploadMaxBytes(): number {
  return env.UPLOAD_MAX_SIZE_MB * 1024 * 1024;
}

export { envSchema } from "@/lib/env-schema";
