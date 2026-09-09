import { requireInternalUser } from "@/server/auth/current-user";
import { countUnread } from "@/server/services/notifications";
import { countUnreadMessages } from "@/server/services/messages";
import { db } from "@/server/db";
import { taskScope } from "@/server/authz/scopes";
import { InternalSidebar } from "@/components/app/internal-sidebar";
import { InternalMobileNav } from "@/components/app/internal-mobile-nav";
import { CommandPalette } from "@/components/app/command-palette";
import { Topbar } from "@/components/app/topbar";
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

  const [notificationCount, messageCount, openTasks] = await Promise.all([
    countUnread(user.id),
    countUnreadMessages(user),
    db.task.count({
      where: {
        AND: [taskScope(user), { assignedToId: user.id, status: { notIn: ["COMPLETED", "CANCELLED"] } }],
      },
    }),
  ]);

  return (
    <div className="flex min-h-dvh bg-canvas">
      <InternalSidebar
        user={user}
        roleLabel={label.role(user.role, dict)}
        notificationCount={notificationCount}
        taskCount={openTasks}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          notificationCount={notificationCount}
          messageCount={messageCount}
          leading={
            <>
              <InternalMobileNav
                user={user}
                roleLabel={label.role(user.role, dict)}
                notificationCount={notificationCount}
                taskCount={openTasks}
              />
              <CommandPalette
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
            </>
          }
        />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
          <div className="mx-auto w-full max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
