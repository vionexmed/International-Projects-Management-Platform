import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, Clock, FileText, ListChecks } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { listSupplierQueue, type QueueItem } from "@/server/services/supplier-queue";
import { PageHeader } from "@/components/app/page-header";
import { TabsNav } from "@/components/app/tabs-nav";
import { Panel, PanelHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary, plural, type Dictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage, type Locale } from "@/lib/i18n/config";
import { meta } from "@/lib/labels";
import { daysUntil, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Action Required" };

const FILTERS = [
  { key: "all", label: (d: Dictionary) => d.portal.requests.filterAll },
  { key: "document", label: (d: Dictionary) => d.portal.requests.filterDocuments },
  { key: "task", label: (d: Dictionary) => d.portal.requests.filterTasks },
];

/**
 * One queue: everything Vionex is waiting on.
 *
 * The portal used to split this in two — Action Required for document
 * requests, Tasks for the rest — which asked a manufacturer to know which of
 * our two models their work happens to live in before they could find it.
 * Both are now one list with a type label, and `/supplier/tasks` redirects
 * here with the filter already applied.
 *
 * The mirror task of a document request never appears: the service excludes
 * it, so one pendency is one row.
 */
export default async function ActionRequiredPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const { open, waiting, done } = await listSupplierQueue(user);

  const active = FILTERS.find((filter) => filter.key === params.type) ?? FILTERS[0];
  const matches = (item: QueueItem) =>
    active.key === "all" ||
    (active.key === "document" ? item.type === "DOCUMENT" : item.type === "TASK");

  const visibleOpen = open.filter(matches);
  const visibleWaiting = waiting.filter(matches);
  const visibleDone = done.filter(matches);

  const countFor = (key: string) =>
    key === "all"
      ? open.length
      : open.filter((item) => (key === "document" ? item.type === "DOCUMENT" : item.type === "TASK"))
          .length;

  return (
    <>
      <PageHeader title={dict.portal.requests.title} description={dict.portal.requests.subtitle} />

      <TabsNav
        className="mb-5"
        items={FILTERS.map((filter) => ({
          href:
            filter.key === "all"
              ? "/supplier/action-required"
              : `/supplier/action-required?type=${filter.key}`,
          label: filter.label(dict),
          count: countFor(filter.key),
          active: filter.key === active.key,
        }))}
      />

      {visibleOpen.length === 0 ? (
        <Panel>
          <EmptyState
            icon={CircleCheck}
            title={dict.portal.requests.empty}
            description={dict.portal.requests.emptyDescription}
          />
        </Panel>
      ) : (
        <Panel>
          <ul className="divide-y divide-line-soft">
            {visibleOpen.map((item) => (
              <QueueRow key={item.id} item={item} dict={dict} locale={locale} />
            ))}
          </ul>
        </Panel>
      )}

      {visibleWaiting.length > 0 ? (
        <section className="mt-8">
          <Panel>
            <PanelHeader
              title={dict.portal.requests.underReview}
              description={dict.portal.requests.underReviewHint}
            />
            <ul className="divide-y divide-line-soft">
              {visibleWaiting.map((item) => (
                <QueueRow key={item.id} item={item} dict={dict} locale={locale} muted />
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      {visibleDone.length > 0 ? (
        <section className="mt-8">
          <Panel>
            <PanelHeader title={dict.portal.requests.done} />
            <ul className="divide-y divide-line-soft">
              {visibleDone.map((item) => (
                <QueueRow key={item.id} item={item} dict={dict} locale={locale} muted />
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      {active.key === "task" ? (
        <p className="mt-4 text-[13px] text-muted">{dict.portal.requests.taskHint}</p>
      ) : null}
    </>
  );
}

/**
 * One pendency. The type is stated plainly rather than implied by which page
 * you happened to open.
 */
function QueueRow({
  item,
  dict,
  locale,
  muted = false,
}: {
  item: QueueItem;
  dict: Dictionary;
  locale: Locale;
  muted?: boolean;
}) {
  const remaining = daysUntil(item.dueDate);
  const overdue = remaining !== null && remaining < 0 && item.state === "open";
  const Icon = item.type === "DOCUMENT" ? FileText : ListChecks;
  const status = item.requestStatus ? meta.request(item.requestStatus, dict) : null;

  return (
    <li>
      <Link
        href={item.href}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-subtle"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-sm border",
            muted ? "border-line bg-subtle text-muted" : "border-brand-line bg-brand-soft text-brand-strong",
          )}
        >
          <Icon className="size-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
          <span className="mt-0.5 block truncate text-[13px] text-muted">
            {item.type === "DOCUMENT"
              ? dict.portal.requests.typeDocument
              : dict.portal.requests.typeTask}{" "}
            · {item.project.name}
          </span>
        </span>

        {item.dueDate ? (
          <span
            className={cn(
              "shrink-0 text-[13px] whitespace-nowrap",
              overdue ? "font-medium text-risk" : "text-muted",
            )}
          >
            {overdue ? (
              dict.portal.requests.overdue
            ) : remaining !== null && remaining <= 7 && item.state === "open" ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {remaining === 0
                  ? dict.portal.requests.dueToday
                  : plural(dict.portal.requests.dueInDays, remaining)}
              </span>
            ) : (
              formatDate(item.dueDate, locale)
            )}
          </span>
        ) : null}

        {status ? (
          <span className="shrink-0">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </span>
        ) : null}

        <ArrowRight className="size-4 shrink-0 text-faint" />
      </Link>
    </li>
  );
}
