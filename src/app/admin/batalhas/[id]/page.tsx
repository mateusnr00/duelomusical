import Link from "next/link";
import { notFound } from "next/navigation";
import { publishBattle } from "@/app/admin/actions";
import { BattleForm } from "@/components/admin/battle-form";
import { EntriesForm } from "@/components/admin/entries-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { battleStatusLabel } from "@/lib/battle/rules";
import { createClient } from "@/lib/supabase/server";
import type { BattleRow, Entry } from "@/lib/battle/types";

export const dynamic = "force-dynamic";

const flashes: Record<string, string> = {
  criada: "Batalha criada. Agora cadastre as quatro músicas.",
  salva: "Alterações salvas.",
  musicas: "Músicas salvas.",
  publicada: "Semifinais publicadas. A página já está no ar.",
};

export default async function EditarBatalhaPage({
  params,
  searchParams,
}: PageProps<"/admin/batalhas/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: battle }, { data: entryRows }] = await Promise.all([
    supabase.from("music_battles").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("music_battle_entries")
      .select("id, name, artist, audio_url, cover_url, seed")
      .eq("battle_id", id)
      .order("seed"),
  ]);

  if (!battle) notFound();

  const entries = (entryRows ?? []) as Entry[];
  const row = battle as BattleRow;
  const flashKey = Object.keys(flashes).find((key) => query[key]);
  const complete = entries.length === 4;

  return (
    <>
      <Link href="/admin/batalhas" className="eyebrow transition-colors hover:text-text">
        ← Batalhas
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl leading-tight font-medium">{row.name}</h1>
          <p className="mt-2 text-sm text-muted">
            {battleStatusLabel[row.status]} · /b/{row.slug}
          </p>
        </div>
        <Link
          href={`/admin/batalhas/${row.id}/resultados`}
          className="eyebrow transition-colors hover:text-text"
        >
          Resultados e apuração →
        </Link>
      </div>

      {flashKey && (
        <p role="status" className="mt-8 border-l-2 border-accent bg-accent/5 px-5 py-3 text-sm">
          {flashes[flashKey]}
        </p>
      )}

      {typeof query.erro === "string" && (
        <p role="alert" className="mt-8 border-l-2 border-danger bg-danger/5 px-5 py-3 text-sm text-danger">
          {query.erro}
        </p>
      )}

      <section className="mt-12">
        <h2 className="eyebrow">Dados da batalha</h2>
        <div className="mt-6">
          <BattleForm battle={row} />
        </div>
      </section>

      <section className="mt-16 border-t border-line pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="eyebrow">As quatro músicas</h2>
            <p className="mt-2 text-sm text-muted">
              {entries.length} de 4 cadastradas. A posição define o chaveamento: 01 contra
              02 na semifinal 01, e 03 contra 04 na semifinal 02.
            </p>
          </div>
        </div>
        <div className="mt-8">
          <EntriesForm
            battleId={row.id}
            entries={entries}
            locked={row.status !== "DRAFT"}
          />
        </div>
      </section>

      {row.status === "DRAFT" && (
        <section className="mt-16 border-t border-line pt-12">
          <h2 className="eyebrow">Publicar</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Publicar monta as duas semifinais automaticamente a partir das posições e abre
            a votação na página pública.
          </p>
          {!complete && (
            <p className="mt-4 max-w-2xl border-l-2 border-danger bg-danger/5 px-4 py-3 text-sm text-danger">
              Faltam músicas: são necessárias exatamente 4, cada uma com nome e arquivo de
              áudio.
            </p>
          )}
          <form action={publishBattle} className="mt-6">
            <input type="hidden" name="id" value={row.id} />
            <ConfirmButton
              variant="primary"
              pendingLabel="Publicando…"
              question="Publicar as semifinais e abrir a votação?"
            >
              Publicar semifinais
            </ConfirmButton>
          </form>
        </section>
      )}
    </>
  );
}
