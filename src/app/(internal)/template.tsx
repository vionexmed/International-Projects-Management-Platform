/**
 * Remounts when the sidebar moves to another section, so the new page's
 * blocks rise in one after another (`.vx-page` in globals.css). The rise is
 * plain CSS on newly mounted blocks, so it also plays when the real content
 * replaces the loading skeleton, and never on a refresh, where the blocks
 * are the same nodes. Reduced motion turns it off.
 *
 * The old page is not faded out: a cross-fade left it showing through the
 * gaps of the new page's skeleton while it went. The swap is instant.
 */
export default function InternalTemplate({ children }: { children: React.ReactNode }) {
  return <div className="vx-page">{children}</div>;
}
