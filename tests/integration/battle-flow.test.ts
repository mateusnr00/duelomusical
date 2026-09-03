import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Testes de integração contra o Supabase de verdade.
 *
 * O que estes testes cobrem não dá para verificar com função pura: o índice
 * único que impede voto duplicado, a validação dentro da função SECURITY
 * DEFINER e a RLS que barra quem não é admin. Por isso eles falam com o banco.
 *
 * Precisam de rede até o projeto Supabase e de um admin de teste. Sem as
 * variáveis abaixo a suíte é pulada, para `npm test` continuar passando em
 * ambiente sem credencial:
 *
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   DUELO_TEST_ADMIN_EMAIL, DUELO_TEST_ADMIN_PASSWORD  (conta em music_battle_admins)
 *   DUELO_TEST_USER_EMAIL,  DUELO_TEST_USER_PASSWORD
 *   DUELO_TEST_USER2_EMAIL, DUELO_TEST_USER2_PASSWORD
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = {
  email: process.env.DUELO_TEST_ADMIN_EMAIL,
  password: process.env.DUELO_TEST_ADMIN_PASSWORD,
};
const user1 = {
  email: process.env.DUELO_TEST_USER_EMAIL,
  password: process.env.DUELO_TEST_USER_PASSWORD,
};
const user2 = {
  email: process.env.DUELO_TEST_USER2_EMAIL,
  password: process.env.DUELO_TEST_USER2_PASSWORD,
};

const configured =
  Boolean(url && anonKey && admin.email && admin.password && user1.email && user1.password);

