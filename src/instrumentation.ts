/**
 * Runs once, before the server accepts its first request.
 *
 * Every rule checked here was already enforced somewhere deeper — at the first
 * query, at the first download, in a health response. Enforcing it here as
 * well is not redundancy: it changes *when* the deployment finds out. A
 * misconfigured instance that boots and answers pages is worse than one that
 * refuses to start, because somebody begins using it, and the part that is
 * broken is discovered by whoever happens to need it first.
 *
 * Deliberately no database call. This answers "is this deployment allowed to
 * serve?", which must not depend on anything that can itself be down — a
 * temporarily unreachable database is a degraded system, not a forbidden one,
 * and the two deserve different answers.
 */
export async function register() {
  // Only the Node.js server runtime has an environment to check.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { appEnv } = await import("@/lib/app-env");
  const { startupProblems, describeProblems } = await import("@/lib/startup-check");

  const problems = startupProblems();
  const fatal = problems.filter((problem) => problem.severity === "fatal");
  const warnings = problems.filter((problem) => problem.severity === "warning");

  if (warnings.length > 0) {
    console.warn(`[startup] APP_ENV=${appEnv()}\n${describeProblems(warnings)}`);
  }

  if (fatal.length > 0) {
    /**
     * Thrown rather than `process.exit`: the platform needs the message in the
     * log and a non-zero exit, and throwing out of `register` gives both
     * without racing the logger's flush.
     */
    throw new Error(
      `Refusing to start in "${appEnv()}" — the deployment is misconfigured:\n` +
        `${describeProblems(fatal)}\n` +
        "Fix the variables above, or set APP_ENV to development, test or demo.",
    );
  }

  console.info(`[startup] APP_ENV=${appEnv()} · configuration accepted`);
}
