import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startupProblems } from "@/lib/startup-check";
import { DEMO_SIGNING_KEY } from "@/lib/env-schema";
import { APP_ENVIRONMENTS, allowsDemo, appEnv, isRealEnvironment } from "@/lib/app-env";

/**
 * The environment contract.
 *
 * Every rule below exists because the opposite behaviour is plausible and
 * dangerous: a deployment with no database URL falling back to a published
 * demonstration dataset, a real environment signing sessions with a key
 * printed in this repository, uploads landing on a disk that is thrown away.
 *
 * These are the checks that decide whether an instance is allowed to serve, so
 * they are tested the way the deployment will meet them — by setting the
 * variables and asking.
 */
const ORIGINAL = { ...process.env };

/** A syntactically valid, obviously fake set of real-deployment variables. */
const REAL_CONFIG = {
  DATABASE_URL: "postgresql://user:pw@db.example.com:5432/vionex",
  AUTH_SECRET: "x".repeat(44),
  STORAGE_DRIVER: "s3",
  STORAGE_ACCESS_KEY: "key",
  STORAGE_SECRET_KEY: "secret",
  STORAGE_BUCKET: "bucket",
};

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  // Start from a blank slate so a variable in the developer's own .env cannot
  // make a test pass that would fail in CI.
  for (const key of [
    "APP_ENV",
    "VERCEL_ENV",
    "DATABASE_URL",
    "DIRECT_URL",
    "AUTH_SECRET",
    "STORAGE_DRIVER",
    "STORAGE_ACCESS_KEY",
    "STORAGE_SECRET_KEY",
    "STORAGE_BUCKET",
  ]) {
    delete process.env[key];
  }
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("which environment is this", () => {
  it("lets APP_ENV win over everything", () => {
    setEnv({ APP_ENV: "staging", VERCEL_ENV: "production", NODE_ENV: "production" });
    expect(appEnv()).toBe("staging");
  });

  it("falls back to the platform, then to NODE_ENV", () => {
    setEnv({ VERCEL_ENV: "preview" });
    expect(appEnv()).toBe("preview");

    setEnv({ VERCEL_ENV: "production" });
    expect(appEnv()).toBe("production");

    setEnv({ VERCEL_ENV: undefined });
    expect(appEnv()).toBe(process.env.NODE_ENV === "test" ? "test" : "development");
  });

  it("never derives demo from anything", () => {
    /**
     * The rule the whole model rests on: a deployment is a demonstration
     * because somebody typed it, never because a variable was missing. A
     * missing database URL is a failure, not an invitation to open the
     * passwordless account chooser.
     */
    for (const vercel of [undefined, "preview", "production", "development"]) {
      setEnv({ APP_ENV: undefined, VERCEL_ENV: vercel, DATABASE_URL: undefined });
      expect(appEnv()).not.toBe("demo");
    }

    setEnv({ APP_ENV: "demo" });
    expect(appEnv()).toBe("demo");
  });

  it("rejects an APP_ENV that is not one of the six", () => {
    setEnv({ APP_ENV: "prod" });
    expect(() => appEnv()).toThrow(/APP_ENV/);
  });

  it("splits the six environments into demo-friendly and real, with no overlap", () => {
    for (const environment of APP_ENVIRONMENTS) {
      setEnv({ APP_ENV: environment });
      expect(allowsDemo()).toBe(!isRealEnvironment());
    }
  });
});

