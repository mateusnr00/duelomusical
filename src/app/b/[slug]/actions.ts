"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type VoteResult =
  | { error: string }
  | { ok: true; entryId: string; alreadyVoted: boolean };

/**
 * Registra o voto.
 *
 * Toda a validação (confronto aberto, música pertence ao par, um voto por
 * pessoa) acontece dentro de `music_battle_cast_vote`, na mesma transação da
 * escrita. Aqui não há checagem própria de propósito: repetir a regra no Next
 * criaria duas versões dela, e a que vale é a do banco.
 */
export async function castVote(
  slug: string,
  matchId: string,
  entryId: string,
): Promise<VoteResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("music_battle_cast_vote", {
    p_match_id: matchId,
    p_entry_id: entryId,
  });

  if (error) {
    return { error: error.message || "Não foi possível registrar seu voto." };
  }

  const payload = data as { entry_id: string; already_voted: boolean };

  // Revalida a página para o placar voltar atualizado sem recarregar a aba.
  revalidatePath(`/b/${slug}`);

  return {
    ok: true,
    entryId: payload.entry_id,
    alreadyVoted: payload.already_voted,
  };
}
