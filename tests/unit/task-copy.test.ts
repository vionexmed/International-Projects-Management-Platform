import { describe, expect, it } from "vitest";
import { SUPPLIER_TASK_HINT } from "@/features/tasks/new-task-dialog";

describe("supplier task guidance", () => {
  it("distinguishes generic uploads from reviewed document requests", () => {
    expect(SUPPLIER_TASK_HINT).toContain("Documentos");
    expect(SUPPLIER_TASK_HINT).toContain("não conclui a tarefa");
    expect(SUPPLIER_TASK_HINT).toContain("solicitação de documento formal");
  });
});
