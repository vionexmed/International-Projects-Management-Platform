"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { signIn, type SignInState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/config";

/** Taller than the app's `h-9`: here the form *is* the page, not a table row. */
const FIELD = "h-11 text-[15px]";

function SubmitButton({ dict }: { dict: Dictionary }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      className="h-11 w-full text-[15px]"
      disabled={pending}
    >
      {pending ? dict.auth.signingIn : dict.auth.signIn}
    </Button>
  );
}

export function LoginForm({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const [state, formAction] = useActionState<SignInState, FormData>(signIn, {});
  const [visible, setVisible] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);

  /**
   * Caps Lock is the single most common reason a correct password is typed
   * wrong, and the field hides the evidence. The browser only reports the
   * modifier during a key event, so it is read from the event itself.
   */
  const readCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState("CapsLock"));
  };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />

      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-sm border border-risk/25 bg-risk-soft px-3 py-2.5 text-[13px] text-risk"
        >
          <AlertCircle className="mt-px size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">{dict.auth.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="nome@vionex.com"
          className={FIELD}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{dict.auth.password}</Label>

        <div className="relative">
          <Input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className={cn(FIELD, "pr-11")}
            onKeyUp={readCapsLock}
            onKeyDown={readCapsLock}
            onBlur={() => setCapsLock(false)}
          />

          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-pressed={visible}
            aria-label={visible ? dict.auth.hidePassword : dict.auth.showPassword}
            title={visible ? dict.auth.hidePassword : dict.auth.showPassword}
            className={cn(
              "absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-sm",
              "text-faint transition-colors hover:text-ink-soft focus-visible:text-ink-soft",
            )}
          >
            {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>

        {capsLock ? (
          <p role="status" className="flex items-center gap-1.5 pt-0.5 text-[12px] text-warn">
            <AlertCircle className="size-3.5 shrink-0" />
            {dict.auth.capsLockOn}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox id="remember" name="remember" />
          <Label htmlFor="remember" className="cursor-pointer font-normal">
            {dict.auth.rememberMe}
          </Label>
        </div>
        <a
          href="mailto:suporte@vionex.com?subject=Redefini%C3%A7%C3%A3o%20de%20senha"
          className="text-[13px] text-brand-strong underline-offset-4 hover:underline"
        >
          {dict.auth.forgotPassword}
        </a>
      </div>

      <SubmitButton dict={dict} />
    </form>
  );
}
