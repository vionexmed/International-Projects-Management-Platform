"use client";

import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { addPortalUserAction, updateUserAction } from "@/server/actions/users";
import type { Dictionary } from "@/lib/i18n/dictionary";

export type PortalUser = {
  id: string;
  name: string;
  role: string;
  jobTitle: string | null;
  status: string;
};

/**
 * A supplier administrator managing their own company.
 *
 * The company is never a field here. `createUser` takes it from the session, so
 * there is no value the browser could send that would place a user somewhere
 * else — the tenant boundary is not something this form can get wrong.
 *
 * Only the two portal roles are offered, and the server refuses anything else
 * regardless of what arrives.
 */
export function AddPortalUserDialog({ dict }: { dict: Dictionary }) {
  return (
    <FormDialog
      trigger={
        <Button variant="primary">
          <Plus />
          {dict.portal.team.add}
        </Button>
      }
      title={dict.portal.team.addTitle}
      action={addPortalUserAction}
      submitLabel={dict.portal.team.add}
      successMessage={dict.portal.team.added}
    >
      {(state) => (
        <>
          <FieldGrid>
            <Field name="name" label={dict.common.name} required state={state}>
              <Input id="name" name="name" required defaultValue="" />
            </Field>
            <Field name="email" label={dict.auth.email} required state={state}>
              <Input id="email" name="email" type="email" required defaultValue="" />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field
              name="role"
              label={dict.common.role}
              hint={dict.portal.team.roleHint}
              state={state}
            >
              <Select id="role" name="role" defaultValue="SUPPLIER_USER">
                <option value="SUPPLIER_USER">{dict.portal.team.roleUser}</option>
                <option value="SUPPLIER_ADMIN">{dict.portal.team.roleAdmin}</option>
              </Select>
            </Field>
            <Field name="jobTitle" label={dict.common.jobTitle} state={state}>
              <Input id="jobTitle" name="jobTitle" defaultValue="" />
            </Field>
          </FieldGrid>

          <Field
            name="password"
            label={dict.auth.password}
            hint={dict.account.passwordRule}
            required
            state={state}
          >
            <Input id="password" name="password" type="password" required defaultValue="" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

export function EditPortalUserDialog({ user, dict }: { user: PortalUser; dict: Dictionary }) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="iconSm" aria-label={`${dict.portal.team.editTitle}: ${user.name}`}>
          <Pencil />
        </Button>
      }
      title={dict.portal.team.editTitle}
      description={user.name}
      action={updateUserAction}
      submitLabel={dict.common.save}
      successMessage={dict.portal.team.updated}
    >
      {(state) => (
        <>
          <input type="hidden" name="userId" value={user.id} />

          <Field name="name" label={dict.common.name} required state={state}>
            <Input id="name" name="name" required defaultValue={user.name} />
          </Field>

          <FieldGrid>
            <Field
              name="role"
              label={dict.common.role}
              hint={dict.portal.team.lastAdmin}
              state={state}
            >
              <Select id="role" name="role" defaultValue={user.role}>
                <option value="SUPPLIER_USER">{dict.portal.team.roleUser}</option>
                <option value="SUPPLIER_ADMIN">{dict.portal.team.roleAdmin}</option>
              </Select>
            </Field>

            <Field name="status" label={dict.common.status} state={state}>
              <Select id="status" name="status" defaultValue={user.status}>
                <option value="ACTIVE">{dict.enums.userStatus.ACTIVE}</option>
                <option value="SUSPENDED">{dict.enums.userStatus.SUSPENDED}</option>
              </Select>
            </Field>
          </FieldGrid>

          <Field name="jobTitle" label={dict.common.jobTitle} state={state}>
            <Input id="jobTitle" name="jobTitle" defaultValue={user.jobTitle ?? ""} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
