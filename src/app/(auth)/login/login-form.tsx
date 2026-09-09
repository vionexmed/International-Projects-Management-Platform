"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { signIn, type SignInState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/config";

function SubmitButton({ dict }: { dict: Dictionary }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
      {pending ? dict.auth.signingIn : dict.auth.signIn}
    </Button>
  );
}

export function LoginForm({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const [state, formAction] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
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
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{dict.auth.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
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

      <div className="pt-2">
        <SubmitButton dict={dict} />
      </div>
    </form>
  );
}
