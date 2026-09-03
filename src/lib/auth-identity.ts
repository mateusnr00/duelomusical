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
 * Deixa o que a pessoa digitou no formato aceito: sem acento, sem maiúscula,
 * e espaços viram ponto — "Mateus Rocha" vira "mateus.rocha". É conveniência
 * de interface; quem recusa de fato é a função no banco, que só aceita o
 * formato final.
 */
export function normalizeUsername(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
}

export function usernameError(username: string): string | null {
  if (!username) return "Escolha um nome de usuário.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Use de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.";
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