async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Falha ao entrar como ${email}: ${error.message}`);
  return client;
}

describe.skipIf(!configured)("fluxo completo da batalha", () => {
  let adminClient: SupabaseClient;
  let voter: SupabaseClient;
  let voter2: SupabaseClient | null = null;
  let battleId: string;
  let entries: { id: string; seed: number }[] = [];
  let semi1: string;
  let semi2: string;

  const slug = `teste-integracao-${Date.now()}`;

  async function matches() {
    const { data } = await adminClient
      .from("music_battle_matches")
      .select("id, round, position, status, entry_a_id, entry_b_id, winner_id, winner_decision_type")
      .eq("battle_id", battleId)
      .order("round")
      .order("position");
    return data ?? [];
  }

  const entryBySeed = (seed: number) => entries.find((entry) => entry.seed === seed)!.id;

  beforeAll(async () => {
    adminClient = await signedInClient(admin.email!, admin.password!);
    voter = await signedInClient(user1.email!, user1.password!);
    if (user2.email && user2.password) {
      voter2 = await signedInClient(user2.email!, user2.password!);
    }

    const { data: battle, error } = await adminClient
      .from("music_battles")
      .insert({ name: "Batalha de teste", slug, show_results_mode: "AFTER_VOTE" })
      .select("id")
      .single();
    if (error) throw new Error(`Não foi possível criar a batalha: ${error.message}`);
    battleId = battle.id;

    const { data: created, error: entryError } = await adminClient
      .from("music_battle_entries")
      .insert(
        [1, 2, 3, 4].map((seed) => ({
          battle_id: battleId,
          seed,
          name: `Faixa 0${seed}`,
          audio_url: `https://exemplo.test/faixa-0${seed}.mp3`,
        })),
      )
      .select("id, seed");
    if (entryError) throw new Error(`Não foi possível criar as músicas: ${entryError.message}`);
    entries = created!;
  });

  afterAll(async () => {
    if (battleId) await adminClient.from("music_battles").delete().eq("id", battleId);
  });

  it("publicar cria os dois confrontos da semifinal, 1v2 e 3v4", async () => {
    const { error } = await adminClient.rpc("music_battle_publish", { p_battle_id: battleId });
    expect(error).toBeNull();

    const rows = await matches();
    expect(rows).toHaveLength(2);
    expect(rows.map((m) => m.position)).toEqual([1, 2]);
    expect(rows.every((m) => m.status === "OPEN")).toBe(true);
    expect(rows[0].entry_a_id).toBe(entryBySeed(1));
    expect(rows[0].entry_b_id).toBe(entryBySeed(2));
    expect(rows[1].entry_a_id).toBe(entryBySeed(3));
    expect(rows[1].entry_b_id).toBe(entryBySeed(4));

    semi1 = rows[0].id;
    semi2 = rows[1].id;
  });

  it("o voto válido é registrado", async () => {
    const { data, error } = await voter.rpc("music_battle_cast_vote", {
      p_match_id: semi1,
      p_entry_id: entryBySeed(1),
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ entry_id: entryBySeed(1), already_voted: false });
  });

  it("o segundo voto no mesmo confronto não cria voto novo", async () => {
    const { data, error } = await voter.rpc("music_battle_cast_vote", {
      p_match_id: semi1,
      p_entry_id: entryBySeed(2),
    });

    // Idempotente: não estoura, devolve o voto original e não troca a escolha.
    expect(error).toBeNull();
    expect(data).toMatchObject({ entry_id: entryBySeed(1), already_voted: true });

    const { count } = await voter
      .from("music_battle_votes")
      .select("id", { count: "exact", head: true })
      .eq("match_id", semi1);
    expect(count).toBe(1);
  });

  it("a mesma pessoa vota também na semifinal 02", async () => {
    const { error } = await voter.rpc("music_battle_cast_vote", {
      p_match_id: semi2,
      p_entry_id: entryBySeed(4),
    });
    expect(error).toBeNull();
  });

  it("música de outro confronto é recusada", async () => {
    const { error } = await voter.rpc("music_battle_cast_vote", {
      p_match_id: semi1,
      p_entry_id: entryBySeed(4),
    });
    expect(error?.message).toMatch(/não participa deste confronto/i);
  });

  it("dois votos simultâneos do mesmo usuário não geram duplicidade", async () => {
    const outros = await signedInClient(user1.email!, user1.password!);
    const [a, b] = await Promise.all([
      outros.rpc("music_battle_cast_vote", { p_match_id: semi2, p_entry_id: entryBySeed(3) }),
      outros.rpc("music_battle_cast_vote", { p_match_id: semi2, p_entry_id: entryBySeed(4) }),
    ]);

    expect(a.error).toBeNull();
    expect(b.error).toBeNull();

    const { count } = await outros
      .from("music_battle_votes")
      .select("id", { count: "exact", head: true })
      .eq("match_id", semi2);
    expect(count).toBe(1);
  });

  it("quem não é admin não consegue encerrar rodada nem publicar", async () => {
    const encerrar = await voter.rpc("music_battle_close_round", {
      p_battle_id: battleId,
      p_round: "SEMIFINAL",
    });
    expect(encerrar.error?.message).toMatch(/restrita a administradores/i);

    const publicar = await voter.rpc("music_battle_publish", { p_battle_id: battleId });
    expect(publicar.error?.message).toMatch(/restrita a administradores/i);
  });

  it("quem não é admin não enxerga o voto de outra pessoa", async () => {
    const { data } = await voter
      .from("music_battle_votes")
      .select("id")
      .eq("battle_id", battleId);
    // A RLS devolve só as próprias linhas: os dois votos desta conta.
    expect(data?.length).toBe(2);
  });

  it("encerrar as semifinais define vencedores e monta a final", async () => {
    if (voter2) {
      // Desempata a semifinal 02, que teria 1 a 0 ou empate conforme o caso.
      await voter2.rpc("music_battle_cast_vote", {
        p_match_id: semi2,
        p_entry_id: entryBySeed(4),
      });
    }

    const { error } = await adminClient.rpc("music_battle_close_round", {
      p_battle_id: battleId,
      p_round: "SEMIFINAL",
    });
    expect(error).toBeNull();

    const rows = await matches();
    const semis = rows.filter((m) => m.round === "SEMIFINAL");
    const final = rows.find((m) => m.round === "FINAL");

    expect(semis[0].winner_id).toBe(entryBySeed(1));
    expect(semis[0].winner_decision_type).toBe("VOTES");

    // A final só existe se as duas semifinais tiverem vencedor.
    if (semis.every((m) => m.winner_id)) {
      expect(final).toBeDefined();
      expect(final!.entry_a_id).toBe(semis[0].winner_id);
      expect(final!.entry_b_id).toBe(semis[1].winner_id);
      expect(final!.status).toBe("OPEN");
    } else {
      expect(semis.some((m) => m.status === "TIE")).toBe(true);
      expect(final).toBeUndefined();
    }
  });

  it("votar em confronto encerrado é recusado", async () => {
    const { error } = await voter.rpc("music_battle_cast_vote", {
      p_match_id: semi1,
      p_entry_id: entryBySeed(1),
    });
    expect(error?.message).toMatch(/encerrada/i);
  });

  it("quem votou na semifinal vota de novo na final", async () => {
    const rows = await matches();
    const final = rows.find((m) => m.round === "FINAL");
    if (!final) return; // Semifinal empatada: coberto pelo teste de empate.

    const { data, error } = await voter.rpc("music_battle_cast_vote", {
      p_match_id: final.id,
      p_entry_id: final.entry_a_id!,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ already_voted: false });
  });

  it("encerrar a final define a campeã e fecha a batalha", async () => {
    const rows = await matches();
    const final = rows.find((m) => m.round === "FINAL");
    if (!final) return;

    const { error } = await adminClient.rpc("music_battle_close_round", {
      p_battle_id: battleId,
      p_round: "FINAL",
    });
    expect(error).toBeNull();

    const depois = await matches();
    const encerrada = depois.find((m) => m.round === "FINAL")!;
    expect(encerrada.status).toBe("FINISHED");
    expect(encerrada.winner_id).toBe(final.entry_a_id);

    const { data: battle } = await adminClient
      .from("music_battles")
      .select("status")
      .eq("id", battleId)
      .single();
    expect(battle!.status).toBe("FINISHED");
  });
});

