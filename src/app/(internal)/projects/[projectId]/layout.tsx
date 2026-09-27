import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { orNotFound } from "@/server/authz/rsc";
import { listSupplierOptions } from "@/server/services/suppliers";
import { listInternalUserOptions } from "@/server/services/users";
import { db } from "@/server/db";
import { PageHeader } from "@/components/app/page-header";
import { SolidBadge } from "@/components/ui/badge";
import { ProjectTabs } from "@/features/projects/project-tabs";
import { EditProjectDialog } from "@/features/projects/edit-project-dialog";
import { ProjectActionsMenu } from "@/features/projects/project-actions-menu";
import { StageSwitcher } from "@/features/projects/stage-switcher";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { meta, type StageProgress } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import type { ProjectStatus } from "@/server/services/projects";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    const user = await requireInternalUser();
    const project = await requireProjectAccess(user, projectId);
    return { title: project.name };
  } catch {
    return { title: "Projeto" };
  }
}

/**
 * Shared chrome for every project tab. The access check runs here, so each
 * child page inherits a verified project without repeating the guard.
 *
 * The header carries the record's identity — owner, dates, category — as one
 * unboxed row, so no tab has to repeat it in a panel of its own.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();

  const project = await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const status = meta.project(project.status as ProjectStatus, dict);
  const editable = can(user, "project:update");

  const [options, stages] = await Promise.all([
    editable ? Promise.all([listSupplierOptions(user), listInternalUserOptions(user)]) : null,
    /*
      Only key and status, for the stage switcher's dots. The project was
      verified above, so its stages are the caller's to see.
    */
    db.projectStage.findMany({
      where: { projectId: project.id },
      select: { key: true, status: true },
    }),
  ]);
  const [suppliers, owners] = options ?? [[], []];

  const properties = [
    { label: "Responsável", value: project.owner.name },
    { label: "Início", value: project.startDate ? formatDate(project.startDate, locale) : null },
    {
      label: "Lançamento previsto",
      value: project.targetLaunchDate ? formatDate(project.targetLaunchDate, locale) : null,
    },
    { label: "Categoria", value: project.category },
    { label: "Tipo de produto", value: project.productType },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Projetos", href: "/projects" }]}
        title={project.name}
        status={<SolidBadge tone={status.tone}>{status.label}</SolidBadge>}
        meta={`${project.supplier.name} · ${project.country} · ${project.projectCode}`}
        properties={properties}
        className="mb-6"
        actions={
          editable ? (
            <>
              <EditProjectDialog
                project={{
                  id: project.id,
                  name: project.name,
                  ownerId: project.ownerId,
                  country: project.country,
                  productType: project.productType,
                  category: project.category,
                  description: project.description,
                  blockerNote: project.blockerNote,
                  status: project.status as ProjectStatus,
                  startDate: project.startDate?.toISOString().slice(0, 10) ?? "",
                  targetLaunchDate: project.targetLaunchDate?.toISOString().slice(0, 10) ?? "",
                }}
                owners={owners}
                suppliers={suppliers}
              />
              <ProjectActionsMenu projectId={project.id} canArchive={can(user, "project:archive")} />
            </>
          ) : null
        }
      />

      <ProjectTabs projectId={project.id} currentStage={project.currentStage} className="mb-6" />
      <StageSwitcher
        projectId={project.id}
        className="mb-8"
        stages={stages.map((stage) => {
          const stageStatus = meta.stage(stage.status as StageProgress, dict);
          return { key: stage.key, statusLabel: stageStatus.label, tone: stageStatus.tone };
        })}
      />

      {children}
    </>
  );
}
