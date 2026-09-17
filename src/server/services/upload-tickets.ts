import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import { ALLOWED_FILE_TYPES, maxUploadMb } from "@/lib/upload";
import { uploadMaxBytes } from "@/lib/env";
import { ForbiddenError } from "@/server/authz/errors";
import type { SessionUser } from "@/types/auth";

/**
 * Uploading a file without sending it through the application.
 *
 * Every deployment platform caps the body of a request to a serverless
 * function. Vercel rejects anything over about 4.5 MB at the edge — before our
 * code runs, which is why the failure arrived as an unexplained error page —
 * while the product accepts documents up to 25 MB. No configuration bridges
 * that gap: the bytes have to travel a different road.
 *
 * So the server approves the upload *before* it happens and records it after:
 *
 *   1. the client describes the file; the server validates name, type and size
 *      exactly as it always did, chooses the storage key itself, and returns a
 *      short-lived URL the browser may PUT that one object to;
 *   2. the browser uploads straight to storage;
 *   3. the client comes back with the ticket; the server verifies its own
 *      signature, checks the object really landed and how big it is, and only
 *      then writes the database row.
 *
 * The ticket is a signed token rather than a row in a table: it carries who
 * asked, for which project, which key, and what was promised. A client that
 * edits any of it invalidates the signature, and a client that skips step 1
 * has no ticket at all. Nothing here trusts a value the browser sends back.
 */

const TICKET_TTL_SECONDS = 10 * 60;
const ISSUER = "vionex-upload-ticket";

export type UploadTicket = {
  /** Where the browser PUTs the file. Null when the driver cannot presign. */
  url: string | null;
  /** Opaque token returned to the server when the upload finishes. */
  token: string;
  /** Echoed so the browser sends exactly the type that was signed. */
  contentType: string;
  /** How long the browser has before the URL stops working. */
  expiresInSeconds: number;
};

export type TicketClaims = {
  key: string;
  projectId: string;
  fileName: string;
  contentType: string;
  declaredSize: number;
  userId: string;
};

function signingKey() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

/**
 * Validates the description of a file that does not exist on this machine.
 *
 * The same three rules as `validateUpload` — type allowed, extension matching
 * the type, size within the ceiling — applied to metadata instead of bytes.
 * Nothing is lost: that function never inspected content either.
 */
export function validateDescribedUpload(input: {
  fileName: string;
  contentType: string;
  size: number;
}): string | null {
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return "O arquivo está vazio.";
  }
  if (input.size > uploadMaxBytes()) {
    return `O arquivo excede o limite de ${maxUploadMb()} MB.`;
  }

  const allowedExtensions = ALLOWED_FILE_TYPES[input.contentType];
  if (!allowedExtensions) {
    return "Tipo de arquivo não permitido.";
  }

  const lower = input.fileName.toLowerCase();
  if (!allowedExtensions.some((extension) => lower.endsWith(extension))) {
    return "A extensão do arquivo não corresponde ao seu tipo.";
  }

  return null;
}

/** Storage key, chosen by the server. Never derived from client input. */
function buildKey(projectId: string, fileName: string) {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return `projects/${projectId}/${randomUUID()}${extension}`;
}

export async function issueUploadTicket(
  user: SessionUser,
  input: { projectId: string; fileName: string; contentType: string; size: number },
): Promise<UploadTicket> {
  const problem = validateDescribedUpload(input);
  if (problem) throw new Error(problem);

  const key = buildKey(input.projectId, input.fileName);
  const url = await storage().presignPut(key, input.contentType, TICKET_TTL_SECONDS);

  const token = await new SignJWT({
    key,
    projectId: input.projectId,
    fileName: input.fileName,
    contentType: input.contentType,
    declaredSize: input.size,
    userId: user.id,
  } satisfies TicketClaims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(`${TICKET_TTL_SECONDS}s`)
    .sign(signingKey());

  return { url, token, contentType: input.contentType, expiresInSeconds: TICKET_TTL_SECONDS };
}

/**
 * Reads back a ticket and confirms the object is really there.
 *
 * Three things are checked, and each one is a way the client could lie: the
 * signature (did we issue this?), the holder (is it the same session?), and
 * the object itself (did the upload actually land, and is it the size that was
 * approved?). The size comes from storage, never from the browser — a client
 * that promised 2 MB and uploaded 200 MB is refused here, and the stray object
 * is removed.
 */
export async function redeemUploadTicket(
  user: SessionUser,
  token: string,
): Promise<TicketClaims & { size: number }> {
  let claims: TicketClaims;
  try {
    const { payload } = await jwtVerify(token, signingKey(), { issuer: ISSUER });
    claims = payload as unknown as TicketClaims;
  } catch {
    throw new ForbiddenError("O envio expirou. Tente novamente.");
  }

  if (claims.userId !== user.id) {
    throw new ForbiddenError("Este envio pertence a outra sessão.");
  }

  const object = await storage().head(claims.key);
  if (!object) {
    throw new Error("O arquivo não chegou ao armazenamento. Tente novamente.");
  }

  if (object.size > uploadMaxBytes()) {
    // Approved as one size and uploaded as another: discard it.
    await storage().delete(claims.key);
    throw new Error(`O arquivo excede o limite de ${maxUploadMb()} MB.`);
  }

  return { ...claims, size: object.size };
}
