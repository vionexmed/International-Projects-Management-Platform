import { z } from "zod";

/**
 * Server-side environment. Parsed once at module load so that a
 * misconfigured deployment fails fast instead of at the first request.
 * Never import this module from a client component.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),

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
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const UPLOAD_MAX_BYTES = env.UPLOAD_MAX_SIZE_MB * 1024 * 1024;
