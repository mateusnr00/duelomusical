import { describe, expect, it } from "vitest";
import {
  VOTER_EMAIL_DOMAIN,
  loginEmailFor,
  looksLikeEmail,
  normalizeUsername,
  usernameError,
} from "@/lib/auth-identity";

describe("nome de usuário", () => {
  it("tira acento, maiúscula e troca espaço por ponto", () => {
    expect(normalizeUsername("Maria Silva")).toBe("maria.silva");
    expect(normalizeUsername("  JOÃO  ")).toBe("joao");
    expect(normalizeUsername("André Luís Ção")).toBe("andre.luis.cao");
  });

  it("aceita nomes no formato esperado", () => {
    for (const nome of ["maria.silva", "joao", "dj-2000", "fa_do_rock"]) {
      expect(usernameError(nome)).toBeNull();
    }
  });

  it("recusa nome curto, vazio ou com caractere fora do conjunto", () => {
    expect(usernameError("")).toMatch(/Escolha um nome/);
    expect(usernameError("ab")).toMatch(/3 a 30/);
    expect(usernameError("a".repeat(31))).toMatch(/3 a 30/);
    expect(usernameError(".comeca.com.ponto")).toMatch(/3 a 30/);
    expect(usernameError("com espaco")).toMatch(/3 a 30/);
  });

  it("recusa nome com @, que é o que impede assumir um e-mail de verdade", () => {
    expect(usernameError(normalizeUsername("mateusnr08@gmail.com"))).toMatch(/3 a 30/);
  });
});

describe("endereço usado no login", () => {
  it("nome vira endereço no domínio reservado", () => {
    expect(loginEmailFor("Maria Silva")).toBe(`maria.silva@${VOTER_EMAIL_DOMAIN}`);
  });

  it("e-mail continua sendo e-mail, para quem já tinha conta assim", () => {
    expect(loginEmailFor("  Fulano@Exemplo.com ")).toBe("fulano@exemplo.com");
    expect(looksLikeEmail("fulano@exemplo.com")).toBe(true);
    expect(looksLikeEmail("fulano")).toBe(false);
  });

  it("o domínio é `.local`, que nunca resolve na internet", () => {
    expect(VOTER_EMAIL_DOMAIN.endsWith(".local")).toBe(true);
  });
});
