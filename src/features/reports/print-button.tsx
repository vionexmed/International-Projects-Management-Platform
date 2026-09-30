"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Prints the report (or saves it as PDF from the print dialog); the app chrome is hidden in print. */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer />
      Imprimir / PDF
    </Button>
  );
}
