import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";

/**
 * A 404 inside the portal.
 *
 * The root one is in Portuguese and offers "Voltar ao dashboard" — a Vionex
 * route the supplier is redirected away from, so following it landed them back
 * where they started, in a language they may not read. This one speaks their
 * language and points somewhere they can actually go.
 */
export default async function SupplierNotFound() {
  const user = await requireSupplierUser();
  const dict = getDictionary(localeFromLanguage(user.language));

  return (
    <Panel className="mx-auto max-w-[520px]">
      <div className="px-6 py-10 text-center">
        <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-md border border-line bg-subtle">
          <FileQuestion className="size-5 text-muted" />
        </span>
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
          {dict.common.noResults}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted">{dict.common.tryAgain}</p>
        <Button asChild variant="primary" className="mt-6">
          <Link href="/supplier">{dict.nav.home}</Link>
        </Button>
      </div>
    </Panel>
  );
}
