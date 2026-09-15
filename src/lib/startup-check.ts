import { appEnv, allowsDemo, isRealEnvironment, type AppEnvironment } from "@/lib/app-env";
import { DEMO_SIGNING_KEY, envSchema } from "@/lib/env-schema";

/**
 * The contract each environment has to satisfy, checked before serving.
 *
 * Everything here was already enforced somewhere — at the first query, at the
 * first download, in a health response. That is too late and too scattered: a
 * deployment that is wrong should say so once, at startup, instead of working
 * for an hour and then failing on whichever page happens to need the broken
 * piece. A misconfigured deployment that boots is worse than one that does
 * not, because somebody starts using it.
 *
 * Pure and synchronous on purpose — no database, no network. It answers "is
 * this deployment allowed to serve?", which must not depend on anything that
 * can itself be down.
 */

export type StartupProblem = {
  variable: string;
  message: string;
  /** `fatal` refuses to boot; `warning` is reported and allowed. */
  severity: "fatal" | "warning";
};

/**
 * Environments where uploads must land somewhere that survives an instance
 * recycling. Left out of `development` and `test` on purpose: a local disk is
 * exactly right there.
 */
const NEEDS_PERSISTENT_STORAGE: readonly AppEnvironment[] = ["staging", "production"];

export function startupProblems(env: NodeJS.ProcessEnv = process.env): StartupProblem[] {
  const environment = appEnv();
  const problems: StartupProblem[] = [];

  // A typo in a variable name is reported by the schema, not guessed at here.
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push({
        variable: issue.path.join(".") || "(root)",
        message: issue.message,
        severity: "fatal",
      });
    }
  }

  /**
   * The remaining rules read the raw environment rather than the parsed
   * result, so that a deployment with three problems is told about three
   * problems. Returning at the first schema failure meant fixing one variable,
   * redeploying, and discovering the next one — which turns a five-minute
   * setup into an afternoon.
   */
  const value = {
    DATABASE_URL: env.DATABASE_URL?.trim() || undefined,
    AUTH_SECRET: env.AUTH_SECRET?.trim() || DEMO_SIGNING_KEY,
    STORAGE_DRIVER: env.STORAGE_DRIVER?.trim() || "local",
  };

  /** Keeps the schema's message when it already complained about a variable. */
  const alreadyReported = (variable: string) =>
    problems.some((problem) => problem.variable === variable);

  if (isRealEnvironment()) {
    /**
     * No database URL in a real deployment used to mean "start the embedded
     * demonstration database", which is a published dataset with published
     * passwords. It now means the deployment is misconfigured, and says so.
     */
    if (!value.DATABASE_URL && !alreadyReported("DATABASE_URL")) {
      problems.push({
        variable: "DATABASE_URL",
        message: `DATABASE_URL is required in "${environment}". The embedded demonstration database is refused outside development, test and demo.`,
        severity: "fatal",
      });
    }

    if (value.AUTH_SECRET === DEMO_SIGNING_KEY && !alreadyReported("AUTH_SECRET")) {
      problems.push({
        variable: "AUTH_SECRET",
        message: `AUTH_SECRET is the published demonstration key. Sessions signed with it can be forged. Generate one with: openssl rand -base64 32`,
        severity: "fatal",
      });
    }

    /**
     * `allowsDemo()` cannot be true here — `isRealEnvironment()` and
     * `allowsDemo()` partition the six environments — but the check is written
     * anyway, because the day somebody adds a seventh environment to one list
     * and forgets the other, this is the line that catches it.
     */
    if (allowsDemo()) {
      problems.push({
        variable: "APP_ENV",
        message: `The passwordless demonstration sign-in is enabled in "${environment}".`,
        severity: "fatal",
      });
    }
  }

  if (
    NEEDS_PERSISTENT_STORAGE.includes(environment) &&
    value.STORAGE_DRIVER === "local" &&
    !alreadyReported("STORAGE_DRIVER")
  ) {
    /**
     * Fatal rather than a warning, and only in staging and production.
     *
     * The local driver writes to the instance filesystem, which on any
     * serverless platform is discarded when the instance recycles. A regulatory
     * document that uploads successfully and disappears an hour later is the
     * worst possible failure mode for this product: nobody is told, and the
     * database still says the file exists.
     */
    problems.push({
      variable: "STORAGE_DRIVER",
      message: `STORAGE_DRIVER=local in "${environment}" loses every uploaded document when the instance recycles. Configure S3-compatible storage.`,
      severity: "fatal",
    });
  }

  if (environment === "preview" && value.STORAGE_DRIVER === "local") {
    // A preview is real but disposable: losing its uploads costs nothing, and
    // refusing to boot over it would block the reviews previews exist for.
    problems.push({
      variable: "STORAGE_DRIVER",
      message: "STORAGE_DRIVER=local on a preview: uploaded documents will not survive a redeploy.",
      severity: "warning",
    });
  }

  return problems;
}

/** Formats the refusal so the first line of a crashed log says what to fix. */
export function describeProblems(problems: StartupProblem[]) {
  return problems
    .map((problem) => `  ${problem.severity === "fatal" ? "✗" : "!"} ${problem.variable}: ${problem.message}`)
    .join("\n");
}
