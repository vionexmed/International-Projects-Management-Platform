import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CircleCheck } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { listSupplierQueue, type QueueItem } from "@/server/services/supplier-queue";
import { listProjects } from "@/server/services/projects";
import { listNotifications } from "@/server/services/notifications";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { StatusBadge, StatusIcon } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/app/search-filters";
import {
  Table,
  TableScroll,
  TableShell,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { getDictionary, interpolate, plural, type Dictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { daysUntil, formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

function greetingKey(hour: number) {
  if (hour < 12) return "greetingMorning" as const;
  if (hour < 18) return "greetingAfternoon" as const;
  return "greetingEvening" as const;
}

const FILTERS = [
  { key: "all", label: (d: Dictionary) => d.portal.requests.filterAll },
  { key: "document", label: (d: Dictionary) => d.portal.requests.filterDocuments },
  { key: "task", label: (d: Dictionary) => d.portal.requests.filterTasks },
];

const VISIBLE_TASKS = 8;

/**
 * "What is my situation right now?" — a stack of sections, not a dashboard of
 * boxes: a one-line status, then the queue itself (filterable, searchable,
 * right here rather than behind a second click), then the quiet rest of the
 * portal — projects and updates — each ending in a link to the page that can
 * actually be worked from.
 */
export default async function SupplierHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [queue, projects, updates] = await Promise.all([
    listSupplierQueue(user),
    listProjects(user, { perPage: 5 }),
    listNotifications(user.id, 5),
  ]);

  const openCount = queue.open.length;
  // A date already behind us is not a "next deadline" — when anything is
  // late, that is what the status line says, in the only colour reserved for
  // problems.
  const overdueCount = queue.open.filter((item) => {
    const remaining = daysUntil(item.dueDate);
    return remaining !== null && remaining < 0;
  }).length;
  const nextUpcoming = queue.open.find((item) => (daysUntil(item.dueDate) ?? -1) >= 0);
  const firstName = user.name.split(" ")[0];

  const active = FILTERS.find((filter) => filter.key === params.type) ?? FILTERS[0];
  const query = (params.q ?? "").trim().toLowerCase();
  const matches = (item: QueueItem) =>
    (active.key === "all" ||
      (active.key === "document" ? item.type === "DOCUMENT" : item.type === "TASK")) &&
    (query === "" ||
      item.title.toLowerCase().includes(query) ||
      item.project.name.toLowerCase().includes(query));

  const visibleTasks = queue.open.filter(matches);
  const shownTasks = visibleTasks.slice(0, VISIBLE_TASKS);

  const countFor = (key: string) =>
    key === "all"
      ? queue.open.length
      : queue.open.filter((item) => (key === "document" ? item.type === "DOCUMENT" : item.type === "TASK"))
          .length;

  const filterHref = (key: string) => {
    const qs = new URLSearchParams();
    if (key !== "all") qs.set("type", key);
    if (params.q) qs.set("q", params.q);
    const search = qs.toString();
    return search ? `/supplier?${search}` : "/supplier";
  };

  return (
    <div className="space-y-10">
      {/* Hero: greeting plus a single line of status — never a second copy of
          the queue below it. */}
      <div>
        <h1 className="text-page text-ink">
          {interpolate(dict.portal[greetingKey(new Date().getHours())], { name: firstName })}
        </h1>
        <p className="mt-1.5 text-body text-ink-soft">
          {openCount === 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="size-4 shrink-0 text-ok" />
              {dict.portal.home.actionRequiredEmpty}
            </span>
          ) : (
            <>
              {plural(dict.portal.home.actionRequiredCount, openCount)}
              {overdueCount > 0 ? (
                <>
                  {" · "}
                  <span className="font-medium text-risk">
                    {dict.portal.requests.overdue}: {overdueCount}
                  </span>
                </>
              ) : nextUpcoming?.dueDate ? (
                <>
                  {" · "}
                  {dict.portal.home.nextDue}:{" "}
                  <span className="font-medium text-ink">
                    {formatDate(nextUpcoming.dueDate, locale)}
                  </span>
                </>
              ) : null}
            </>
          )}
        </p>
      </div>

      {/* Your tasks: filter chips, search and a compact table — the queue
          itself, not a preview of it. */}
      <Section
        title={dict.portal.home.yourTasksTitle}
        action={
          openCount > shownTasks.length
            ? { label: dict.portal.home.viewAllTasks, href: "/supplier/action-required" }
            : undefined
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((filter) => {
              const isActive = filter.key === active.key;
              return (
                <Link
                  key={filter.key}
                  href={filterHref(filter.key)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-label font-medium transition-colors",
                    isActive
                      ? "border-brand bg-brand-soft text-brand-deep"
                      : "border-line text-ink-soft hover:border-line-strong hover:bg-raised",
                  )}
                >
                  {filter.label(dict)}
                  <span className={cn("text-[11px] tabular-nums", isActive ? "text-brand-deep" : "text-faint")}>
                    {countFor(filter.key)}
                  </span>
                </Link>
              );
            })}
          </div>
          <SearchInput placeholder={dict.common.search} className="w-full sm:w-[260px]" />
        </div>

        <TableShell>
          {shownTasks.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title={query || active.key !== "all" ? dict.common.noResults : dict.portal.requests.empty}
              compact
            />
          ) : (
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>{dict.common.name}</TH>
                    <TH>{dict.common.project}</TH>
                    <TH>{dict.common.dueDate}</TH>
                    <TH className="w-10" />
                  </TR>
                </THead>
                <TBody>
                  {shownTasks.map((item) => {
                    const remaining = daysUntil(item.dueDate);
                    const overdue = remaining !== null && remaining < 0;
                    return (
                      <TR key={item.id} interactive>
                        <TD>
                          <Link
                            href={item.href}
                            className="flex min-w-0 items-center gap-2.5 after:absolute after:inset-0 after:content-['']"
                          >
                            <StatusIcon kind={item.state} />
                            <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">
                              {item.title}
                            </span>
                          </Link>
                        </TD>
                        <TD label={dict.common.project} className="text-meta text-ink-soft">
                          {item.project.name}
                        </TD>
                        <TD
                          label={dict.common.dueDate}
                          className={cn("text-meta whitespace-nowrap", overdue ? "font-medium text-risk" : "text-ink-soft")}
                        >
                          {item.dueDate ? (overdue ? dict.portal.requests.overdue : formatDate(item.dueDate, locale)) : "—"}
                        </TD>
                        <TD className="max-md:hidden text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={item.href}>
                              {item.type === "DOCUMENT"
                                ? dict.portal.requests.openRequest
                                : dict.portal.requests.openProject}
                            </Link>
                          </Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </TableShell>
      </Section>

      {/* Projects — compact rows with a progress bar; the full table lives on its own page. */}
      {projects.items.length > 0 ? (
        <Section
          title={dict.portal.home.activeProjects}
          action={{ label: dict.portal.home.viewProjects, href: "/supplier/projects" }}
        >
          <TableShell>
            <ul className="divide-y divide-line-faint">
              {projects.items.map((project) => {
                const status = meta.project(project.status, dict);
                return (
                  <li key={project.id}>
                    <Link
                      href={`/supplier/projects/${project.id}`}
                      className="flex flex-wrap items-center gap-4 px-4 py-3.5 transition-colors hover:bg-subtle"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-medium text-ink">{project.name}</p>
                        <p className="mt-0.5 truncate text-meta text-muted">
                          {label.stageKey(project.currentStage, dict)}
                        </p>
                      </div>
                      <div className="hidden w-36 shrink-0 sm:block">
                        <ProgressBar value={project.progress} />
                      </div>
                      <span className="w-9 shrink-0 text-right text-meta font-semibold text-ink tabular-nums">
                        {project.progress}%
                      </span>
                      <span className="shrink-0">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </TableShell>
        </Section>
      ) : null}

      {/* Vionex updates */}
      <Section title={dict.portal.home.updatesTitle}>
        {updates.length === 0 ? (
          <EmptyState icon={Bell} title={dict.portal.home.updatesEmpty} compact />
        ) : (
          <ul className="divide-y divide-line-soft">
            {updates.map((update) => {
              const body = (
                <>
                  <p className="text-body font-medium text-ink">{update.title}</p>
                  {update.description ? (
                    <p className="mt-0.5 text-meta text-muted">{update.description}</p>
                  ) : null}
                  <p className="mt-1 text-meta text-faint">
                    {formatRelative(update.createdAt, locale)}
                  </p>
                </>
              );

              return (
                <li key={update.id}>
                  {update.href ? (
                    <Link
                      href={update.href}
                      className="-mx-2 block rounded-sm px-2 py-3 transition-colors hover:bg-subtle"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
