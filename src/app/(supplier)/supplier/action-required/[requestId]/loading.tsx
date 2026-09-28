import { Skeleton } from "@/components/app/skeleton";
import { Panel } from "@/components/ui/card";

/** Mirrors a request: header, what is needed, the upload form, and the facts column. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1080px]" aria-busy="true">
      <div className="mb-7 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <Panel className="space-y-4 p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
            <div className="flex justify-end">
              <Skeleton className="h-10 w-40" />
            </div>
          </Panel>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
