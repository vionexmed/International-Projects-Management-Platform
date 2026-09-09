import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 [&_svg]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-strong text-white hover:bg-brand-deep active:bg-brand-deep shadow-[0_1px_2px_rgba(10,24,38,0.08)]",
        secondary:
          "bg-surface text-ink border border-line hover:bg-raised hover:border-line-strong",
        ghost: "text-ink-soft hover:bg-raised hover:text-ink",
        subtle: "bg-raised text-ink-soft hover:bg-line-soft hover:text-ink",
        danger: "bg-risk text-white hover:brightness-95",
        link: "text-brand-strong underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-[13px] rounded-sm",
        md: "h-9 px-3.5 text-sm rounded-sm",
        lg: "h-10 px-4 text-sm rounded-md",
        icon: "h-9 w-9 rounded-sm",
        iconSm: "h-8 w-8 rounded-sm",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
