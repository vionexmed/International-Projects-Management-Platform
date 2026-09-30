"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { AssistantReply, ReplyTone } from "@/lib/assistant/reply";
import { cn } from "@/lib/utils";

const DOT: Record<ReplyTone, string> = {
  risk: "bg-risk-dot",
  warn: "bg-warn-dot",
  ok: "bg-ok-dot",
  info: "bg-info-dot",
  neutral: "bg-line-strong",
};

const TAG: Record<ReplyTone, string> = {
  risk: "bg-risk-soft text-risk",
  warn: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok",
  info: "bg-info-soft text-info",
  neutral: "bg-raised text-ink-soft",
};

const FILL: Record<ReplyTone, string> = {
  risk: "bg-risk-dot",
  warn: "bg-warn-dot",
  ok: "bg-ok-dot",
  info: "bg-brand",
  neutral: "bg-line-strong",
};

/** One assistant answer: the sentence, a project card or rows, the way onward and follow-ups. */
export function AssistantReplyView({
  reply,
  onAsk,
  onNavigate,
}: {
  reply: AssistantReply;
  onAsk: (question: string) => void;
  onNavigate: () => void;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <p className="text-body leading-relaxed text-ink">{reply.text}</p>

      {reply.project ? (
        <div className="overflow-hidden rounded-xl border border-line-soft">
          <div className="flex items-start justify-between gap-3 px-3.5 pt-3">
            <div className="min-w-0">
              <Link href={reply.project.href} onClick={onNavigate} className="text-title text-ink hover:underline">
                {reply.project.name}
              </Link>
              <p className="truncate text-meta text-muted">{reply.project.subtitle}</p>
            </div>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", TAG[reply.project.status.tone])}>
              {reply.project.status.label}
            </span>
          </div>
          <div className="flex items-center gap-2.5 px-3.5 pt-3">
            <span className="flex flex-1 gap-1">
              {reply.project.stages.map((stage) => (
                <span key={stage.name} title={`${stage.name} · ${stage.fill}%`} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft">
                  <span className={cn("block h-full rounded-full", FILL[stage.tone])} style={{ width: `${stage.fill}%` }} />
                </span>
              ))}
            </span>
            <span className="text-meta font-medium text-ink tabular-nums">{reply.project.progress}%</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-px border-t border-line-faint bg-line-faint">
            {reply.project.facts.map((fact) => (
              <div key={fact.label} className="bg-surface px-3.5 py-2">
                <dt className="text-[11px] text-muted">{fact.label}</dt>
                <dd className={cn("truncate text-meta font-medium", fact.tone === "risk" ? "text-risk" : fact.tone === "warn" ? "text-warn" : "text-ink")}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {reply.items?.length ? (
        <ul className="overflow-hidden rounded-xl border border-line-soft">
          {reply.items.map((item, index) => {
            const body = (
              <>
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", DOT[item.tone ?? "neutral"])} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-5 font-medium text-ink">{item.title}</span>
                  {item.detail ? <span className="block truncate text-[12px] text-muted">{item.detail}</span> : null}
                </span>
                {item.trailing ? (
                  <span className={cn("shrink-0 text-right text-[11.5px] tabular-nums", item.tone === "risk" ? "font-medium text-risk" : "text-muted")}>
                    {item.trailing}
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={`${item.title}-${index}`} className="border-t border-line-faint first:border-t-0">
                {item.href ? (
                  <Link href={item.href} onClick={onNavigate} className="flex items-start gap-2.5 px-3 py-2 transition-colors hover:bg-subtle">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-2.5 px-3 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {reply.more ? (
        <Link
          href={reply.more.href}
          onClick={onNavigate}
          className="inline-flex items-center gap-1 text-label font-medium text-brand-strong hover:underline"
        >
          {reply.more.label}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}

      {reply.suggestions.length ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {reply.suggestions.slice(0, 4).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onAsk(suggestion)}
              className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface px-2.5 py-1 text-[12px] text-ink-soft transition-colors hover:border-brand-line hover:bg-brand-soft hover:text-brand-deep"
            >
              {suggestion}
              <ArrowRight className="size-3 opacity-50" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
