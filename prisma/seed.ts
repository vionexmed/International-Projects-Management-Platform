import "dotenv/config";
import bcrypt from "bcryptjs";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import type { StageKey } from "../src/generated/prisma";
import { buildPdf, createSeedClient, date, daysFromNow } from "./seed-helpers";
import { DOCUMENT_BLUEPRINTS, PROJECT_BLUEPRINTS } from "./seed-projects";
import { seedStageDetails } from "./seed-stages";

const db = createSeedClient();

const DEMO_PASSWORD = "vionex123";
const STORAGE_ROOT = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./storage");

const STAGE_NAMES: Record<StageKey, string> = {
  CLINICAL: "Clinical",
  REGULATORY: "Regulatory",
  IMPORT_LOGISTICS: "Import & Logistics",
  GO_TO_MARKET: "Go-to-Market",
};
const STAGE_ORDER: StageKey[] = ["CLINICAL", "REGULATORY", "IMPORT_LOGISTICS", "GO_TO_MARKET"];

/** Writes a demo file through the same key layout the app uses. */
async function storeFile(organizationId: string, projectId: string, fileName: string, body: Buffer) {
  const key = `${organizationId}/${projectId}/${randomUUID()}-${fileName}`;
  const target = path.join(STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body);
  await fs.writeFile(`${target}.meta`, JSON.stringify({ contentType: "application/pdf" }), "utf8");
  return { key, size: body.byteLength };
}

