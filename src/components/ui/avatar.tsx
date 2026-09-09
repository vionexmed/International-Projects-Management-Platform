import { cn, initials } from "@/lib/utils";

const SIZES = {
  sm: "size-7 text-[11px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

export function UserAvatar({
  name,
  size = "md",
  className,
  tone = "light",
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  tone?: "light" | "dark" | "brand";
}) {
  const toneClass =
    tone === "dark"
      ? "bg-navy-line text-white"
      : tone === "brand"
        ? "bg-brand-soft text-brand-deep"
        : "bg-raised text-ink-soft";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        SIZES[size],
        toneClass,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
