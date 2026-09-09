import "server-only";
import { notFound } from "next/navigation";
import { isNotFoundError } from "@/server/authz/errors";

/**
 * Converts an out-of-scope lookup into a 404 for React Server Components.
 *
 * Layouts and pages render in parallel, so it is not enough for the layout to
 * handle the failure: an unhandled rejection in the sibling page reaches the
 * error boundary first and turns a 404 into a 200 error screen. Wrapping every
 * RSC call site in this helper makes the outcome the same no matter which
 * segment loses the race.
 *
 *     const project = await orNotFound(requireProjectAccess(user, projectId));
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }
}
