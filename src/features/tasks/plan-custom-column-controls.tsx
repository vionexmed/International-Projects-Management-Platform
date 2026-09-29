"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/app/form-dialog";
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

function AddPlanColumn({ projectId }: { projectId: string }) {
  const [type, setType] = React.useState<PlanColumn["type"]>("TEXT");

  return (
    <FormDialog
      trigger={<Button type="button" size="sm" variant="secondary"><Plus /> Nova coluna</Button>}
      title="Nova coluna do plano"
      action={createProjectPlanColumnAction}
      submitLabel="Criar coluna"
      successMessage="Coluna criada."
      beforeSubmit={async (form) => {
        const input = form.elements.namedItem("options") as HTMLInputElement | null;
        const textarea = form.elements.namedItem("selectOptions") as HTMLTextAreaElement | null;
        if (!input) return "Não foi possível preparar as opções.";
        const options = type === "SELECT"
          ? (textarea?.value ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
          : [];
        if (type === "SELECT" && options.length === 0) return "Informe ao menos uma opção.";
        input.value = JSON.stringify(options);
        return null;
      }}
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="options" defaultValue="[]" />
          <Field name="name" label="Nome" required state={state}>
            <Input name="name" id="plan-column-name" maxLength={80} required />
          </Field>
          <Field name="type" label="Tipo" required state={state}>
            <Select name="type" id="plan-column-type" value={type} onChange={(event) => setType(event.target.value as PlanColumn["type"])}>
              {COLUMN_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </Field>
          {type === "SELECT" ? (
            <div>
              <label htmlFor="plan-column-options" className="text-label font-medium text-ink-soft">Opções, uma por linha</label>
              <Textarea id="plan-column-options" name="selectOptions" className="mt-1" required />
            </div>
          ) : null}
        </>
      )}
    </FormDialog>
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
          <AddPlanColumn projectId={projectId} />
        </div>
        {columns.length === 0 ? (
          <p className="text-meta text-muted">Nenhuma coluna personalizada.</p>
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
