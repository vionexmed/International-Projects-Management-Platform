"use client";

import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChangePasswordDialog } from "@/features/account/change-password-dialog";
import type { Dictionary } from "@/lib/i18n/dictionary";

/** The password dialog with its own trigger, for a page rather than a menu. */
export function ChangePasswordButton({ dict }: { dict: Dictionary }) {
  return (
    <ChangePasswordDialog
      trigger={
        <Button variant="secondary">
          <KeyRound />
          {dict.account.changePassword}
        </Button>
      }
      labels={{
        trigger: dict.account.changePassword,
        title: dict.account.changePassword,
        description: dict.account.changePasswordHint,
        current: dict.account.currentPassword,
        next: dict.account.newPassword,
        confirm: dict.account.confirmPassword,
        hint: dict.account.passwordRule,
        submit: dict.account.changePassword,
        success: dict.account.passwordChanged,
      }}
    />
  );
}
