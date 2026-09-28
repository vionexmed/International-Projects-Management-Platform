import { Skeleton } from "@/components/app/skeleton";
import { Panel } from "@/components/ui/card";

/** Mirrors the home page: greeting, the focal action card, projects with stage bars, updates. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[820px]" aria-busy="true">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Panel variant="focal" className="mb-10 space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-36 max-sm:hidden" />
        </div>
        <div className="space-y-3 border-t border-brand-line/40 pt-4">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </Panel>

      <Skeleton className="mb-4 h-5 w-32" />
      <div className="mb-10 divide-y divide-line-soft">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2 py-3">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-3 w-36" />
            <div className="flex max-w-[560px] gap-1 pt-1">
              {Array.from({ length: 4 }).map((__, segment) => (
                <Skeleton key={segment} className="h-1.5 flex-1 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="mb-4 h-5 w-36" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
      </div>
    </div>
  );
}
