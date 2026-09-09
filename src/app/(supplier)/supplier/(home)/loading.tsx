import { PanelSkeleton, Skeleton } from "@/components/app/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-6">
        <PanelSkeleton lines={2} />
        <PanelSkeleton lines={3} />
      </div>
    </div>
  );
}
