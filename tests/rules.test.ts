import { describe, expect, it } from "vitest";
import {
  buildFinalPairing,
  buildSemifinalPairs,
  champion,
  decideMatch,
  formatTime,
  matchLabel,
  rejectVote,
  sharePercent,
  shouldShowResults,
  slugify,
} from "@/lib/battle/rules";
import type { BattleView } from "@/lib/battle/types";

const match = {
  status: "OPEN" as const,
  entry_a_id: "a",
  entry_b_id: "b",
  starts_at: null,
  ends_at: null,
  my_vote_entry_id: null,
};

describe("montagem das semifinais", () => {
  it("cria os dois confrontos pelas posições: 1v2 e 3v4", () => {
    const pairs = buildSemifinalPairs([
      { id: "m1", seed: 1 },
      { id: "m2", seed: 2 },
      { id: "m3", seed: 3 },
      { id: "m4", seed: 4 },
    ]);

    expect(pairs).toEqual([
      { position: 1, entryAId: "m1", entryBId: "m2" },
      { position: 2, entryAId: "m3", entryBId: "m4" },
    ]);
  });

  it("recusa uma batalha que não tem exatamente 4 músicas", () => {
    expect(() =>
      buildSemifinalPairs([
        { id: "m1", seed: 1 },
        { id: "m2", seed: 2 },
        { id: "m3", seed: 3 },
      ]),
    ).toThrow(/exatamente 4/);
  });
});

describe("apuração", () => {
  it("quem tem mais votos vence", () => {
    expect(decideMatch(328, 251)).toEqual({ outcome: "WINNER", winner: "A" });
    expect(decideMatch(198, 401)).toEqual({ outcome: "WINNER", winner: "B" });
  });

  it("empate não escolhe vencedor", () => {
    expect(decideMatch(300, 300)).toEqual({ outcome: "TIE" });
  });

  it("zero a zero é empate, e não vitória de ninguém", () => {
    expect(decideMatch(0, 0)).toEqual({ outcome: "TIE" });
  });

  it("um voto de diferença já decide", () => {
    expect(decideMatch(1, 0)).toEqual({ outcome: "WINNER", winner: "A" });
  });
});

describe("final", () => {
  it("recebe exatamente os dois vencedores das semifinais", () => {
    expect(buildFinalPairing("m1", "m4")).toEqual({ entryAId: "m1", entryBId: "m4" });
  });

  it("não existe enquanto uma das semifinais não tiver vencedor", () => {
    expect(buildFinalPairing("m1", null)).toBeNull();
    expect(buildFinalPairing(null, "m4")).toBeNull();
    expect(buildFinalPairing(null, null)).toBeNull();
  });
});

