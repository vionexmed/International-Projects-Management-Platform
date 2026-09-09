import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { requireDocumentVersionAccess } from "@/server/authz/access";
import { isNotFoundError } from "@/server/authz/errors";
import { storage } from "@/lib/storage";
import { recordAudit } from "@/server/services/audit";

/**
 * The only way a stored file reaches a browser.
 *
 * Storage keys never leave the server: the client addresses a file by version
 * id, and access is re-checked against the caller's scope on every request, so
 * a supplier cannot fetch another supplier's document by guessing an id, and a
 * link shared outside the platform is useless without a valid session.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const version = await requireDocumentVersionAccess(user, versionId);
    const object = await storage().get(version.storageKey);

    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "document.download",
      entity: "DocumentVersion",
      entityId: version.id,
      metadata: { documentId: version.documentId },
    });

    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const disposition = inline ? "inline" : "attachment";
    const encodedName = encodeURIComponent(version.fileName);

    return new NextResponse(new Uint8Array(object.body), {
      headers: {
        "Content-Type": object.contentType || version.mimeType,
        "Content-Length": String(object.body.byteLength),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
        // Private: the response is user-specific and must never be shared cache.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }
    console.error("[files] download failed", error);
    return NextResponse.json({ error: "Não foi possível baixar o arquivo." }, { status: 500 });
  }
}
