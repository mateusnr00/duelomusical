"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp, type AuthResult } from "@/app/entrar/actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { normalizeUsername } from "@/lib/auth-identity";

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
  const [digitado, setDigitado] = useState("");

  // O nome é ajustado antes de virar conta (acento sai, espaço vira ponto, o
  // que vem depois do "@" é descartado). Mostrar o resultado enquanto a pessoa
  // digita evita a surpresa de se cadastrar com um nome diferente do que leu.
  const nomeFinal = mode === "signup" ? normalizeUsername(digitado) : "";
  const mostrarPreview = nomeFinal.length > 0 && nomeFinal !== digitado.trim();

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="redirect" value={redirectTo} />

      <Field
        label="Usuário"
        htmlFor="identity"
        hint={
          mode === "signup"
            ? mostrarPreview
              ? `Você vai entrar como ${nomeFinal}`
              : "Letras, números, ponto, hífen ou sublinhado."
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
          placeholder="maria.silva"
          onChange={(event) => setDigitado(event.target.value)}
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
