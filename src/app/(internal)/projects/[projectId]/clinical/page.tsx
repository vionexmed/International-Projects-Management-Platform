import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { db } from "@/server/db";
import { orNotFound } from "@/server/authz/rsc";
import { Field, Panel, PanelHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ClinicalStudyDialog } from "@/features/projects/clinical-form";
import { StageTaskList } from "@/features/projects/stage-task-list";
import { StageDocumentList } from "@/features/projects/stage-document-list";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { meta, type ClinicalProgress } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export default async function ProjectClinicalPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [study, tasks, documents] = await Promise.all([
    db.clinicalStudy.findUnique({ where: { projectId } }),
    db.task.findMany({
      where: { projectId, category: "CLINICAL" },
      include: { assignedTo: { select: { name: true } }, supplier: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    db.document.findMany({
      where: { projectId, type: "CLINICAL" },
      include: { currentVersion: true, createdBy: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const status = study ? meta.clinical(study.status as ClinicalProgress, dict) : null;
  const editable = can(user, "clinical:manage");

  const pending = tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          title="Estudo clínico"
          description="Dados do estudo associado a este projeto."
          action={
            editable ? (
              <ClinicalStudyDialog
                projectId={projectId}
                hasStudy={Boolean(study)}
                values={{
                  institution: study?.institution ?? "",
                  country: study?.country ?? "",
                  protocol: study?.protocol ?? "",
                  studyType: study?.studyType ?? "",
                  status: (study?.status as ClinicalProgress) ?? "PLANNED",
                  startDate: study?.startDate?.toISOString().slice(0, 10) ?? "",
                  expectedCompletion: study?.expectedCompletion?.toISOString().slice(0, 10) ?? "",
                  notes: study?.notes ?? "",
                }}
              />
            ) : null
          }
        />

        {study ? (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Instituição">{study.institution ?? "—"}</Field>
              <Field label="País">{study.country ?? "—"}</Field>
              <Field label="Protocolo">{study.protocol ?? "—"}</Field>
              <Field label="Tipo de estudo">{study.studyType ?? "—"}</Field>
              <Field label="Status">
                {status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : "—"}
              </Field>
              <Field label="Início">{formatDate(study.startDate, locale)}</Field>
              <Field label="Conclusão prevista">{formatDate(study.expectedCompletion, locale)}</Field>
            </dl>
            {study.notes ? (
              <div className="border-t border-line px-5 py-4">
                <p className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                  Observações
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">{study.notes}</p>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={FlaskConical}
            title="Nenhum estudo cadastrado."
            description="Adicione o estudo clínico para acompanhar instituição, protocolo e prazos."
            compact
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Pendências clínicas"
          description={`${pending.length} item(ns) em aberto nesta etapa.`}
          action={
            <Link
              href={`/projects/${projectId}/tasks`}
              className="text-[13px] font-medium text-brand-strong hover:underline"
            >
              Ver todas as tarefas
            </Link>
          }
        />
        <StageTaskList tasks={tasks} locale={locale} dict={dict} />
      </Panel>

      <Panel>
        <PanelHeader
          title="Documentos clínicos"
          action={
            <Link
              href={`/projects/${projectId}/documents`}
              className="text-[13px] font-medium text-brand-strong hover:underline"
            >
              Ver todos os documentos
            </Link>
          }
        />
        <StageDocumentList documents={documents} locale={locale} dict={dict} />
      </Panel>
    </div>
  );
}
