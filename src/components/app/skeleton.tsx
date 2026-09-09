import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/card";
import { TableShell } from "@/components/ui/table";

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("animate-pulse rounded-sm bg-line-soft", className)} style={style} />;
}

/** Placeholder that mirrors the shape of a list page while it loads. */
export function TablePageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      <div className="mb-7 space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>
      <TableShell>
        <div className="border-b border-line bg-subtle px-5 py-3">
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="divide-y divide-line-soft">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-6 px-5 py-4">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </TableShell>
    </>
  );
}

export function PanelSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <Panel className="p-5">
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className="h-4" style={{ width: `${90 - index * 12}%` }} />
        ))}
      </div>
    </Panel>
  );
}
