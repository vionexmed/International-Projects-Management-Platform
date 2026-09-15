import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The passwordless account chooser at `/demo` is a real open door: anyone who
 * reaches the URL signs in as any seeded account, administrator included.
 *
 * These tests used to pin the opposite of what they pin now. They asserted
 * that the chooser stayed open "including in production", because that was the
 * deliberate arrangement while the data was invented. Inverting them is the
 * point: the door is now tied to a declared environment, and this file is what
 * fails if somebody re-opens it by accident.
 */
const original = { ...process.env };

const BASE = {
  DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app",
  AUTH_SECRET: "a-genuinely-random-secret-of-enough-length",
  APP_URL: "https://projetos.vionex.com",
  STORAGE_DRIVER: "s3",
  STORAGE_ACCESS_KEY: "key",
  STORAGE_SECRET_KEY: "secret",
  STORAGE_BUCKET: "documents",
};

async function loadDemo(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
  // The platform sets these; they must not leak between cases.
  delete process.env.VERCEL_ENV;
  delete process.env.APP_ENV;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("@/lib/demo");
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
});

describe("demo mode", () => {
  it("is closed in production", async () => {
    const { isDemoEnabled } = await loadDemo({
      ...BASE,
      NODE_ENV: "production",
      APP_ENV: "production",
    });
    expect(isDemoEnabled()).toBe(false);
  });

  it("is closed in staging", async () => {
    const { isDemoEnabled } = await loadDemo({ ...BASE, APP_ENV: "staging" });
    expect(isDemoEnabled()).toBe(false);
  });

  it("is closed on preview deployments", async () => {
    // A preview URL is shareable and built from the same code as production.
    const { isDemoEnabled } = await loadDemo({ ...BASE, APP_ENV: "preview" });
    expect(isDemoEnabled()).toBe(false);
  });

  it("stays open in development", async () => {
    const { isDemoEnabled } = await loadDemo({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://vionex:pass@localhost:5433/app",
      APP_URL: "http://localhost:3000",
      STORAGE_DRIVER: "local",
    });
    expect(isDemoEnabled()).toBe(true);
  });

  it("stays open in an environment declared as a demonstration", async () => {
    const { isDemoEnabled } = await loadDemo({ ...BASE, APP_ENV: "demo" });
    expect(isDemoEnabled()).toBe(true);
  });

  it("is never inferred from missing configuration", async () => {
    /**
     * The failure this guards against: a deployment whose DATABASE_URL was
     * deleted by accident quietly becoming a demonstration, complete with
     * seeded accounts whose password is published in this repository. Absent
     * configuration is a fault, never an invitation.
     */
    const { isDemoEnabled } = await loadDemo({
      NODE_ENV: "production",
      APP_ENV: "production",
      AUTH_SECRET: "a-genuinely-random-secret-of-enough-length",
      DATABASE_URL: undefined,
    });
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(isDemoEnabled()).toBe(false);
  });

  it("labels a deployed demonstration on screen", async () => {
    // A reachable URL that asks for no password has to announce itself.
    const { isPublicDemo } = await loadDemo({ ...BASE, APP_ENV: "demo" });
    expect(isPublicDemo()).toBe(true);
  });

  it("does not clutter local development with the banner", async () => {
    const { isPublicDemo } = await loadDemo({
      NODE_ENV: "development",
      STORAGE_DRIVER: "local",
    });
    expect(isPublicDemo()).toBe(false);
  });

  it("refuses demo-only code paths outside a demonstration", async () => {
    const { assertDemoAllowed } = await loadDemo({ ...BASE, APP_ENV: "production" });
    expect(() => assertDemoAllowed("The account chooser")).toThrow(/production/);
  });
});
