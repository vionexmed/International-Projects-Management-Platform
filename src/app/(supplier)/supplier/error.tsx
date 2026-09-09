"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";

export default function SupplierError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[vionex:supplier]", error);
  }, [error]);

  return (
    <Panel className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-base font-semibold text-ink">Something went wrong.</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        This page could not be loaded. Please try again, or go back to the home page.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[11px] text-faint">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-5 flex items-center justify-center gap-2">
        <Button variant="primary" onClick={reset}>
          <RotateCw />
          Try again
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/supplier">Go to home</Link>
        </Button>
      </div>
    </Panel>
  );
}
