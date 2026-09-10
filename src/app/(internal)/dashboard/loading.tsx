import { PanelSkeleton, Skeleton } from "@/components/app/skeleton";
import { Panel } from "@/components/ui/card";

export default function Loading() {
  return (
    <>
      <div className="mb-7 space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Panel className="mb-8">
        <div className="stat-grid grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3 px-5 py-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>
      </Panel>

      <div className="mb-8 space-y-3">
        <Skeleton className="h-4 w-52" />
        <PanelSkeleton lines={5} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelSkeleton lines={4} />
        <PanelSkeleton lines={4} />
      </div>
    </>
  );
}
