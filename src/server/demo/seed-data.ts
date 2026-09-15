import type { PrismaClient } from "@/generated/prisma";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { StageKey } from "@/generated/prisma";
import type { StorageDriver } from "@/lib/storage/types";
import { buildPdf, date, daysFromNow } from "@/server/demo/helpers";
import { DOCUMENT_BLUEPRINTS, PROJECT_BLUEPRINTS } from "@/server/demo/projects";
import { seedStageDetails } from "@/server/demo/stages";

const STAGE_NAMES: Record<StageKey, string> = {
  CLINICAL: "Clinical",
  REGULATORY: "Regulatory",
  IMPORT_LOGISTICS: "Import & Logistics",
  GO_TO_MARKET: "Go-to-Market",
};

const STAGE_ORDER: StageKey[] = ["CLINICAL", "REGULATORY", "IMPORT_LOGISTICS", "GO_TO_MARKET"];

export type SeedOptions = {
  /** Plain password given to every demo account. */
  password: string;
  /**
   * Where demo PDFs are written. Omit to create the document rows without the
   * files — enough for reviewing the interface, and the only sensible choice
   * for the embedded database, whose storage would vanish with it anyway.
   */
  storage?: StorageDriver | null;
};

/**
 * Creates the demonstration portfolio: four suppliers across four countries,
 * six projects at different stages, plus the tasks, documents, requests,
 * conversations and history that make the screens look like a system in use.
 *
 * Shared by the CLI seed and by the embedded database, so both produce exactly
 * the same dataset.
 */
