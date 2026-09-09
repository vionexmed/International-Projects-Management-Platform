import { env } from "@/lib/env";

/**
 * The account chooser at `/demo` is always available.
 *
 * This deployment exists to be evaluated, and requiring credentials would
 * defeat that: the reviewer needs to move between the internal environment and
 * the Supplier Portal without being handed passwords.
 *
 * The consequence is deliberate and worth stating plainly: anyone who can
 * reach the URL can sign in as any seeded user. That is acceptable only while
 * the data is fictitious. Before this platform holds real supplier data, this
 * function must return `false` outside development — at which point `/` goes
 * back to the login form and `/demo` becomes a 404. Nothing else needs to
 * change; the login flow is intact and still reachable at `/login`.
 */
export function isDemoEnabled(): boolean {
  return true;
}

/**
 * Whether to label the deployment on screen. A reachable URL that asks for no
 * password should say so, so nobody mistakes it for the live system.
 */
export function isPublicDemo(): boolean {
  return env.NODE_ENV === "production";
}
