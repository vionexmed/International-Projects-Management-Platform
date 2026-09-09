import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { listDocumentRequests } from "@/server/services/documents";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary, interpolate, plural } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { daysUntil, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Action Required" };

/**
 * The heart of the Supplier Portal: one card per request, each stating what is
 * needed, by when, and a single way forward.
 */
export default async function ActionRequiredPage() {
  const user = await requireSupplierUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const requests = await listDocumentRequests(user);
  const open = requests.filter((request) => ["PENDING", "REJECTED"].includes(request.status));
  const closed = requests.filter((request) => !["PENDING", "REJECTED"].includes(request.status));

  return (
    <>
      <PageHeader title={dict.portal.requests.title} description={dict.portal.requests.subtitle} />

      {open.length === 0 ? (
        <Panel>
          <EmptyState
            icon={CircleCheck}
            title={dict.portal.requests.empty}
            description={dict.portal.requests.emptyDescription}
          />
        </Panel>
      ) : (
        <ul className="space-y-4">
          {open.map((request) => {
            const status = meta.request(request.status, dict);
            const remaining = daysUntil(request.dueDate);
            const overdue = remaining !== null && remaining < 0;

            return (
              <li key={request.id}>
                <Panel className="p-5 transition-colors hover:border-line-strong">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[15px] font-semibold text-ink">{request.title}</h2>
                      <p className="mt-1 text-[13px] text-muted">
                        {request.project.name} · {label.documentType(request.type, dict)}
                      </p>

                      {request.description ? (
                        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                          {request.description}
                        </p>
                      ) : null}

                      <dl className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-[13px]">
                        <div>
                          <dt className="text-muted">{dict.portal.requests.requestedBy}</dt>
                          <dd className="mt-0.5 font-medium text-ink">{request.requestedBy.name}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">{dict.portal.requests.due}</dt>
                          <dd
                            className={cn(
                              "mt-0.5 font-medium",
                              overdue ? "text-risk" : "text-ink",
                            )}
                          >
                            {formatDate(request.dueDate, locale)}
                            {remaining !== null ? (
                              <span className="ml-1.5 font-normal">
                                ·{" "}
                                {overdue
                                  ? dict.portal.requests.overdue
                                  : remaining === 0
                                    ? dict.portal.requests.dueToday
                                    : plural(dict.portal.requests.dueInDays, remaining)}
                              </span>
                            ) : null}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">{dict.common.status}</dt>
                          <dd className="mt-0.5">
                            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <Button variant="primary" asChild>
                      <Link href={`/supplier/action-required/${request.id}`}>
                        {dict.portal.requests.openRequest}
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}

      {closed.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">
            {dict.portal.requests.history}
          </h2>
          <Panel>
            <ul className="divide-y divide-line-soft">
              {closed.map((request) => {
                const status = meta.request(request.status, dict);
                return (
                  <li key={request.id}>
                    <Link
                      href={`/supplier/action-required/${request.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-subtle"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{request.title}</p>
                        <p className="mt-0.5 truncate text-[13px] text-muted">
                          {request.project.name}
                          {request.submittedAt
                            ? ` · ${interpolate(dict.portal.requests.submittedOn, {
                                date: formatDate(request.submittedAt, locale),
                              })}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </section>
      ) : null}
    </>
  );
}
