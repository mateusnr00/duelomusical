"use client";

import { Cover } from "./cover";
import { AudioPlayer } from "@/components/player/audio-player";
import { formatVotes } from "@/lib/battle/rules";
import type { Entry } from "@/lib/battle/types";

/**
 * Tela da campeã. A animação é uma entrada só (fade + escala curta) e as
 * "partículas" são três pontos de brilho lento — o suficiente para marcar o
 * momento sem virar fogos de artifício.
 */
export function Champion({
  entry,
  votes,
  percent,
}: {
  entry: Entry;
  votes: number | null;
  percent: number | null;
}) {
  return (
    <section
      aria-label="Música campeã"
      className="animate-champion relative overflow-hidden rounded-sm border border-accent/40 bg-surface p-8 text-center"
    >
      <span
        aria-hidden="true"
        className="animate-spark absolute left-[18%] top-10 h-1 w-1 rounded-full bg-accent"
      />
      <span
        aria-hidden="true"
        className="animate-spark absolute right-[22%] top-20 h-1 w-1 rounded-full bg-accent [animation-delay:900ms]"
      />
      <span
        aria-hidden="true"
        className="animate-spark absolute left-[62%] top-6 h-px w-px rounded-full bg-accent [animation-delay:1800ms]"
      />

      <p className="text-2xl" aria-hidden="true">
        🏆
      </p>
      <h2 className="eyebrow mt-3 text-accent">Música campeã</h2>

      <div className="relative mx-auto mt-6 aspect-square w-full max-w-56 overflow-hidden rounded-sm">
        <Cover src={entry.cover_url} alt={`Capa de ${entry.name}`} sizes="14rem" priority />
      </div>

      <h3 className="mt-6 text-2xl leading-tight font-medium">{entry.name}</h3>
      <p className="mt-1 text-sm text-muted">{entry.artist || "Artista não informado"}</p>

      {votes !== null && (
        <p className="mt-6 font-mono text-sm tabular-nums text-text">
          {formatVotes(votes)} {votes === 1 ? "voto" : "votos"}
          {percent !== null && (
            <span className="ml-2 text-muted">· {percent}% da final</span>
          )}
        </p>
      )}

      <div className="mx-auto mt-6 max-w-xs">
        <AudioPlayer trackId={`campea:${entry.id}`} src={entry.audio_url} title={entry.name} />
      </div>
    </section>
  );
}