async function reset() {
  // Ordered so foreign keys never block the truncate.
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "MessageRead", "Message", "MessageThread",
      "DocumentRequestReply", "DocumentRequest",
      "DocumentVersion", "Document",
      "TaskComment", "Task",
      "GtmItem", "ImportShipment", "RegulatoryItem", "ClinicalStudy",
      "Milestone", "ProjectStage", "TimelineEvent", "Project",
      "Notification", "AuditLog", "User", "Supplier", "Organization"
    RESTART IDENTITY CASCADE;
  `);
  await fs.rm(STORAGE_ROOT, { recursive: true, force: true });
}

async function main() {
  console.log("→ Limpando dados existentes…");
  await reset();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const org = await db.organization.create({
    data: { name: "Vionex", slug: "vionex" },
  });

  console.log("→ Criando equipe interna…");
  const [lucas, stefany, joao, maria] = await Promise.all([
    db.user.create({
      data: {
        organizationId: org.id, name: "Lucas Silva", email: "admin@vionex.com", passwordHash,
        role: "ADMIN", jobTitle: "Diretor", department: "Management", language: "PT_BR",
      },
    }),
    db.user.create({
      data: {
        organizationId: org.id, name: "Stefany Rocha", email: "regulatory@vionex.com", passwordHash,
        role: "REGULATORY", jobTitle: "Especialista Regulatória", department: "Regulatory", language: "PT_BR",
      },
    }),
    db.user.create({
      data: {
        organizationId: org.id, name: "João Mendes", email: "manager@vionex.com", passwordHash,
        role: "MANAGER", jobTitle: "Gerente de Importação", department: "Import & Logistics", language: "PT_BR",
      },
    }),
    db.user.create({
      data: {
        organizationId: org.id, name: "Maria Santos", email: "marketing@vionex.com", passwordHash,
        role: "MARKETING", jobTitle: "Coordenadora de Marketing", department: "Marketing", language: "PT_BR",
      },
    }),
    db.user.create({
      data: {
        organizationId: org.id, name: "Paulo Reis", email: "viewer@vionex.com", passwordHash,
        role: "VIEWER", jobTitle: "Analista", department: "Operations", language: "PT_BR",
      },
    }),
  ]);

  console.log("→ Criando fornecedores…");
  const [manufacturerA, manufacturerB, manufacturerC, manufacturerD] = await Promise.all([
    db.supplier.create({
      data: {
        organizationId: org.id, name: "Manufacturer A", country: "China", status: "AT_RISK",
        website: "https://manufacturer-a.example.com", address: "Building 4, Pudong, Shanghai",
        primaryContact: "John Smith", email: "contact@manufacturer-a.example.com", phone: "+86 21 5555 0100",
      },
    }),
    db.supplier.create({
      data: {
        organizationId: org.id, name: "Manufacturer B", country: "Germany", status: "ON_TRACK",
        website: "https://manufacturer-b.example.com", address: "Industriestraße 12, Munich",
        primaryContact: "Klaus Weber", email: "contact@manufacturer-b.example.com", phone: "+49 89 5555 0110",
      },
    }),
    db.supplier.create({
      data: {
        organizationId: org.id, name: "Manufacturer C", country: "United States", status: "ON_TRACK",
        website: "https://manufacturer-c.example.com", address: "220 Harbor Drive, Boston, MA",
        primaryContact: "Emily Carter", email: "contact@manufacturer-c.example.com", phone: "+1 617 555 0120",
      },
    }),
    db.supplier.create({
      data: {
        organizationId: org.id, name: "Manufacturer D", country: "Italy", status: "ON_TRACK",
        website: "https://manufacturer-d.example.com", address: "Via Roma 45, Milan",
        primaryContact: "Marco Bianchi", email: "contact@manufacturer-d.example.com", phone: "+39 02 5555 0130",
      },
    }),
  ]);

  console.log("→ Criando usuários dos fornecedores…");
  const [johnSmith, liWei] = await Promise.all([
    db.user.create({
      data: {
        organizationId: org.id, supplierId: manufacturerA.id, name: "John Smith",
        email: "supplier@example.com", passwordHash, role: "SUPPLIER_ADMIN",
        jobTitle: "Regulatory Contact", language: "EN",
      },
    }),
    db.user.create({
      data: {
        organizationId: org.id, supplierId: manufacturerA.id, name: "Li Wei",
        email: "liwei@example.com", passwordHash, role: "SUPPLIER_USER",
        jobTitle: "Export Manager", language: "ZH",
      },
    }),
    db.user.create({
      data: {
        organizationId: org.id, supplierId: manufacturerB.id, name: "Klaus Weber",
        email: "klaus@example.com", passwordHash, role: "SUPPLIER_ADMIN",
        jobTitle: "Quality Manager", language: "EN",
      },
    }),
    db.user.create({
      data: {
        organizationId: org.id, supplierId: manufacturerC.id, name: "Emily Carter",
        email: "emily@example.com", passwordHash, role: "SUPPLIER_ADMIN",
        jobTitle: "Program Manager", language: "EN",
      },
    }),
  ]);

  console.log("→ Criando projetos…");
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

  console.log("→ Criando marcos, etapas detalhadas e tarefas…");
  const tasks = await seedStageDetails(db, {
    organizationId: org.id,
    projects,
    users: { lucas: lucas.id, stefany: stefany.id, joao: joao.id, maria: maria.id },
    suppliers: { A: manufacturerA.id, B: manufacturerB.id, C: manufacturerC.id },
  });

  console.log("→ Criando documentos e versões…");
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
      const stored = await storeFile(org.id, blueprint.projectId, fileName, pdf);
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

  console.log("→ Criando solicitações de documentos…");
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

  console.log("→ Criando conversas…");
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

  console.log("→ Criando histórico e notificações…");
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
      { userId: liWei.id, type: "DOCUMENT_REQUESTED", title: "Certificate of Analysis", description: "New request for Product Alpha.", href: `/supplier/action-required/${coaRequest.id}` },
    ],
  });

  await db.auditLog.createMany({
    data: [
      { organizationId: org.id, actorId: lucas.id, action: "project.create", entity: "Project", entityId: alpha, metadata: { projectCode: "VX-001" } },
      { organizationId: org.id, actorId: stefany.id, action: "document.request", entity: "DocumentRequest", entityId: coaRequest.id },
      { organizationId: org.id, actorId: johnSmith.id, action: "document.upload", entity: "Document", entityId: documentIds["IFU"] },
    ],
  });

  const counts = await Promise.all([
    db.project.count(), db.task.count(), db.document.count(),
    db.documentRequest.count(), db.user.count(), db.supplier.count(),
  ]);

  console.log(`
✓ Seed concluído.
  Organização ......... ${org.name}
  Fornecedores ........ ${counts[5]}
  Usuários ............ ${counts[4]}
  Projetos ............ ${counts[0]}
  Tarefas ............. ${counts[1]}
  Documentos .......... ${counts[2]}
  Solicitações ........ ${counts[3]}

  Credenciais de demonstração (senha: ${DEMO_PASSWORD})
    admin@vionex.com ........ ADMIN       · Lucas Silva
    manager@vionex.com ...... MANAGER     · João Mendes
    regulatory@vionex.com ... REGULATORY  · Stefany Rocha
    marketing@vionex.com .... MARKETING   · Maria Santos
    viewer@vionex.com ....... VIEWER      · Paulo Reis
    supplier@example.com .... SUPPLIER    · John Smith (Manufacturer A)
    klaus@example.com ....... SUPPLIER    · Klaus Weber (Manufacturer B)
`);
}

main()
  .catch((error) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
