"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";

/**
 * Keeps the navy shell in place when a page below it fails, so the user can
 * move somewhere else instead of hitting a bare error screen.
 */
export default function InternalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[vionex:internal]", error);
  }, [error]);

  return (
    <Panel className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-base font-semibold text-ink">Algo deu errado.</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        Não foi possível carregar esta página. Tente novamente ou volte ao dashboard.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[11px] text-faint">Referência: {error.digest}</p>
      ) : null}
      <div className="mt-5 flex items-center justify-center gap-2">
        <Button variant="primary" onClick={reset}>
          <RotateCw />
          Tentar novamente
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">Ir para o dashboard</Link>
        </Button>
      </div>
    </Panel>
  );
}
