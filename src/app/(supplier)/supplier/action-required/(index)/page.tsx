import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { listSupplierQueue, type QueueItem } from "@/server/services/supplier-queue";
import { PageHeader } from "@/components/app/page-header";
import { TabsNav } from "@/components/app/tabs-nav";
import { Section } from "@/components/ui/section";
import { StatusBadge, StatusIcon } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CellStack,
  Table,
  TableScroll,
  TableShell,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
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
        <TableShell>
          <EmptyState
            icon={StatusIconEmpty}
            title={dict.portal.requests.empty}
            description={dict.portal.requests.emptyDescription}
          />
        </TableShell>
      ) : (
        <QueueTable items={visibleOpen} dict={dict} locale={locale} />
      )}

      {visibleWaiting.length > 0 ? (
        <Section
          title={dict.portal.requests.underReview}
          description={dict.portal.requests.underReviewHint}
          className="mt-8"
        >
          <QueueTable items={visibleWaiting} dict={dict} locale={locale} muted />
        </Section>
      ) : null}

      {visibleDone.length > 0 ? (
        <Section title={dict.portal.requests.done} className="mt-8">
          <QueueTable items={visibleDone} dict={dict} locale={locale} muted />
        </Section>
      ) : null}

      {active.key === "task" ? (
        <p className="mt-4 text-meta text-muted">{dict.portal.requests.taskHint}</p>
      ) : null}
    </>
  );
}

/** A stand-in glyph for the empty state, matching the queue's own iconography. */
function StatusIconEmpty(props: { className?: string }) {
  return <StatusIcon kind="done" size={20} className={props.className} />;
}

/**
 * Compact grid: status as a shape (not a pill), title and type, project, due
 * date, and the request's own workflow badge when it has one.
 */
function QueueTable({
  items,
  dict,
  locale,
  muted = false,
}: {
  items: QueueItem[];
  dict: Dictionary;
  locale: Locale;
  muted?: boolean;
}) {
  return (
    <TableShell>
      <TableScroll>
        <Table>
          <THead>
            <TR>
              <TH>{dict.common.name}</TH>
              <TH>{dict.common.project}</TH>
              <TH>{dict.common.dueDate}</TH>
              <TH>{dict.common.status}</TH>
              <TH className="w-10" />
            </TR>
          </THead>
          <TBody>
            {items.map((item) => (
              <QueueRow key={item.id} item={item} dict={dict} locale={locale} muted={muted} />
            ))}
          </TBody>
        </Table>
      </TableScroll>
    </TableShell>
  );
}

function QueueRow({
  item,
  dict,
  locale,
  muted,
}: {
  item: QueueItem;
  dict: Dictionary;
  locale: Locale;
  muted: boolean;
}) {
  const remaining = daysUntil(item.dueDate);
  const overdue = remaining !== null && remaining < 0 && item.state === "open";
  const status = item.requestStatus ? meta.request(item.requestStatus, dict) : null;
  const typeLabel = item.type === "DOCUMENT" ? dict.portal.requests.typeDocument : dict.portal.requests.typeTask;

  return (
    <TR interactive>
      <TD>
        <Link href={item.href} className="flex min-w-0 items-center gap-2.5 after:absolute after:inset-0 after:content-['']">
          <StatusIcon kind={item.state} />
          <CellStack
            title={
              <span className={cn(muted && "font-normal text-ink-soft")}>{item.title}</span>
            }
            subtitle={typeLabel}
          />
        </Link>
      </TD>
      <TD label={dict.common.project} className="text-meta text-ink-soft">
        {item.project.name}
      </TD>
      <TD
        label={dict.common.dueDate}
        className={cn("text-meta whitespace-nowrap", overdue ? "font-medium text-risk" : "text-ink-soft")}
      >
        {item.dueDate ? (
          overdue ? (
            dict.portal.requests.overdue
          ) : remaining !== null && remaining <= 7 && item.state === "open" ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {remaining === 0 ? dict.portal.requests.dueToday : plural(dict.portal.requests.dueInDays, remaining)}
            </span>
          ) : (
            formatDate(item.dueDate, locale)
          )
        ) : (
          "—"
        )}
      </TD>
      <TD label={dict.common.status}>
        {status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : "—"}
      </TD>
      <TD className="max-md:hidden text-right text-meta font-medium whitespace-nowrap text-brand-strong">
        {item.type === "DOCUMENT" ? dict.portal.requests.openRequest : dict.portal.requests.openProject}
      </TD>
    </TR>
  );
}
