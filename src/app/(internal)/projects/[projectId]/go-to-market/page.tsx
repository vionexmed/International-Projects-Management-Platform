import { Megaphone } from "lucide-react";
import type { GtmCategory } from "@/generated/prisma";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { db } from "@/server/db";
import { Panel } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { GtmItemDialog } from "@/features/projects/gtm-item-dialog";
import { StatusMenu, type StatusOption } from "@/components/app/status-menu";
import { CanvasList, CanvasRow } from "@/features/projects/canvas-list";
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

  // The launch date is in the record header; this page is about the checklist.
  return (
    <Section
      title="Itens de lançamento"
      count={items.length > 0 ? `${completed} de ${items.length} concluídos` : undefined}
      action={editable ? <GtmItemDialog projectId={projectId} /> : null}
    >
      {grouped.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Megaphone}
            title="Nenhum item de Go-to-Market."
            description="Adicione itens para acompanhar estratégia, preço, canais e lançamento."
          />
        </Panel>
      ) : (
        <>
          <ProgressBar
            value={progress}
            tone={progress === 100 ? "ok" : "neutral"}
            label="Progresso do Go-to-Market"
            className="mb-8 max-w-md"
          />

          <div className="space-y-8">
            {grouped.map((group) => (
              <div key={group.category}>
                <h3 className="mb-2 text-title text-ink-soft">
                  {label.gtmCategory(group.category, dict)}
                </h3>
                <CanvasList>
                  {group.items.map((item) => (
                    <CanvasRow
                      key={item.id}
                      href={`/tasks/${item.id}`}
                      title={item.title}
                      subtitle={[
                        item.description,
                        item.assignedTo?.name,
                        item.dueDate ? formatDateShort(item.dueDate, locale) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      trailing={
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
                      }
                    />
                  ))}
                </CanvasList>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
