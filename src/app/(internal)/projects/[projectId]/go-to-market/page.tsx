import { Megaphone } from "lucide-react";
import type { GtmCategory } from "@/generated/prisma";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { db } from "@/server/db";
import { WorkBlock, DenseList, DenseRow } from "@/features/projects/work-block";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { GtmItemDialog } from "@/features/projects/gtm-item-dialog";
import { StatusMenu, type StatusOption } from "@/components/app/status-menu";
import { updateGtmItemAction } from "@/server/actions/stages";
import { orNotFound } from "@/server/authz/rsc";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label, meta } from "@/lib/labels";
import { formatDateShort } from "@/lib/format";
import { toPercent } from "@/lib/utils";

export default async function ProjectGoToMarketPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  await orNotFound(requireProjectAccess(user, projectId));

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

  const statusOptions: StatusOption[] = OPTIONS.taskStatus.map((value) => ({
    value,
    ...meta.task(value, dict),
  }));

  // The launch date is in the overview; this page is about the checklist.
  return (
    <WorkBlock
      title="Itens de lançamento"
      count={items.length > 0 ? `${completed} de ${items.length} concluídos` : undefined}
      action={editable ? <GtmItemDialog projectId={projectId} /> : null}
    >
      {grouped.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhum item de Go-to-Market."
          description="Adicione itens para acompanhar estratégia, preço, canais e lançamento."
        />
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-line-faint px-4 py-3">
            <ProgressBar
              value={progress}
              tone={progress === 100 ? "ok" : "neutral"}
              label="Progresso do Go-to-Market"
              barClassName="h-1.5"
              className="max-w-md"
            />
            <span className="text-meta font-semibold text-ink tabular-nums">{progress}%</span>
          </div>

          {/* Each category is a phase row with its items under it, like the plan. */}
          {grouped.map((group) => (
            <div key={group.category}>
              <h3 className="flex h-10 items-center gap-2 border-b border-line-faint bg-subtle px-4 text-body font-semibold text-ink">
                {label.gtmCategory(group.category, dict)}
                <span className="text-meta font-normal text-muted tabular-nums">
                  {group.items.filter((item) => item.status === "COMPLETED").length}/{group.items.length}
                </span>
              </h3>
              <DenseList className="border-b border-line-faint last:border-b-0">
                {group.items.map((item) => (
                  <DenseRow
                    key={item.id}
                    href={`/tasks/${item.id}`}
                    className="pl-10"
                    title={item.title}
                    meta={[item.description, item.assignedTo?.name].filter(Boolean).join(" · ")}
                    trailing={
                      <>
                        <span className="hidden w-12 text-right tabular-nums sm:inline">
                          {item.dueDate ? formatDateShort(item.dueDate, locale) : ""}
                        </span>
                        <StatusMenu
                          action={updateGtmItemAction}
                          hidden={{ projectId, itemId: item.id }}
                          name="status"
                          value={item.status}
                          options={statusOptions}
                          ariaLabel={`Status de ${item.title}`}
                          readOnly={!editable}
                          align="end"
                        />
                      </>
                    }
                  />
                ))}
              </DenseList>
            </div>
          ))}
        </>
      )}
    </WorkBlock>
  );
}
