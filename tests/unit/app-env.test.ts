import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `APP_ENV` is the variable the safety guards read, so its resolution is worth
 * pinning case by case — particularly the fallbacks, which exist so that
 * introducing the variable did not break every deployment at once, and which
 * are therefore the part most likely to be subtly wrong.
 */
const original = { ...process.env };

async function load(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("@/lib/app-env");
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
});

describe("appEnv", () => {
  it("uses an explicit APP_ENV above everything else", async () => {
    const { appEnv } = await load({
      APP_ENV: "staging",
      VERCEL_ENV: "production",
      NODE_ENV: "development",
    });
    expect(appEnv()).toBe("staging");
  });

  it("rejects an unknown value instead of guessing", async () => {
    const { appEnv } = await load({ APP_ENV: "prod" });
    expect(() => appEnv()).toThrow(/APP_ENV is "prod"/);
  });

  it("falls back to the Vercel signal", async () => {
    const production = await load({ APP_ENV: undefined, VERCEL_ENV: "production" });
    expect(production.appEnv()).toBe("production");

    const preview = await load({ APP_ENV: undefined, VERCEL_ENV: "preview" });
    expect(preview.appEnv()).toBe("preview");
  });

  it("treats an unmarked production build as production", async () => {
    const { appEnv } = await load({
      APP_ENV: undefined,
      VERCEL_ENV: undefined,
      NODE_ENV: "production",
    });
    expect(appEnv()).toBe("production");
  });

  it("defaults to development, never to demo", async () => {
    const { appEnv } = await load({
      APP_ENV: undefined,
      VERCEL_ENV: undefined,
      NODE_ENV: "development",
    });
    expect(appEnv()).toBe("development");
  });

  it("never derives demo from any combination of platform signals", async () => {
    // `demo` has to be typed on purpose. Nothing may arrive at it by accident.
    for (const vercel of [undefined, "production", "preview", "development"]) {
      for (const node of ["development", "test", "production"]) {
        const { appEnv } = await load({
          APP_ENV: undefined,
          VERCEL_ENV: vercel,
          NODE_ENV: node,
        });
        expect(appEnv()).not.toBe("demo");
      }
    }
  });
});

describe("environment capabilities", () => {
  const cases: { env: string; demo: boolean; real: boolean }[] = [
    { env: "development", demo: true, real: false },
    { env: "test", demo: true, real: false },
    { env: "demo", demo: true, real: false },
    { env: "preview", demo: false, real: true },
    { env: "staging", demo: false, real: true },
    { env: "production", demo: false, real: true },
  ];

  it.each(cases)("$env allows demo: $demo, is real: $real", async ({ env, demo, real }) => {
    const { allowsDemo, isRealEnvironment } = await load({ APP_ENV: env });
    expect(allowsDemo()).toBe(demo);
    expect(isRealEnvironment()).toBe(real);
  });

  it("keeps the two sets disjoint", async () => {
    for (const { env } of cases) {
      const { allowsDemo, isRealEnvironment } = await load({ APP_ENV: env });
      expect(allowsDemo() && isRealEnvironment()).toBe(false);
    }
  });
});
