"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp, type AuthResult } from "@/app/entrar/actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Enviando…" : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  redirectTo,
}: {
  mode: "signin" | "signup";
  redirectTo: string;
}) {
  const action = mode === "signup" ? signUp : signIn;
  const [state, formAction] = useActionState<AuthResult | null, FormData>(action, null);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="redirect" value={redirectTo} />

      <Field
        // No login o campo aceita as duas formas, porque as contas de
        // administrador foram criadas por e-mail antes do cadastro por nome.
        label={mode === "signup" ? "Nome de usuário" : "Nome de usuário ou e-mail"}
        htmlFor="identity"
        hint={
          mode === "signup"
            ? "Sem e-mail. Espaços viram ponto: Maria Silva fica maria.silva."
            : undefined
        }
      >
        <Input
          id="identity"
          name="identity"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder={mode === "signup" ? "maria.silva" : "seu nome ou e-mail"}
        />
      </Field>

      <Field
        label="Senha"
        htmlFor="password"
        hint={mode === "signup" ? "Ao menos 6 caracteres." : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 6 : undefined}
        />
      </Field>

      {state && "error" in state && <FormError>{state.error}</FormError>}
      {state && "ok" in state && state.message && (
        <p role="status" className="border-l-2 border-accent bg-accent/5 px-4 py-3 text-sm">
          {state.message}
        </p>
      )}

      <Submit label={mode === "signup" ? "Criar conta e entrar" : "Entrar"} />
    </form>
  );
}
