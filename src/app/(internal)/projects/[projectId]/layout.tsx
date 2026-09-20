import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { orNotFound } from "@/server/authz/rsc";
import { listSupplierOptions } from "@/server/services/suppliers";
import { listInternalUserOptions } from "@/server/services/users";
import { SolidBadge } from "@/components/ui/badge";
import { ProjectTabs } from "@/features/projects/project-tabs";
import { EditProjectDialog } from "@/features/projects/edit-project-dialog";
import { ProjectActionsMenu } from "@/features/projects/project-actions-menu";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { meta } from "@/lib/labels";
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

  const dict = getDictionary(localeFromLanguage(user.language));
  const status = meta.project(project.status as ProjectStatus, dict);
  const editable = can(user, "project:update");

  const [suppliers, owners] = editable
    ? await Promise.all([listSupplierOptions(user), listInternalUserOptions(user)])
    : [[], []];

  return (
    <>
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Projetos
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">
              {project.name}
            </h1>
            <SolidBadge tone={status.tone}>{status.label}</SolidBadge>
          </div>
          <p className="mt-1.5 text-[14px] text-muted">
            {project.supplier.name} · {project.country} · Project ID {project.projectCode}
          </p>
        </div>

        {editable ? (
          <div className="flex shrink-0 items-center gap-2">
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
          </div>
        ) : null}
      </div>

      <ProjectTabs projectId={project.id} className="mb-6" />

      {children}
    </>
  );
}
