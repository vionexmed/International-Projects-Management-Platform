import { FlaskConical } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { db } from "@/server/db";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PropertyList } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
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
    <div className="space-y-10">
      {/* The study is this stage's own record, so it is the one box here. */}
      <Section
        title="Estudo clínico"
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
      >
        {study ? (
          <Panel className="space-y-5 p-5">
            <PropertyList
              layout="grid"
              items={[
                {
                  label: "Status",
                  value: status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : null,
                },
                { label: "Instituição", value: study.institution },
                { label: "País", value: study.country },
                { label: "Protocolo", value: study.protocol },
                { label: "Tipo de estudo", value: study.studyType },
                {
                  label: "Início",
                  value: study.startDate ? formatDate(study.startDate, locale) : null,
                },
                {
                  label: "Conclusão prevista",
                  value: study.expectedCompletion
                    ? formatDate(study.expectedCompletion, locale)
                    : null,
                },
              ]}
            />
            {study.notes ? (
              <div className="rounded-lg bg-raised/70 px-4 py-3">
                <p className="text-meta text-muted">Observações</p>
                <p className="mt-1 text-body text-ink-soft">{study.notes}</p>
              </div>
            ) : null}
          </Panel>
        ) : (
          <Panel>
            <EmptyState
              icon={FlaskConical}
              title="Nenhum estudo cadastrado."
              description="Adicione o estudo clínico para acompanhar instituição, protocolo e prazos."
              compact
            />
          </Panel>
        )}
      </Section>

      {/* Side by side, like the import stage: two short lists, not two full-width strips. */}
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-8">
        <Section
          title="Tarefas clínicas"
          count={pending.length > 0 ? `${pending.length} em aberto` : undefined}
          action={{ label: "Ver todas", href: `/projects/${projectId}/tasks?category=CLINICAL` }}
        >
          <StageTaskList tasks={tasks} locale={locale} dict={dict} />
        </Section>

        <Section
          title="Documentos clínicos"
          count={documents.length || undefined}
          action={{ label: "Ver todos", href: `/projects/${projectId}/documents?type=CLINICAL` }}
        >
          <StageDocumentList documents={documents} locale={locale} dict={dict} />
        </Section>
      </div>
    </div>
  );
}
