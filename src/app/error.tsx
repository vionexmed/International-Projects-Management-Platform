"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Friendly failure surface. The underlying error is logged for operators but
 * never shown to the user (§59).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[vionex] unhandled error", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold text-ink">Algo deu errado.</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Não foi possível carregar esta página. Tente novamente em instantes.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-faint">Referência: {error.digest}</p>
        ) : null}
        <Button variant="primary" className="mt-5" onClick={reset}>
          <RotateCw />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
