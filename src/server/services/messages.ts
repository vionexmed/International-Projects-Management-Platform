import "server-only";
import { db } from "@/server/db";
import { threadScope } from "@/server/authz/scopes";
import { requireThreadAccess } from "@/server/authz/access";
import { recordAudit } from "@/server/services/audit";
import { recordTimelineEvent } from "@/server/services/timeline";
import { notify, supplierRecipients } from "@/server/services/notifications";
import { uploadDocument } from "@/server/services/documents";
import { isSupplierRole, type SessionUser } from "@/types/auth";

/**
 * Contextual messaging: every thread belongs to a project, so a conversation
 * is always anchored to the work it is about.
 */
export async function listThreads(user: SessionUser, filters: { projectId?: string } = {}) {
  const threads = await db.messageThread.findMany({
    where: {
      AND: [threadScope(user), filters.projectId ? { projectId: filters.projectId } : {}],
    },
    include: {
      project: { select: { id: true, name: true, projectCode: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const threadIds = threads.map((thread) => thread.id);
  const unreadCounts = new Map<string, number>();

  if (threadIds.length > 0) {
    const unread = await db.message.groupBy({
      by: ["threadId"],
      where: {
        threadId: { in: threadIds },
        senderId: { not: user.id },
        reads: { none: { userId: user.id } },
      },
      _count: { _all: true },
    });
    for (const row of unread) unreadCounts.set(row.threadId, row._count._all);
  }

  return threads.map((thread) => ({
    ...thread,
    lastMessage: thread.messages[0] ?? null,
    unreadCount: unreadCounts.get(thread.id) ?? 0,
  }));
}

export async function getThread(user: SessionUser, threadId: string) {
  const thread = await requireThreadAccess(user, threadId);
  const messages = await db.message.findMany({
    where: { threadId },
    include: {
      sender: { select: { id: true, name: true, jobTitle: true, supplierId: true } },
      reads: { where: { userId: user.id }, select: { id: true } },
      /**
       * The version id is all the client needs: the file itself is fetched
       * through `/api/files/[versionId]`, which re-checks the caller's scope.
       * A recipient who should not see this document gets a 404 there, so the
       * link being present is never itself an authorisation.
       */
      attachments: {
        select: {
          id: true,
          documentVersion: {
            select: { id: true, fileName: true, fileSize: true, mimeType: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return { thread, messages };
}

export async function markThreadRead(user: SessionUser, threadId: string) {
  await requireThreadAccess(user, threadId);
  const unread = await db.message.findMany({
    where: { threadId, senderId: { not: user.id }, reads: { none: { userId: user.id } } },
    select: { id: true },
  });
  if (unread.length === 0) return;

  await db.messageRead.createMany({
    data: unread.map((message) => ({ messageId: message.id, userId: user.id })),
    skipDuplicates: true,
  });
}

export async function sendMessage(
  user: SessionUser,
  threadId: string,
  body: string,
  file?: File | null,
) {
  const thread = await requireThreadAccess(user, threadId);
  const trimmed = body.trim();
  if (!trimmed && !file) {
    throw new Error("Escreva uma mensagem ou anexe um arquivo.");
  }

  /**
   * An attachment is a document, stored the way every other document is.
   *
   * Uploading first and only then creating the message is the same trade
   * `uploadDocument` already makes: an orphaned object is harmless, a row
   * pointing at a file that is not there is not. If the message fails, the
   * document exists and is visible in the project's documents — which is
   * where a supplier would look for a file they know they sent.
   *
   * Visibility follows the thread. A file on a thread shared with the supplier
   * is `SHARED_WITH_SUPPLIER`, so `documentScope` lets them download it
   * through the ordinary route; one on an internal thread stays internal, and
   * that thread is already invisible to them.
   */
  let versionId: string | null = null;
  if (file) {
    const document = await uploadDocument(user, {
      projectId: thread.projectId,
      file,
      name: file.name.replace(/\.[^.]+$/, ""),
      type: "OTHER",
      visibility: thread.withSupplier ? "SHARED_WITH_SUPPLIER" : "INTERNAL_ONLY",
    });

    const version = await db.documentVersion.findFirstOrThrow({
      where: { documentId: document.id },
      orderBy: { version: "desc" },
      select: { id: true },
    });
    versionId = version.id;
  }

  const message = await db.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        threadId,
        senderId: user.id,
        body: trimmed || file!.name,
        ...(versionId
          ? { attachments: { create: { documentVersionId: versionId } } }
          : {}),
      },
    });
    await tx.messageThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    return created;
  });

  await recordTimelineEvent({
    projectId: thread.projectId,
    actorId: user.id,
    type: "MESSAGE_SENT",
    description: `Nova mensagem em ${thread.subject}.`,
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "message.send",
    entity: "MessageThread",
    entityId: threadId,
  });

  // Notify the other side of the conversation.
  const project = await db.project.findUnique({
    where: { id: thread.projectId },
    select: { ownerId: true, supplierId: true, name: true },
  });

  if (project) {
    const recipients = isSupplierRole(user.role)
      ? [project.ownerId]
      : await supplierRecipients(project.supplierId);

    await notify({
      userIds: recipients.filter((id) => id !== user.id),
      type: "MESSAGE_RECEIVED",
      title: thread.subject,
      description: `${user.name}: ${trimmed.slice(0, 90)}`,
      href: isSupplierRole(user.role)
        ? `/projects/${thread.projectId}/messages`
        : `/supplier/messages?thread=${threadId}`,
    });
  }

  return message;
}

/** Ensures a project has its shared Vionex ↔ supplier thread. */
export async function ensureProjectThread(projectId: string, subject: string) {
  const existing = await db.messageThread.findFirst({
    where: { projectId, withSupplier: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const thread = await db.messageThread.create({
    data: { projectId, subject, withSupplier: true },
    select: { id: true },
  });
  return thread.id;
}

export async function countUnreadMessages(user: SessionUser) {
  return db.message.count({
    where: {
      senderId: { not: user.id },
      reads: { none: { userId: user.id } },
      thread: threadScope(user),
    },
  });
}
