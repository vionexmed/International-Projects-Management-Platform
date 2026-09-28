import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CircleCheck, Clock } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { listSupplierQueue } from "@/server/services/supplier-queue";
import { listProjects } from "@/server/services/projects";
import { listNotifications } from "@/server/services/notifications";
import { markNotificationReadAction } from "@/server/actions/notifications";
import { Panel } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Greeting } from "@/features/supplier-portal/greeting";
import { StageProgressBar } from "@/features/supplier-portal/stage-progress-bar";
import { stageBarLabels } from "@/features/supplier-portal/portal-labels";
import { DUE_TONE_CLASS, dueLabel } from "@/features/supplier-portal/due-label";
import { getDictionary, interpolate, plural } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { daysUntil, formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

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
    listProjects(user, { perPage: 5 }),
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
  const barLabels = stageBarLabels(dict);

  return (
    <div className="mx-auto max-w-[820px]">
      <Greeting
        name={firstName}
        className="text-page text-ink"
        labels={{
          neutral: dict.portal.greetingNeutral,
          morning: dict.portal.greetingMorning,
          afternoon: dict.portal.greetingAfternoon,
          evening: dict.portal.greetingEvening,
        }}
      />
      <p className="mt-1.5 mb-8 text-body text-muted">{dict.portal.welcome}</p>

      {/* The one focal element: what Vionex needs, and how to act on it. */}
      <Panel variant="focal" className="mb-10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-section text-ink">{dict.portal.home.actionRequiredTitle}</h2>
            {openCount === 0 ? (
              <>
                <p className="mt-1 flex items-center gap-2 text-body font-medium text-ink">
                  <CircleCheck className="size-4 shrink-0 text-ok" aria-hidden />
                  {dict.portal.home.actionRequiredEmpty}
                </p>
                <p className="mt-0.5 pl-6 text-meta text-muted">
                  {dict.portal.home.actionRequiredEmptyHint}
                </p>
              </>
            ) : (
              <p className="mt-1 text-body text-ink-soft">
                {plural(dict.portal.home.actionRequiredCount, openCount)}
                {overdueCount > 0 ? (
                  <>
                    {" · "}
                    <span className="font-medium text-risk">
                      {plural(dict.portal.home.overdueCount, overdueCount)}
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
              const due = dueLabel(item.dueDate, dict, locale);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="group flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-body text-ink max-sm:basis-full max-sm:whitespace-normal group-hover:underline group-hover:decoration-brand-line group-hover:underline-offset-4">
                      {item.title}
                      <span className="text-ink-soft"> · {item.project.name}</span>
                    </span>
                    {due ? (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 text-meta whitespace-nowrap",
                          DUE_TONE_CLASS[due.tone],
                        )}
                      >
                        {due.tone === "overdue" ? null : <Clock className="size-3.5" aria-hidden />}
                        {due.text}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
            {openCount > topOpen.length ? (
              <li>
                <Link
                  href="/supplier/action-required"
                  className="flex min-h-11 items-center py-2.5 text-meta font-medium text-brand-strong hover:underline"
                >
                  {plural(dict.portal.home.moreRequests, openCount - topOpen.length)}
                </Link>
              </li>
            ) : null}
          </ul>
        ) : null}
      </Panel>

      {/* Projects — the short version; the list lives on its own page. */}
      {projects.items.length > 0 ? (
        <Section
          title={dict.portal.home.activeProjects}
          count={projects.total}
          action={{ label: dict.portal.home.viewProjects, href: "/supplier/projects" }}
          className="mb-10"
        >
          <ul className="divide-y divide-line-soft">
            {projects.items.map((project) => {
              const status = meta.project(project.status, dict);
              return (
                <li
                  key={project.id}
                  className="relative -mx-2 rounded-sm px-2 pt-3 pb-1.5 transition-colors hover:bg-subtle md:pb-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* The name is the row's link; its overlay makes the whole row clickable. */}
                      <Link
                        href={`/supplier/projects/${project.id}`}
                        className="block truncate text-body font-medium text-ink after:absolute after:inset-0 after:content-['']"
                      >
                        {project.name}
                      </Link>
                      <p className="mt-0.5 text-meta text-muted">
                        {interpolate(dict.portal.home.nowIn, {
                          stage: label.stageKey(project.currentStage, dict),
                        })}
                        {" · "}
                        <span className="tabular-nums">
                          {interpolate(dict.portal.home.overallProgress, {
                            percent: project.progress,
                          })}
                        </span>
                      </p>
                    </div>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </div>
                  {/* Above the row overlay, so each segment is its own target. */}
                  <StageProgressBar
                    projectId={project.id}
                    stages={project.stages}
                    currentStage={project.currentStage}
                    labels={barLabels}
                    className="relative z-10 mt-1 max-w-[560px]"
                  />
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <Section
        title={dict.portal.home.updatesTitle}
        action={
          updates.length > 0
            ? { label: dict.portal.home.viewAllUpdates, href: "/supplier/notifications" }
            : undefined
        }
      >
        {updates.length === 0 ? (
          <EmptyState icon={Bell} title={dict.portal.home.updatesEmpty} compact />
        ) : (
          <ul className="divide-y divide-line-soft">
            {updates.map((update) => {
              const body = (
                <span className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      update.readAt ? "bg-transparent" : "bg-brand",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-body text-ink",
                        update.readAt ? "font-normal" : "font-medium",
                      )}
                    >
                      {update.title}
                    </span>
                    {update.description ? (
                      <span className="mt-0.5 block text-meta text-muted">{update.description}</span>
                    ) : null}
                    <span className="mt-1 block text-meta text-faint">
                      {formatRelative(update.createdAt, locale)}
                    </span>
                  </span>
                </span>
              );

              return (
                <li key={update.id}>
                  {update.href ? (
                    // Following an update marks it read on the way, so the bell
                    // in the header clears instead of staying lit.
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={update.id} />
                      <input type="hidden" name="href" value={update.href} />
                      <button
                        type="submit"
                        className="-mx-2 block w-[calc(100%+1rem)] rounded-sm px-2 py-3 text-left transition-colors hover:bg-subtle"
                      >
                        {body}
                      </button>
                    </form>
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
