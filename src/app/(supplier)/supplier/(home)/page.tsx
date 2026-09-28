import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CircleCheck, Clock } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { listSupplierQueue } from "@/server/services/supplier-queue";
import { listProjects } from "@/server/services/projects";
import { listNotifications } from "@/server/services/notifications";
import { Panel } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary, interpolate, plural } from "@/lib/i18n/dictionary";
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

/**
 * "What is my situation right now?"
 *
 * A summary, and deliberately not a second Action Required. It says how much
 * is waiting, when the nearest deadline is, which projects exist and what
 * changed recently — then hands off. No list here is complete, and none of
 * them can be worked from: every one ends in a link to the page that can.
 *
 * One focal element: the action card. Projects and updates are the quiet,
 * un-boxed rest of the page — a supplier arriving here should see exactly one
 * thing demanding a decision, not three panels of equal weight.
 */
export default async function SupplierHomePage() {
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [queue, projects, updates] = await Promise.all([
    listSupplierQueue(user),
    listProjects(user, { perPage: 4 }),
    listNotifications(user.id, 4),
  ]);

  const openCount = queue.open.length;
  const topOpen = queue.open.slice(0, 3);
  // A date already behind us is not a "next deadline" — when anything is late,
  // that is what the card says, in the only colour reserved for problems.
  const overdueCount = queue.open.filter((item) => {
    const remaining = daysUntil(item.dueDate);
    return remaining !== null && remaining < 0;
  }).length;
  const nextUpcoming = queue.open.find((item) => (daysUntil(item.dueDate) ?? -1) >= 0);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-[820px]">
      <h1 className="text-page text-ink">
        {interpolate(dict.portal[greetingKey(new Date().getHours())], { name: firstName })}
      </h1>
      <p className="mt-1.5 mb-8 text-body text-muted">{dict.portal.welcome}</p>

      {/* The one focal element: what Vionex needs, and how to act on it. */}
      <Panel variant="focal" className="mb-10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-section text-ink">{dict.portal.home.actionRequiredTitle}</h2>
            {openCount === 0 ? (
              <p className="mt-1 flex items-center gap-2 text-body text-ink-soft">
                <CircleCheck className="size-4 shrink-0 text-ok" />
                {dict.portal.home.actionRequiredEmpty}
              </p>
            ) : (
              <p className="mt-1 text-body text-ink-soft">
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
              </p>
            )}
          </div>
          {openCount > 0 ? (
            <Button variant="primary" asChild>
              <Link href="/supplier/action-required">
                {dict.portal.home.viewRequests}
                <ArrowRight />
              </Link>
            </Button>
          ) : null}
        </div>

        {openCount > 0 ? (
          <ul className="mt-4 divide-y divide-brand-line/40 border-t border-brand-line/40">
            {topOpen.map((item) => {
              const remaining = daysUntil(item.dueDate);
              const overdue = remaining !== null && remaining < 0;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 transition-colors hover:opacity-80"
                  >
                    <span className="min-w-0 flex-1 truncate text-body text-ink">
                      {item.title}
                      <span className="text-ink-soft"> · {item.project.name}</span>
                    </span>
                    {item.dueDate ? (
                      <span
                        className={cn(
                          "shrink-0 text-meta whitespace-nowrap",
                          overdue ? "font-medium text-risk" : "text-muted",
                        )}
                      >
                        {overdue ? (
                          dict.portal.requests.overdue
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="size-3.5" />
                            {formatDate(item.dueDate, locale)}
                          </span>
                        )}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Panel>

      {/* Projects — the short version; the list lives on its own page. */}
      {projects.items.length > 0 ? (
        <Section
          title={dict.portal.home.activeProjects}
          action={{ label: dict.portal.home.viewProjects, href: "/supplier/projects" }}
          className="mb-10"
        >
          <ul className="divide-y divide-line-soft">
            {projects.items.map((project) => {
              const status = meta.project(project.status, dict);
              return (
                <li key={project.id}>
                  <Link
                    href={`/supplier/projects/${project.id}`}
                    className="-mx-2 flex flex-wrap items-center justify-between gap-3 rounded-sm px-2 py-3 transition-colors hover:bg-subtle"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-body font-medium text-ink">{project.name}</p>
                      <p className="mt-0.5 text-meta text-muted">
                        {label.stageKey(project.currentStage, dict)}
                      </p>
                    </div>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

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
