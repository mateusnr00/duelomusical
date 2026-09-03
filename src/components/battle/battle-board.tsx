"use client";

import { MatchPanel } from "./match-panel";
import { CompactBracket } from "./compact-bracket";
import { Champion } from "./champion";
import { AudioProvider } from "@/components/player/audio-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ButtonLink } from "@/components/ui/button";
import {
  battleStatusLabel,
  entryById,
  findMatch,
  sharePercent,
} from "@/lib/battle/rules";
import type { BattleView, Match } from "@/lib/battle/types";

/**
 * Linhas do chaveamento, só no desktop.
 *
 * Desenhadas em CSS sobre uma coluna que repete o mesmo grid de duas linhas
 * das semifinais. Como as duas linhas têm altura igual, o centro de cada uma
 * cai em `top-1/2` da sua própria linha, e o encontro das duas é exatamente o
 * centro da coluna — que é onde sai a linha da final. Assim a geometria
 * continua certa quando os cards mudam de altura, o que um SVG com
 * coordenadas fixas não daria.
 */
function Connector() {
  return (
    <div aria-hidden="true" className="relative hidden grid-rows-2 gap-y-10 lg:grid">
      {[0, 1].map((linha) => (
        <div key={linha} className="flex flex-col">
          {/* Espelha o cabeçalho do confronto (h-7 + mb-4). É o que faz a linha
              sair no centro dos cards, e não no centro da seção inteira. */}
          <div className="mb-4 h-7" />
          <div className="relative flex-1">
            <span className="absolute top-1/2 left-0 w-1/2 border-t border-line" />
            {/* A vertical é feita em duas metades, uma por linha, e cada uma
                avança metade do espaçamento do grid (1.25rem). Juntas ligam o
                centro de uma semifinal ao da outra sem depender da altura dos
                cards. */}
            {linha === 0 ? (
              <span className="absolute top-1/2 -bottom-5 left-1/2 w-px bg-line" />
            ) : (
              // Sobe até 1.25rem acima da linha, atravessando o cabeçalho
              // espelhado (2.75rem) — daí o 4rem.
              <span className="absolute top-[-4rem] left-1/2 h-[calc(50%+4rem)] w-px bg-line" />
            )}
          </div>
        </div>
      ))}

      {/* Saída para a final: no meio das duas semifinais, deslocado meio
          cabeçalho para acompanhar os cards. */}
      <span className="absolute top-[calc(50%+1.375rem)] left-1/2 w-1/2 border-t border-line" />
    </div>
  );
}

function FinalPlaceholder() {
  return (
    <section aria-label="Grande final" className="animate-rise">
      <h2 className="mb-4 text-sm font-medium tracking-[0.18em] uppercase">Grande final</h2>
      <div className="rounded-sm border border-dashed border-line p-8 text-center">
        <p className="text-sm text-muted">
          Os dois finalistas entram aqui assim que as semifinais forem encerradas.
        </p>
      </div>
    </section>
  );
}

export function BattleBoard({ view }: { view: BattleView }) {
  const semi1 = findMatch(view, "SEMIFINAL", 1);
  const semi2 = findMatch(view, "SEMIFINAL", 2);
  const final = findMatch(view, "FINAL");

  const championEntry =
    view.battle.status === "FINISHED" && final?.winner_id
      ? entryById(view, final.winner_id)
      : null;

  function panel(match: Match | null, compact = false) {
    if (!match) return null;
    return (
      <MatchPanel
        battle={view.battle}
        match={match}
        entryA={entryById(view, match.entry_a_id)}
        entryB={entryById(view, match.entry_b_id)}
        signedIn={view.viewer.signed_in}
        compact={compact}
      />
    );
  }

  let championVotes: number | null = null;
  let championPercent: number | null = null;
  if (championEntry && final && final.votes_a !== null && final.votes_b !== null) {
    const isA = final.entry_a_id === championEntry.id;
    championVotes = isA ? final.votes_a : final.votes_b;
    const [percentA, percentB] = sharePercent(final.votes_a, final.votes_b);
    championPercent = isA ? percentA : percentB;
  }

  const finalColumn = championEntry ? (
    // A âncora acompanha a campeã: a chave compacta aponta para o confronto da
    // final, e encerrada a batalha é esta tela que ocupa o lugar dele.
    // O recuo repõe o cabeçalho que os confrontos têm e a campeã não, para a
    // linha do chaveamento chegar no centro dela.
    <div id={final ? `confronto-${final.id}` : undefined} className="scroll-mt-6 lg:pt-11">
      <Champion entry={championEntry} votes={championVotes} percent={championPercent} />
    </div>
  ) : final ? (
    panel(final, true)
  ) : (
    <FinalPlaceholder />
  );

  return (
    <ToastProvider>
      <AudioProvider>
        <header className="mb-12">
          <p className="eyebrow">Batalha de músicas · {battleStatusLabel[view.battle.status]}</p>
          <h1 className="mt-3 text-3xl leading-tight font-medium sm:text-4xl">
            {view.battle.name}
          </h1>
          {view.battle.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
              {view.battle.description}
            </p>
          )}

          {!view.viewer.signed_in && (
            <div className="mt-6 flex flex-wrap items-center gap-4 rounded-sm border border-line bg-surface px-5 py-4">
              <p className="text-sm text-muted">
                Ouça à vontade. Para votar, entre na sua conta.
              </p>
              <ButtonLink href={`/entrar?redirect=/b/${view.battle.slug}`} variant="outline">
                Entrar para votar
              </ButtonLink>
            </div>
          )}
        </header>

        {/* No mobile o chaveamento aparece primeiro em forma compacta, como
            panorama, e os cards de ouvir e votar vêm abaixo. No desktop cabe a
            chave inteira em cards, em três colunas com a final centrada. */}
        <CompactBracket view={view} />

        <div className="mt-12 lg:mt-0 lg:grid lg:grid-cols-[minmax(0,1.15fr)_4rem_minmax(0,1fr)] lg:items-stretch">
          <div className="grid gap-y-10 lg:grid-rows-2">
            {panel(semi1)}
            {panel(semi2)}
          </div>

          <Connector />

          {/* No mobile a final vem depois das semifinais e precisa do mesmo
              respiro que separa uma da outra; no desktop ela é uma coluna. */}
          <div className="mt-10 lg:mt-0 lg:self-center lg:pl-2">{finalColumn}</div>
        </div>
      </AudioProvider>
    </ToastProvider>
  );
}
