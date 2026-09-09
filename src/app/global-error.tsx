"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: catches failures in the root layout itself, where the
 * normal `error.tsx` cannot run. It must render its own <html>/<body> and
 * cannot rely on global styles being available, so everything is inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[vionex:root]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f7f9fa",
          color: "#14202c",
          fontFamily:
            "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main style={{ maxWidth: "24rem", padding: "0 1.5rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              color: "#687784",
            }}
          >
            VIONEX PROJECTS
          </p>
          <h1 style={{ margin: "0.75rem 0 0", fontSize: "1.125rem", fontWeight: 600 }}>
            Algo deu errado.
          </h1>
          <p style={{ margin: "0.375rem 0 0", fontSize: "13px", color: "#687784" }}>
            Não foi possível carregar a aplicação. Tente novamente em instantes.
          </p>
          {error.digest ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "11px", color: "#8b98a3" }}>
              Referência: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 0.875rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#ffffff",
              backgroundColor: "#00707c",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