describe("a real deployment refuses to serve when it is wrong", () => {
  it("accepts a correctly configured production", () => {
    setEnv({ APP_ENV: "production", ...REAL_CONFIG });
    expect(startupProblems()).toHaveLength(0);
  });

  it("refuses production with no database", () => {
    setEnv({ APP_ENV: "production", ...REAL_CONFIG, DATABASE_URL: undefined });

    const fatal = startupProblems().filter((problem) => problem.severity === "fatal");
    expect(fatal.map((problem) => problem.variable)).toContain("DATABASE_URL");
  });

  it("refuses production signed with the published demonstration key", () => {
    setEnv({ APP_ENV: "production", ...REAL_CONFIG, AUTH_SECRET: undefined });

    const fatal = startupProblems().filter((problem) => problem.severity === "fatal");
    expect(fatal.map((problem) => problem.variable)).toContain("AUTH_SECRET");
  });

  it("refuses a secret that is a placeholder", () => {
    setEnv({ APP_ENV: "production", ...REAL_CONFIG, AUTH_SECRET: "change_me" });
    expect(startupProblems().length).toBeGreaterThan(0);
  });

  it("refuses ephemeral storage in staging and production", () => {
    for (const environment of ["staging", "production"] as const) {
      setEnv({
        APP_ENV: environment,
        ...REAL_CONFIG,
        STORAGE_DRIVER: "local",
        STORAGE_ACCESS_KEY: undefined,
        STORAGE_SECRET_KEY: undefined,
        STORAGE_BUCKET: undefined,
      });

      const fatal = startupProblems().filter((problem) => problem.severity === "fatal");
      expect(fatal.map((problem) => problem.variable)).toContain("STORAGE_DRIVER");
    }
  });

  it("only warns about ephemeral storage on a preview", () => {
    /**
     * A preview is real — it gets a shareable URL and a real secret — but it
     * is also disposable. Refusing to boot over uploads that nobody will miss
     * would block the reviews previews exist for.
     */
    setEnv({
      APP_ENV: "preview",
      ...REAL_CONFIG,
      STORAGE_DRIVER: "local",
      STORAGE_ACCESS_KEY: undefined,
      STORAGE_SECRET_KEY: undefined,
      STORAGE_BUCKET: undefined,
    });

    const problems = startupProblems();
    expect(problems.filter((problem) => problem.severity === "fatal")).toHaveLength(0);
    expect(problems.some((problem) => problem.severity === "warning")).toBe(true);
  });

  it("reports every problem at once, not one per deploy", () => {
    setEnv({
      APP_ENV: "production",
      DATABASE_URL: undefined,
      AUTH_SECRET: undefined,
      STORAGE_DRIVER: "local",
    });

    const variables = startupProblems().map((problem) => problem.variable);
    expect(variables).toContain("DATABASE_URL");
    expect(variables).toContain("AUTH_SECRET");
    expect(variables).toContain("STORAGE_DRIVER");
  });

  it("leaves development alone", () => {
    // No database, no secret, local disk — exactly how a developer starts.
    setEnv({ APP_ENV: "development" });
    expect(startupProblems()).toHaveLength(0);
  });

  it("leaves an explicit demo alone", () => {
    setEnv({ APP_ENV: "demo" });
    expect(startupProblems()).toHaveLength(0);
  });
});

describe("staging and production carry nothing from the demonstration", () => {
  it("never enables the passwordless sign-in", async () => {
    const { isDemoEnabled } = await import("@/lib/demo");

    for (const environment of ["preview", "staging", "production"] as const) {
      setEnv({ APP_ENV: environment });
      expect(isDemoEnabled()).toBe(false);
    }
  });

  it("never falls back to the embedded database", async () => {
    const { shouldUseEmbeddedDatabase } = await import("@/server/demo/embedded-db");

    for (const environment of ["preview", "staging", "production"] as const) {
      setEnv({ APP_ENV: environment, DATABASE_URL: undefined });
      // Throws rather than returning false: silently continuing with no
      // database is how a real deployment ends up serving invented data.
      expect(() => shouldUseEmbeddedDatabase()).toThrow(/DATABASE_URL/);
    }
  });

  it("does not treat the published key as a valid secret", () => {
    setEnv({ APP_ENV: "staging", ...REAL_CONFIG, AUTH_SECRET: DEMO_SIGNING_KEY });
    expect(startupProblems().some((problem) => problem.variable === "AUTH_SECRET")).toBe(true);
  });
});
