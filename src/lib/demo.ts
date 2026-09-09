import { env } from "@/lib/env";

/**
 * The account chooser is available in development, and in a deployment that
 * explicitly opts in with DEMO_MODE.
 *
 * When it is on, anyone who can reach the URL can sign in as any seeded user
 * without a password — that is its entire purpose, and the reason it must
 * never be enabled on a deployment holding real supplier data.
 */
export function isDemoEnabled(): boolean {
  return env.NODE_ENV !== "production" || env.DEMO_MODE;
}

/** True only for the case worth warning about on screen. */
export function isPublicDemo(): boolean {
  return env.NODE_ENV === "production" && env.DEMO_MODE;
}
