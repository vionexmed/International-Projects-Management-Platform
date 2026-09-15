import { CircleCheck, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReviewRound = {
  id: string;
  decision: "APPROVED" | "CHANGES_REQUESTED";
  note: string | null;
  /** Already formatted for the viewer's locale on the server. */
  when: string;
  /** Present internally, withheld from the portal by the service. */
  reviewer?: { id: string; name: string } | null;
  documentVersion?: { id: string; version: number; fileName: string } | null;
};

/**
 * Every round a request has been through.
 *
 * `reviewNote` only ever held the latest verdict, so each new decision erased
 * the reason for the one before it — which is exactly the thing a regulatory
 * file needs to keep. These rows are the record: who decided (internally),
 * on which version, and why.
 *
 * The reviewer's name is absent for a supplier session because the service
 * never selects it, not because this component hides it.
 */
export function ReviewHistory({
  rounds,
  title,
  labels,
}: {
  rounds: ReviewRound[];
  title: string;
  labels: { approved: string; changesRequested: string; version: string };
}) {
  if (rounds.length === 0) return null;

  return (
    <section>
      <p className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{title}</p>
      <ol className="mt-2 space-y-2">
        {rounds.map((round) => {
          const approved = round.decision === "APPROVED";
          return (
            <li
              key={round.id}
              className={cn(
                "rounded-md border px-3.5 py-3",
                approved ? "border-ok/25 bg-ok-soft" : "border-warn/25 bg-warn-soft",
              )}
            >
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                {approved ? (
                  <CircleCheck className="size-3.5 shrink-0 text-ok" />
                ) : (
                  <RotateCcw className="size-3.5 shrink-0 text-warn" />
                )}
                <span className={cn("font-medium", approved ? "text-ok" : "text-warn")}>
                  {approved ? labels.approved : labels.changesRequested}
                </span>
                {round.documentVersion ? (
                  <span className="text-muted">
                    {labels.version}
                    {round.documentVersion.version}
                  </span>
                ) : null}
                {round.reviewer ? <span className="text-muted">{round.reviewer.name}</span> : null}
                <span className="text-muted">{round.when}</span>
              </p>
              {round.note ? (
                <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
                  {round.note}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
