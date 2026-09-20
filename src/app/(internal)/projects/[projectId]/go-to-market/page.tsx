import Link from "next/link";
import { Megaphone } from "lucide-react";
import type { GtmCategory } from "@/generated/prisma";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { db } from "@/server/db";
import { Panel, PanelHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { GtmItemDialog } from "@/features/projects/gtm-item-dialog";
import { InlineStatusSelect } from "@/features/projects/inline-status-select";
import { updateGtmItemAction } from "@/server/actions/stages";
import { orNotFound } from "@/server/authz/rsc";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label, meta } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { toPercent } from "@/lib/utils";
import type { TaskStatus } from "@/server/services/tasks";

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Aberto" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "WAITING", label: "Aguardando" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "CANCELLED", label: "Cancelado" },
];

export default async function ProjectGoToMarketPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  const project = await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const editable = can(user, "gtm:manage");

  const items = await db.task.findMany({
    where: { projectId, category: "GO_TO_MARKET" },
    include: { assignedTo: { select: { name: true } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  const completed = items.filter((item) => item.status === "COMPLETED").length;
  const progress = items.length === 0 ? 0 : toPercent((completed / items.length) * 100);

  const grouped = OPTIONS.gtmCategory
    .map((category: GtmCategory) => ({
      category,
      items: items.filter((item) => item.gtmCategory === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          title="Go-to-Market"
          description={`Lançamento previsto para ${formatDate(project.targetLaunchDate, locale)}.`}
          action={editable ? <GtmItemDialog projectId={projectId} /> : null}
        />
        <div className="p-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-ink-soft">
              {completed} de {items.length} itens concluídos
            </span>
            <span className="text-[13px] font-semibold text-ink tabular-nums">{progress}%</span>
          </div>
          <ProgressBar value={progress} label="Progresso do Go-to-Market" />
        </div>
      </Panel>

      {grouped.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Megaphone}
            title="Nenhum item de Go-to-Market."
            description="Adicione itens para acompanhar estratégia, preço, canais e lançamento."
          />
        </Panel>
      ) : (
        grouped.map((group) => (
          <Panel key={group.category}>
            <PanelHeader title={label.gtmCategory(group.category, dict)} />
            <ul className="divide-y divide-line-soft">
              {group.items.map((item) => {
                const status = meta.task(item.status as TaskStatus, dict);
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <Link href={`/tasks/${item.id}`} className="truncate text-sm font-medium text-ink hover:underline">
                        {item.title}
                      </Link>
                      {item.description || item.assignedTo?.name || item.dueDate ? (
                        <p className="mt-0.5 truncate text-[13px] text-muted">
                          {[
                            item.description,
                            item.assignedTo?.name,
                            item.dueDate ? formatDate(item.dueDate, locale) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0">
                      {editable ? (
                        <InlineStatusSelect
                          action={updateGtmItemAction}
                          hidden={{ projectId, itemId: item.id }}
                          name="status"
                          value={item.status}
                          options={STATUS_OPTIONS}
                          ariaLabel={`Status de ${item.title}`}
                        />
                      ) : (
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))
      )}
    </div>
  );
}
