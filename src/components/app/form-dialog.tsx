"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { useFormAction } from "@/components/app/use-form-action";
import type { ActionState } from "@/server/actions/utils";

type Origin = { x: number; y: number };

/**
 * Wraps a server action in a modal with consistent error, pending and success
 * behaviour, so individual forms only describe their fields.
 *
 * `guided` is the full registration experience, for the create forms people
 * open most: the window flies out of the button that opened it, its sections
 * rise in one after another, a bar counts the required fields as they are
 * filled, ⌘/Ctrl+Enter saves, and success is a check drawn in the window
 * before it takes you to the new record.
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
  beforeSubmit,
  size = "md",
  labels,
  guided = false,
  icon,
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
  /**
   * Runs before the action, with the form in hand. Returning a string cancels
   * the submission and shows it as the error.
   *
   * It exists for large uploads: the file is sent straight to storage first,
   * because the request that carries it would be rejected by the platform
   * before the application ever sees it.
   */
  beforeSubmit?: (form: HTMLFormElement) => Promise<string | null>;
  size?: "md" | "lg";
  /**
   * Chrome wording. Optional — the internal environment is Portuguese and keeps
   * the defaults; the Supplier Portal passes its own locale's words, so a
   * dialog in English does not end in "Cancelar".
   */
  labels?: { cancel?: string; saving?: string; uploading?: string; unreachable?: string };
  /** The full registration experience (see above). */
  guided?: boolean;
  /** Shown beside the title of a guided dialog. */
  icon?: React.ReactNode;
  children: React.ReactNode | ((state: ActionState) => React.ReactNode);
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  // Where the opening click came from, relative to the centre of the screen.
  const [origin, setOrigin] = React.useState<Origin | null>(null);
  const [progress, setProgress] = React.useState({ filled: 0, total: 0 });
  const [done, setDone] = React.useState(false);

  // A dropdown item cannot host a trigger (the menu unmounts on select), so
  // the dialog can also be driven from the outside.
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  /**
   * Cleared here, on success, and nowhere else. Leaving the reset to React
   * would also wipe the form when the action *failed* — see `useFormAction`.
   */
  const handleSuccess = React.useCallback(
    (result: ActionState, form: HTMLFormElement) => {
      const finish = () => {
        setOpen(false);
        setDone(false);
        form.reset();
        if (redirectTo && result.createdId) router.push(redirectTo(result.createdId));
        else router.refresh();
      };
      if (!guided) {
        toast.success(successMessage);
        finish();
        return;
      }
      // The check is drawn in the window first; then it takes you there.
      setDone(true);
      window.setTimeout(finish, 1150);
    },
    [guided, successMessage, setOpen, redirectTo, router],
  );

  const { state, pending, onSubmit, reset } = useFormAction(action, handleSuccess, {
    unreachableError: labels?.unreachable,
  });
  const [blocked, setBlocked] = React.useState<string | null>(null);
  const [preparing, setPreparing] = React.useState(false);

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      if (!beforeSubmit) return onSubmit(event);

      const form = event.currentTarget;
      event.preventDefault();
      setBlocked(null);
      setPreparing(true);

      try {
        const problem = await beforeSubmit(form);
        if (problem) {
          setBlocked(problem);
          return;
        }
        onSubmit({
          ...event,
          currentTarget: form,
          preventDefault: () => {},
        } as unknown as React.FormEvent<HTMLFormElement>);
      } finally {
        setPreparing(false);
      }
    },
    [beforeSubmit, onSubmit],
  );

  /** Required fields that hold a valid value, out of all of them. */
  const measure = React.useCallback((form: HTMLFormElement | null) => {
    if (!form) return;
    const fields = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[required]")];
    const filled = fields.filter((field) => field.value.trim() !== "" && field.checkValidity()).length;
    setProgress((current) =>
      current.filled === filled && current.total === fields.length ? current : { filled, total: fields.length },
    );
  }, []);

  const ready = progress.total > 0 && progress.filled === progress.total;
  const launchStyle = guided && origin
    ? ({ "--vx-from-x": `${origin.x}px`, "--vx-from-y": `${origin.y}px` } as React.CSSProperties)
    : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {trigger ? (
        <DialogTrigger
          asChild
          onClick={(event) => {
            if (!guided) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setOrigin({
              x: rect.left + rect.width / 2 - window.innerWidth / 2,
              y: rect.top + rect.height / 2 - window.innerHeight / 2,
            });
          }}
        >
          {trigger}
        </DialogTrigger>
      ) : null}
      <DialogContent size={size} className={cn(guided && "vx-launch overflow-hidden")} style={launchStyle}>
        <DialogHeader
          title={title}
          description={description}
          icon={guided ? icon : undefined}
        />
        <form
          ref={guided ? measure : undefined}
          onSubmit={handleSubmit}
          onInput={guided ? (event) => measure(event.currentTarget) : undefined}
          onChange={guided ? (event) => measure(event.currentTarget) : undefined}
          onKeyDown={
            guided
              ? (event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    event.currentTarget.requestSubmit();
                  }
                }
              : undefined
          }
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogBody className={cn(guided ? "vx-launch-body space-y-6" : "space-y-4")}>
            {blocked ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-sm border border-risk/25 bg-risk-soft px-3 py-2.5 text-[13px] text-risk"
              >
                <AlertCircle className="mt-px size-4 shrink-0" />
                <span>{blocked}</span>
              </div>
            ) : null}

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
            {guided && progress.total > 0 ? (
              <div className="mr-auto flex items-center gap-2.5 text-meta" aria-live="polite">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line-soft">
                  <span
                    className={cn("block h-full rounded-full transition-[width] duration-500 ease-out", ready ? "bg-ok" : "bg-brand")}
                    style={{ width: `${(progress.filled / progress.total) * 100}%` }}
                  />
                </span>
                {ready ? (
                  <span className="font-medium text-ok">Pronto para salvar</span>
                ) : (
                  <span className="text-muted tabular-nums">
                    {progress.filled} de {progress.total} obrigatórios
                  </span>
                )}
              </div>
            ) : null}
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {labels?.cancel ?? "Cancelar"}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="primary"
              disabled={pending || preparing || done}
              className={cn(guided && ready && !pending && "vx-ready")}
            >
              {preparing
                ? (labels?.uploading ?? "Enviando arquivo…")
                : pending
                  ? (labels?.saving ?? "Salvando…")
                  : submitLabel}
              {guided && !pending && !preparing ? (
                <kbd className="ml-1 hidden rounded bg-white/15 px-1.5 py-px font-sans text-[11px] font-medium text-white/80 sm:inline">
                  ⌘↵
                </kbd>
              ) : null}
            </Button>
          </DialogFooter>
        </form>

        {done ? <SuccessMark message={successMessage} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Success, drawn: a ring, a check, the sentence — then the dialog moves on. */
function SuccessMark({ message }: { message: string }) {
  return (
    <div role="status" className="vx-success absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-surface/95">
      <svg viewBox="0 0 64 64" className="size-16" aria-hidden>
        <circle cx="32" cy="32" r="28" className="vx-success-ring" fill="none" stroke="var(--color-ok)" strokeWidth="3" />
        <path d="M20 33.5 28.5 42 45 24" className="vx-success-check" fill="none" stroke="var(--color-ok)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="vx-success-text text-center">
        <p className="text-section text-ink">{message}</p>
        <p className="mt-1 text-meta text-muted">Abrindo o cadastro…</p>
      </div>
    </div>
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

/** A titled group of fields in a guided form; each one rises in on its own. */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">{title}</h3>
      {children}
    </section>
  );
}
