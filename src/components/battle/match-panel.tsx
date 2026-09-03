"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EntryCard } from "./entry-card";
import { Countdown } from "./countdown";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { castVote } from "@/app/b/[slug]/actions";
import { matchLabel, matchStatusLabel, sharePercent } from "@/lib/battle/rules";
import type { Battle, Entry, Match } from "@/lib/battle/types";

function StatusBadge({ match }: { match: Match }) {
  const tone =
    match.status === "OPEN"
      ? "border-accent/40 text-accent"
      : match.status === "TIE"
        ? "border-danger/40 text-danger"
        : "border-line-strong text-muted";

  return (
    <span className={`rounded-sm border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.16em] ${tone}`}>
      {matchStatusLabel[match.status]}
    </span>
  );
}

export function MatchPanel({
  battle,
  match,
  entryA,
  entryB,
  signedIn,
  compact = false,
}: {
  battle: Battle;
  match: Match;
  entryA: Entry | null;
  entryB: Entry | null;
  signedIn: boolean;
  compact?: boolean;
}) {
  const [confirming, setConfirming] = useState<Entry | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const votesA = match.votes_a;
  const votesB = match.votes_b;
  const [percentA, percentB] =
    votesA !== null && votesB !== null ? sharePercent(votesA, votesB) : [null, null];

  const votingOpen = match.status === "OPEN" && !match.my_vote_entry_id;

  function confirm() {
    const entry = confirming;
    if (!entry || pending) return;

    startTransition(async () => {
      const result = await castVote(battle.slug, match.id, entry.id);
      setConfirming(null);

      if ("error" in result) {
        toast(result.error, "error");
        return;
      }

      toast(result.alreadyVoted ? "Você já tinha votado neste confronto." : "Voto registrado!");
      // Traz o placar novo sem recarregar a página inteira.
      router.refresh();
    });
  }

  function cardFor(entry: Entry | null, votes: number | null, percent: number | null) {
    if (!entry) {
      return (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-dashed border-line p-6 text-center text-sm text-muted-dim">
          Aguardando o vencedor da semifinal
        </div>
      );
    }

    return (
      <EntryCard
        entry={entry}
        playerId={`${match.id}:${entry.id}`}
        votes={votes}
        percent={percent}
        isMyVote={match.my_vote_entry_id === entry.id}
        isWinner={match.winner_id === entry.id}
        compact={compact}
        onVote={votingOpen ? () => setConfirming(entry) : undefined}
        voteDisabled={pending || !signedIn}
        voteLabel={signedIn ? "Votar nessa música" : "Entre para votar"}
      />
    );
  }

  return (
    <section
      id={`confronto-${match.id}`}
      aria-label={matchLabel(match.round, match.position)}
      // No desktop a seção ocupa a linha inteira do grid e centra o conteúdo:
      // é isso que faz o centro dos cards cair perto de onde a linha do
      // chaveamento sai, do lado.
      // `scroll-mt` dá respiro quando a chave compacta rola até aqui.
      className="animate-rise scroll-mt-6 lg:flex lg:h-full lg:flex-col"
    >
      {/* A altura fixa vale só a partir de `lg`, onde o conector do chaveamento
          a usa para saber onde começam os cards. No mobile não há conector e o
          cabeçalho quebra em duas linhas, então ele precisa crescer. */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:h-7">
        <h2 className="text-sm font-medium tracking-[0.18em] uppercase">
          {matchLabel(match.round, match.position)}
        </h2>
        <div className="flex items-center gap-3">
          {match.status === "OPEN" && match.ends_at && (
            <Countdown endsAt={match.ends_at} label="Encerra em" />
          )}
          <StatusBadge match={match} />
        </div>
      </header>

      {match.status === "TIE" && (
        <p role="status" className="mb-4 border-l-2 border-danger bg-danger/5 px-4 py-3 text-sm text-danger">
          Empate. O resultado deste confronto será definido pela organização.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch lg:flex-1">
        {cardFor(entryA, votesA, percentA)}
        <span
          aria-hidden="true"
          className="mx-auto self-center text-xs tracking-[0.2em] text-muted-dim uppercase"
        >
          vs
        </span>
        {cardFor(entryB, votesB, percentB)}
      </div>

      <Dialog open={confirming !== null} onClose={() => !pending && setConfirming(null)} title="Confirmar voto">
        <h3 className="text-base font-medium">Confirmar voto?</h3>
        <p className="mt-3 text-sm text-muted">
          Você está votando em{" "}
          <strong className="font-medium text-text">{confirming?.name}</strong>
          {confirming?.artist ? `, de ${confirming.artist}` : ""}. O voto é único neste
          confronto e não pode ser trocado depois.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirming(null)}
            disabled={pending}
          >
            Cancelar
          </Button>
          {/* `disabled` enquanto pendente é o que impede o clique duplo na
              interface; o banco impede de verdade, pelo índice único. */}
          <Button type="button" onClick={confirm} disabled={pending}>
            {pending ? "Registrando…" : "Confirmar voto"}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
