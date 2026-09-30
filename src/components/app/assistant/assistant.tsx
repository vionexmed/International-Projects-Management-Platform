"use client";

import * as React from "react";
import { ArrowUp, RotateCcw, X } from "lucide-react";
import { VionexMarkColor } from "@/components/app/logo";
import { AssistantReplyView } from "@/components/app/assistant/assistant-reply";
import type { AssistantReply } from "@/lib/assistant/reply";
import { askAssistantAction } from "@/server/actions/assistant";
import { cn } from "@/lib/utils";

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; reply: AssistantReply }
  | { id: string; role: "error"; text: string };

const STORAGE = "vionex-assistant";

const STARTERS = [
  "O que precisa da minha atenção?",
  "Como está o portfólio?",
  "Quais documentos estão pendentes?",
  "O que vence esta semana?",
  "Minhas tarefas",
];

function readHistory(): Message[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

/**
 * The platform assistant: the Vionex mark in the corner, a conversation that
 * answers from the platform's own records — no outside AI. ⌘J (Ctrl+J)
 * opens and closes it; the conversation lasts for the browser session.
 */
export function Assistant({ firstName }: { firstName: string }) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const loaded = React.useRef(false);

  // The conversation of this browser session comes back the first time the panel opens.
  const restore = () => {
    if (loaded.current) return;
    loaded.current = true;
    const history = readHistory();
    if (history.length) setMessages(history);
  };
  const toggle = () => {
    restore();
    setOpen((value) => !value);
  };

  React.useEffect(() => {
    if (!loaded.current) return;
    try {
      window.sessionStorage.setItem(STORAGE, JSON.stringify(messages.slice(-30)));
    } catch {
      /* The conversation still works without storage. */
    }
  }, [messages]);

  const toggleRef = React.useRef(toggle);
  React.useEffect(() => {
    toggleRef.current = toggle;
  });

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "j" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleRef.current();
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    setDraft("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
    startTransition(async () => {
      const result = await askAssistantAction(text).catch(() => ({ error: "Sem conexão com a plataforma. Tente de novo." }));
      setMessages((current) => [
        ...current,
        "error" in result
          ? { id: crypto.randomUUID(), role: "error", text: result.error }
          : { id: crypto.randomUUID(), role: "assistant", reply: result },
      ]);
    });
  };

  return (
    <>
      {/* The launcher: the mark, and its name on hover. */}
      <button
        type="button"
        aria-label="Abrir o assistente Vionex (⌘J)"
        aria-expanded={open}
        onClick={toggle}
        className={cn(
          "group fixed right-5 bottom-5 z-40 flex h-13 items-center gap-2 rounded-full bg-navy p-1.5 pr-1.5 text-white shadow-dialog ring-1 ring-white/10 transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:pr-4 motion-reduce:transition-none",
          open && "pointer-events-none scale-90 opacity-0",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-white/5">
          <VionexMarkColor className="size-7" />
        </span>
        <span className="max-w-0 overflow-hidden text-label font-medium whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-40 group-hover:opacity-100">
          Pergunte à Vionex
        </span>
      </button>

      <section
        role="dialog"
        aria-label="Assistente Vionex"
        aria-hidden={!open}
        className={cn(
          "fixed right-5 bottom-5 z-50 flex h-[min(680px,calc(100dvh-2.5rem))] w-[min(420px,calc(100vw-2.5rem))] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-dialog transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <header className="relative flex shrink-0 items-center gap-3 overflow-hidden bg-[linear-gradient(115deg,#071726_0%,#0c2c45_60%,#11486a_100%)] px-4 py-3.5 text-white">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/10">
            <VionexMarkColor className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-title">Assistente Vionex</p>
            <p className="truncate text-[12px] text-sky-100/70">Responde com os dados da plataforma</p>
          </div>
          {messages.length ? (
            <button
              type="button"
              aria-label="Nova conversa"
              title="Nova conversa"
              onClick={() => setMessages([])}
              className="flex size-8 items-center justify-center rounded-sm text-sky-100/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="flex size-8 items-center justify-center rounded-sm text-sky-100/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </header>

        <div ref={listRef} className="scroll-slim min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div>
                <p className="text-section text-ink">Olá, {firstName}.</p>
                <p className="mt-1 text-body text-muted">
                  Pergunte sobre qualquer projeto, empresa, tarefa, documento ou prazo. Eu respondo com o que está registrado na plataforma.
                </p>
              </div>
              <div className="grid gap-1.5">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => ask(starter)}
                    className="rounded-lg border border-line-soft px-3 py-2 text-left text-[13px] text-ink-soft transition-colors hover:border-brand-line hover:bg-brand-soft hover:text-brand-deep"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-body whitespace-pre-wrap text-white">
                  {message.text}
                </p>
              </div>
            ) : message.role === "error" ? (
              <p key={message.id} className="rounded-lg bg-risk-soft px-3 py-2 text-body text-risk">
                {message.text}
              </p>
            ) : (
              <div key={message.id} className="vx-assistant-in flex gap-2.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-navy">
                  <VionexMarkColor className="size-4.5" />
                </span>
                <AssistantReplyView reply={message.reply} onAsk={ask} onNavigate={() => undefined} />
              </div>
            ),
          )}

          {pending ? (
            <div className="flex items-center gap-2.5" aria-label="Consultando">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy">
                <VionexMarkColor className="size-4.5" />
              </span>
              <span className="flex gap-1 rounded-2xl bg-raised px-3 py-2.5">
                {[0, 1, 2].map((dot) => (
                  <span key={dot} className="vx-typing size-1.5 rounded-full bg-muted" style={{ animationDelay: `${dot * 140}ms` }} />
                ))}
              </span>
            </div>
          ) : null}
        </div>

        <form
          className="shrink-0 border-t border-line-soft bg-surface p-3"
          onSubmit={(event) => {
            event.preventDefault();
            ask(draft);
          }}
        >
          <div className="flex items-end gap-2 rounded-xl border border-line-soft bg-subtle px-3 py-2 transition-colors focus-within:border-brand focus-within:bg-surface">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={500}
              placeholder="Pergunte sobre um projeto, empresa, prazo…"
              aria-label="Sua pergunta"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  ask(draft);
                }
              }}
              className="max-h-28 min-h-6 flex-1 resize-none bg-transparent py-0.5 text-body text-ink outline-none field-sizing-content placeholder:text-faint"
            />
            <button
              type="submit"
              aria-label="Enviar pergunta"
              disabled={!draft.trim() || pending}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-faint">Enter para enviar · ⌘J abre e fecha · só consulta, não altera nada</p>
        </form>
      </section>
    </>
  );
}
