import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { listProjects } from "@/server/services/projects";
import { db } from "@/server/db";
import { projectScope } from "@/server/authz/scopes";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-filters";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CellStack,
  Table,
  TableFooter,
  TableScroll,
  TableShell,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { getDictionary, interpolate } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Projects" };

export default async function SupplierProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const result = await listProjects(user, { query: params.q, perPage: 50 });

  // Next milestone dates are shown next to the milestone name.
  const milestoneDates = new Map<string, Date | null>();
  if (result.items.length > 0) {
    const milestones = await db.milestone.findMany({
      where: {
        project: projectScope(user),
        projectId: { in: result.items.map((project) => project.id) },
        status: { in: ["PLANNED", "IN_PROGRESS", "DELAYED"] },
      },
      orderBy: [{ dueDate: "asc" }],
      select: { projectId: true, dueDate: true },
    });
    for (const milestone of milestones) {
      if (!milestoneDates.has(milestone.projectId)) {
        milestoneDates.set(milestone.projectId, milestone.dueDate);
      }
    }
  }

  return (
    <>
      <PageHeader title={dict.portal.projects.title} description={dict.portal.projects.subtitle} />

      <div className="mb-5 flex justify-end">
        <SearchInput
          placeholder={dict.portal.projects.searchPlaceholder}
          className="w-full sm:w-[340px]"
        />
      </div>

      <TableShell>
        {result.items.length === 0 ? (
          <EmptyState
            icon={Folder}
            title={params.q ? dict.common.noResults : dict.portal.projects.empty}
          />
        ) : (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>{dict.common.project}</TH>
                    <TH>{dict.portal.projects.currentStage}</TH>
                    <TH className="w-40">{dict.common.progress}</TH>
                    <TH>{dict.common.nextMilestone}</TH>
                    <TH>{dict.common.targetLaunch}</TH>
                    <TH>{dict.common.status}</TH>
                    <TH className="w-10" />
                  </TR>
                </THead>
                <TBody>
                  {result.items.map((project) => {
                    const status = meta.project(project.status, dict);
                    return (
                      <TR key={project.id} interactive>
                        <TD>
                          <Link
                            href={`/supplier/projects/${project.id}`}
                            className="block after:absolute after:inset-0 after:content-['']"
                          >
                            <CellStack title={project.name} subtitle={user.supplierName} />
                          </Link>
                        </TD>
                        <TD label={dict.portal.projects.currentStage}>
                          <span className="inline-flex items-center gap-2 text-[13px] text-ink-soft">
                            <span className="size-[7px] rounded-full bg-brand" aria-hidden />
                            {label.stageKey(project.currentStage, dict)}
                          </span>
                        </TD>
                        <TD label={dict.common.progress}>
                          <div className="w-32">
                            <div className="mb-1 text-[13px] font-semibold text-ink tabular-nums">
                              {project.progress}%
                            </div>
                            <ProgressBar value={project.progress} />
                          </div>
                        </TD>
                        <TD label={dict.common.nextMilestone}>
                          {project.nextMilestone ? (
                            <CellStack
                              title={
                                <span className="text-[13px] font-normal text-ink">
                                  {project.nextMilestone.title}
                                </span>
                              }
                              subtitle={formatDate(
                                milestoneDates.get(project.id) ?? project.nextMilestone.dueDate,
                                locale,
                              )}
                            />
                          ) : (
                            <span className="text-[13px] text-muted">—</span>
                          )}
                        </TD>
                        <TD label={dict.common.targetLaunch} className="text-[13px] whitespace-nowrap text-ink-soft">
                          {formatDate(project.targetLaunchDate, locale)}
                        </TD>
                        <TD label={dict.common.status}>
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        </TD>
                        <TD className="max-md:hidden text-right">
                          <ChevronRight className="inline size-4 text-faint" />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>

            <TableFooter>
              <span>
                {interpolate(dict.common.showingRange, {
                  from: 1,
                  to: result.items.length,
                  total: `${result.total} ${dict.portal.projects.countLabel}`,
                })}
              </span>
            </TableFooter>
          </>
        )}
      </TableShell>
    </>
  );
}
