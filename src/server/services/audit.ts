import "server-only";
import type { Prisma } from "@/generated/prisma";
import { db } from "@/server/db";

export type AuditAction =
  | "project.create"
  | "project.update"
  | "project.status_change"
  | "project.archive"
  | "task.create"
  | "task.update"
  | "task.status_change"
  | "task.comment"
  | "document.upload"
  | "document.version"
  | "document.request"
  | "document.submit"
  | "document.review"
  | "document.download"
  | "message.send"
  | "supplier.create"
  | "supplier.update"
  | "user.create"
  | "user.update"
  | "user.role_change"
  | "auth.login"
  | "auth.logout";

/**
 * Append-only record of who changed what. Deliberately never throws: an audit
 * failure must not roll back the operation the user actually asked for, so it
 * is logged and swallowed.
 */
export async function recordAudit(input: {
  organizationId: string;
  actorId: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  client?: Prisma.TransactionClient;
}) {
  const client = input.client ?? db;
  try {
    await client.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", input.action, error);
  }
}
