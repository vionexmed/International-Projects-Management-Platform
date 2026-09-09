import { envSchema } from "@/lib/env-schema";

/**
 * Validated server environment. Parsed once at module load so a misconfigured
 * deployment fails immediately and loudly instead of half-working.
 *
 * Importing this module throws when the configuration is invalid — that is the
 * point. Code that needs to inspect the configuration *without* that side
 * effect should import `@/lib/env-schema` instead.
 *
 * Never import this module from a client component.
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const UPLOAD_MAX_BYTES = env.UPLOAD_MAX_SIZE_MB * 1024 * 1024;

export const isProduction = env.NODE_ENV === "production";

export { envSchema } from "@/lib/env-schema";
