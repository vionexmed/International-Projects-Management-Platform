import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-sm border border-line bg-surface px-3 py-1 text-sm text-ink transition-colors",
        "placeholder:text-faint",
        "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15",
        "disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-20 w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors",
      "placeholder:text-faint",
      "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15",
      "disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full appearance-none rounded-sm border border-line bg-surface bg-no-repeat px-3 pr-8 text-sm text-ink transition-colors",
      "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%23687784%22 stroke-width=%221.6%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m4 6 4 4 4-4%22/%3E%3C/svg%3E')] bg-[right_0.6rem_center]",
      "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15",
      "disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
