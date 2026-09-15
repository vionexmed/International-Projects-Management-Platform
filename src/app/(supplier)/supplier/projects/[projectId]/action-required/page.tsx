import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { requireSharedProjectAccess } from "@/server/authz/access";
import { listDocumentRequests } from "@/server/services/documents";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary, plural } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { meta } from "@/lib/labels";
import { daysUntil, formatDate } from "@/lib/format";
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
            const status = meta.request(request.status, dict);
            const remaining = daysUntil(request.dueDate);
            const overdue = remaining !== null && remaining < 0 && request.status === "PENDING";

            return (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{request.title}</p>
                  <p className={cn("mt-0.5 text-[13px]", overdue ? "text-risk" : "text-muted")}>
                    {dict.portal.requests.due} {formatDate(request.dueDate, locale)}
                    {remaining !== null && request.status === "PENDING"
                      ? ` · ${
                          overdue
                            ? dict.portal.requests.overdue
                            : remaining === 0
                              ? dict.portal.requests.dueToday
                              : plural(dict.portal.requests.dueInDays, remaining)
                        }`
                      : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/supplier/action-required/${request.id}`}>
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
