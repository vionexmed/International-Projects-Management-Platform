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

  it("refuses local storage in production", () => {
    const messages = messagesFor({
      ...base,
      NODE_ENV: "production",
      STORAGE_DRIVER: "local",
    });
    expect(messages.join(" ")).toMatch(/ephemeral filesystem/);
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

  it("refuses plain http in production, because the session cookie is Secure", () => {
    const messages = messagesFor({
      ...base,
      NODE_ENV: "production",
      APP_URL: "http://projetos.vionex.com",
    });
    expect(messages.join(" ")).toMatch(/https/);
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

      expect(names).toEqual(
        expect.arrayContaining(["DATABASE_URL", "AUTH_SECRET", "APP_URL", "STORAGE_DRIVER"]),
      );

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
