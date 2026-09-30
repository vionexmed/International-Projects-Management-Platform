"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** One dim for every overlay: ink at 45 %, no blur. */
function Overlay({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Overlay
      className={cn("fixed inset-0 z-50 bg-ink/45 data-[state=open]:animate-fade-in", className)}
    />
  );
}

function CloseButton({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close
      className={cn(
        "absolute top-4 right-4 rounded-sm p-1 text-muted transition-colors hover:bg-raised hover:text-ink",
        className,
      )}
      aria-label="Fechar"
    >
      <X className="size-4" />
    </DialogPrimitive.Close>
  );
}

/** Centred modal, used for create/edit forms. */
export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { size?: "md" | "lg" }
>(({ className, children, size = "md", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <Overlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col",
        "rounded-lg border border-line bg-surface shadow-dialog data-[state=open]:animate-fade-in",
        size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg",
        className,
      )}
      {...props}
    >
      {children}
      <CloseButton />
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

/**
 * Right-hand drawer, used for record detail without losing list context.
 * Kept for existing callers; new work uses `SheetContent`.
 */
export const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <Overlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface sm:max-w-xl",
        "shadow-sheet data-[state=open]:animate-sheet-in",
        className,
      )}
      {...props}
    >
      {children}
      <CloseButton />
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DrawerContent.displayName = "DrawerContent";

export function DialogHeader({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description?: string;
  /** A badge beside the title (the guided create forms). */
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-4 border-b border-line px-6 py-4 pr-12", icon && "py-5", className)}>
      {icon ? (
        <span className="vx-pop flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand ring-1 ring-brand/15 [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <DialogPrimitive.Title className="text-base font-semibold text-ink">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-[13px] text-muted">
            {description}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
      </div>
    </div>
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("scroll-slim flex-1 overflow-y-auto px-6 py-5", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-line bg-subtle px-6 py-3.5",
        className,
      )}
      {...props}
    />
  );
}

/* ---------------------------------------------------------------------------
   Sheet — a full-height side panel on the right.

   `sm` (368 px) holds filters and settings: tinted header strip, a body and
   a footer of two full-width 50/50 buttons. `lg` (min(1040px, 72vw)) is a
   record opened over its list — pass `aside` for the split layout (content
   left, ~32 % conversation/aside column right). Radix supplies the focus
   trap, Esc and scroll lock; the sheet is full width on a phone.
--------------------------------------------------------------------------- */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/** `modal` is the record opened as a centred window (the task), laid out like `lg`. */
export type SheetSize = "sm" | "lg" | "modal";

const SheetSizeContext = React.createContext<SheetSize>("sm");

const SHEET_WIDTH: Record<SheetSize, string> = {
  sm: "sm:w-[368px]",
  lg: "md:w-[min(1040px,72vw)]",
  modal: "",
};

const SHEET_FRAME = "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface shadow-sheet outline-none data-[state=open]:animate-sheet-in";
const MODAL_FRAME =
  "fixed top-1/2 left-1/2 z-50 flex max-h-[min(90dvh,880px)] w-[calc(100vw-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-dialog outline-none data-[state=open]:animate-fade-in";

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: SheetSize;
    /** Right-hand column of an `lg` sheet (e.g. the task's conversation). */
    aside?: React.ReactNode;
  }
>(({ className, children, size = "sm", aside, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <Overlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(size === "modal" ? MODAL_FRAME : SHEET_FRAME, SHEET_WIDTH[size], className)}
      {...props}
    >
      <SheetSizeContext.Provider value={size}>
        {aside ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
            <div className="flex min-w-0 flex-col md:min-h-0 md:flex-1">{children}</div>
            <aside
              className={cn(
                "flex flex-col border-t border-line bg-subtle md:min-h-0 md:shrink-0 md:border-t-0 md:border-l",
                size === "modal" ? "md:w-[340px]" : "md:w-[32%]",
              )}
            >
              {aside}
            </aside>
          </div>
        ) : (
          children
        )}
      </SheetSizeContext.Provider>
      <CloseButton className={size === "sm" ? "top-3.5 right-3" : undefined} />
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

/**
 * Title row. The `sm` sheet gets the tinted strip; `lg` a plain white header
 * with room for a breadcrumb-style `eyebrow` and trailing `actions`.
 */
export function SheetHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small line above the title, e.g. the project link. */
  eyebrow?: React.ReactNode;
  /** Icon buttons placed left of the close button. */
  actions?: React.ReactNode;
  className?: string;
}) {
  const size = React.useContext(SheetSizeContext);
  return (
    <div
      className={cn(
        "flex shrink-0 items-start gap-3 pr-12",
        size === "sm"
          ? "min-h-14 border-b border-line bg-subtle px-5 py-3.5"
          : "px-6 pt-5 pb-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? <div className="mb-1 text-label text-brand-strong">{eyebrow}</div> : null}
        <DialogPrimitive.Title
          className={cn("text-ink", size === "sm" ? "text-section" : "text-[22px] leading-8 font-semibold")}
        >
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-0.5 text-meta text-muted">
            {description}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">
            {typeof title === "string" ? title : ""}
          </DialogPrimitive.Description>
        )}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const size = React.useContext(SheetSizeContext);
  return (
    <div
      className={cn(
        "scroll-slim min-h-0 flex-1 overflow-y-auto",
        size === "sm" ? "px-5 py-4" : "px-6 pb-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * `split` (default on `sm`): the children — normally a secondary and a
 * primary `Button` — become two flush 48-px halves. `end` is a padded,
 * right-aligned row, for `lg` sheets.
 */
export function SheetFooter({
  className,
  layout,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { layout?: "split" | "end" }) {
  const size = React.useContext(SheetSizeContext);
  const resolved = layout ?? (size === "sm" ? "split" : "end");
  return (
    <div
      className={cn(
        "shrink-0 border-t border-line",
        resolved === "split"
          ? "grid auto-cols-fr grid-flow-col [&>*]:h-12 [&>*]:w-full [&>*]:rounded-none [&>*]:border-0"
          : "flex items-center justify-end gap-2 px-6 py-3",
        className,
      )}
      {...props}
    />
  );
}
