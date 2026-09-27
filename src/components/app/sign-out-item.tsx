"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { DropdownItem } from "@/components/ui/dropdown";
import { signOut } from "@/server/actions/auth";

/**
 * "Sign out" inside an account dropdown.
 *
 * Not a `<form action={signOut}>` around the item: selecting a Radix item
 * closes the menu and unmounts its content before the button's native submit
 * runs, so the form never posted and the user stayed signed in. The action is
 * called from `onSelect` instead, which fires before the menu closes.
 */
export function SignOutItem({ label }: { label: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <DropdownItem
      destructive
      disabled={pending}
      onSelect={() => startTransition(() => signOut())}
    >
      <LogOut />
      {label}
    </DropdownItem>
  );
}
