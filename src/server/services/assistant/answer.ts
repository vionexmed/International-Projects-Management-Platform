import "server-only";
import { understand, type Understanding } from "@/lib/assistant/understand";
import type { AssistantReply, ReplyItem, ReplyProject, ReplyTone } from "@/lib/assistant/reply";
import { getDictionary } from "@/lib/i18n/dictionary";
import { label, meta } from "@/lib/labels";
import { daysUntil, formatDateShort } from "@/lib/format";
import type { ProjectStatus } from "@/server/services/projects";
import type { SessionUser } from "@/types/auth";
import {
  dueWithin,
  findActivity,
  findBlockers,
  findMilestones,
  findRequests,
  findTasks,
  loadCatalog,
  overdueWhere,
  type AssistantCatalog,
  type CatalogProject,
} from "@/server/services/assistant/data";

/**
 * Turns a question into an answer from the platform's own records. Every
 * reply is a sentence, the rows behind it (each a link to where it is dealt
 * with) and the natural next questions.
 */

const dict = getDictionary("pt-BR");
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function when(date: Date | null) {
  const days = daysUntil(date);
  if (days === null || !date) return "sem prazo";
  if (days < 0) return `${plural(-days, "dia", "dias")} de atraso`;
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias · ${formatDateShort(date, "pt-BR")}`;
}

const lateTone = (date: Date | null): ReplyTone => ((daysUntil(date) ?? 0) < 0 ? "risk" : "neutral");

const GENERAL_SUGGESTIONS = [
  "O que precisa da minha atenção?",
  "Quais tarefas estão atrasadas?",
  "Quais documentos estão pendentes?",
  "O que vence esta semana?",
];

function projectSuggestions(name: string) {
  return [`O que falta no ${name}?`, `Documentos pendentes do ${name}`, `O que aconteceu no ${name}?`, `Próximos marcos do ${name}`];
}

/* ------------------------------------------------------------ project -- */

function stageTone(status: string, current: boolean): ReplyTone {
  if (status === "COMPLETED") return "ok";
  if (status === "BLOCKED") return "risk";
  return current ? "info" : "neutral";
}

async function projectCard(user: SessionUser, project: CatalogProject): Promise<{ card: ReplyProject; overdue: number; owed: number }> {
  const [overdue, open, owed] = await Promise.all([
    findTasks(user, { AND: [{ projectId: project.id }, overdueWhere()] }, 50),
    findTasks(user, { projectId: project.id }, 200),
    findRequests(user, ["PENDING", "REJECTED"], { projectId: project.id }, 50),
  ]);
  const status = meta.project(project.status as ProjectStatus, dict);
  const card: ReplyProject = {
    name: project.name,
    href: `/projects/${project.id}`,
    subtitle: `${project.projectCode} · ${project.supplier.name} · ${project.supplier.country}`,
    progress: project.progress,
    status: { label: status.label, tone: status.tone },
    stages: project.stages.map((stage) => ({
      name: label.stageKey(stage.key, dict),
      fill: stage.status === "COMPLETED" ? 100 : stage.progress,
      tone: stageTone(stage.status, stage.key === project.currentStage),
      current: stage.key === project.currentStage,
    })),
    facts: [
      { label: "Etapa atual", value: label.stageKey(project.currentStage, dict) },
      {
        label: "Tarefas em aberto",
        value: overdue.length > 0 ? `${open.length} · ${overdue.length} atrasada${overdue.length === 1 ? "" : "s"}` : String(open.length),
        tone: overdue.length > 0 ? "risk" : undefined,
      },
      { label: "Documentos pendentes", value: String(owed.length), tone: owed.length > 0 ? "warn" : undefined },
      {
        label: "Próximo marco",
        value: project.nextMilestone ? `${project.nextMilestone.title} · ${project.nextMilestone.dueDate ? formatDateShort(project.nextMilestone.dueDate, "pt-BR") : "sem data"}` : "Nenhum",
      },
      { label: "Lançamento", value: project.targetLaunchDate ? when(project.targetLaunchDate) : "Sem data" },
      { label: "Responsável", value: project.owner.name },
    ],
  };
  return { card, overdue: overdue.length, owed: owed.length };
}

async function projectStatus(user: SessionUser, project: CatalogProject): Promise<AssistantReply> {
  const { card, overdue, owed } = await projectCard(user, project);
  const stage = label.stageKey(project.currentStage, dict);
  const issues = [
    overdue > 0 ? plural(overdue, "tarefa atrasada", "tarefas atrasadas") : null,
    owed > 0 ? plural(owed, "documento pendente", "documentos pendentes") : null,
  ].filter(Boolean);
  return {
    text:
      `O ${project.name} está ${card.status.label.toLowerCase()}, na etapa ${stage}, com ${project.progress}% concluído.` +
      (issues.length ? ` Pontos de atenção: ${issues.join(" e ")}.` : " Nada atrasado no momento."),
    project: card,
    suggestions: projectSuggestions(project.name),
  };
}

async function projectNeeds(user: SessionUser, project: CatalogProject): Promise<AssistantReply> {
  const [overdue, soon, owed, review, blockers] = await Promise.all([
    findTasks(user, { AND: [{ projectId: project.id }, overdueWhere()] }, 8),
    findTasks(user, { AND: [{ projectId: project.id }, dueWithin(14)] }, 6),
    findRequests(user, ["PENDING", "REJECTED"], { projectId: project.id }, 8),
    findRequests(user, ["SUBMITTED", "IN_REVIEW"], { projectId: project.id }, 8),
    findBlockers(user),
  ]);
  const blocker = blockers.find((item) => item.id === project.id)?.blockerNote;
  const items: ReplyItem[] = [
    ...(blocker ? [{ title: "Bloqueio registrado", detail: blocker, tone: "risk" as const, href: `/projects/${project.id}` }] : []),
    ...overdue.map((task) => ({ title: task.title, detail: `Atrasada · ${task.assignedTo?.name ?? "sem responsável"}`, trailing: when(task.dueDate), tone: "risk" as const, href: `/tasks/${task.id}` })),
    ...owed.map((request) => ({ title: request.title, detail: `Documento aguardando ${request.supplier.name}`, trailing: when(request.dueDate), tone: "warn" as const, href: request.taskId ? `/tasks/${request.taskId}` : `/projects/${project.id}` })),
    ...review.map((request) => ({ title: request.title, detail: "Enviado — falta a análise da Vionex", tone: "info" as const, href: request.taskId ? `/tasks/${request.taskId}` : `/projects/${project.id}` })),
    ...soon
      .filter((task) => !overdue.some((late) => late.id === task.id))
      .map((task) => ({ title: task.title, detail: `Vence em breve · ${task.assignedTo?.name ?? "sem responsável"}`, trailing: when(task.dueDate), href: `/tasks/${task.id}` })),
  ];
  const text = items.length
    ? `Para o ${project.name} avançar: ${[
        blocker ? "resolver o bloqueio" : null,
        overdue.length ? plural(overdue.length, "tarefa atrasada", "tarefas atrasadas") : null,
        owed.length ? plural(owed.length, "documento a receber", "documentos a receber") : null,
        review.length ? plural(review.length, "documento para analisar", "documentos para analisar") : null,
      ]
        .filter(Boolean)
        .join(", ") || "acompanhar os próximos prazos"}.`
    : `O ${project.name} não tem nada pendente agora: nenhum atraso, documento em falta ou análise parada.`;
  return { text, items, more: { label: "Abrir o plano", href: `/projects/${project.id}/tasks` }, suggestions: projectSuggestions(project.name) };
}

/* ------------------------------------------------------------ company -- */

async function supplierStatus(user: SessionUser, catalog: AssistantCatalog, supplierId: string): Promise<AssistantReply> {
  const supplier = catalog.suppliers.find((item) => item.id === supplierId)!;
  const projects = catalog.projects.filter((project) => project.supplier.id === supplierId);
  const [owed, overdue] = await Promise.all([
    findRequests(user, ["PENDING", "REJECTED"], { supplierId }, 20),
    findTasks(user, { AND: [{ project: { supplierId } }, overdueWhere()] }, 20),
  ]);
  return {
    text:
      `A ${supplier.name} (${supplier.country}) tem ${plural(projects.length, "projeto ativo", "projetos ativos")}` +
      (owed.length ? `, deve ${plural(owed.length, "documento", "documentos")}` : ", está em dia com os documentos") +
      (overdue.length ? ` e há ${plural(overdue.length, "tarefa atrasada", "tarefas atrasadas")} nos projetos dela.` : "."),
    items: projects.map((project) => ({
      title: project.name,
      detail: `${project.projectCode} · ${label.stageKey(project.currentStage, dict)}`,
      trailing: `${project.progress}%`,
      href: `/projects/${project.id}`,
    })),
    more: { label: "Abrir a pasta da empresa", href: `/regulatory?supplier=${supplierId}` },
    suggestions: [`Documentos pendentes da ${supplier.name}`, `Tarefas atrasadas da ${supplier.name}`, ...(projects[0] ? [`Como está o ${projects[0].name}?`] : [])],
  };
}

/* ------------------------------------------------------------- lists -- */

function scopeWhere(understanding: Understanding, userId: string) {
  if (understanding.projectId) return { projectId: understanding.projectId };
  if (understanding.supplierId) return { project: { supplierId: understanding.supplierId } };
  if (understanding.personId) return { assignedToId: understanding.personId };
  if (understanding.intent === "mine") return { assignedToId: userId };
  return {};
}

function scopeLabel(understanding: Understanding, catalog: AssistantCatalog) {
  if (understanding.projectId) return ` no ${catalog.projects.find((item) => item.id === understanding.projectId)?.name}`;
  if (understanding.supplierId) return ` da ${catalog.suppliers.find((item) => item.id === understanding.supplierId)?.name}`;
  if (understanding.personId) return ` de ${catalog.people.find((item) => item.id === understanding.personId)?.name}`;
  return "";
}

export async function answer(user: SessionUser, question: string): Promise<AssistantReply> {
  const catalog = await loadCatalog(user);
  const understanding = understand(question, {
    projects: catalog.projects.map((project) => ({ id: project.id, name: project.name, code: project.projectCode })),
    suppliers: catalog.suppliers,
    people: catalog.people,
  });
  const project = understanding.projectId ? catalog.projects.find((item) => item.id === understanding.projectId) : undefined;
  const where = scopeWhere(understanding, user.id);
  const scope = scopeLabel(understanding, catalog);
  const firstName = user.name.split(" ")[0];

  switch (understanding.intent) {
    case "greeting":
    case "help":
    case "unknown":
      return {
        text:
          understanding.intent === "unknown"
            ? "Não encontrei isso nos dados da plataforma. Posso responder sobre projetos, empresas, tarefas, documentos, prazos, marcos e o que aconteceu recentemente."
            : `Olá, ${firstName}. Respondo com os dados da plataforma: como está cada projeto ou empresa, o que está atrasado, os documentos pendentes, os prazos e o que aconteceu.`,
        suggestions: [...GENERAL_SUGGESTIONS, ...(catalog.projects[0] ? [`Como está o ${catalog.projects[0].name}?`] : [])],
      };

    case "status":
      if (project) return projectStatus(user, project);
      if (understanding.supplierId) return supplierStatus(user, catalog, understanding.supplierId);
      return portfolio(catalog);

    case "portfolio":
      return portfolio(catalog);

    case "needs":
      if (project) return projectNeeds(user, project);
      if (understanding.supplierId) return supplierStatus(user, catalog, understanding.supplierId);
      return attention(user, catalog);

    case "overdue":
    case "mine": {
      const tasks = await findTasks(user, understanding.intent === "overdue" ? { AND: [where, overdueWhere()] } : where, 12);
      const mine = understanding.intent === "mine";
      return {
        text: tasks.length
          ? mine
            ? `Você tem ${plural(tasks.length, "tarefa em aberto", "tarefas em aberto")}, da mais urgente para a menos.`
            : `${plural(tasks.length, "tarefa atrasada", "tarefas atrasadas")}${scope}.`
          : mine
            ? "Você não tem tarefas em aberto."
            : `Nenhuma tarefa atrasada${scope}.`,
        items: tasks.map((task) => ({
          title: task.title,
          detail: `${task.project.name} · ${task.assignedTo?.name ?? "sem responsável"}${task.supplier ? ` · aguardando ${task.supplier.name}` : ""}`,
          trailing: when(task.dueDate),
          tone: lateTone(task.dueDate),
          href: `/tasks/${task.id}`,
        })),
        more: { label: "Ver em Tarefas", href: mine ? `/tasks?assignee=${user.id}` : "/tasks?tab=OVERDUE" },
        suggestions: project ? projectSuggestions(project.name) : GENERAL_SUGGESTIONS,
      };
    }

    case "documents": {
      const requestWhere = understanding.projectId
        ? { projectId: understanding.projectId }
        : understanding.supplierId
          ? { supplierId: understanding.supplierId }
          : {};
      const owed = await findRequests(user, ["PENDING", "REJECTED"], requestWhere, 15);
      return {
        text: owed.length
          ? `${plural(owed.length, "documento ainda não enviado", "documentos ainda não enviados")}${scope}.`
          : `Nenhum documento pendente${scope}: tudo o que foi pedido já chegou.`,
        items: owed.map((request) => ({
          title: request.title,
          detail: `${request.project.name} · ${request.supplier.name}${request.status === "REJECTED" ? " · correção pedida" : ""}`,
          trailing: when(request.dueDate),
          tone: request.status === "REJECTED" ? "risk" : lateTone(request.dueDate) === "risk" ? "risk" : "warn",
          href: request.taskId ? `/tasks/${request.taskId}` : `/regulatory?supplier=${request.supplier.id}&project=${request.project.id}`,
        })),
        more: { label: "Abrir o Regulatório", href: understanding.supplierId ? `/regulatory?supplier=${understanding.supplierId}` : "/regulatory?view=pendencias" },
        suggestions: ["O que tenho para analisar?", "Quais tarefas estão atrasadas?", "O que vence esta semana?"],
      };
    }

    case "review": {
      const review = await findRequests(user, ["SUBMITTED", "IN_REVIEW"], {}, 15);
      return {
        text: review.length
          ? `${plural(review.length, "documento enviado espera", "documentos enviados esperam")} a análise da Vionex.`
          : "Nada para analisar: nenhum documento enviado está esperando revisão.",
        items: review.map((request) => ({
          title: request.title,
          detail: `${request.project.name} · enviado por ${request.supplier.name}`,
          trailing: request.submittedAt ? `enviado ${formatDateShort(request.submittedAt, "pt-BR")}` : undefined,
          tone: "info",
          href: request.taskId ? `/tasks/${request.taskId}` : `/projects/${request.project.id}`,
        })),
        more: { label: "Fila de análise", href: "/regulatory?status=review" },
        suggestions: ["Quais documentos estão pendentes?", "O que precisa da minha atenção?"],
      };
    }

    case "deadlines": {
      const tasks = await findTasks(user, { AND: [where, dueWithin(understanding.horizon)] }, 15);
      const span = understanding.horizon >= 30 ? "nos próximos 30 dias" : understanding.horizon <= 2 ? "até amanhã" : "nos próximos 7 dias";
      return {
        text: tasks.length ? `${plural(tasks.length, "prazo", "prazos")} ${span}${scope}.` : `Nenhum prazo ${span}${scope}.`,
        items: tasks.map((task) => ({
          title: task.title,
          detail: `${task.project.name} · ${task.assignedTo?.name ?? "sem responsável"}`,
          trailing: when(task.dueDate),
          href: `/tasks/${task.id}`,
        })),
        suggestions: understanding.horizon >= 30 ? ["O que vence esta semana?", "Quais tarefas estão atrasadas?"] : ["Prazos deste mês", "Quais tarefas estão atrasadas?"],
      };
    }

    case "milestones": {
      const milestones = await findMilestones(user, understanding.projectId ? { projectId: understanding.projectId } : {}, 10);
      return {
        text: milestones.length ? `Próximos marcos${scope}:` : `Nenhum marco pendente${scope}.`,
        items: milestones.map((milestone) => ({
          title: milestone.title,
          detail: `${milestone.project.name}${milestone.stage ? ` · ${label.stageKey(milestone.stage, dict)}` : ""}`,
          trailing: when(milestone.dueDate),
          tone: milestone.status === "DELAYED" || lateTone(milestone.dueDate) === "risk" ? "risk" : "neutral",
          href: `/projects/${milestone.project.id}`,
        })),
        suggestions: project ? projectSuggestions(project.name) : GENERAL_SUGGESTIONS,
      };
    }

    case "blocked": {
      const blockers = await findBlockers(user);
      const blockedStages = catalog.projects.flatMap((item) =>
        item.stages
          .filter((stage) => stage.status === "BLOCKED")
          .map((stage) => ({ project: item, stage })),
      );
      const items: ReplyItem[] = [
        ...blockers.map((item) => ({ title: item.name, detail: item.blockerNote ?? "", tone: "risk" as const, href: `/projects/${item.id}` })),
        ...blockedStages.map(({ project: item, stage }) => ({
          title: `${item.name} · ${label.stageKey(stage.key, dict)}`,
          detail: "Etapa marcada como bloqueada",
          tone: "risk" as const,
          href: `/projects/${item.id}`,
        })),
      ];
      return {
        text: items.length ? `${plural(items.length, "bloqueio", "bloqueios")} no portfólio. Cada um se resolve na visão geral do projeto.` : "Nada bloqueado no portfólio.",
        items,
        suggestions: GENERAL_SUGGESTIONS,
      };
    }

    case "activity": {
      const events = await findActivity(user, understanding.projectId);
      return {
        text: events.length ? `O que aconteceu por último${scope}:` : `Nenhuma atividade registrada${scope}.`,
        items: events.map((event) => ({
          title: event.description,
          detail: [event.actor?.name, "project" in event && event.project ? (event.project as { name: string }).name : null].filter(Boolean).join(" · "),
          trailing: formatDateShort(event.createdAt, "pt-BR"),
          href: `/projects/${event.projectId}`,
        })),
        more: understanding.projectId ? { label: "Histórico completo", href: `/projects/${understanding.projectId}/timeline` } : undefined,
        suggestions: project ? projectSuggestions(project.name) : GENERAL_SUGGESTIONS,
      };
    }
  }
}

/* --------------------------------------------------------- portfolio -- */

function portfolio(catalog: AssistantCatalog): AssistantReply {
  const projects = catalog.projects;
  const count = (status: string) => projects.filter((project) => project.status === status).length;
  const average = projects.length ? Math.round(projects.reduce((total, project) => total + project.progress, 0) / projects.length) : 0;
  const order: Record<string, number> = { BLOCKED: 0, AT_RISK: 1, ON_TRACK: 2, COMPLETED: 3 };
  return {
    text:
      `${plural(projects.length, "projeto ativo", "projetos ativos")}: ${count("ON_TRACK")} em dia, ${count("AT_RISK")} em risco e ${count("BLOCKED")} bloqueado${count("BLOCKED") === 1 ? "" : "s"}. ` +
      `Progresso médio de ${average}%.`,
    items: [...projects]
      .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
      .map((project) => {
        const status = meta.project(project.status as ProjectStatus, dict);
        return {
          title: project.name,
          detail: `${project.supplier.name} · ${label.stageKey(project.currentStage, dict)} · ${status.label}`,
          trailing: `${project.progress}%`,
          tone: status.tone,
          href: `/projects/${project.id}`,
        };
      }),
    more: { label: "Ver projetos", href: "/projects" },
    suggestions: GENERAL_SUGGESTIONS,
  };
}

async function attention(user: SessionUser, catalog: AssistantCatalog): Promise<AssistantReply> {
  const [overdue, owed, review, blockers] = await Promise.all([
    findTasks(user, overdueWhere(), 6),
    findRequests(user, ["PENDING", "REJECTED"], {}, 6),
    findRequests(user, ["SUBMITTED", "IN_REVIEW"], {}, 6),
    findBlockers(user),
  ]);
  const items: ReplyItem[] = [
    ...blockers.map((item) => ({ title: `${item.name} está bloqueado`, detail: item.blockerNote ?? "", tone: "risk" as const, href: `/projects/${item.id}` })),
    ...overdue.map((task) => ({ title: task.title, detail: `Atrasada · ${task.project.name}`, trailing: when(task.dueDate), tone: "risk" as const, href: `/tasks/${task.id}` })),
    ...review.map((request) => ({ title: request.title, detail: `Para analisar · ${request.project.name}`, tone: "info" as const, href: request.taskId ? `/tasks/${request.taskId}` : `/projects/${request.project.id}` })),
    ...owed.map((request) => ({ title: request.title, detail: `Aguardando ${request.supplier.name} · ${request.project.name}`, trailing: when(request.dueDate), tone: "warn" as const, href: request.taskId ? `/tasks/${request.taskId}` : `/projects/${request.project.id}` })),
  ];
  return {
    text: items.length
      ? `Precisa de atenção: ${[
          blockers.length ? plural(blockers.length, "projeto bloqueado", "projetos bloqueados") : null,
          overdue.length ? plural(overdue.length, "tarefa atrasada", "tarefas atrasadas") : null,
          review.length ? plural(review.length, "documento para analisar", "documentos para analisar") : null,
          owed.length ? plural(owed.length, "documento pendente", "documentos pendentes") : null,
        ]
          .filter(Boolean)
          .join(", ")}.`
      : "Nada fora do previsto: nenhum bloqueio, atraso ou análise parada.",
    items,
    suggestions: catalog.projects.slice(0, 3).map((project) => `Como está o ${project.name}?`),
  };
}
