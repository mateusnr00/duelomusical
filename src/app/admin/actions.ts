"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/battle/rules";
import type { Round, ShowResultsMode } from "@/lib/battle/types";

export type ActionResult = { error: string } | { ok: true };

/** Campo de data-hora vazio é null, não string vazia. */
function timestamp(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  return raw ? new Date(raw).toISOString() : null;
}

function battlePayload(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();

  return {
    name,
    slug: slugInput ? slugify(slugInput) : slugify(name),
    description: String(formData.get("description") ?? "").trim(),
    show_results_mode: String(
      formData.get("show_results_mode") ?? "AFTER_VOTE",
    ) as ShowResultsMode,
    semifinal_starts_at: timestamp(formData.get("semifinal_starts_at")),
    semifinal_ends_at: timestamp(formData.get("semifinal_ends_at")),
    final_starts_at: timestamp(formData.get("final_starts_at")),
    final_ends_at: timestamp(formData.get("final_ends_at")),
  };
}

function validate(payload: ReturnType<typeof battlePayload>): string | null {
  if (!payload.name) return "O nome da batalha é obrigatório.";
  if (!payload.slug) return "Não foi possível gerar o endereço na URL. Revise o nome.";
  return null;
}

/** Traduz o erro do Postgres para algo que o admin consiga agir. */
function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Já existe uma batalha com esse endereço (slug).";
  if (error.code === "42501") return "Sua conta não tem permissão para esta ação.";
  return error.message;
}

export async function createBattle(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const payload = battlePayload(formData);
  const invalid = validate(payload);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("music_battles")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { error: friendly(error) };

  revalidatePath("/admin/batalhas");
  redirect(`/admin/batalhas/${data.id}?criada=1`);
}

export async function updateBattle(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const payload = battlePayload(formData);
  const invalid = validate(payload);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("music_battles").update(payload).eq("id", id);

  if (error) return { error: friendly(error) };

  revalidatePath("/admin/batalhas");
  revalidatePath(`/admin/batalhas/${id}`);
  revalidatePath(`/b/${payload.slug}`);
  redirect(`/admin/batalhas/${id}?salva=1`);
}

export async function deleteBattle(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("music_battles").delete().eq("id", id);

  revalidatePath("/admin/batalhas");
  redirect(error ? "/admin/batalhas?erro=exclusao" : "/admin/batalhas?excluida=1");
}

/**
 * Salva as quatro músicas de uma vez.
 *
 * Só entra a linha que já tem nome e áudio: `audio_url` é NOT NULL no banco, e
 * gravar uma música sem faixa deixaria a batalha impossível de publicar sem
 * dizer por quê.
 */
export async function saveEntries(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const battleId = String(formData.get("battle_id") ?? "");
  const supabase = await createClient();

  const rows = [1, 2, 3, 4]
    .map((seed) => ({
      battle_id: battleId,
      seed,
      name: String(formData.get(`name_${seed}`) ?? "").trim(),
      artist: String(formData.get(`artist_${seed}`) ?? "").trim() || null,
      audio_url: String(formData.get(`audio_url_${seed}`) ?? "").trim(),
      cover_url: String(formData.get(`cover_url_${seed}`) ?? "").trim() || null,
    }))
    .filter((row) => row.name && row.audio_url);

  if (rows.length === 0) {
    return { error: "Cadastre ao menos uma música com nome e arquivo de áudio." };
  }

  const { error } = await supabase
    .from("music_battle_entries")
    .upsert(rows, { onConflict: "battle_id,seed" });

  if (error) return { error: friendly(error) };

  revalidatePath(`/admin/batalhas/${battleId}`);
  redirect(`/admin/batalhas/${battleId}?musicas=1`);
}

export async function publishBattle(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("music_battle_publish", { p_battle_id: id });

  revalidatePath("/", "layout");
  redirect(
    error
      ? `/admin/batalhas/${id}?erro=${encodeURIComponent(friendly(error))}`
      : `/admin/batalhas/${id}?publicada=1`,
  );
}

export async function closeRound(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const round = String(formData.get("round") ?? "SEMIFINAL") as Round;

  const supabase = await createClient();
  const { error } = await supabase.rpc("music_battle_close_round", {
    p_battle_id: id,
    p_round: round,
  });

  revalidatePath("/", "layout");
  redirect(
    error
      ? `/admin/batalhas/${id}/resultados?erro=${encodeURIComponent(friendly(error))}`
      : `/admin/batalhas/${id}/resultados?encerrada=${round}`,
  );
}

export async function reopenRound(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const round = String(formData.get("round") ?? "SEMIFINAL") as Round;

  const supabase = await createClient();
  const { error } = await supabase.rpc("music_battle_reopen_round", {
    p_battle_id: id,
    p_round: round,
  });

  revalidatePath("/", "layout");
  redirect(
    error
      ? `/admin/batalhas/${id}/resultados?erro=${encodeURIComponent(friendly(error))}`
      : `/admin/batalhas/${id}/resultados?reaberta=${round}`,
  );
}

export async function resolveTie(formData: FormData) {
  const battleId = String(formData.get("battle_id") ?? "");
  const matchId = String(formData.get("match_id") ?? "");
  const entryId = String(formData.get("entry_id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("music_battle_resolve_tie", {
    p_match_id: matchId,
    p_entry_id: entryId,
    p_note: note,
  });

  revalidatePath("/", "layout");
  redirect(
    error
      ? `/admin/batalhas/${battleId}/resultados?erro=${encodeURIComponent(friendly(error))}`
      : `/admin/batalhas/${battleId}/resultados?desempatada=1`,
  );
}
