import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CircleCheck } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { countSupplierQueue } from "@/server/services/supplier-queue";
import { listProjects } from "@/server/services/projects";
import { listNotifications } from "@/server/services/notifications";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary, interpolate, plural } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDate, formatRelative } from "@/lib/format";

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
 */
export default async function SupplierHomePage() {
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [queue, projects, updates] = await Promise.all([
    countSupplierQueue(user),
    listProjects(user, { perPage: 4 }),
    listNotifications(user.id, 4),
  ]);

  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">
        {interpolate(dict.portal[greetingKey(new Date().getHours())], { name: firstName })}
      </h1>
      <p className="mt-1.5 mb-8 text-[15px] text-muted">{dict.portal.welcome}</p>

      {/* The situation, in one panel. */}
      <Panel className="mb-6">
        <PanelHeader title={dict.portal.home.actionRequiredTitle} />
        <div className="p-5">
          {queue.open === 0 ? (
            <div className="flex items-center gap-3">
              <CircleCheck className="size-5 shrink-0 text-ok" />
              <p className="text-sm text-ink">{dict.portal.home.actionRequiredEmpty}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink">
                {plural(dict.portal.home.actionRequiredCount, queue.open)}
              </p>
              <p className="mt-1.5 text-[13px] text-muted">
                {dict.portal.home.nextDue}:{" "}
                <span className="font-medium text-ink">
                  {queue.nextDueDate
                    ? formatDate(queue.nextDueDate, locale)
                    : dict.portal.home.noDueDate}
                </span>
              </p>
              <Button variant="primary" className="mt-4" asChild>
                <Link href="/supplier/action-required">
                  {dict.portal.home.viewRequests}
                  <ArrowRight />
                </Link>
              </Button>
            </>
          )}
        </div>
      </Panel>

      {/* Projects — the short version; the list lives on its own page. */}
      {projects.items.length > 0 ? (
        <Panel className="mb-6">
          <PanelHeader
            title={dict.portal.home.activeProjects}
            action={
              <Link
                href="/supplier/projects"
                className="text-[13px] font-medium text-brand-strong hover:underline"
              >
                {dict.portal.home.viewProjects}
              </Link>
            }
          />
          <ul className="divide-y divide-line-soft">
            {projects.items.map((project) => {
              const status = meta.project(project.status, dict);
              return (
                <li key={project.id}>
                  <Link
                    href={`/supplier/projects/${project.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-subtle"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{project.name}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {label.stageKey(project.currentStage, dict)}
                      </p>
                    </div>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title={dict.portal.home.updatesTitle} />
        {updates.length === 0 ? (
          <EmptyState icon={Bell} title={dict.portal.home.updatesEmpty} compact />
        ) : (
          <ul className="divide-y divide-line-soft">
            {updates.map((update) => {
              const body = (
                <>
                  <p className="text-sm font-medium text-ink">{update.title}</p>
                  {update.description ? (
                    <p className="mt-0.5 text-[13px] text-muted">{update.description}</p>
                  ) : null}
                  <p className="mt-1 text-[12px] text-faint">
                    {formatRelative(update.createdAt, locale)}
                  </p>
                </>
              );

              return (
                <li key={update.id}>
                  {update.href ? (
                    <Link
                      href={update.href}
                      className="block px-5 py-4 transition-colors hover:bg-subtle"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="px-5 py-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
