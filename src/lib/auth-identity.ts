/**
 * Identidade de quem vota: nome de usuário, não e-mail.
 *
 * O Supabase Auth exige um endereço, então cada nome vira um endereço
 * sintético neste domínio. `.local` é reservado pela RFC 6762 e nunca resolve
 * na internet: nenhum nome cadastrado aqui pode colidir com um e-mail de
 * verdade, o que impede alguém de criar "dono@gmail.com" e assumir a conta
 * de outra pessoa.
 */
export const VOTER_EMAIL_DOMAIN = "duelo-musical.local";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/**
 * Transforma o que a pessoa digitou num nome válido, em vez de recusar.
 *
 * Recusar era o erro da primeira versão: quem digitava o próprio e-mail por
 * hábito, ou um nome com apóstrofo ou "+", só via mensagem de erro e não
 * conseguia se cadastrar. Aqui tudo que está fora do conjunto permitido vira
 * separador e o resto é aproveitado — "José D\'Ávila" vira "jose.d.avila",
 * "maria@gmail.com" vira "maria".
 */
export function normalizeUsername(raw: string): string {
  const semDominio = raw.split("@")[0] ?? "";

  return semDominio
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Tudo que não é letra, número ou separador vira ponto.
    .replace(/[^a-z0-9._-]+/g, ".")
    // Separadores repetidos viram um só: "ana..maria" fica "ana.maria".
    .replace(/([._-])[._-]+/g, "$1")
    // Nome não começa nem termina em separador.
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 30)
    .replace(/[._-]+$/g, "");
}

export function usernameError(username: string): string | null {
  if (!username) return "Escolha um nome de usuário.";
  if (username.length < 3) {
    return "O nome precisa ter ao menos 3 letras ou números.";
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Use letras, números, ponto, hífen ou sublinhado.";
  }
  return null;
}

/** Quem administra entrou por e-mail antes de existir nome de usuário. */
export function looksLikeEmail(raw: string): boolean {
  return raw.includes("@");
}

/**
 * Endereço usado no login. Aceita as duas formas para não quebrar quem já
 * tinha conta por e-mail quando o cadastro por nome entrou.
 */
export function loginEmailFor(raw: string): string {
  const value = raw.trim();
  if (looksLikeEmail(value)) return value.toLowerCase();
  return `${normalizeUsername(value)}@${VOTER_EMAIL_DOMAIN}`;
}
