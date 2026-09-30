/** What the assistant sends back: plain data the chat panel lays out. */

export type ReplyTone = "risk" | "warn" | "ok" | "info" | "neutral";

/** One row of a list answer: a task, a document, a project, an event. */
export type ReplyItem = {
  title: string;
  detail?: string;
  /** Short right-hand text: a date, a share, a count. */
  trailing?: string;
  tone?: ReplyTone;
  href?: string;
};

/** The project card shown when a question is about one project. */
export type ReplyProject = {
  name: string;
  href: string;
  subtitle: string;
  progress: number;
  status: { label: string; tone: ReplyTone };
  stages: { name: string; fill: number; tone: ReplyTone; current: boolean }[];
  facts: { label: string; value: string; tone?: ReplyTone }[];
};

export type AssistantReply = {
  /** One or two sentences, the answer itself. */
  text: string;
  project?: ReplyProject;
  items?: ReplyItem[];
  /** "Ver tudo" — the screen that holds the full answer. */
  more?: { label: string; href: string };
  /** Follow-up questions, as tappable chips. */
  suggestions: string[];
};
