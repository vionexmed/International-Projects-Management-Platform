import { cn, initials } from "@/lib/utils";

const SIZES = {
  /** 20 px — table rows, chips. */
  xs: "size-5 text-[9px]",
  sm: "size-7 text-[11px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

const TONES = {
  light: "bg-raised text-ink-soft",
  dark: "bg-navy-line text-white",
  brand: "bg-brand-soft text-brand-deep",
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
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        SIZES[size],
        TONES[tone],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* 16 in board cards, 20–24 in rows. */
const STACK_SIZES = {
  16: "size-4 text-[7px]",
  20: "size-5 text-[9px]",
  24: "size-6 text-[10px]",
} as const;

/* The "+N" chip grows sideways for two digits, so height and min-width only. */
const MORE_SIZES = {
  16: "h-4 min-w-4 text-[8px]",
  20: "h-5 min-w-5 text-[9px]",
  24: "h-6 min-w-6 text-[10px]",
} as const;

export type AvatarStackPerson = { name: string; id?: string };

/**
 * Overlapping avatars (−4 px) with a "+N" chip for the rest. Each avatar has
 * a hover title; the group carries every name for assistive technology.
 * `ring` is the colour of the separating ring — match it to the surface the
 * stack sits on (`ring-surface` on white, `ring-subtle` on a board column).
 */
export function AvatarStack({
  people,
  size = 20,
  max = 3,
  ring = "ring-surface",
  tone = "light",
  className,
}: {
  people: AvatarStackPerson[];
  size?: keyof typeof STACK_SIZES;
  max?: number;
  ring?: string;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const names = people.map((person) => person.name).join(", ");

  return (
    <span role="group" aria-label={names} className={cn("inline-flex items-center", className)}>
      {shown.map((person, index) => (
        <span
          key={person.id ?? `${person.name}-${index}`}
          title={person.name}
          aria-hidden
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 select-none",
            STACK_SIZES[size],
            TONES[tone],
            ring,
            index > 0 && "-ml-1",
          )}
        >
          {initials(person.name)}
        </span>
      ))}
      {rest > 0 ? (
        <span
          title={people.slice(max).map((person) => person.name).join(", ")}
          aria-hidden
          className={cn(
            "-ml-1 inline-flex shrink-0 items-center justify-center rounded-full bg-line-soft px-1 font-semibold text-muted ring-2 tabular-nums",
            MORE_SIZES[size],
            ring,
          )}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
