import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { requireSharedProjectAccess } from "@/server/authz/access";
import { listDocumentRequests, type RequestStatus } from "@/server/services/documents";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { meta } from "@/lib/labels";
import { DUE_TONE_CLASS, dueLabel } from "@/features/supplier-portal/due-label";
import { cn } from "@/lib/utils";

export default async function SupplierProjectRequestsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireSupplierUser();
  await orNotFound(requireSharedProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const requests = await listDocumentRequests(user, { projectId });

  return (
    <Panel>
      <PanelHeader title={dict.portal.requests.title} description={dict.portal.requests.subtitle} />

      {requests.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title={dict.portal.requests.empty}
          description={dict.portal.requests.emptyDescription}
          compact
        />
      ) : (
        <ul className="divide-y divide-line-soft">
          {requests.map((request) => {
            const open = request.status === "PENDING" || request.status === "REJECTED";
            const status =
              request.status === "REJECTED"
                ? { label: dict.portal.requests.changesRequested, tone: "warn" as const }
                : meta.request(request.status as RequestStatus, dict);
            const due = dueLabel(request.dueDate, dict, locale, { open });

            return (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-ink">{request.title}</p>
                  {due ? (
                    <p className={cn("mt-0.5 text-meta", DUE_TONE_CLASS[due.tone])}>{due.text}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  <Button variant={open ? "primary" : "secondary"} size="sm" asChild>
                    <Link
                      href={`/supplier/action-required/${request.id}`}
                      aria-label={`${dict.common.open}: ${request.title}`}
                    >
                      {dict.common.open}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
