"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error: string } | { ok: true; message?: string };

/**
 * Só destinos internos são aceitos depois do login: aceitar a URL crua abriria
 * redirecionamento aberto — um link de login que joga o visitante em outro site.
 */
function safeRedirect(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? "");
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: safeRedirect(formData.get("redirect")),
  };
}

export async function signIn(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const { email, password, next } = readCredentials(formData);
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "E-mail ou senha incorretos." };
  redirect(next);
}

export async function signUp(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const { email, password, next } = readCredentials(formData);

  if (!email) return { error: "Informe seu e-mail." };
  if (password.length < 8) return { error: "A senha precisa ter ao menos 8 caracteres." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: error.message };

  // Com confirmação de e-mail ligada no projeto, o cadastro não devolve sessão:
  // avisamos em vez de mandar para a votação e deixar o voto falhar lá.
  if (!data.session) {
    return { ok: true, message: "Confira seu e-mail para confirmar o cadastro." };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
