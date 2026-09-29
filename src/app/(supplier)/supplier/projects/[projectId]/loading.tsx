import { Skeleton } from "@/components/app/skeleton";
import { Panel } from "@/components/ui/card";

/**
 * Tab content only — the project header and tabs belong to the layout and stay
 * on screen, so switching tabs never blanks the page.
 */
export default function Loading() {
  return (
    <div className="space-y-10" aria-busy="true">
      <Panel className="flex flex-wrap gap-x-10 gap-y-5 p-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-48" />
        </div>
      </Panel>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
