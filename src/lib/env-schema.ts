import { z } from "zod";

/**
 * The environment contract, kept apart from the module that applies it.
 *
 * `env.ts` throws on invalid configuration, which is the right behaviour for
 * application code but makes the module unimportable when something is
 * missing. Diagnostics (the health endpoint) need to *read* the contract
 * without triggering that, so the schema lives here on its own.
 *
 * `next build` runs with NODE_ENV=production but without the deployment's real
 * environment, so the runtime-only checks must not fire during it — otherwise
 * a perfectly valid project fails to compile. Next sets NEXT_PHASE for exactly
 * this kind of distinction.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Exact values that ship in templates or get typed in a hurry. Matched
 * exactly rather than as substrings: a random base64 secret can legitimately
 * contain a word like "secret", and rejecting it would be a false positive on
 * a perfectly good key.
 */
const PLACEHOLDER_SECRETS = new Set([
  "change_me",
  "change_me_generate_with_openssl_rand_base64_32",
  "secret",
  "changeme",
  "development",
  "production",
  "todo",
  "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
]);

/**
 * An environment variable set to an empty string is treated as absent.
 *
 * Hosting dashboards make this the common case: pasting a template leaves
 * entries like `DIRECT_URL=""` behind, and a bare `""` would otherwise fail
 * every rule instead of falling back to its default — reporting
 * "STORAGE_DRIVER: invalid option" when the honest answer is "not set".
 */
function blankToUndefined(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    cleaned[key] = typeof value === "string" && value.trim() === "" ? undefined : value;
  }
  return cleaned;
}

/** Exported so the production guards can be exercised in tests. */
export const envSchema = z.preprocess(
  blankToUndefined,
  z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z
      .string({ error: "DATABASE_URL is required — the PostgreSQL connection string." })
      .min(1, "DATABASE_URL is required — the PostgreSQL connection string."),
    /**
     * Direct (non-pooled) connection, used only by migrations. Managed
     * Postgres providers expose a transaction-mode pooler for the app and a
     * direct port for schema changes; migrations need session-level advisory
     * locks, which a transaction pooler does not provide.
     */
    DIRECT_URL: z.string().optional(),

    AUTH_SECRET: z
      .string({ error: "AUTH_SECRET is required — generate one with: openssl rand -base64 32" })
      .min(32, "AUTH_SECRET must be at least 32 characters — openssl rand -base64 32"),
    /**
     * Public origin, used to build absolute links in outbound notifications.
     * Nothing reads it yet, so it never blocks startup; on Vercel it is
     * derived from the deployment URL and needs no configuration at all.
     */
    APP_URL: z
      .string()
      .url()
      .optional()
      .default(
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000",
      ),

    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().default("./storage"),
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_REGION: z.string().default("us-east-1"),
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_FORCE_PATH_STYLE: z
      .string()
      .optional()
      .transform((value) => value === "true"),

    UPLOAD_MAX_SIZE_MB: z.coerce.number().int().positive().default(25),

    EMAIL_SERVER: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const inProduction = value.NODE_ENV === "production";

    // A placeholder secret would sign every session with a public value.
    if (PLACEHOLDER_SECRETS.has(value.AUTH_SECRET.trim().toLowerCase())) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET is still a placeholder. Generate one with: openssl rand -base64 32",
      });
    }

    // Serving in production is what these guard; building is not serving.
    if (!inProduction || isBuildPhase) return;

    /**
     * The local driver writes to the instance filesystem, which is ephemeral
     * on every serverless and most container platforms: uploaded documents
     * survive only until the instance recycles.
     *
     * This used to refuse to boot, which turned out to be the wrong trade: it
     * blocked every page that has nothing to do with documents, so the whole
     * application became unreachable over a limitation that affects one
     * feature. It is now reported by `/api/health` as a degraded state instead
     * — visible, but not fatal.
     */
    if (value.STORAGE_DRIVER === "s3") {
      for (const key of ["STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY", "STORAGE_BUCKET"] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }

    // APP_URL is not checked here: nothing consumes it yet, and on Vercel it
    // is derived from the deployment. Refusing to start over a value no code
    // reads would be friction without a benefit.
  }),
);

export type Env = z.infer<typeof envSchema>;

/**
 * Names of the variables that are wrong or missing. Deliberately returns only
 * names, never values, so it is safe to surface in a diagnostic response.
 */
export function environmentIssues(): { variable: string; message: string }[] {
  const result = envSchema.safeParse(process.env);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    variable: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}
