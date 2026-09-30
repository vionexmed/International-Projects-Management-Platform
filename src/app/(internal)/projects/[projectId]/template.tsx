import { PageTransition } from "@/components/app/page-transition";

/**
 * Remounts on every navigation inside the project, which is what lets the
 * page content slide in and out under the header (the layout itself stays).
 * Only links tagged forward/back animate; tabs and refreshes swap in place.
 */
export default function ProjectTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