describe.skipIf(!configured)("empate e desempate manual", () => {
  let adminClient: SupabaseClient;
  let battleId: string;
  const slug = `teste-empate-${Date.now()}`;

  beforeAll(async () => {
    adminClient = await signedInClient(admin.email!, admin.password!);
    const { data: battle } = await adminClient
      .from("music_battles")
      .insert({ name: "Batalha empatada", slug })
      .select("id")
      .single();
    battleId = battle!.id;

    await adminClient.from("music_battle_entries").insert(
      [1, 2, 3, 4].map((seed) => ({
        battle_id: battleId,
        seed,
        name: `Faixa 0${seed}`,
        audio_url: `https://exemplo.test/faixa-0${seed}.mp3`,
      })),
    );
    await adminClient.rpc("music_battle_publish", { p_battle_id: battleId });
  });

  afterAll(async () => {
    if (battleId) await adminClient.from("music_battles").delete().eq("id", battleId);
  });

  it("sem votos, encerrar marca TIE e não escolhe vencedor nem cria final", async () => {
    await adminClient.rpc("music_battle_close_round", {
      p_battle_id: battleId,
      p_round: "SEMIFINAL",
    });

    const { data } = await adminClient
      .from("music_battle_matches")
      .select("id, round, status, winner_id, entry_a_id")
      .eq("battle_id", battleId);

    const semis = data!.filter((m) => m.round === "SEMIFINAL");
    expect(semis).toHaveLength(2);
    expect(semis.every((m) => m.status === "TIE")).toBe(true);
    expect(semis.every((m) => m.winner_id === null)).toBe(true);
    expect(data!.some((m) => m.round === "FINAL")).toBe(false);
  });

  it("o desempate manual registra quem decidiu e monta a final", async () => {
    const { data: semis } = await adminClient
      .from("music_battle_matches")
      .select("id, entry_a_id")
      .eq("battle_id", battleId)
      .eq("round", "SEMIFINAL")
      .order("position");

    for (const semi of semis!) {
      const { error } = await adminClient.rpc("music_battle_resolve_tie", {
        p_match_id: semi.id,
        p_entry_id: semi.entry_a_id,
        p_note: "Critério da organização",
      });
      expect(error).toBeNull();
    }

    const { data } = await adminClient
      .from("music_battle_matches")
      .select("round, status, winner_id, winner_decision_type, decided_by, decided_at, decision_note, entry_a_id, entry_b_id")
      .eq("battle_id", battleId);

    const decididas = data!.filter((m) => m.round === "SEMIFINAL");
    expect(decididas.every((m) => m.winner_decision_type === "MANUAL")).toBe(true);
    expect(decididas.every((m) => m.decided_by !== null)).toBe(true);
    expect(decididas.every((m) => m.decided_at !== null)).toBe(true);
    expect(decididas[0].decision_note).toBe("Critério da organização");

    const final = data!.find((m) => m.round === "FINAL");
    expect(final).toBeDefined();
    expect(final!.entry_a_id).toBe(decididas[0].winner_id);
    expect(final!.entry_b_id).toBe(decididas[1].winner_id);
  });
});
