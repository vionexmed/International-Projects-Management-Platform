import type { PrismaClient } from "../src/generated/prisma";
import { date, daysFromNow } from "./seed-helpers";

type Ids = {
  organizationId: string;
  projects: Record<string, string>;
  users: { lucas: string; stefany: string; joao: string; maria: string };
  suppliers: { A: string; B: string; C: string };
};

/**
 * Milestones, clinical studies, regulatory items, shipments, Go-to-Market
 * items and tasks for the demonstration portfolio. Split out of the seed
 * script so each file stays readable.
 */
export async function seedStageDetails(db: PrismaClient, ids: Ids) {
  const { organizationId: orgId } = ids;
  const { lucas, stefany, joao, maria } = ids.users;
  const alpha = ids.projects["VX-001"];
  const beta = ids.projects["VX-002"];
  const gamma = ids.projects["VX-003"];
  const epsilon = ids.projects["VX-005"];
  const zeta = ids.projects["VX-006"];
  const manufacturerA = { id: ids.suppliers.A };
  const manufacturerB = { id: ids.suppliers.B };
  const manufacturerC = { id: ids.suppliers.C };

  await db.milestone.createMany({
    data: [
      { projectId: alpha, title: "ANVISA submission", stage: "REGULATORY", dueDate: daysFromNow(16), status: "IN_PROGRESS", position: 0 },
      { projectId: alpha, title: "ANVISA approval", stage: "REGULATORY", dueDate: date(2026, 10, 20), status: "PLANNED", position: 1 },
      { projectId: alpha, title: "Product launch", stage: "GO_TO_MARKET", dueDate: date(2026, 11, 14), status: "PLANNED", position: 2 },
      { projectId: beta, title: "Protocol approval", stage: "CLINICAL", dueDate: daysFromNow(13), status: "DELAYED", position: 0 },
      { projectId: beta, title: "First patient enrolled", stage: "CLINICAL", dueDate: date(2026, 11, 5), status: "PLANNED", position: 1 },
      { projectId: gamma, title: "Shipment arrival", stage: "IMPORT_LOGISTICS", dueDate: daysFromNow(33), status: "IN_PROGRESS", position: 0 },
      { projectId: gamma, title: "Customs clearance", stage: "IMPORT_LOGISTICS", dueDate: date(2026, 10, 22), status: "PLANNED", position: 1 },
      { projectId: epsilon, title: "Launch event", stage: "GO_TO_MARKET", dueDate: date(2026, 10, 1), status: "IN_PROGRESS", position: 0 },
      { projectId: zeta, title: "Study kick-off", stage: "CLINICAL", dueDate: date(2026, 10, 8), status: "PLANNED", position: 0 },
    ],
  });

  await db.clinicalStudy.createMany({
    data: [
      {
        projectId: alpha, institution: "Hospital São Lucas", country: "Brasil",
        protocol: "PRT-ALPHA-2026-01", studyType: "Estudo observacional prospectivo",
        status: "COMPLETED", startDate: date(2026, 3, 1), expectedCompletion: date(2026, 7, 30),
        notes: "Relatório final recebido e incorporado ao dossiê regulatório.",
      },
      {
        projectId: beta, institution: "Instituto de Cardiologia", country: "Brasil",
        protocol: "PRT-BETA-2026-04", studyType: "Ensaio clínico multicêntrico",
        status: "IN_PROGRESS", startDate: date(2026, 6, 1), expectedCompletion: date(2027, 2, 28),
        notes: "Submissão ao comitê de ética em andamento.",
      },
      {
        projectId: zeta, institution: "Centro de Pesquisa Vionex", country: "Brasil",
        protocol: "PRT-ZETA-2026-09", studyType: "Avaliação clínica documental",
        status: "PLANNED", startDate: date(2026, 10, 1), expectedCompletion: date(2027, 4, 30),
      },
    ],
  });

  await db.regulatoryItem.createMany({
    data: [
      { projectId: alpha, title: "Certificate of Analysis", authority: "ANVISA", requestedFrom: "Manufacturer A", ownerName: "Stefany Rocha", status: "REQUESTED", dueDate: daysFromNow(10) },
      { projectId: alpha, title: "Instructions for Use (IFU)", authority: "ANVISA", requestedFrom: "Manufacturer A", ownerName: "Stefany Rocha", status: "REQUESTED", dueDate: daysFromNow(13) },
      { projectId: alpha, title: "Clinical Evaluation Report", authority: "ANVISA", requestedFrom: "Vionex", ownerName: "Stefany Rocha", status: "APPROVED" },
      { projectId: alpha, title: "Risk Management File", authority: "ANVISA", requestedFrom: "Vionex", ownerName: "Stefany Rocha", status: "IN_REVIEW", dueDate: daysFromNow(20) },
      { projectId: alpha, title: "ISO 13485 Certificate", authority: "ANVISA", requestedFrom: "Manufacturer A", ownerName: "Stefany Rocha", status: "RECEIVED" },
      { projectId: beta, title: "Clinical protocol", authority: "CONEP", requestedFrom: "Vionex", ownerName: "Lucas Silva", status: "PENDING", dueDate: daysFromNow(13) },
      { projectId: gamma, title: "Import licence", authority: "ANVISA", requestedFrom: "Vionex", ownerName: "João Mendes", status: "APPROVED" },
    ],
  });

  await db.importShipment.createMany({
    data: [
      {
        projectId: gamma, reference: "SHP-GAMMA-01", stage: "IN_TRANSIT", shippingMethod: "Sea freight",
        carrier: "Maersk", trackingNumber: "MSKU4471820", portOfOrigin: "Boston, US",
        portOfArrival: "Santos, BR", etd: date(2026, 8, 18), eta: daysFromNow(33),
        productionNote: "Produção concluída em julho.", documentsNote: "Invoice e packing list recebidos.",
      },
      {
        projectId: alpha, reference: "SHP-ALPHA-01", stage: "PRODUCTION", shippingMethod: "Air freight",
        carrier: "DHL", portOfOrigin: "Shanghai, CN", portOfArrival: "Guarulhos, BR",
        etd: date(2026, 10, 5), eta: date(2026, 10, 12),
        productionNote: "Aguardando liberação regulatória para iniciar produção do lote comercial.",
      },
    ],
  });

  const gtmCategories = [
    ["MARKET_ANALYSIS", "Análise de mercado e concorrência", "COMPLETED"],
    ["COMMERCIAL_STRATEGY", "Definição da estratégia comercial", "COMPLETED"],
    ["PRICING", "Estrutura de preços e margens", "IN_PROGRESS"],
    ["SALES_CHANNELS", "Mapeamento de distribuidores", "IN_PROGRESS"],
    ["KOLS", "Engajamento de KOLs", "NOT_STARTED"],
    ["MARKETING", "Materiais de marketing", "NOT_STARTED"],
    ["TRAINING", "Treinamento da força de vendas", "NOT_STARTED"],
    ["LAUNCH_PLAN", "Plano de lançamento", "NOT_STARTED"],
  ] as const;

  await db.gtmItem.createMany({
    data: [alpha, epsilon].flatMap((projectId) =>
      gtmCategories.map(([category, title, status], index) => ({
        projectId,
        category,
        title,
        status: projectId === epsilon && index < 5 ? ("COMPLETED" as const) : status,
        owner: "Maria Santos",
        position: index,
      })),
    ),
  });

  const tasks = await Promise.all([
    db.task.create({
      data: {
        organizationId: orgId, projectId: alpha, createdById: stefany, assignedToId: stefany,
        supplierId: manufacturerA.id, title: "Certificate of Analysis", category: "REGULATORY",
        priority: "HIGH", status: "WAITING", dueDate: daysFromNow(10),
        description: "Solicitar ao Manufacturer A o COA atualizado do lote comercial.",
      },
    }),
    db.task.create({
      data: {
        organizationId: orgId, projectId: alpha, createdById: stefany, assignedToId: stefany,
        supplierId: manufacturerA.id, title: "Instructions for Use (IFU)", category: "REGULATORY",
        priority: "HIGH", status: "WAITING", dueDate: daysFromNow(13),
        description: "IFU em português e inglês para submissão à ANVISA.",
      },
    }),
    db.task.create({
      data: {
        organizationId: orgId, projectId: alpha, createdById: stefany, assignedToId: stefany,
        title: "Compilar dossiê técnico", category: "REGULATORY", priority: "MEDIUM",
        status: "IN_PROGRESS", dueDate: daysFromNow(20),
      },
    }),
    db.task.create({
      data: {
        organizationId: orgId, projectId: beta, createdById: lucas, assignedToId: lucas,
        title: "Clinical protocol", category: "CLINICAL", priority: "URGENT", status: "WAITING",
        dueDate: daysFromNow(-4), description: "Protocolo aguardando parecer do comitê de ética.",
      },
    }),
    db.task.create({
      data: {
        organizationId: orgId, projectId: beta, createdById: lucas, assignedToId: stefany,
        supplierId: manufacturerB.id, title: "Technical file update", category: "REGULATORY",
        priority: "MEDIUM", status: "OPEN", dueDate: daysFromNow(25),
      },
    }),
    db.task.create({
      data: {
        organizationId: orgId, projectId: gamma, createdById: joao, assignedToId: joao,
        title: "Shipment preparation", category: "IMPORT", priority: "HIGH", status: "IN_PROGRESS",
        dueDate: daysFromNow(6), description: "Conferir documentação de embarque e seguro de carga.",
      },
    }),
    db.task.create({
      data: {
        organizationId: orgId, projectId: gamma, createdById: joao, assignedToId: joao,
        supplierId: manufacturerC.id, title: "Packing list", category: "IMPORT", priority: "MEDIUM",
        status: "COMPLETED", dueDate: daysFromNow(-12), completedAt: daysFromNow(-13),
      },
    }),
    db.task.create({
      data: {
        organizationId: orgId, projectId: epsilon, createdById: maria, assignedToId: maria,
        title: "Plano de lançamento", category: "GO_TO_MARKET", priority: "MEDIUM",
        status: "IN_PROGRESS", dueDate: daysFromNow(18),
      },
    }),
    db.task.create({
      data: {
        organizationId: orgId, projectId: zeta, createdById: stefany, assignedToId: stefany,
        supplierId: manufacturerA.id, title: "Clinical data package", category: "CLINICAL",
        priority: "HIGH", status: "WAITING", dueDate: daysFromNow(-2),
      },
    }),
  ]);

  await db.taskComment.createMany({
    data: [
      { taskId: tasks[0].id, authorId: stefany, body: "Solicitação enviada ao fornecedor em 01/09. Aguardando retorno.", internal: true },
      { taskId: tasks[3].id, authorId: lucas, body: "Comitê informou que o parecer sai na próxima reunião.", internal: true },
      { taskId: tasks[5].id, authorId: joao, body: "Seguro de carga contratado. Falta apenas o BL.", internal: true },
    ],
  });

  return tasks;
}
