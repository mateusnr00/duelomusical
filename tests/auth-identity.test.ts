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

  it("aproveita o que a pessoa digitou em vez de recusar", () => {
    // Era o bug: qualquer caractere fora do conjunto virava erro, e digitar o
    // próprio e-mail — o hábito mais comum — nunca deixava criar conta.
    expect(normalizeUsername("mateusnr10@gmail.com")).toBe("mateusnr10");
    expect(normalizeUsername("Mateus!")).toBe("mateus");
    expect(normalizeUsername("ana+teste")).toBe("ana.teste");
    expect(normalizeUsername("José D'Ávila")).toBe("jose.d.avila");
    expect(normalizeUsername("ana..maria")).toBe("ana.maria");
    expect(normalizeUsername("...bruno...")).toBe("bruno");

    for (const digitado of ["mateusnr10@gmail.com", "Mateus!", "ana+teste", "José D'Ávila"]) {
      expect(usernameError(normalizeUsername(digitado))).toBeNull();
    }
  });

  it("corta em 30 caracteres sem terminar em separador", () => {
    const longo = normalizeUsername("a".repeat(28) + " bc");
    expect(longo.length).toBeLessThanOrEqual(30);
    expect(longo.endsWith(".")).toBe(false);
  });

  it("só recusa quando não sobra nome utilizável", () => {
    expect(usernameError(normalizeUsername(""))).toMatch(/Escolha um nome/);
    expect(usernameError(normalizeUsername("!!!"))).toMatch(/Escolha um nome/);
    expect(usernameError(normalizeUsername("zé"))).toMatch(/ao menos 3/);
  });

  it("o nome nunca carrega @, então não vira um e-mail de verdade", () => {
    expect(normalizeUsername("mateusnr08@gmail.com")).not.toContain("@");
    expect(loginEmailFor("mateusnr08")).toBe(`mateusnr08@${VOTER_EMAIL_DOMAIN}`);
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

describe("cadastrar e depois entrar chegam na mesma conta", () => {
  // A regra que faz a senha funcionar no login não é a senha em si: é o nome
  // resolver para a mesma conta nas duas telas. Se divergir, a pessoa cria a
  // conta e depois não consegue voltar.
  const contaCriadaPor = (digitado: string) =>
    `${normalizeUsername(digitado)}@${VOTER_EMAIL_DOMAIN}`;

  const contaProcuradaNoLogin = (digitado: string) => {
    const primeira = loginEmailFor(digitado);
    // O login tenta o literal e, se o texto tem "@", cai para a forma por nome.
    return looksLikeEmail(digitado) ? contaCriadaPor(digitado) : primeira;
  };

  const digitados = [
    "mateus",
    "Mateus Rocha",
    "mateus rocha",
    "Mateus  Rocha",
    "MATEUS.ROCHA",
    "José D'Ávila",
    "Mateus!",
    "ana+teste",
    "maria@gmail.com",
  ];

  for (const digitado of digitados) {
    it(`"${digitado}"`, () => {
      expect(contaProcuradaNoLogin(digitado)).toBe(contaCriadaPor(digitado));
      expect(usernameError(normalizeUsername(digitado))).toBeNull();
    });
  }

  it("variações de como a pessoa escreve o mesmo nome caem na mesma conta", () => {
    const mesma = ["Mateus Rocha", "mateus rocha", "MATEUS  ROCHA", "mateus.rocha"];
    const contas = new Set(mesma.map(contaCriadaPor));
    expect(contas.size).toBe(1);
  });
});
