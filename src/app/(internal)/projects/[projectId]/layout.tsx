import Link from "next/link";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { orNotFound } from "@/server/authz/rsc";
import { listSupplierOptions } from "@/server/services/suppliers";
import { listInternalUserOptions } from "@/server/services/users";
import { db } from "@/server/db";
import { AvatarStack } from "@/components/ui/avatar";
import { SolidBadge } from "@/components/ui/badge";
import { ProjectTabs } from "@/features/projects/project-tabs";
import { EditProjectDialog } from "@/features/projects/edit-project-dialog";
import { RequestDocumentDialog } from "@/features/documents/request-document-dialog";
import { ProjectActionsMenu } from "@/features/projects/project-actions-menu";
import { StageSwitcher } from "@/features/projects/stage-switcher";
import { PROJECT_GUTTER } from "@/features/projects/project-frame";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { meta, type StageProgress } from "@/lib/labels";
import { cn, initials } from "@/lib/utils";
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
 * A white work surface under a sticky 104-px header: a 64-px identity row
 * (initials tile, supplier link over the project name, status, owner, Edit
 * and ⋮) and the 40-px tab strip. The record's properties live in the
 * overview tab, not here.
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
      Only key and status, for the stage switcher's glyphs. The project was
      verified above, so its stages are the caller's to see.
    */
    db.projectStage.findMany({
      where: { projectId: project.id },
      select: { key: true, status: true },
    }),
  ]);
  const [suppliers, owners] = options ?? [[], []];

  return (
    // Cancels the shell's padding: the project is one white surface, edge to edge.
    <div className="-mx-4 -mt-5 -mb-5 flex min-h-[calc(100dvh-3rem)] flex-col bg-surface sm:-mx-6 sm:-mt-6 sm:-mb-6 lg:min-h-dvh">
      <header className="sticky top-12 z-20 bg-surface shadow-[0_1px_3px_rgba(5,41,47,0.06)] lg:top-0">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <span
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xs bg-brand-soft text-label font-semibold text-brand-deep select-none"
            aria-hidden
          >
            {initials(project.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 text-label">
              <Link
                href={`/suppliers/${project.supplier.id}`}
                className="truncate text-brand-strong hover:underline"
              >
                {project.supplier.name}
              </Link>
              <span className="hidden shrink-0 text-muted sm:inline">
                · {project.country} · {project.projectCode}
              </span>
            </p>
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="truncate text-section text-ink">{project.name}</h1>
              <SolidBadge tone={status.tone} className="max-sm:hidden">
                {status.label}
              </SolidBadge>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <AvatarStack
              people={[{ id: project.owner.id, name: project.owner.name }]}
              size={24}
              className={cn("mr-1 hidden md:inline-flex")}
            />
            {/*
              The project's primary action, in the header so it is one click
              away from every tab. It used to live only on the regulatory
              stage page, three levels down, where nobody looked for it.
            */}
            {can(user, "document:request") ? (
              <RequestDocumentDialog projectId={project.id} supplierName={project.supplier.name} />
            ) : null}
            {editable ? (
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
                <ProjectActionsMenu
                  projectId={project.id}
                  canArchive={can(user, "project:archive")}
                  size="iconSm"
                />
              </>
            ) : null}
          </div>
        </div>

        <ProjectTabs projectId={project.id} className="px-2 sm:px-4" />
      </header>

      <StageSwitcher
        projectId={project.id}
        stages={stages.map((stage) => {
          const stageStatus = meta.stage(stage.status as StageProgress, dict);
          return { key: stage.key, status: stage.status as StageProgress, statusLabel: stageStatus.label };
        })}
      />

      <div className={cn(PROJECT_GUTTER, "flex-1")}>{children}</div>
    </div>
  );
}
