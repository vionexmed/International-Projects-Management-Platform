import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireInternalUser } from "@/server/auth/current-user";
import { getPortfolioSummary, listUpcomingDeadlines } from "@/server/services/dashboard";
import { countAttentionItems, listAttentionItems } from "@/server/services/attention";
import { countDocumentRequestsByQueue } from "@/server/services/documents";
import { listProjects } from "@/server/services/projects";
import { AttentionList } from "@/components/app/attention-list";
import { VionexMark } from "@/components/app/logo";
import { CardLink, CardSection } from "@/components/app/card-section";
import { StageTrack } from "@/features/projects/stage-track";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { formatDateShort, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(name: string) {
  const hour = new Date().getHours();
  const firstName = name.split(" ")[0];
  if (hour < 12) return `Bom dia, ${firstName}.`;
  if (hour < 18) return `Boa tarde, ${firstName}.`;
  return `Boa noite, ${firstName}.`;
}

/** "Quarta-feira, 30 de setembro", in the team's own time zone. */
function today() {
  const text = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "em 6 dias", "hoje", "3 dias de atraso". */
function distance(date: Date | null) {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0) return { text: `${Math.abs(days)}d de atraso`, late: true };
  if (days === 0) return { text: "hoje", late: false };
  return { text: `em ${days} ${days === 1 ? "dia" : "dias"}`, late: false };
}

/**
 * Where things stand, and what to do about it.
 *
 * Four numbers that each open the list behind them; then the exceptions (the
 * page's subject), the portfolio at a glance — every project on its stage
 * track — and the deadlines coming up. Every block is a doorway to the screen
 * where the thing is resolved; none of them is a destination of its own.
 */
export default async function DashboardPage() {
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [summary, attention, counts, deadlines, queue, portfolio] = await Promise.all([
    getPortfolioSummary(user),
    listAttentionItems(user, 6),
    countAttentionItems(user),
    listUpcomingDeadlines(user, 7),
    countDocumentRequestsByQueue(user),
    listProjects(user, { perPage: 8 }),
  ]);

  const stats = [
    { label: "Projetos ativos", value: summary.total - summary.completed, note: "Ver portfólio", href: "/projects" },
    {
      label: "Tarefas atrasadas",
      value: counts.tasks,
      note: counts.tasks > 0 ? "Precisam de ação" : "Nenhum atraso",
      href: "/tasks?tab=OVERDUE",
      tone: counts.tasks > 0 ? "risk" : undefined,
    },
    {
      label: "Documentos pendentes",
      value: queue.supplier,
      note: queue.overdue > 0 ? `${queue.overdue} com prazo vencido` : "Aguardando fornecedores",
      href: "/regulatory?status=supplier",
      tone: queue.overdue > 0 ? "warn" : undefined,
    },
    {
      label: "Para analisar",
      value: queue.review,
      note: queue.review > 0 ? "Enviados pelos fornecedores" : "Nada na fila",
      href: "/regulatory?status=review",
      tone: queue.review > 0 ? "info" : undefined,
    },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl">
      {/*
        The welcome band, as large products open their home screen: graphite,
        the Vionex mark oversized and cropped by the edge one step off the
        background (as on the sign-in page) — a shape, not an illustration —
        and the day's one sentence with the two ways onward.
      */}
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-navy px-6 py-7 sm:px-9 sm:py-9">
        <span aria-hidden className="pointer-events-none absolute -top-28 -right-24 sm:-right-6">
          <VionexMark className="size-[380px] text-navy-line" />
        </span>
        <span aria-hidden className="pointer-events-none absolute top-1/2 right-24 size-64 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-meta font-medium tracking-[0.14em] text-navy-ink uppercase">{today()}</p>
            <h1 className="mt-2 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-white">{greeting(user.name)}</h1>
            <p className="mt-2 max-w-xl text-body text-navy-ink">
              {counts.total > 0
                ? `${counts.total} ${counts.total === 1 ? "item precisa" : "itens precisam"} da sua atenção hoje.`
                : "Tudo em dia no portfólio. Nenhum atraso ou bloqueio."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/regulatory?view=pendencias"
              className="inline-flex h-9 items-center gap-2 rounded-sm bg-white px-3.5 text-label font-medium text-ink transition-colors hover:bg-white/90"
            >
              Ver pendências
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/reports"
              className="inline-flex h-9 items-center gap-2 rounded-sm border border-navy-line px-3.5 text-label font-medium text-white transition-colors hover:bg-navy-soft"
            >
              Relatórios
            </Link>
          </div>
        </div>
      </section>

      {/* Four numbers, one strip: the hairline gaps are the dividers. */}
      <ul className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line-soft bg-line-soft lg:grid-cols-4">
        {stats.map((stat) => (
          <li key={stat.label} className="bg-surface">
          <Link href={stat.href} className="group block h-full px-5 py-4 transition-colors hover:bg-subtle">
            <p className="text-meta font-medium text-muted">{stat.label}</p>
            <p
              className={cn(
                "mt-1.5 text-kpi tabular-nums",
                "tone" in stat && stat.tone === "risk" ? "text-risk" : "text-ink",
              )}
            >
              {stat.value}
            </p>
            <p
              className={cn(
                "mt-0.5 flex items-center gap-1 text-meta",
                "tone" in stat && stat.tone === "risk"
                  ? "text-risk"
                  : "tone" in stat && stat.tone === "warn"
                    ? "text-warn"
                    : "text-muted",
              )}
            >
              {stat.note}
              <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </p>
          </Link>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <CardSection title="Precisa da sua atenção" count={counts.total}>
            <AttentionList
              bare
              items={attention}
              locale={locale}
              emptyTitle="Nada fora do previsto."
              emptyDescription="Nenhum atraso, bloqueio ou análise parada no portfólio."
            />
          </CardSection>

          <CardSection title="Portfólio" count={portfolio.total} action={<CardLink href="/projects">Ver projetos</CardLink>}>
            <ul>
              {portfolio.items.map((project) => (
                <li
                  key={project.id}
                  className="relative grid grid-cols-1 items-center gap-x-6 gap-y-2 border-t border-line-faint px-6 py-3.5 transition-colors hover:bg-subtle sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_6rem]"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${project.id}`}
                      className="block truncate text-body font-medium text-ink after:absolute after:inset-0"
                    >
                      {project.name}
                    </Link>
                    <p className="truncate text-meta text-muted">
                      {project.projectCode} · {project.supplier.name}
                    </p>
                  </div>
                  <StageTrack
                    projectId={project.id}
                    stages={project.stages}
                    current={project.currentStage}
                    progress={project.progress}
                    dict={dict}
                  />
                  <p className="text-meta text-muted tabular-nums sm:text-right">
                    {project.targetLaunchDate ? formatDateShort(project.targetLaunchDate, locale) : "Sem data"}
                  </p>
                </li>
              ))}
            </ul>
          </CardSection>
        </div>

        <CardSection title="Próximos prazos" action={<CardLink href="/tasks">Ver tarefas</CardLink>}>
          {deadlines.length === 0 ? (
            <p className="px-6 pb-6 text-body text-muted">Nenhum prazo próximo.</p>
          ) : (
            <ul className="pb-1">
              {deadlines.map((item) => {
                const due = distance(item.dueDate);
                return (
                  <li key={item.id} className="relative flex items-start gap-3 border-t border-line-faint px-6 py-3 transition-colors hover:bg-subtle">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/tasks/${item.id}`}
                        className="block truncate text-body font-medium text-ink after:absolute after:inset-0"
                      >
                        {item.title}
                      </Link>
                      <p className="truncate text-meta text-muted">
                        {item.project.name}
                        {item.supplier ? ` · aguardando ${item.supplier.name}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-meta tabular-nums">
                      <p className="text-ink-soft">{formatDateShort(item.dueDate, locale)}</p>
                      {due ? <p className={cn(due.late ? "font-medium text-risk" : "text-muted")}>{due.text}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardSection>
      </div>
    </div>
  );
}
