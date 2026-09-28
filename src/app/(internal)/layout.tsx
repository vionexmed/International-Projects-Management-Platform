import Link from "next/link";
import { requireInternalUser } from "@/server/auth/current-user";
import { countUnread } from "@/server/services/notifications";
import { db } from "@/server/db";
import { taskScope } from "@/server/authz/scopes";
import { InternalSidebar } from "@/components/app/internal-sidebar";
import { InternalMobileNav } from "@/components/app/internal-mobile-nav";
import { CommandPalette, SearchTrigger } from "@/components/app/command-palette";
import { VionexLogo } from "@/components/app/logo";
import { Topbar } from "@/components/app/topbar";
import { DemoBanner } from "@/components/app/demo-banner";
import { NavMemory } from "@/components/app/nav-memory";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label } from "@/lib/labels";

/**
 * Server-side gate for the whole internal environment. Every page below this
 * layout is guaranteed to have an authenticated Vionex user; supplier accounts
 * are redirected to their own portal.
 */
export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInternalUser();
  const dict = getDictionary(localeFromLanguage(user.language));

  const [notificationCount, openTasks] = await Promise.all([
    countUnread(user.id),
    db.task.count({
      where: {
        AND: [taskScope(user), { assignedToId: user.id, status: { notIn: ["COMPLETED", "CANCELLED"] } }],
      },
    }),
  ]);

  const roleLabel = label.role(user.role, dict);

  /*
    Shell: a 48-px icon rail (or the pinned 232-px sidebar) on the left and
    the page to its right, full width with a 24-px gutter — pages that read
    better narrow constrain themselves. There is no top bar from `lg` up;
    below it a slim header carries the menu, search and the bell.
  */
  return (
    <>
      <DemoBanner />
      {/* Lets breadcrumbs and back arrows return to a list exactly as it was left. */}
      <NavMemory />
      <div className="flex min-h-dvh bg-canvas">
        <InternalSidebar
          user={user}
          roleLabel={roleLabel}
          notificationCount={notificationCount}
          taskCount={openTasks}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            notificationCount={notificationCount}
            leading={
              <>
                <InternalMobileNav
                  user={user}
                  roleLabel={roleLabel}
                  notificationCount={notificationCount}
                  taskCount={openTasks}
                />
                <Link href="/dashboard" className="rounded-sm px-1">
                  <VionexLogo width={84} subtitle={null} />
                </Link>
              </>
            }
            actions={<SearchTrigger label="Buscar" />}
          />
          {/* One palette for the whole shell; the rail and header open it. */}
          <CommandPalette
            trigger="none"
            labels={{
              placeholder: "Buscar…",
              empty: "Nenhum resultado encontrado.",
              hint: "Busque projetos, tarefas, documentos e fornecedores.",
              groups: {
                project: "Projeto",
                task: "Tarefa",
                document: "Documento",
                supplier: "Fornecedor",
              },
            }}
          />
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
    </>
  );
}
