import Link from "next/link";
import { Cover } from "./cover";
import { formatVotes, matchLabel, sharePercent } from "@/lib/battle/rules";
import type { BattleView, Entry, Match } from "@/lib/battle/types";

/**
 * Chave compacta — a visão de campeonato, usada no mobile.
 *
 * No celular o chaveamento inteiro em cards não cabe sem virar uma árvore
 * horizontal gigante, então aqui ele aparece como panorama: duas colunas,
 * uma linha por música, vencedor destacado. Ouvir e votar acontece nos cards
 * logo abaixo, e cada confronto daqui é um link que leva até o seu card.
 */

function Row({
  entry,
  votes,
  isWinner,
  decided,
  isMyVote,
}: {
  entry: Entry | null;
  votes: number | null;
  isWinner: boolean;
  decided: boolean;
  isMyVote: boolean;
}) {
  // Quando o confronto acabou, quem perdeu recua para o segundo plano — é o
  // que faz o vencedor saltar aos olhos sem precisar de cor extra.
  const perdeu = decided && !isWinner;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <span
        aria-hidden="true"
        className={`h-6 w-0.5 shrink-0 rounded-full ${
          isWinner ? "bg-accent" : perdeu ? "bg-line-strong" : "bg-line"
        }`}
      />

      <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-[2px]">
        <Cover src={entry?.cover_url ?? null} alt="" sizes="24px" />
      </span>

      <span
        className={`min-w-0 flex-1 truncate text-[0.72rem] ${
          perdeu ? "text-muted" : "text-text"
        }`}
      >
        {entry?.name ?? "—"}
        {isMyVote && <span className="ml-1 text-accent">•</span>}
      </span>

      <span
        className={`shrink-0 font-mono text-[0.72rem] tabular-nums ${
          isWinner ? "text-accent" : "text-muted"
        }`}
      >
        {votes === null ? "–" : formatVotes(votes)}
      </span>
    </div>
  );
}

function CompactMatch({
  view,
  match,
}: {
  view: BattleView;
  match: Match | null;
}) {
  if (!match) {
    return (
      <div className="flex items-center justify-center rounded-sm border border-dashed border-line px-2 py-4 text-center text-[0.68rem] text-muted-dim">
        Aguardando os vencedores
      </div>
    );
  }

  const entryA = view.entries.find((e) => e.id === match.entry_a_id) ?? null;
  const entryB = view.entries.find((e) => e.id === match.entry_b_id) ?? null;
  const decided = match.winner_id !== null;

  // O placar segue a mesma regra do card: enquanto o resultado não pode
  // aparecer, os votos chegam nulos do banco e a linha mostra um traço.
  const votesA = match.votes_a;
  const votesB = match.votes_b;

  return (
    <Link
      href={`#confronto-${match.id}`}
      aria-label={`${matchLabel(match.round, match.position)}: ${
        entryA?.name ?? "a definir"
      } contra ${entryB?.name ?? "a definir"}. Ver e votar.`}
      className="block divide-y divide-line rounded-sm border border-line bg-surface transition-colors hover:border-line-strong"
    >
      <Row
        entry={entryA}
        votes={votesA}
        isWinner={match.winner_id === entryA?.id}
        decided={decided}
        isMyVote={match.my_vote_entry_id === entryA?.id}
      />
      <Row
        entry={entryB}
        votes={votesB}
        isWinner={match.winner_id === entryB?.id}
        decided={decided}
        isMyVote={match.my_vote_entry_id === entryB?.id}
      />
    </Link>
  );
}

/**
 * As linhas entre as colunas. Os confrontos compactos não têm cabeçalho, então
 * o centro de cada caixa é o centro da própria linha do grid, e as linhas saem
 * direto de `top-1/2` — sem precisar compensar altura nenhuma.
 */
function Lines() {
  return (
    <div aria-hidden="true" className="relative grid grid-rows-2 gap-y-4">
      <div className="relative">
        <span className="absolute top-1/2 left-0 w-1/2 border-t border-line" />
        <span className="absolute top-1/2 -bottom-2 left-1/2 w-px bg-line" />
      </div>
      <div className="relative">
        <span className="absolute top-1/2 left-0 w-1/2 border-t border-line" />
        <span className="absolute top-[-0.5rem] left-1/2 h-[calc(50%+0.5rem)] w-px bg-line" />
      </div>
      <span className="absolute top-1/2 left-1/2 w-1/2 border-t border-line" />
    </div>
  );
}

export function CompactBracket({ view }: { view: BattleView }) {
  const semi1 = view.matches.find((m) => m.round === "SEMIFINAL" && m.position === 1) ?? null;
  const semi2 = view.matches.find((m) => m.round === "SEMIFINAL" && m.position === 2) ?? null;
  const final = view.matches.find((m) => m.round === "FINAL") ?? null;

  const champion =
    view.battle.status === "FINISHED" && final?.winner_id
      ? view.entries.find((e) => e.id === final.winner_id)
      : null;

  const championPercent =
    champion && final && final.votes_a !== null && final.votes_b !== null
      ? sharePercent(final.votes_a, final.votes_b)[
          final.entry_a_id === champion.id ? 0 : 1
        ]
      : null;

  return (
    <nav aria-label="Chaveamento da batalha" className="lg:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_1.75rem_minmax(0,1fr)] gap-y-2">
        <p className="eyebrow">Semifinais</p>
        <span />
        <p className="eyebrow">Final</p>

        <div className="grid grid-rows-2 gap-y-4">
          <CompactMatch view={view} match={semi1} />
          <CompactMatch view={view} match={semi2} />
        </div>

        <Lines />

        <div className="self-center">
          <CompactMatch view={view} match={final} />
        </div>
      </div>

      {champion && (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-sm border border-accent/40 px-3 py-2 text-[0.72rem]">
          <span aria-hidden="true">🏆</span>
          <span className="text-accent">{champion.name}</span>
          {championPercent !== null && (
            <span className="text-muted">· {championPercent}%</span>
          )}
        </p>
      )}
    </nav>
  );
}
