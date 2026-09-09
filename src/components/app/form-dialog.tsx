"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/server/actions/utils";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Salvando…" : label}
    </Button>
  );
}

/**
 * Wraps a server action in a modal with consistent error, pending and success
 * behaviour, so individual forms only describe their fields.
 */
export function FormDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  action,
  submitLabel,
  successMessage,
  redirectTo,
  size = "md",
  children,
}: {
  /** Omit when the dialog is opened from elsewhere (e.g. a dropdown item). */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  successMessage: string;
  /** Builds a destination from the created record's id. */
  redirectTo?: (createdId: string) => string;
  size?: "md" | "lg";
  children: React.ReactNode | ((state: ActionState) => React.ReactNode);
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [state, setState] = React.useState<ActionState>({});
  const formRef = React.useRef<HTMLFormElement>(null);

  // A dropdown item cannot host a trigger (the menu unmounts on select), so
  // the dialog can also be driven from the outside.
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const handleAction = async (formData: FormData) => {
    const result = await action(state, formData);
    setState(result);

    if (result.ok) {
      toast.success(successMessage);
      setOpen(false);
      formRef.current?.reset();
      if (redirectTo && result.createdId) router.push(redirectTo(result.createdId));
      else router.refresh();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setState({});
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent size={size}>
        <DialogHeader title={title} description={description} />
        <form ref={formRef} action={handleAction} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            {state.error ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-sm border border-risk/25 bg-risk-soft px-3 py-2.5 text-[13px] text-risk"
              >
                <AlertCircle className="mt-px size-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            ) : null}
            {typeof children === "function" ? children(state) : children}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <SubmitButton label={submitLabel} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Labelled field with inline validation feedback from the action state. */
export function Field({
  name,
  label,
  hint,
  required,
  state,
  className,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  state?: ActionState;
  className?: string;
  children: React.ReactNode;
}) {
  const errors = state?.fieldErrors?.[name];

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="ml-0.5 text-risk">*</span> : null}
      </Label>
      {children}
      {hint && !errors ? <p className="text-[12px] text-muted">{hint}</p> : null}
      {errors?.length ? (
        <p className="text-[12px] text-risk" role="alert">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/** Two-column grid used inside dialogs. */
export function FieldGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
