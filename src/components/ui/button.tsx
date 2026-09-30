import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
  Control heights stay dense: 32 px in toolbars and page headers (`sm`), 36 px
  as the neutral default (`md`), and 40 px in forms and modals (`lg`).
*/
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 [&_svg]:size-4",
  {
    variants: {
      variant: {
        primary:
          // The logo turquoise with dark ink: white on it is only 3.04:1. The
          // outline is the rail colour, since a turquoise ring would vanish.
          "bg-brand text-on-brand font-semibold hover:bg-brand-hover active:bg-brand focus-visible:outline-navy",
        secondary:
          "border border-line-soft bg-surface text-ink hover:border-line hover:bg-subtle",
        /** Accent-outlined secondary, for the second action beside a primary. */
        outline:
          "bg-surface text-brand-strong border border-brand-strong hover:bg-brand-soft",
        ghost: "text-ink-soft hover:bg-raised hover:text-ink",
        subtle: "bg-raised text-ink-soft hover:bg-line-soft hover:text-ink",
        danger: "bg-risk text-white hover:brightness-95",
        link: "text-brand-strong underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-3.5 text-sm",
        lg: "h-10 px-4 text-sm",
        icon: "h-9 w-9",
        iconSm: "h-8 w-8",
        iconLg: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Icon placed before the label. Children may still carry their own icons. */
  leadingIcon?: React.ReactNode;
  /** Icon placed after the label — e.g. "Novo projeto +". */
  trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, leadingIcon, trailingIcon, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>
        {leadingIcon}
        {/* Slottable lets `asChild` wrap a Link while the icons stay outside it. */}
        <Slottable>{children}</Slottable>
        {trailingIcon}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
