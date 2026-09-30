import { describe, expect, it } from "vitest";
import { normalize, understand, type Catalog } from "@/lib/assistant/understand";

const catalog: Catalog = {
  projects: [
    { id: "p-alpha", name: "Product Alpha", code: "VX-001" },
    { id: "p-beta", name: "Product Beta", code: "VX-002" },
    { id: "p-zeta", name: "Product Zeta", code: "VX-006" },
  ],
  suppliers: [
    { id: "s-a", name: "Manufacturer A" },
    { id: "s-b", name: "Manufacturer B" },
  ],
  people: [
    { id: "u-stefany", name: "Stefany Rocha" },
    { id: "u-maria", name: "Maria Santos" },
  ],
};

describe("assistant — understanding a question", () => {
  it("normalizes accents, case and punctuation", () => {
    expect(normalize("  Como está o Projeto?! ")).toBe("como esta o projeto");
  });

  it.each([
    ["Como está o Product Alpha?", "status", "p-alpha"],
    ["status do alpha", "status", "p-alpha"],
    ["resumo do VX-002", "status", "p-beta"],
    ["vx 6", "status", "p-zeta"],
    ["o que falta no zeta?", "needs", "p-zeta"],
    ["quais tarefas estão atrasadas no beta", "overdue", "p-beta"],
    ["próximos marcos do alpha", "milestones", "p-alpha"],
    ["o que aconteceu no alpha essa semana", "activity", "p-alpha"],
    ["documentos pendentes do alpha", "documents", "p-alpha"],
  ])("reads %j as %s about a project", (question, intent, projectId) => {
    const result = understand(question, catalog);
    expect(result.intent).toBe(intent);
    expect(result.projectId).toBe(projectId);
  });

  it("finds a company by its full name, not by a generic word", () => {
    expect(understand("o que a Manufacturer A deve enviar?", catalog)).toMatchObject({ intent: "documents", supplierId: "s-a" });
    expect(understand("como está a manufacturer b", catalog)).toMatchObject({ intent: "status", supplierId: "s-b" });
    expect(understand("qual manufacturer está atrasado?", catalog).supplierId).toBeUndefined();
  });

  it("prefers the project when a question names both", () => {
    const result = understand("documentos do Product Alpha da Manufacturer A", catalog);
    expect(result.projectId).toBe("p-alpha");
    expect(result.supplierId).toBeUndefined();
  });

  it.each([
    ["o que tenho para analisar?", "review"],
    ["tem algo bloqueado?", "blocked"],
    ["o que vence essa semana", "deadlines"],
    ["minhas tarefas", "mine"],
    ["minhas tarefas atrasadas", "overdue"],
    ["visão geral do portfólio", "portfolio"],
    ["oi", "greeting"],
    ["ajuda", "help"],
    ["qual a cor do céu", "unknown"],
  ])("reads %j as %s", (question, intent) => {
    expect(understand(question, catalog).intent).toBe(intent);
  });

  it("looks a month ahead when asked about the month", () => {
    expect(understand("prazos deste mês", catalog).horizon).toBe(30);
    expect(understand("prazos", catalog).horizon).toBe(7);
  });

  it("recognises a person named in the question", () => {
    expect(understand("tarefas atrasadas da Stefany", catalog)).toMatchObject({ intent: "overdue", personId: "u-stefany" });
  });
});
