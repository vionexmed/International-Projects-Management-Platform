import { errorText } from "@/lib/i18n/error-text";

/**
 * Authorization errors.
 *
 * Identity is checked with the `is*` guards below, never with `instanceof`:
 * the same class can be instantiated from a different compiled chunk (the RSC
 * and SSR module graphs are separate), which makes `instanceof` silently
 * false. Security behaviour must not depend on how the bundler split the code,
 * so each error carries a stable marker instead.
 */

const NOT_FOUND = "NotFoundError";
const FORBIDDEN = "ForbiddenError";
const UNAUTHENTICATED = "AuthenticationError";

/** Thrown when a user is authenticated but lacks the required capability. */
export class ForbiddenError extends Error {
  constructor(message = errorText("forbidden")) {
    super(message);
    this.name = FORBIDDEN;
  }
}

/** Thrown when a record does not exist *or* is outside the caller's scope. */
export class NotFoundError extends Error {
  constructor(message = errorText("notFound")) {
    super(message);
    this.name = NOT_FOUND;
  }
}

export class AuthenticationError extends Error {
  constructor(message = errorText("sessionExpired")) {
    super(message);
    this.name = UNAUTHENTICATED;
  }
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof Error && error.name === NOT_FOUND;
}

export function isForbiddenError(error: unknown): error is ForbiddenError {
  return error instanceof Error && error.name === FORBIDDEN;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof Error && error.name === UNAUTHENTICATED;
}
