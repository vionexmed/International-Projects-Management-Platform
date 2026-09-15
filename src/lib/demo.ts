import { allowsDemo, appEnv, isRealEnvironment } from "@/lib/app-env";

/**
 * Whether the passwordless account chooser at `/demo` exists.
 *
 * It is a real convenience and it is also a real open door: anyone who reaches
 * the URL signs in as any seeded account, administrator included. That is fine
 * while the data is invented and unacceptable the moment it is not, so the
 * decision is tied to the declared environment instead of to a constant.
 *
 * `development`, `test` and `demo` keep it. `preview`, `staging` and
 * `production` do not — there `/demo` and `/demo/enter` are 404, and `/` goes
 * to the login form.
 *
 * To bring a demonstration deployment back, set `APP_ENV=demo` on it. That is
 * the whole mechanism: a deployment is a demonstration because somebody said
 * so, never because a variable happened to be missing.
 */
export function isDemoEnabled(): boolean {
  return allowsDemo();
}

/**
 * Whether to label the deployment on screen. A reachable URL that asks for no
 * password should say so, so nobody mistakes it for the live system — but
 * there is no reason to clutter a developer's own machine with the banner.
 */
export function isPublicDemo(): boolean {
  return isDemoEnabled() && appEnv() === "demo";
}

/**
 * Guard for code paths that must never run outside a demonstration. Throws
 * rather than returning a boolean so a caller cannot forget to check.
 */
export function assertDemoAllowed(what: string): void {
  if (!isDemoEnabled()) {
    throw new Error(
      `${what} is only available in a demonstration environment. ` +
        `APP_ENV is "${appEnv()}".`,
    );
  }
}

export { isRealEnvironment };
