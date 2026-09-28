import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HistoryBackButton } from "@/components/app/nav-memory";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Erro 404</p>
        <h1 className="mt-2 text-lg font-semibold text-ink">Página não encontrada.</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          O endereço não existe ou você não tem acesso a ele.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <HistoryBackButton fallbackHref="/dashboard" label="Voltar" />
          <Button variant="secondary" asChild>
            <Link href="/dashboard">Ir para o dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
