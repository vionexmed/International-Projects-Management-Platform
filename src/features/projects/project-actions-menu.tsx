"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  FileText,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { FormDialog } from "@/components/app/form-dialog";
import { setProjectArchivedAction } from "@/server/actions/projects";

/**
 * Archiving is a confirmation, not a menu click.
 *
 * It is the only action in the product that makes a project disappear from
 * every list, so it is worth one deliberate step — and worth saying plainly
 * what it does and does not do: nothing is deleted, the supplier stops seeing
 * the project, and it can be reopened.
 *
 * The dialog is driven from the outside because a dropdown item cannot host a
 * trigger: the menu unmounts the moment it is selected, taking the trigger with
 * it.
 */
export function ProjectActionsMenu({
  projectId,
  archived = false,
  canArchive = false,
}: {
  projectId: string;
  archived?: boolean;
  canArchive?: boolean;
}) {
  const [confirming, setConfirming] = React.useState(false);

  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Ações do projeto">
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownLabel>Ações do projeto</DropdownLabel>
          <DropdownItem asChild>
            <Link href={`/projects/${projectId}/tasks`}>
              <ListChecks />
              Ver tarefas
            </Link>
          </DropdownItem>
          <DropdownItem asChild>
            <Link href={`/projects/${projectId}/regulatory`}>
              <ShieldCheck />
              Solicitar documento
            </Link>
          </DropdownItem>
          <DropdownItem asChild>
            <Link href={`/projects/${projectId}/documents`}>
              <FileText />
              Enviar documento
            </Link>
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem asChild>
            <Link href={`/projects/${projectId}/messages`}>
              <MessageSquare />
              Abrir conversa
            </Link>
          </DropdownItem>

          {canArchive ? (
            <>
              <DropdownSeparator />
              <DropdownItem onSelect={() => setConfirming(true)}>
                {archived ? <ArchiveRestore /> : <Archive />}
                {archived ? "Reabrir projeto" : "Arquivar projeto"}
              </DropdownItem>
            </>
          ) : null}
        </DropdownContent>
      </Dropdown>

      {canArchive ? (
        <FormDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={archived ? "Reabrir projeto" : "Arquivar projeto"}
          description={
            archived
              ? "O projeto volta ao portfólio e o fornecedor passa a enxergá-lo de novo."
              : "O projeto sai das listas e do portal do fornecedor. Nada é apagado, e você pode reabri-lo quando quiser."
          }
          action={setProjectArchivedAction}
          submitLabel={archived ? "Reabrir" : "Arquivar"}
          successMessage={archived ? "Projeto reaberto." : "Projeto arquivado."}
          // An archived project leaves the default scope, so the page behind
          // this dialog stops existing. Send the user somewhere that does.
          redirectTo={() => (archived ? "/projects" : "/projects?tab=ARCHIVED")}
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="archived" value={archived ? "false" : "true"} />
        </FormDialog>
      ) : null}
    </>
  );
}
