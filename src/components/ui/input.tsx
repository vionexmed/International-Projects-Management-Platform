import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Field sizes. Forms and modals use 40 px (`lg`, the default); toolbars use
 * 32 px (`sm`) so a field lines up with the 32-px toolbar buttons. Named
 * `fieldSize` because `size` is already a native `<input>` attribute.
 */
export type FieldSize = "sm" | "md" | "lg";

const FIELD_HEIGHT: Record<FieldSize, string> = {
  sm: "h-8 text-[13px]",
  md: "h-9 text-sm",
  lg: "h-10 text-sm",
};

/*
  Quiet white fields with a hairline and a 2-px brand edge on focus.
*/
const FIELD_BASE = cn(
  "w-full rounded-sm border border-line-soft bg-surface text-ink transition-colors",
  "placeholder:text-faint hover:border-line-strong",
  "focus:border-brand focus:bg-surface focus:ring-1 focus:ring-brand focus:outline-none",
  "aria-[invalid=true]:border-risk aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-risk",
  "disabled:cursor-not-allowed disabled:border-line-soft disabled:bg-raised/60 disabled:text-muted",
);

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { fieldSize?: FieldSize }
>(({ className, type, fieldSize = "lg", ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex px-3 py-1",
      FIELD_BASE,
      FIELD_HEIGHT[fieldSize],
      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("flex min-h-20 px-3 py-2.5 text-sm", FIELD_BASE, className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { fieldSize?: FieldSize }
>(({ className, children, fieldSize = "lg", ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "appearance-none px-3 pr-8",
      FIELD_BASE,
      FIELD_HEIGHT[fieldSize],
      // The chevron lives in globals.css (`.field-chevron`): as an arbitrary
      // background-image utility, tailwind-merge filed it as a background
      // colour and silently dropped the field fill.
      "field-chevron",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
