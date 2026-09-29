"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { PlanColumn } from "@/features/tasks/plan-data";
import {
  createProjectPlanColumnAction,
  deleteProjectPlanColumnAction,
  reorderProjectPlanColumnsAction,
  updateProjectPlanColumnAction,
} from "@/server/actions/project-plan";
import type { ActionState } from "@/server/actions/utils";

type PlanAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const COLUMN_TYPES = [
  { value: "TEXT", label: "Texto" },
  { value: "SELECT", label: "Seleção" },
  { value: "DATE", label: "Data" },
  { value: "NUMBER", label: "Número" },
  { value: "PERSON", label: "Pessoa" },
] as const;

function AddPlanColumn({
  projectId,
  pending,
  submit,
}: {
  projectId: string;
  pending: boolean;
  submit: (action: PlanAction, fields: Record<string, string>, success: string) => void;
}) {
  const [type, setType] = React.useState<PlanColumn["type"]>("TEXT");
  const [name, setName] = React.useState("");
  const [options, setOptions] = React.useState("");

  return (
    <form
      className="grid gap-2 rounded-sm bg-raised p-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = type === "SELECT" ? options.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : [];
        if (!name.trim() || (type === "SELECT" && parsed.length === 0)) return;
        submit(createProjectPlanColumnAction, { projectId, name: name.trim(), type, options: JSON.stringify(parsed) }, "Coluna criada.");
        setName(""); setOptions(""); setType("TEXT");
      }}
    >
      <div className="flex items-center gap-2"><Plus className="size-4 text-brand-strong" /><span className="text-label font-semibold text-ink">Nova coluna</span></div>
      <Input aria-label="Nome da coluna" fieldSize="sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Documento" disabled={pending} />
      <Select aria-label="Tipo da coluna" value={type} onChange={(event) => setType(event.target.value as PlanColumn["type"])} disabled={pending}>
        {COLUMN_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
      {type === "SELECT" ? <Textarea aria-label="Opções" value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Uma opção por linha" className="min-h-16" disabled={pending} /> : null}
      <Button type="submit" size="sm" disabled={pending}>Adicionar ao plano</Button>
    </form>
  );
}

/** Schema editing stays in the internal toolbar and is rendered only to task editors. */
export function PlanCustomColumnControls({
  projectId,
  columns,
}: {
  projectId: string;
  columns: PlanColumn[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [names, setNames] = React.useState<Record<string, string>>({});

  const submit = (action: PlanAction, fields: Record<string, string>, success: string) => {
    startTransition(async () => {
      const data = new FormData();
      data.set("projectId", projectId);
      for (const [key, value] of Object.entries(fields)) data.set(key, value);
      const result = await action({}, data);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    const ids = columns.map((column) => column.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    submit(reorderProjectPlanColumnsAction, { columnIds: JSON.stringify(ids) }, "Ordem atualizada.");
  };

  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center rounded-sm px-3 text-[13px] font-medium text-ink-soft hover:bg-raised [&::-webkit-details-marker]:hidden">
        Colunas
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-[min(28rem,calc(100vw-2rem))] rounded-md border border-line bg-surface p-4 shadow-overlay">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-label font-semibold text-ink">Colunas do plano</span>
          <span className="text-meta text-muted">Edite no próprio plano</span>
        </div>
        <AddPlanColumn projectId={projectId} pending={pending} submit={submit} />
        {columns.length === 0 ? (
          <p className="mt-3 text-meta text-muted">Crie uma coluna acima para preencher cada tarefa diretamente na tabela.</p>
        ) : (
          <ul className="max-h-80 space-y-3 overflow-y-auto">
            {columns.map((column, index) => (
              <li key={column.id} className="rounded-sm border border-line-soft p-2.5">
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = (names[column.id] ?? column.name).trim();
                    if (!name || name === column.name) return;
                    submit(updateProjectPlanColumnAction, { columnId: column.id, name }, "Coluna renomeada.");
                  }}
                >
                  <label className="sr-only" htmlFor={`plan-rename-${column.id}`}>Renomear {column.name}</label>
                  <Input
                    id={`plan-rename-${column.id}`}
                    fieldSize="sm"
                    maxLength={80}
                    value={names[column.id] ?? column.name}
                    onChange={(event) => setNames((current) => ({ ...current, [column.id]: event.target.value }))}
                    disabled={pending}
                  />
                  <Button type="submit" size="sm" variant="secondary" disabled={pending || (names[column.id] ?? column.name).trim() === column.name}>Salvar</Button>
                </form>
                <div className="mt-2 flex items-center gap-1">
                  <span className="mr-auto text-meta text-muted">{COLUMN_TYPES.find((type) => type.value === column.type)?.label}</span>
                  <Button type="button" size="iconSm" variant="ghost" aria-label={`Mover ${column.name} para cima`} disabled={pending || index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
                  <Button type="button" size="iconSm" variant="ghost" aria-label={`Mover ${column.name} para baixo`} disabled={pending || index === columns.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
                  <Button
                    type="button"
                    size="iconSm"
                    variant="ghost"
                    aria-label={`${column.visible ? "Ocultar" : "Mostrar"} ${column.name}`}
                    disabled={pending}
                    onClick={() => submit(updateProjectPlanColumnAction, { columnId: column.id, visible: String(!column.visible) }, "Visibilidade atualizada.")}
                  >
                    {column.visible ? <Eye /> : <EyeOff />}
                  </Button>
                  <Button
                    type="button"
                    size="iconSm"
                    variant="ghost"
                    aria-label={`Excluir ${column.name}`}
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Excluir a coluna “${column.name}” e todos os valores preenchidos?`)) {
                        submit(deleteProjectPlanColumnAction, { columnId: column.id }, "Coluna excluída.");
                      }
                    }}
                  ><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
