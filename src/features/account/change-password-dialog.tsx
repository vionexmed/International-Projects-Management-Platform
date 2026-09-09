"use client";

import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FormDialog } from "@/components/app/form-dialog";
import { changePasswordAction } from "@/server/actions/account";

export type PasswordLabels = {
  trigger: string;
  title: string;
  description: string;
  current: string;
  next: string;
  confirm: string;
  hint: string;
  submit: string;
  success: string;
};

export const PT_PASSWORD_LABELS: PasswordLabels = {
  trigger: "Alterar senha",
  title: "Alterar senha",
  description: "Escolha uma senha nova para a sua conta.",
  current: "Senha atual",
  next: "Nova senha",
  confirm: "Confirmar nova senha",
  hint: "Mínimo de 8 caracteres.",
  submit: "Alterar senha",
  success: "Senha alterada.",
};

/**
 * Available from the account menu in both environments, so a supplier is not
 * stuck with the initial password Vionex sent them.
 */
export function ChangePasswordDialog({
  labels,
  trigger,
  open,
  onOpenChange,
}: {
  labels: PasswordLabels;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      title={labels.title}
      description={labels.description}
      action={changePasswordAction}
      submitLabel={labels.submit}
      successMessage={labels.success}
    >
      {(state) => (
        <>
          <Field name="currentPassword" label={labels.current} required state={state}>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <Field name="newPassword" label={labels.next} hint={labels.hint} required state={state}>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>

          <Field name="confirmPassword" label={labels.confirm} required state={state}>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

export { KeyRound as ChangePasswordIcon };
