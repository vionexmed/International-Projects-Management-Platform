import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { TableShell } from "@/components/ui/table";
import { PlanList } from "@/features/tasks/plan-list";
import { getDictionary } from "@/lib/i18n/dictionary";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("shared workspace foundation", () => {
  it("names the plan list as a navigable work region", () => {
    const markup = renderToStaticMarkup(
      <PlanList
        groups={[]}
        owners={[]}
        editable={false}
        projectId="project-1"
        columns={[]}
        dict={getDictionary("pt-BR")}
      />,
    );

    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-label="Plano de trabalho"');
    expect(markup).not.toContain("Tarefas por etapa");
  });

  it("keeps controls and empty-state action labelled", () => {
    const markup = renderToStaticMarkup(
      <>
        <Button type="button">Criar tarefa</Button>
        <Input aria-label="Buscar tarefas" />
        <EmptyState title="Nenhuma tarefa" action={<Button type="button">Adicionar tarefa</Button>} />
      </>,
    );

    expect(markup).toContain("Criar tarefa");
    expect(markup).toContain('aria-label="Buscar tarefas"');
    expect(markup).toContain("Nenhuma tarefa");
    expect(markup).toContain("Adicionar tarefa");
  });

  it("keeps workspace toolbar menus outside an overflow clipping ancestor", () => {
    const markup = renderToStaticMarkup(
      <TableShell variant="workspace">
        <details><summary>Colunas</summary><div className="absolute">Criar coluna</div></details>
      </TableShell>,
    );

    const outerClass = markup.match(/^<div class="([^"]+)"/)?.[1] ?? "";
    expect(markup).toContain("Colunas");
    expect(outerClass).not.toContain("overflow-hidden");
  });
});
