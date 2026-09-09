"use client";

import Link from "next/link";
import { FileText, ListChecks, MessageSquare, MoreHorizontal, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";

export function ProjectActionsMenu({ projectId }: { projectId: string }) {
  return (
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
      </DropdownContent>
    </Dropdown>
  );
}