describe("validação do voto", () => {
  it("aceita voto de quem entrou, em confronto aberto e música do par", () => {
    expect(
      rejectVote({ signedIn: true, battleStatus: "SEMIFINAL", match, entryId: "a" }),
    ).toBeNull();
  });

  it("recusa quem não entrou na conta", () => {
    expect(
      rejectVote({ signedIn: false, battleStatus: "SEMIFINAL", match, entryId: "a" }),
    ).toBe("NAO_AUTENTICADO");
  });

  it("recusa música que não participa do confronto", () => {
    expect(
      rejectVote({ signedIn: true, battleStatus: "SEMIFINAL", match, entryId: "outra" }),
    ).toBe("MUSICA_FORA_DO_CONFRONTO");
  });

  it("recusa confronto já encerrado", () => {
    expect(
      rejectVote({
        signedIn: true,
        battleStatus: "SEMIFINAL",
        match: { ...match, status: "FINISHED" },
        entryId: "a",
      }),
    ).toBe("CONFRONTO_FECHADO");
  });

  it("recusa segundo voto no mesmo confronto", () => {
    expect(
      rejectVote({
        signedIn: true,
        battleStatus: "SEMIFINAL",
        match: { ...match, my_vote_entry_id: "a" },
        entryId: "b",
      }),
    ).toBe("JA_VOTOU");
  });

  it("recusa voto depois do prazo da fase", () => {
    expect(
      rejectVote({
        signedIn: true,
        battleStatus: "SEMIFINAL",
        match: { ...match, ends_at: "2020-01-01T00:00:00Z" },
        entryId: "a",
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    ).toBe("FORA_DO_PRAZO");
  });

  it("ter votado na semifinal não impede votar na final", () => {
    // Confrontos diferentes são objetos diferentes: o voto da semifinal fica
    // no confronto dela e o da final chega sem voto anterior.
    const finalMatch = { ...match, entry_a_id: "a", entry_b_id: "d" };
    expect(
      rejectVote({ signedIn: true, battleStatus: "FINAL", match: finalMatch, entryId: "d" }),
    ).toBeNull();
  });
});

describe("quando o placar aparece", () => {
  const base = { battleStatus: "SEMIFINAL" as const, matchStatus: "OPEN" as const };

  it("AFTER_VOTE esconde antes do voto e mostra depois", () => {
    expect(shouldShowResults({ ...base, mode: "AFTER_VOTE", hasVoted: false })).toBe(false);
    expect(shouldShowResults({ ...base, mode: "AFTER_VOTE", hasVoted: true })).toBe(true);
  });

  it("AFTER_ROUND só mostra quando o confronto encerra", () => {
    expect(shouldShowResults({ ...base, mode: "AFTER_ROUND", hasVoted: true })).toBe(false);
    expect(
      shouldShowResults({ ...base, matchStatus: "FINISHED", mode: "AFTER_ROUND", hasVoted: false }),
    ).toBe(true);
  });

  it("ALWAYS mostra sempre e HIDDEN só no fim da batalha", () => {
    expect(shouldShowResults({ ...base, mode: "ALWAYS", hasVoted: false })).toBe(true);
    expect(shouldShowResults({ ...base, mode: "HIDDEN", hasVoted: true })).toBe(false);
    expect(
      shouldShowResults({ ...base, battleStatus: "FINISHED", mode: "HIDDEN", hasVoted: false }),
    ).toBe(true);
  });
});

describe("apresentação", () => {
  it("percentuais somam 100", () => {
    expect(sharePercent(328, 192)).toEqual([63, 37]);
    expect(sharePercent(1, 2)).toEqual([33, 67]);
    expect(sharePercent(0, 0)).toEqual([0, 0]);
  });

  it("rótulo do confronto", () => {
    expect(matchLabel("SEMIFINAL", 1)).toBe("SEMIFINAL 01");
    expect(matchLabel("SEMIFINAL", 2)).toBe("SEMIFINAL 02");
    expect(matchLabel("FINAL", 1)).toBe("GRANDE FINAL");
  });

  it("tempo do player, com duração desconhecida", () => {
    expect(formatTime(14)).toBe("0:14");
    expect(formatTime(151)).toBe("2:31");
    expect(formatTime(null)).toBe("--:--");
    expect(formatTime(Number.NaN)).toBe("--:--");
  });

  it("slug sai sem acento nem espaço", () => {
    expect(slugify("Escolha a próxima música!")).toBe("escolha-a-proxima-musica");
  });
});

describe("campeã", () => {
  const view = (status: BattleView["battle"]["status"], winnerId: string | null): BattleView => ({
    battle: {
      id: "b",
      name: "Batalha",
      slug: "batalha",
      description: "",
      status,
      show_results_mode: "AFTER_VOTE",
      semifinal_starts_at: null,
      semifinal_ends_at: null,
      final_starts_at: null,
      final_ends_at: null,
    },
    entries: [
      { id: "a", name: "Faixa 01", artist: null, audio_url: "a.mp3", cover_url: null, seed: 1 },
      { id: "d", name: "Faixa 04", artist: null, audio_url: "d.mp3", cover_url: null, seed: 4 },
    ],
    matches: [
      {
        id: "f",
        round: "FINAL",
        position: 1,
        status: winnerId ? "FINISHED" : "OPEN",
        entry_a_id: "a",
        entry_b_id: "d",
        winner_id: winnerId,
        winner_decision_type: winnerId ? "VOTES" : null,
        starts_at: null,
        ends_at: null,
        my_vote_entry_id: null,
        show_results: true,
        votes_a: 500,
        votes_b: 784,
      },
    ],
    viewer: { signed_in: true, is_admin: false },
  });

  it("é a vencedora da final quando a batalha encerra", () => {
    expect(champion(view("FINISHED", "d"))?.name).toBe("Faixa 04");
  });

  it("não existe enquanto a final está aberta", () => {
    expect(champion(view("FINAL", null))).toBeNull();
  });
});
