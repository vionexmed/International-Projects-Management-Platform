import { describe, expect, it } from "vitest";
import { envSchema, environmentIssues } from "@/lib/env-schema";

/**
 * These guards are the difference between a deployment that quietly loses
 * uploaded documents and one that refuses to start, so they are pinned here.
 */
const base = {
  DATABASE_URL: "postgresql://user:pass@host:5432/db",
  AUTH_SECRET: "a-genuinely-random-secret-of-enough-length",
  APP_URL: "https://projetos.vionex.com",
  STORAGE_DRIVER: "s3",
  STORAGE_ACCESS_KEY: "key",
  STORAGE_SECRET_KEY: "secret",
  STORAGE_BUCKET: "bucket",
};

const messagesFor = (input: Record<string, string>) => {
  const result = envSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("environment validation", () => {
  it("accepts a complete production configuration", () => {
    expect(envSchema.safeParse({ ...base, NODE_ENV: "production" }).success).toBe(true);
  });

  it("allows local storage in production instead of refusing to boot", () => {
    // Ephemeral storage affects documents only. Blocking startup over it made
    // every unrelated page unreachable too; /api/health reports it instead.
    const result = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      STORAGE_DRIVER: "local",
    });
    expect(result.success).toBe(true);
  });

  it("allows local storage in development", () => {
    const result = envSchema.safeParse({
      ...base,
      NODE_ENV: "development",
      APP_URL: "http://localhost:3000",
      STORAGE_DRIVER: "local",
    });
    expect(result.success).toBe(true);
  });

  it("requires the S3 credentials when the s3 driver is selected", () => {
    const messages = messagesFor({
      DATABASE_URL: base.DATABASE_URL,
      AUTH_SECRET: base.AUTH_SECRET,
      APP_URL: base.APP_URL,
      NODE_ENV: "production",
      STORAGE_DRIVER: "s3",
    });

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining("STORAGE_ACCESS_KEY"),
        expect.stringContaining("STORAGE_SECRET_KEY"),
        expect.stringContaining("STORAGE_BUCKET"),
      ]),
    );
  });

  it("does not block startup over APP_URL, which nothing reads yet", () => {
    const result = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      APP_URL: "http://projetos.vionex.com",
    });
    expect(result.success).toBe(true);
  });

  it("boots a production deployment on DATABASE_URL and AUTH_SECRET alone", () => {
    // The smallest configuration someone can reasonably be asked for.
    const result = envSchema.safeParse({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app",
      AUTH_SECRET: "a-genuinely-random-secret-of-enough-length",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.STORAGE_DRIVER).toBe("local");
      expect(result.data.UPLOAD_MAX_SIZE_MB).toBe(25);
    }
  });

  it("rejects a placeholder AUTH_SECRET in any environment", () => {
    for (const NODE_ENV of ["development", "production"]) {
      const messages = messagesFor({
        ...base,
        NODE_ENV,
        APP_URL: NODE_ENV === "production" ? base.APP_URL : "http://localhost:3000",
        AUTH_SECRET: "CHANGE_ME_generate_with_openssl_rand_base64_32",
      });
      expect(messages.join(" ")).toMatch(/placeholder/);
    }
  });

  it("rejects a secret that is too short to be safe", () => {
    const messages = messagesFor({ ...base, AUTH_SECRET: "too-short" });
    expect(messages.join(" ")).toMatch(/at least 32/);
  });

  it("defaults the upload limit and coerces it from a string", () => {
    const parsed = envSchema.parse({ ...base, UPLOAD_MAX_SIZE_MB: "50" });
    expect(parsed.UPLOAD_MAX_SIZE_MB).toBe(50);
    expect(envSchema.parse(base).UPLOAD_MAX_SIZE_MB).toBe(25);
  });
  it("treats an empty variable as absent, not as an invalid value", () => {
    // Pasting a template into a hosting dashboard leaves entries like
    // DIRECT_URL="" behind. Those must fall back to their defaults instead of
    // failing every rule and burying the two variables that actually matter.
    const issues = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      DIRECT_URL: "",
      STORAGE_ENDPOINT: "",
      UPLOAD_MAX_SIZE_MB: "",
      EMAIL_SERVER: "  ",
    });

    expect(issues.success).toBe(true);
    if (issues.success) {
      expect(issues.data.UPLOAD_MAX_SIZE_MB).toBe(25);
      expect(issues.data.DIRECT_URL).toBeUndefined();
    }
  });

  it("reports offending variable names without leaking their values", () => {
    const original = { ...process.env };

    try {
      // NODE_ENV is typed read-only, so the whole set goes through assign.
      Object.assign(process.env, {
        NODE_ENV: "production",
        DATABASE_URL: "",
        AUTH_SECRET: "too-short-to-be-safe",
        APP_URL: "http://insecure.example.com",
        STORAGE_DRIVER: "local",
      });

      const issues = environmentIssues();
      const names = issues.map((issue) => issue.variable);

      // Required fields are reported first: Zod stops before the
      // production-only checks when the shape itself does not hold.
      expect(names).toEqual(expect.arrayContaining(["DATABASE_URL", "AUTH_SECRET"]));

      // The diagnostic must never echo a configured value back to the caller.
      const serialised = JSON.stringify(issues);
      expect(serialised).not.toContain("too-short-to-be-safe");
      expect(serialised).not.toContain("insecure.example.com");
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in original)) delete process.env[key];
      }
      Object.assign(process.env, original);
    }
  });

  it("reports nothing once the two required fields are supplied", () => {
    const original = { ...process.env };

    try {
      Object.assign(process.env, {
        ...base,
        NODE_ENV: "production",
        APP_URL: "http://insecure.example.com",
        STORAGE_DRIVER: "local",
      });

      // Nothing left to complain about: the remaining guards are advisory.
      expect(environmentIssues()).toEqual([]);
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in original)) delete process.env[key];
      }
      Object.assign(process.env, original);
    }
  });

  it("reports no issues for a valid configuration", () => {
    const original = { ...process.env };

    try {
      Object.assign(process.env, { ...base, NODE_ENV: "production" });
      expect(environmentIssues()).toEqual([]);
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in original)) delete process.env[key];
      }
      Object.assign(process.env, original);
    }
  });
});
