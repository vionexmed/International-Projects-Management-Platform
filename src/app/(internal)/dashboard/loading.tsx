import { PanelSkeleton, Skeleton } from "@/components/app/skeleton";

/** Mirrors the page: greeting and summary line, the attention panel, the deadlines. */
export default function Loading() {
  return (
    <>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-96" />
      </div>

      <div className="space-y-10">
        <div className="space-y-3">
          <Skeleton className="h-5 w-52" />
          <PanelSkeleton lines={5} />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-4 border-y border-line py-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-2/3" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
