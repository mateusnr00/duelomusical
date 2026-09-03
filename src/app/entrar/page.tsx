import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const redirectTo = typeof params.redirect === "string" ? params.redirect : "/";
  const mode = params.modo === "cadastro" ? "signup" : "signin";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-20">
      <Link href="/" className="eyebrow transition-colors hover:text-text">
        ← Duelo Musical
      </Link>

      <h1 className="mt-8 text-2xl font-medium">
        {mode === "signup" ? "Criar conta" : "Entrar"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "signup"
          ? "Escolha um nome e uma senha. Não pedimos e-mail, e você já entra direto para votar."
          : "Sua conta serve para garantir um voto por pessoa em cada confronto."}
      </p>

      <AuthForm mode={mode} redirectTo={redirectTo} />

      <p className="mt-8 text-center text-sm text-muted">
        {mode === "signup" ? (
          <>
            Já tem conta?{" "}
            <Link
              href={`/entrar?redirect=${encodeURIComponent(redirectTo)}`}
              className="text-accent underline-offset-4 hover:underline"
            >
              Entrar
            </Link>
          </>
        ) : (
          <>
            Ainda não tem conta?{" "}
            <Link
              href={`/entrar?modo=cadastro&redirect=${encodeURIComponent(redirectTo)}`}
              className="text-accent underline-offset-4 hover:underline"
            >
              Criar agora
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
