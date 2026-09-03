import Link from "next/link";
import { notFound } from "next/navigation";
import { closeRound, reopenRound, resolveTie } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  battleStatusLabel,
  formatVotes,
  matchLabel,
  matchStatusLabel,
  sharePercent,
} from "@/lib/battle/rules";
import { createClient } from "@/lib/supabase/server";
import type { AdminMatch, AdminResults, BattleRow, Entry } from "@/lib/battle/types";

export const dynamic = "force-dynamic";

function Bar({ votes, percent, winner }: { votes: number; percent: number; winner: boolean }) {
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-sm tabular-nums">{percent}%</span>
        <span className="text-xs text-muted">
          {formatVotes(votes)} {votes === 1 ? "voto" : "votos"}
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${winner ? "bg-accent" : "bg-muted-dim"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MatchResult({
  match,
  entries,
  battleId,
}: {
  match: AdminMatch;
  entries: Map<string, Entry>;
  battleId: string;
}) {
  const entryA = match.entry_a_id ? entries.get(match.entry_a_id) : undefined;
  const entryB = match.entry_b_id ? entries.get(match.entry_b_id) : undefined;
  const [percentA, percentB] = sharePercent(match.votes_a, match.votes_b);

  return (
    <article className="rounded-sm border border-line bg-surface p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium tracking-[0.16em] uppercase">
          {matchLabel(match.round, match.position)}
        </h3>
        <span
          className={`rounded-sm border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.16em] ${
            match.status === "TIE"
              ? "border-danger/40 text-danger"
              : match.status === "OPEN"
                ? "border-accent/40 text-accent"
                : "border-line-strong text-muted"
          }`}
        >
          {matchStatusLabel[match.status]}
        </span>
      </header>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium">{entryA?.name ?? "—"}</p>
          <p className="text-xs text-muted">{entryA?.artist || "Artista não informado"}</p>
          <Bar votes={match.votes_a} percent={percentA} winner={match.winner_id === entryA?.id} />
        </div>
        <div>
          <p className="text-sm font-medium">{entryB?.name ?? "—"}</p>
          <p className="text-xs text-muted">{entryB?.artist || "Artista não informado"}</p>
          <Bar votes={match.votes_b} percent={percentB} winner={match.winner_id === entryB?.id} />
        </div>
      </div>

      {match.status === "TIE" && entryA && entryB && (
        <form action={resolveTie} className="mt-6 border-t border-line pt-5">
          <input type="hidden" name="battle_id" value={battleId} />
          <input type="hidden" name="match_id" value={match.id} />

          <p className="text-sm text-danger">
            Empate em {formatVotes(match.votes_a)}{" "}
            {match.votes_a === 1 ? "voto" : "votos"}. Nenhum vencedor foi escolhido
            automaticamente — decida quem avança.
          </p>

          <fieldset className="mt-4">
            <legend className="eyebrow">Quem avança</legend>
            <div className="mt-3 space-y-2">
              {[entryA, entryB].map((entry) => (
                <label key={entry.id} className="flex items-center gap-3 text-sm">
                  <input type="radio" name="entry_id" value={entry.id} required className="accent-accent" />
                  {entry.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 max-w-md">
            <Field label="Motivo (opcional)" htmlFor={`note_${match.id}`}>
              <Input
                id={`note_${match.id}`}
                name="note"
                placeholder="Critério usado para desempatar"
              />
            </Field>
          </div>

          <div className="mt-5">
            <Button type="submit">Desempatar manualmente</Button>
          </div>
        </form>
      )}

      {match.winner_decision_type === "MANUAL" && (
        <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
          Vencedor definido manualmente
          {match.decided_at &&
            ` em ${new Date(match.decided_at).toLocaleString("pt-BR")}`}
          {match.decision_note && ` · ${match.decision_note}`}
        </p>
      )}
    </article>
  );
}

export default async function ResultadosPage({
  params,
  searchParams,
}: PageProps<"/admin/batalhas/[id]/resultados">) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: battle }, { data: entryRows }, { data: resultsData }] = await Promise.all([
    supabase.from("music_battles").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("music_battle_entries")
      .select("id, name, artist, audio_url, cover_url, seed")
      .eq("battle_id", id)
      .order("seed"),
    supabase.rpc("music_battle_results", { p_battle_id: id }),
  ]);

  if (!battle) notFound();

  const row = battle as BattleRow;
  const entries = new Map(((entryRows ?? []) as Entry[]).map((entry) => [entry.id, entry]));
  const results = (resultsData ?? { matches: [], total_votes: 0 }) as AdminResults;

  const semifinals = results.matches.filter((match) => match.round === "SEMIFINAL");
  const final = results.matches.find((match) => match.round === "FINAL");

  const semifinalsDone = semifinals.length === 2 && semifinals.every((m) => m.status === "FINISHED");
  const champion = final?.winner_id ? entries.get(final.winner_id) : undefined;

  return (
    <>
      <Link href={`/admin/batalhas/${id}`} className="eyebrow transition-colors hover:text-text">
        ← {row.name}
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl leading-tight font-medium">Resultados</h1>
          <p className="mt-2 text-sm text-muted">{battleStatusLabel[row.status]}</p>
        </div>
        <p className="text-sm text-muted">
          Total de votos:{" "}
          <strong className="font-mono tabular-nums text-text">
            {formatVotes(results.total_votes)}
          </strong>
        </p>
      </div>

      {typeof query.erro === "string" && (
        <p role="alert" className="mt-8 border-l-2 border-danger bg-danger/5 px-5 py-3 text-sm text-danger">
          {query.erro}
        </p>
      )}
      {(query.encerrada || query.desempatada || query.reaberta) && (
        <p role="status" className="mt-8 border-l-2 border-accent bg-accent/5 px-5 py-3 text-sm">
          {query.desempatada
            ? "Vencedor definido. A final foi montada com os dois semifinalistas."
            : query.reaberta
              ? "Rodada reaberta para votação."
              : "Rodada encerrada."}
        </p>
      )}

      {row.status === "DRAFT" ? (
        <p className="mt-12 rounded-sm border border-dashed border-line p-10 text-center text-sm text-muted">
          A batalha ainda é um rascunho. Publique as semifinais para começar a receber votos.
        </p>
      ) : (
        <>
          <section className="mt-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="eyebrow">Semifinais</h2>
              <div className="flex items-center gap-5">
                {!semifinalsDone && (
                  <form action={closeRound}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="round" value="SEMIFINAL" />
                    <ConfirmButton
                      variant="primary"
                      pendingLabel="Apurando…"
                      question="Encerrar as semifinais e apurar os votos? A final é montada automaticamente com os vencedores."
                    >
                      Encerrar semifinais
                    </ConfirmButton>
                  </form>
                )}
                {semifinalsDone && row.status !== "FINISHED" && (
                  <form action={reopenRound}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="round" value="SEMIFINAL" />
                    <ConfirmButton
                      pendingLabel="Reabrindo…"
                      question="Reabrir as semifinais? A final montada será desfeita."
                    >
                      Reabrir
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-6">
              {semifinals.map((match) => (
                <MatchResult key={match.id} match={match} entries={entries} battleId={id} />
              ))}
            </div>
          </section>

          <section className="mt-14 border-t border-line pt-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="eyebrow">Grande final</h2>
              {final && final.status !== "FINISHED" && (
                <form action={closeRound}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="round" value="FINAL" />
                  <ConfirmButton
                    variant="primary"
                    pendingLabel="Apurando…"
                    question="Encerrar a final e definir a campeã?"
                  >
                    Encerrar final
                  </ConfirmButton>
                </form>
              )}
            </div>

            {final ? (
              <div className="mt-6">
                <MatchResult match={final} entries={entries} battleId={id} />
              </div>
            ) : (
              <p className="mt-6 rounded-sm border border-dashed border-line p-8 text-center text-sm text-muted">
                A final é criada automaticamente quando as duas semifinais tiverem vencedor.
              </p>
            )}
          </section>

          {champion && (
            <section className="mt-14 border-t border-line pt-12">
              <h2 className="eyebrow">Campeã</h2>
              <p className="mt-4 text-2xl font-medium text-accent">
                🏆 {champion.name}
              </p>
              <p className="mt-1 text-sm text-muted">
                {champion.artist || "Artista não informado"}
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
