import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectReport } from "@/server/services/reports";
import type { ProjectStatus } from "@/server/services/projects";
import type { RequestStatus } from "@/server/services/documents";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Table, TableScroll, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FigureStrip, HealthTag, ProgressCell } from "@/features/reports/report-parts";
import { PrintButton } from "@/features/reports/print-button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label, meta, type MilestoneProgress, type StageProgress } from "@/lib/labels";
import { daysUntil, formatDate, formatDateShort } from "@/lib/format";
import type { SessionUser } from "@/types/auth";
import { cn } from "@/lib/utils";

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-3 text-body text-muted">{children}</p>;

/** One project, as a report someone can read, print or send. */
export async function ProjectReport({ user, projectId, locale, dict }: { user: SessionUser; projectId: string; locale: Locale; dict: Dictionary }) {
  const report = await getProjectReport(user, projectId);
  if (!report) notFound();
  const { health, project, stages, milestones, late, open, requests, documents, timeline } = report;
  const launchIn = daysUntil(project.targetLaunchDate);
  const pendingMilestones = milestones.filter((milestone) => milestone.status !== "COMPLETED");

  return (
    <article className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: "Relatórios", href: "/reports" }, { label: project.name }]}
        title={`Relatório · ${project.name}`}
        description={`${project.projectCode} · ${project.supplier.name} (${project.country}) · responsável ${project.owner.name} · gerado em ${formatDate(new Date(), locale)}`}
        actions={
          <>
            <PrintButton />
            <Button asChild variant="secondary" size="sm" className="print:hidden">
              <Link href={`/projects/${project.id}`}>Abrir projeto</Link>
            </Button>
          </>
        }
      />

      <div className="mb-8 flex flex-wrap items-start gap-3 rounded-xl border border-line-soft bg-surface px-5 py-4">
        <HealthTag status={health.status as ProjectStatus} dict={dict} />
        <p className="min-w-0 flex-1 text-body text-ink-soft">{health.reason}</p>
      </div>

      <div className="mb-10">
        <FigureStrip
          figures={[
            { label: "Progresso geral", value: `${health.progress}%`, note: `Etapa atual: ${label.stageKey(project.currentStage, dict)}` },
            { label: "Tarefas em aberto", value: open.length, note: late.length ? `${late.length} atrasada${late.length === 1 ? "" : "s"}` : "Nenhuma atrasada", tone: late.length ? "risk" : undefined },
            { label: "Documentos pendentes", value: health.owed, note: `${requests.length} solicitado${requests.length === 1 ? "" : "s"} no total`, tone: health.owed ? "warn" : undefined },
            {
              label: "Lançamento previsto",
              value: project.targetLaunchDate ? formatDateShort(project.targetLaunchDate, locale) : "—",
              note: launchIn === null ? "Sem data" : launchIn < 0 ? `${-launchIn} dias de atraso` : `em ${launchIn} dias`,
              tone: launchIn !== null && launchIn < 0 ? "risk" : undefined,
            },
          ]}
        />
      </div>

      <Section title="Etapas" className="mb-10">
        <TableShell>
          <TableScroll>
            <Table>
              <THead>
                <TR>
                  <TH>Etapa</TH>
                  <TH className="w-px">Status</TH>
                  <TH className="w-48">Progresso</TH>
                  <TH className="w-px" align="right">Tarefas</TH>
                </TR>
              </THead>
              <TBody>
                {stages.map((stage) => (
                  <TR key={stage.id}>
                    <TD>
                      <span className={cn("font-medium", stage.key === project.currentStage ? "text-ink" : "text-ink-soft")}>
                        {label.stageKey(stage.key, dict)}
                      </span>
                      {stage.key === project.currentStage ? <span className="ml-2 text-meta text-brand-strong">atual</span> : null}
                    </TD>
                    <TD label="Status">{meta.stage(stage.status as StageProgress, dict).label}</TD>
                    <TD label="Progresso"><ProgressCell value={stage.computedProgress} manual={stage.progress !== null} /></TD>
                    <TD label="Tarefas" align="right">{stage.done}/{stage.total}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        </TableShell>
        {/* A manual override is why 72% can sit next to 1/6: say so instead of looking wrong. */}
        {stages.some((stage) => stage.progress !== null) ? (
          <p className="mt-2 text-meta text-muted">* Progresso definido manualmente na etapa; não segue a contagem de tarefas.</p>
        ) : null}
      </Section>

      <div className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Section title="Tarefas atrasadas" count={late.length || undefined}>
          {late.length === 0 ? (
            <Empty>Nenhuma tarefa atrasada.</Empty>
          ) : (
            <ul className="divide-y divide-line-faint border-y border-line-faint">
              {late.map((task) => (
                <li key={task.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-body text-ink">{task.title}</span>
                    <span className="block text-meta text-muted">{task.assignedTo?.name ?? "Sem responsável"}</span>
                  </span>
                  <span className="shrink-0 text-meta font-medium text-risk tabular-nums">
                    {task.dueDate ? formatDateShort(task.dueDate, locale) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Documentos solicitados" count={requests.length || undefined}>
          {requests.length === 0 ? (
            <Empty>Nenhum documento solicitado.</Empty>
          ) : (
            <ul className="divide-y divide-line-faint border-y border-line-faint">
              {requests.map((request) => {
                const status = meta.request(request.status as RequestStatus, dict);
                return (
                  <li key={request.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-body text-ink">{request.title}</span>
                      <span className="block text-meta text-muted">
                        {request.dueDate ? `Prazo ${formatDateShort(request.dueDate, locale)}` : "Sem prazo"}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-meta font-medium", status.tone === "ok" ? "text-ok" : status.tone === "risk" ? "text-risk" : "text-muted")}>
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Section title="Marcos pendentes" count={pendingMilestones.length || undefined}>
          {pendingMilestones.length === 0 ? (
            <Empty>Nenhum marco pendente.</Empty>
          ) : (
            <ul className="divide-y divide-line-faint border-y border-line-faint">
              {pendingMilestones.map((milestone) => (
                <li key={milestone.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-body text-ink">{milestone.title}</span>
                    <span className="block text-meta text-muted">{meta.milestone(milestone.status as MilestoneProgress, dict).label}</span>
                  </span>
                  <span className="shrink-0 text-meta text-muted tabular-nums">
                    {milestone.dueDate ? formatDateShort(milestone.dueDate, locale) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Documentos recebidos" count={documents.length || undefined}>
          {documents.length === 0 ? (
            <Empty>Nenhum documento recebido.</Empty>
          ) : (
            <ul className="divide-y divide-line-faint border-y border-line-faint">
              {documents.slice(0, 10).map((document) => (
                <li key={document.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-body text-ink">{document.name}</span>
                    <span className="block text-meta text-muted">{label.documentType(document.type, dict)}</span>
                  </span>
                  <span className="shrink-0 text-meta text-muted tabular-nums">{formatDateShort(document.updatedAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Atividade recente">
        {timeline.length === 0 ? (
          <Empty>Nenhuma atividade registrada.</Empty>
        ) : (
          <ul className="divide-y divide-line-faint border-y border-line-faint">
            {timeline.map((event) => (
              <li key={event.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="min-w-0 text-body text-ink-soft">
                  {event.description}
                  {event.actor ? <span className="text-muted"> · {event.actor.name}</span> : null}
                </span>
                <span className="shrink-0 text-meta text-muted tabular-nums">{formatDateShort(event.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </article>
  );
}
