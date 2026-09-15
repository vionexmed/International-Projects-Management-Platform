import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { listTasks } from "@/server/services/tasks";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/app/pagination";
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
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Tasks" };

/**
 * The work Vionex is waiting on, from the supplier's side.
 *
 * `taskScope` has always been written so a supplier sees the tasks that are
 * explicitly waiting on them — the rows existed and nothing ever rendered
 * them, so a supplier could be blocking a project without any way to know.
 *
 * Document requests are left out on purpose. They appear under Action
 * Required, where the supplier can actually answer them; listing the mirror
 * task here as well would show the same pendency twice, once in a place that
 * resolves it and once in a place that does not.
 */
export default async function SupplierTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const result = await listTasks(user, {
    excludeDocumentRequests: true,
    page: Number(params.page ?? 1) || 1,
    perPage: 25,
  });

  return (
    <>
      <PageHeader title={dict.portal.tasks.title} description={dict.portal.tasks.subtitle} />

      <TableShell>
        {result.items.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={dict.portal.tasks.empty}
            description={dict.portal.tasks.emptyDescription}
          />
        ) : (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>{dict.portal.tasks.title}</TH>
                    <TH>{dict.common.project}</TH>
                    <TH>{dict.common.dueDate}</TH>
                    <TH>{dict.common.status}</TH>
                  </TR>
                </THead>
                <TBody>
                  {result.items.map((task) => {
                    const status = meta.task(task.derivedStatus, dict);
                    return (
                      <TR key={task.id} interactive>
                        <TD>
                          <Link
                            href={`/supplier/projects/${task.project.id}`}
                            className="block after:absolute after:inset-0 after:content-['']"
                          >
                            <CellStack
                              title={task.title}
                              subtitle={label.taskCategory(task.category, dict)}
                            />
                          </Link>
                        </TD>
                        <TD label={dict.common.project} className="text-[13px] text-ink-soft">
                          {task.project.name}
                        </TD>
                        <TD
                          label={dict.common.dueDate}
                          className="text-[13px] whitespace-nowrap text-ink-soft"
                        >
                          {formatDate(task.dueDate, locale)}
                        </TD>
                        <TD label={dict.common.status}>
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>

            <TableFooter>
              <Pagination
                page={result.page}
                pageCount={result.pageCount}
                total={result.total}
                perPage={result.perPage}
                searchParams={params}
                label={dict.portal.tasks.title.toLowerCase()}
              />
            </TableFooter>
          </>
        )}
      </TableShell>

      <p className="mt-3 text-[13px] text-muted">{dict.portal.tasks.requestsHint}</p>
    </>
  );
}
