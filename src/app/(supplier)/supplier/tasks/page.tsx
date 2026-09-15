import { redirect } from "next/navigation";

/**
 * Kept as a redirect, not deleted.
 *
 * Tasks stopped being a destination of its own when Action Required became the
 * single queue — the split asked a supplier to know which of Vionex's two
 * models their work lived in. The route stays because links to it exist: in
 * notifications already sent, in e-mails, in somebody's bookmarks. It now
 * lands on the same work, with the filter already applied.
 */
export default function SupplierTasksPage() {
  redirect("/supplier/action-required?type=task");
}
