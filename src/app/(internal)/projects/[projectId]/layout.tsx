import Link from "next/link";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { orNotFound } from "@/server/authz/rsc";
import { listSupplierOptions } from "@/server/services/suppliers";
import { listInternalUserOptions } from "@/server/services/users";
import { db } from "@/server/db";
import { BackLink } from "@/components/app/nav-memory";
import { UserAvatar } from "@/components/ui/avatar";
import { ProjectTabs } from "@/features/projects/project-tabs";
import { EditProjectDialog } from "@/features/projects/edit-project-dialog";
import { RequestDocumentDialog } from "@/features/documents/request-document-dialog";
import { ProjectActionsMenu } from "@/features/projects/project-actions-menu";
import { StageSwitcher } from "@/features/projects/stage-switcher";
import { PROJECT_GUTTER } from "@/features/projects/project-frame";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { meta, type StageProgress } from "@/lib/labels";
import { cn } from "@/lib/utils";
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
      <header className="sticky top-12 z-20 bg-surface lg:top-0">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 sm:px-6">
          {/*
            Back to wherever the project was opened from (the list, a supplier's
            folder, the dashboard); the list, as it was left, on a fresh tab.
          */}
          <BackLink href="/projects" label="Voltar" history className="-ml-1.5" />
          {/* The name first; one quiet line of context under it. */}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[18px] leading-7 font-semibold tracking-[-0.01em] text-ink">{project.name}</h1>
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-meta text-muted">
              <span className="font-mono text-ink-soft">{project.projectCode}</span>
              <span className="text-faint" aria-hidden>·</span>
              <Link href={`/suppliers/${project.supplier.id}`} className="truncate text-ink-soft hover:text-brand-strong hover:underline">
                {project.supplier.name}
              </Link>
              <span className="hidden text-faint sm:inline" aria-hidden>·</span>
              <span className="hidden sm:inline">{project.country}</span>
              <span className="hidden text-faint md:inline" aria-hidden>·</span>
              <span className="hidden items-center gap-1.5 md:inline-flex" title="Responsável pelo projeto">
                <UserAvatar name={project.owner.name} size="xs" />
                {project.owner.name}
              </span>
            </p>
          </div>

          {/* Secondary actions, then the project's primary one at the edge. */}
          <div className="flex shrink-0 items-center gap-2">
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
            {/*
              The project's primary action, in the header so it is one click
              away from every tab. It used to live only on the regulatory
              stage page, three levels down, where nobody looked for it.
            */}
            {can(user, "document:request") ? (
              <RequestDocumentDialog projectId={project.id} supplierName={project.supplier.name} />
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
