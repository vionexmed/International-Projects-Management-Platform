"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from "@/components/ui/dropdown";

const EXPORTS = [
  { key: "portfolio", title: "Portfólio", description: "Projetos com etapa, status e progresso" },
  { key: "regulatory", title: "Regulatório", description: "Solicitações de documentos e prazos" },
  { key: "suppliers", title: "Fornecedores", description: "Pendências e atrasos por empresa" },
];

/** The CSV exports, in one menu instead of three cards. */
export function ExportMenu() {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant="secondary" size="sm" className="print:hidden">
          <Download />
          Exportar
        </Button>
      </DropdownTrigger>
      <DropdownContent className="w-72">
        <DropdownLabel>CSV, linha a linha</DropdownLabel>
        {EXPORTS.map((item) => (
          <DropdownItem key={item.key} asChild>
            <a href={`/api/reports/${item.key}`} download className="items-start">
              <Download className="mt-0.5" />
              <span className="min-w-0">
                <span className="block font-medium text-ink">{item.title}</span>
                <span className="block text-meta text-muted">{item.description}</span>
              </span>
            </a>
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
