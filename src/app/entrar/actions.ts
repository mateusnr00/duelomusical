"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  VOTER_EMAIL_DOMAIN,
  loginEmailFor,
  looksLikeEmail,
  normalizeUsername,
  usernameError,
} from "@/lib/auth-identity";

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
    identity: String(formData.get("identity") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: safeRedirect(formData.get("redirect")),
  };
}

export async function signIn(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const { identity, password, next } = readCredentials(formData);
  if (!identity || !password) return { error: "Informe seu nome e a senha." };

  const supabase = await createClient();

  // Primeira tentativa: o que a pessoa digitou. Com "@" é um e-mail de
  // verdade, que é como as contas de administrador entram.
  const { error } = await supabase.auth.signInWithPassword({
    email: loginEmailFor(identity),
    password,
  });

  if (!error) redirect(next);

  // Quem se cadastrou digitando o próprio e-mail ficou com a conta no nome
  // antes do "@" (maria@gmail.com virou "maria"). Sem esta segunda tentativa
  // essa pessoa se cadastraria e depois não conseguiria voltar.
  if (looksLikeEmail(identity)) {
    const { error: erroPorNome } = await supabase.auth.signInWithPassword({
      email: `${normalizeUsername(identity)}@${VOTER_EMAIL_DOMAIN}`,
      password,
    });
    if (!erroPorNome) redirect(next);
  }

  return { error: "Nome ou senha incorretos." };
}

/**
 * Cadastro por nome, sem e-mail.
 *
 * Não usa `auth.signUp` de propósito: ele dispara e-mail de confirmação, e o
 * SMTP embutido do projeto estoura o limite com poucas pessoas ("email rate
 * limit exceeded"). A função no banco cria a conta já confirmada, e aqui a
 * pessoa entra em seguida — cadastrar e ficar logado viram um passo só.
 */
export async function signUp(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const { identity, password, next } = readCredentials(formData);

  const username = normalizeUsername(identity);
  const invalid = usernameError(username);
  if (invalid) return { error: invalid };
  if (password.length < 6) return { error: "A senha precisa ter ao menos 6 caracteres." };

  const supabase = await createClient();

  const { error: signUpError } = await supabase.rpc("music_battle_signup", {
    p_username: username,
    p_password: password,
  });

  if (signUpError) {
    return { error: signUpError.message || "Não foi possível criar a conta." };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: loginEmailFor(username),
    password,
  });

  // A conta já existe neste ponto; só a sessão falhou. Dizer "não deu certo"
  // faria a pessoa tentar de novo e esbarrar no nome já em uso, então o aviso
  // diz o que realmente aconteceu — e carrega o motivo, que é o que permite
  // diagnosticar se isso acontecer em produção.
  if (signInError) {
    return {
      ok: true,
      message: `Conta criada, mas a entrada automática falhou (${signInError.message}). Use "Entrar" com o nome ${username}.`,
    };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
