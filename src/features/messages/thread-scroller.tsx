"use client";

import * as React from "react";

/**
 * The scrolling pane of a conversation, opened at its end.
 *
 * Messages are listed oldest first, so a plain scroll container opened on the
 * first message of the thread — the newest reply, the one a person came to
 * read, sat below the fold. It now starts at the bottom, and follows new
 * messages down when one is sent.
 */
export function ThreadScroller({
  count,
  className,
  children,
}: {
  /** The number of messages; a change means one arrived and the pane follows. */
  count: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [count]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
