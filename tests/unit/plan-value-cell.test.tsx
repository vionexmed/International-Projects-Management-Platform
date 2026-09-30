import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlanList } from "@/features/tasks/plan-list";
import { PlanValueCell, planValueJson } from "@/features/tasks/plan-value-cell";
import { getDictionary } from "@/lib/i18n/dictionary";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const group = {
  category: "GENERAL" as const,
  name: "Geral",
  stageKey: null,
  stageStatus: null,
  stageHref: null,
  tasks: [{
    id: "task-1",
    title: "Enviar relatório",
    status: "OPEN",
    derived: "OPEN" as const,
    priority: "MEDIUM" as const,
    dueValue: "",
    dueLabel: "",
    late: false,
    lateDays: null,
    assignee: null,
    supplierName: null,
  }],
  done: 0,
  span: null,
  people: [],
};

describe("project plan custom cells", () => {
  it("renders a typed value under its custom header beside built-in task controls", () => {
    const props = {
      groups: [group],
      owners: [],
      editable: false,
      projectId: "project-1",
      taskHref: () => "/projects/project-1/tasks?task=task-1",
      dict: getDictionary("pt-BR"),
      columns: [{
        id: "column-1",
        name: "Score",
        type: "NUMBER" as const,
        visible: true,
        options: [],
        values: [{ taskId: "task-1", value: 12.5 }],
      }],
    };
    const markup = renderToStaticMarkup(React.createElement(PlanList, props));

    expect(markup).toContain("Score");
    expect(markup).toContain("12,5");
    expect(markup).toContain("Enviar relatório");
    expect(markup).toContain("Responsável");
    expect(markup).toContain("Prazo");
    expect(markup).toContain("Prioridade");
    expect(markup).toContain('aria-label="Redimensionar coluna Tarefa"');
    expect(markup).toContain('aria-label="Redimensionar coluna Score"');
    expect((markup.match(/aria-label="Redimensionar coluna /g) ?? [])).toHaveLength(5);
    expect(markup).toContain('aria-keyshortcuts="ArrowLeft ArrowRight"');
    expect(markup).toContain('grid-template-columns:288px 208px 136px 104px 160px minmax(0, 1fr)');
    expect(markup).toContain('class="col-[1/-1] flex');
  });

  it("serializes cleared and typed edits for the value action", () => {
    expect(planValueJson("TEXT", "Revisão pronta")).toBe('"Revisão pronta"');
    expect(planValueJson("SELECT", "Aprovado")).toBe('"Aprovado"');
    expect(planValueJson("DATE", "2026-10-01")).toBe('"2026-10-01"');
    expect(planValueJson("NUMBER", "12.5")).toBe("12.5");
    expect(planValueJson("PERSON", "user-1")).toBe('"user-1"');
    expect(planValueJson("NUMBER", "")).toBe("null");
    expect(() => planValueJson("NUMBER", "not-a-number")).toThrow("número válido");
  });

  it("renders accessible editors for date, select and person values", () => {
    const base = {
      projectId: "project-1",
      taskId: "task-1",
      taskTitle: "Enviar relatório",
      owners: [{ id: "user-1", name: "Ana" }],
      editable: true,
    };
    const date = renderToStaticMarkup(<PlanValueCell {...base} column={{ id: "date", name: "Entrega", type: "DATE", visible: true, options: [], values: [] }} value="2026-10-01" />);
    const choice = renderToStaticMarkup(<PlanValueCell {...base} column={{ id: "select", name: "Revisão", type: "SELECT", visible: true, options: ["Aprovado"], values: [] }} value="Aprovado" />);
    const person = renderToStaticMarkup(<PlanValueCell {...base} column={{ id: "person", name: "Revisor", type: "PERSON", visible: true, options: [], values: [] }} value="user-1" />);

    expect(date).toContain('type="date"');
    expect(date).toContain('aria-label="Entrega de Enviar relatório"');
    expect(choice).toContain('<select');
    expect(choice).toContain('Aprovado</option>');
    expect(person).toContain('Ana</option>');
  });

  it("does not display hidden columns in the grid", () => {
    const markup = renderToStaticMarkup(<PlanList
      groups={[group]}
      owners={[]}
      editable={false}
      projectId="project-1"
      columns={[{ id: "secret", name: "Internal secret", type: "TEXT", visible: false, options: [], values: [{ taskId: "task-1", value: "Private value" }] }]}
      dict={getDictionary("pt-BR")}
    />);
    expect(markup).not.toContain("Internal secret");
    expect(markup).not.toContain("Private value");
  });
});