export async function seedDemoData(db: PrismaClient, options: SeedOptions) {
  const passwordHash = await bcrypt.hash(options.password, 12);
  const storage = options.storage ?? null;

  async function writeFile(organizationId: string, projectId: string, fileName: string, body: Buffer) {
    const key = `${organizationId}/${projectId}/${randomUUID()}-${fileName}`;
    if (storage) await storage.put(key, body, "application/pdf");
    return { key, size: body.byteLength };
  }

  const org = await db.organization.create({
    data: { id: "org-vionex", name: "Vionex", slug: "vionex" },
  });

  const [lucas, stefany, joao, maria] = await Promise.all([
    db.user.create({
      data: {
        id: "usr-admin",
        organizationId: org.id, name: "Lucas Silva", email: "admin@vionex.com", passwordHash,
        role: "ADMIN", jobTitle: "Diretor", department: "Management", language: "PT_BR",
      },
    }),
    db.user.create({
      data: {
        id: "usr-regulatory",
        organizationId: org.id, name: "Stefany Rocha", email: "regulatory@vionex.com", passwordHash,
        role: "REGULATORY", jobTitle: "Especialista Regulatória", department: "Regulatory", language: "PT_BR",
      },
    }),
    db.user.create({
      data: {
        id: "usr-manager",
        organizationId: org.id, name: "João Mendes", email: "manager@vionex.com", passwordHash,
        role: "MANAGER", jobTitle: "Gerente de Importação", department: "Import & Logistics", language: "PT_BR",
      },
    }),
    db.user.create({
      data: {
        id: "usr-marketing",
        organizationId: org.id, name: "Maria Santos", email: "marketing@vionex.com", passwordHash,
        role: "MARKETING", jobTitle: "Coordenadora de Marketing", department: "Marketing", language: "PT_BR",
      },
    }),
    db.user.create({
      data: {
        id: "usr-viewer",
        organizationId: org.id, name: "Paulo Reis", email: "viewer@vionex.com", passwordHash,
        role: "VIEWER", jobTitle: "Analista", department: "Operations", language: "PT_BR",
      },
    }),
  ]);
  const [manufacturerA, manufacturerB, manufacturerC, manufacturerD] = await Promise.all([
    db.supplier.create({
      data: {
        id: "sup-a",
        organizationId: org.id, name: "Manufacturer A", country: "China", status: "AT_RISK",
        website: "https://manufacturer-a.example.com", address: "Building 4, Pudong, Shanghai",
        primaryContact: "John Smith", email: "contact@manufacturer-a.example.com", phone: "+86 21 5555 0100",
      },
    }),
    db.supplier.create({
      data: {
        id: "sup-b",
        organizationId: org.id, name: "Manufacturer B", country: "Germany", status: "ON_TRACK",
        website: "https://manufacturer-b.example.com", address: "Industriestraße 12, Munich",
        primaryContact: "Klaus Weber", email: "contact@manufacturer-b.example.com", phone: "+49 89 5555 0110",
      },
    }),
    db.supplier.create({
      data: {
        id: "sup-c",
        organizationId: org.id, name: "Manufacturer C", country: "United States", status: "ON_TRACK",
        website: "https://manufacturer-c.example.com", address: "220 Harbor Drive, Boston, MA",
        primaryContact: "Emily Carter", email: "contact@manufacturer-c.example.com", phone: "+1 617 555 0120",
      },
    }),
    db.supplier.create({
      data: {
        id: "sup-d",
        organizationId: org.id, name: "Manufacturer D", country: "Italy", status: "ON_TRACK",
        website: "https://manufacturer-d.example.com", address: "Via Roma 45, Milan",
        primaryContact: "Marco Bianchi", email: "contact@manufacturer-d.example.com", phone: "+39 02 5555 0130",
      },
    }),
  ]);
  const [johnSmith] = await Promise.all([
    db.user.create({
      data: {
        id: "usr-supplier",
        organizationId: org.id, supplierId: manufacturerA.id, name: "John Smith",
        email: "supplier@example.com", passwordHash, role: "SUPPLIER_ADMIN",
        jobTitle: "Regulatory Contact", language: "EN",
      },
    }),
    /**
     * A plain portal user, alongside the administrators.
     *
     * Every seeded supplier account was a SUPPLIER_ADMIN, so the difference
     * between the two portal roles — who may manage the company's users —
     * could not be seen without editing the database by hand.
     */
    db.user.create({
      data: {
        id: "usr-supplier-user",
        organizationId: org.id, supplierId: manufacturerA.id, name: "Wei Zhang",
        email: "supplier.user@example.com", passwordHash, role: "SUPPLIER_USER",
        jobTitle: "Documentation Analyst", language: "EN",
      },
    }),
    db.user.create({
      data: {
        id: "usr-klaus",
        organizationId: org.id, supplierId: manufacturerB.id, name: "Klaus Weber",
        email: "klaus@example.com", passwordHash, role: "SUPPLIER_ADMIN",
        jobTitle: "Quality Manager", language: "EN",
      },
    }),
    db.user.create({
      data: {
        id: "usr-emily",
        organizationId: org.id, supplierId: manufacturerC.id, name: "Emily Carter",
        email: "emily@example.com", passwordHash, role: "SUPPLIER_ADMIN",
        jobTitle: "Program Manager", language: "EN",
      },
    }),
  ]);
  const suppliersByKey = {
    A: manufacturerA.id,
    B: manufacturerB.id,
    C: manufacturerC.id,
    D: manufacturerD.id,
  };
  const ownersByKey = {
    lucas: lucas.id,
    stefany: stefany.id,
    joao: joao.id,
    maria: maria.id,
  };
  const authorsByKey = { ...ownersByKey, johnSmith: johnSmith.id };

  const projectBlueprints = PROJECT_BLUEPRINTS.map(({ supplierKey, ownerKey, ...rest }) => ({
    ...rest,
    supplierId: suppliersByKey[supplierKey],
    ownerId: ownersByKey[ownerKey],
  }));

  const projects: Record<string, string> = {};

  for (const blueprint of projectBlueprints) {
    const { progress, ...data } = blueprint;
    const project = await db.project.create({
      data: {
        ...data,
        // Stable id: project URLs must survive the embedded database being
        // rebuilt on the next instance, or a shared link breaks.
        id: `prj-${data.projectCode.toLowerCase()}`,
        organizationId: org.id,
        stages: {
          create: STAGE_ORDER.map((key, index) => ({
            key,
            name: STAGE_NAMES[key],
            position: index,
            progress: progress[key],
            status:
              progress[key] >= 100
                ? ("COMPLETED" as const)
                : progress[key] > 0
                  ? ("IN_PROGRESS" as const)
                  : ("NOT_STARTED" as const),
          })),
        },
      },
    });
    projects[blueprint.projectCode] = project.id;
  }

  const alpha = projects["VX-001"];
  const beta = projects["VX-002"];
  const gamma = projects["VX-003"];
  const epsilon = projects["VX-005"];
  const zeta = projects["VX-006"];
  const tasks = await seedStageDetails(db, {
    organizationId: org.id,
    projects,
    users: { lucas: lucas.id, stefany: stefany.id, joao: joao.id, maria: maria.id },
    suppliers: { A: manufacturerA.id, B: manufacturerB.id, C: manufacturerC.id },
  });
  const documentBlueprints = DOCUMENT_BLUEPRINTS.map(
    ({ projectKey, authorKey, supplierKey, ...rest }) => ({
      ...rest,
      projectId: projects[projectKey],
      createdById: authorsByKey[authorKey],
      supplierId: supplierKey ? suppliersByKey[supplierKey] : null,
    }),
  );

  const documentIds: Record<string, string> = {};

  for (const blueprint of documentBlueprints) {
    const document = await db.document.create({
      data: {
        organizationId: org.id,
        projectId: blueprint.projectId,
        supplierId: blueprint.supplierId,
        createdById: blueprint.createdById,
        name: blueprint.name,
        type: blueprint.type,
        status: blueprint.status,
        visibility: blueprint.shared ? "SHARED_WITH_SUPPLIER" : "INTERNAL_ONLY",
      },
    });
    documentIds[blueprint.name] = document.id;

    let latestVersionId = "";
    for (const [index, fileName] of blueprint.versions.entries()) {
      const pdf = buildPdf(blueprint.name, [
        `Documento de demonstração — ${blueprint.name}`,
        `Versão ${index + 1}`,
        "Vionex Projects · dados de demonstração",
      ]);
      const stored = await writeFile(org.id, blueprint.projectId, fileName, pdf);
      const version = await db.documentVersion.create({
        data: {
          documentId: document.id,
          uploadedById: blueprint.createdById,
          version: index + 1,
          storageKey: stored.key,
          fileName,
          fileSize: stored.size,
          mimeType: "application/pdf",
        },
      });
      latestVersionId = version.id;
    }
    await db.document.update({
      where: { id: document.id },
      data: { currentVersionId: latestVersionId },
    });
  }
  const coaRequest = await db.documentRequest.create({
    data: {
      projectId: alpha, supplierId: manufacturerA.id, requestedById: stefany.id, taskId: tasks[0].id,
      title: "Certificate of Analysis", type: "CERTIFICATE", status: "PENDING", dueDate: daysFromNow(10),
      description: "Please provide the latest Certificate of Analysis for the commercial batch of Product Alpha.",
    },
  });
  await db.documentRequest.create({
    data: {
      projectId: alpha, supplierId: manufacturerA.id, requestedById: stefany.id, taskId: tasks[1].id,
      documentId: documentIds["IFU"], title: "Instructions for Use (IFU)", type: "IFU",
      status: "PENDING", dueDate: daysFromNow(13),
      description: "We need the updated IFU in English and Portuguese for the ANVISA submission.",
    },
  });
  await db.documentRequest.create({
    data: {
      projectId: zeta, supplierId: manufacturerA.id, requestedById: stefany.id,
      title: "Clinical data package", type: "CLINICAL", status: "SUBMITTED",
      dueDate: daysFromNow(-2), submittedAt: daysFromNow(-3),
      description: "Clinical data supporting the evaluation of Product Zeta.",
    },
  });
  await db.documentRequest.create({
    data: {
      projectId: gamma, supplierId: manufacturerC.id, requestedById: joao.id,
      documentId: documentIds["Commercial Invoice"], title: "Commercial Invoice", type: "IMPORT",
      status: "APPROVED", dueDate: daysFromNow(-20), submittedAt: daysFromNow(-22), reviewedAt: daysFromNow(-19),
    },
  });
  await db.documentRequestReply.create({
    data: { requestId: coaRequest.id, authorId: stefany.id, body: "Priorizamos este documento para a submissão de setembro." },
  });
  const alphaThread = await db.messageThread.create({
    data: { projectId: alpha, subject: "Product Alpha", withSupplier: true },
  });
  await db.message.create({ data: { threadId: alphaThread.id, senderId: stefany.id, body: "Hi John, could you send the latest Certificate of Analysis for Product Alpha?" } });
  await db.message.create({ data: { threadId: alphaThread.id, senderId: johnSmith.id, body: "Sure, Stefany. We will upload it today together with the updated IFU." } });
  await db.message.create({ data: { threadId: alphaThread.id, senderId: stefany.id, body: "Perfect, thank you. The ANVISA submission window closes on the 18th." } });

  const gammaThread = await db.messageThread.create({
    data: { projectId: gamma, subject: "Product Gamma", withSupplier: true },
  });
  await db.message.create({ data: { threadId: gammaThread.id, senderId: joao.id, body: "Hello Emily, the shipment left Boston on schedule. Could you confirm the ETA?" } });

  const betaThread = await db.messageThread.create({
    data: { projectId: beta, subject: "Product Beta", withSupplier: true },
  });
  await db.message.create({ data: { threadId: betaThread.id, senderId: lucas.id, body: "Klaus, we are waiting on the ethics committee before moving forward." } });
  await db.timelineEvent.createMany({
    data: [
      { projectId: alpha, actorId: lucas.id, type: "PROJECT_CREATED", description: "Projeto Product Alpha criado.", createdAt: date(2026, 2, 10) },
      { projectId: alpha, actorId: stefany.id, type: "STATUS_CHANGED", description: "Status do projeto alterado para at risk.", createdAt: daysFromNow(-8), metadata: { from: "ON_TRACK", to: "AT_RISK" } },
      { projectId: alpha, actorId: johnSmith.id, type: "DOCUMENT_UPLOADED", description: "IFU (v2) enviado.", createdAt: daysFromNow(-4) },
      { projectId: alpha, actorId: stefany.id, type: "DOCUMENT_REQUESTED", description: "Certificate of Analysis solicitado ao fornecedor.", createdAt: daysFromNow(-1) },
      { projectId: alpha, actorId: stefany.id, type: "MESSAGE_SENT", description: "Nova mensagem em Product Alpha.", createdAt: daysFromNow(-1) },
      { projectId: beta, actorId: lucas.id, type: "PROJECT_CREATED", description: "Projeto Product Beta criado.", createdAt: date(2026, 4, 5) },
      { projectId: beta, actorId: lucas.id, type: "STATUS_CHANGED", description: "Status do projeto alterado para blocked.", createdAt: daysFromNow(-5), metadata: { from: "AT_RISK", to: "BLOCKED" } },
      { projectId: gamma, actorId: joao.id, type: "TASK_COMPLETED", description: 'Tarefa "Packing list" concluída.', createdAt: daysFromNow(-13) },
      { projectId: gamma, actorId: joao.id, type: "DOCUMENT_UPLOADED", description: "Commercial Invoice (v1) enviado.", createdAt: daysFromNow(-22) },
      { projectId: epsilon, actorId: maria.id, type: "STAGE_UPDATED", description: "Etapa Go-to-Market atualizada.", createdAt: daysFromNow(-2) },
    ],
  });

  await db.notification.createMany({
    data: [
      { userId: stefany.id, type: "TASK_OVERDUE", title: "Clinical data package", description: "Tarefa vencida em Product Zeta.", href: `/tasks/${tasks[8].id}` },
      { userId: stefany.id, type: "SUPPLIER_REPLIED", title: "Clinical data package", description: "Manufacturer A respondeu à solicitação.", href: `/projects/${zeta}/regulatory` },
      { userId: stefany.id, type: "MESSAGE_RECEIVED", title: "Product Alpha", description: "John Smith: Sure, Stefany. We will upload it today…", href: `/projects/${alpha}/messages` },
      { userId: lucas.id, type: "PROJECT_UPDATED", title: "Product Beta", description: "Projeto bloqueado: protocolo clínico pendente.", href: `/projects/${beta}` },
      { userId: joao.id, type: "TASK_DUE_SOON", title: "Shipment preparation", description: "Vence em 6 dias.", href: `/tasks/${tasks[5].id}` },
      { userId: johnSmith.id, type: "DOCUMENT_REQUESTED", title: "Certificate of Analysis", description: "New request for Product Alpha.", href: `/supplier/action-required/${coaRequest.id}` },
    ],
  });

  await db.auditLog.createMany({
    data: [
      { organizationId: org.id, actorId: lucas.id, action: "project.create", entity: "Project", entityId: alpha, metadata: { projectCode: "VX-001" } },
      { organizationId: org.id, actorId: stefany.id, action: "document.request", entity: "DocumentRequest", entityId: coaRequest.id },
      { organizationId: org.id, actorId: johnSmith.id, action: "document.upload", entity: "Document", entityId: documentIds["IFU"] },
    ],
  });

  return org;
}
