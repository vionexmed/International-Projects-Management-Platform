"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { createGtmItemAction } from "@/server/actions/stages";

const CATEGORIES = [
  { value: "MARKET_ANALYSIS", label: "Análise de mercado" },
  { value: "COMMERCIAL_STRATEGY", label: "Estratégia comercial" },
  { value: "PRICING", label: "Precificação" },
  { value: "SALES_CHANNELS", label: "Canais de venda" },
  { value: "KOLS", label: "KOLs" },
  { value: "MARKETING", label: "Marketing" },
  { value: "TRAINING", label: "Treinamento" },
  { value: "LAUNCH_PLAN", label: "Plano de lançamento" },
];

export function GtmItemDialog({ projectId }: { projectId: string }) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary" size="sm">
          <Plus />
          Adicionar item
        </Button>
      }
      title="Novo item de Go-to-Market"
      action={createGtmItemAction}
      submitLabel="Adicionar"
      successMessage="Item adicionado."
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />

          <Field name="category" label="Área" required state={state}>
            <Select id="category" name="category" defaultValue="MARKET_ANALYSIS">
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field name="title" label="Item" required state={state}>
            <Input id="title" name="title" required />
          </Field>

          <FieldGrid>
            <Field name="owner" label="Responsável" state={state}>
              <Input id="owner" name="owner" />
            </Field>
            <Field name="dueDate" label="Prazo" state={state}>
              <Input id="dueDate" name="dueDate" type="date" />
            </Field>
          </FieldGrid>

          <Field name="detail" label="Detalhes" state={state}>
            <Textarea id="detail" name="detail" rows={2} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
