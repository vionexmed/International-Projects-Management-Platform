"use client";

import { Input } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { updateOwnProfileAction } from "@/server/actions/account";
import type { Dictionary } from "@/lib/i18n/dictionary";

/**
 * What a person may change about themselves: how they are named, and what they
 * do. The company, the role and the account status are not on this form and
 * not accepted by the action — they decide access, and access is not
 * self-service.
 */
export function ProfileForm({
  dict,
  name,
  jobTitle,
}: {
  dict: Dictionary;
  name: string;
  jobTitle: string | null;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary">
          <Pencil />
          {dict.common.edit}
        </Button>
      }
      title={dict.portal.profile.title}
      action={updateOwnProfileAction}
      submitLabel={dict.common.save}
      successMessage={dict.portal.profile.updated}
    >
      {(state) => (
        <FieldGrid>
          <Field name="name" label={dict.common.name} required state={state}>
            <Input id="name" name="name" required defaultValue={name} />
          </Field>
          <Field name="jobTitle" label={dict.common.jobTitle} state={state}>
            <Input id="jobTitle" name="jobTitle" defaultValue={jobTitle ?? ""} />
          </Field>
        </FieldGrid>
      )}
    </FormDialog>
  );
}
