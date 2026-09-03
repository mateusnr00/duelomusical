import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Entrar no painel" };

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-20">
      <p className="eyebrow">Duelo Musical</p>
      <h1 className="mt-3 text-2xl font-medium">Painel</h1>
      <p className="mt-2 text-sm text-muted">
        Acesso restrito a administradores da batalha. Entre com o e-mail cadastrado.
      </p>
      <AuthForm mode="signin" redirectTo="/admin/batalhas" />
    </main>
  );
}
