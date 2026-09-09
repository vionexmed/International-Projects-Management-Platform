import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { isPublicDemo } from "@/lib/demo";

/**
 * Permanent, unmissable marker on a deployment where DEMO_MODE is on.
 *
 * With the account chooser enabled anyone holding the URL is an administrator,
 * so nobody should ever be in doubt about whether they are looking at the real
 * system or a demonstration.
 */
export function DemoBanner() {
  if (!isPublicDemo()) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warn/25 bg-warn-soft px-4 py-1.5 text-[12px] text-warn">
      <span className="inline-flex items-center gap-1.5">
        <TriangleAlert className="size-3.5" />
        <strong className="font-semibold">Demonstração</strong>
      </span>
      <span>Dados fictícios · acesso sem senha habilitado</span>
      <Link href="/demo" className="font-medium underline underline-offset-2">
        Trocar de usuário
      </Link>
    </div>
  );
}
