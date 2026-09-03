"use client";

import { Cover } from "./cover";
import { AudioPlayer } from "@/components/player/audio-player";
import { Button } from "@/components/ui/button";
import { formatVotes } from "@/lib/battle/rules";
import type { Entry } from "@/lib/battle/types";

/**
 * Card de uma música dentro do confronto.
 *
 * `votes`/`percent` chegam nulos enquanto o resultado não pode ser revelado.
 * Nulo aqui significa que o número nem foi enviado ao navegador — esconder por
 * CSS deixaria o placar legível no HTML antes de o usuário votar.
 */
export function EntryCard({
  entry,
  playerId,
  votes,
  percent,
  isMyVote,
  isWinner,
  onVote,
  voteDisabled,
  voteLabel,
  compact = false,
}: {
  entry: Entry;
  /**
   * Identidade do player nesta posição da tela. Não é o id da música: a mesma
   * música aparece na semifinal e de novo na final ou na tela da campeã, e um
   * id repetido faria os dois players se acharem o mesmo — dois botões
   * mostrando "pausar" com um único áudio tocando.
   */
  playerId: string;
  votes: number | null;
  percent: number | null;
  isMyVote: boolean;
  isWinner: boolean;
  onVote?: () => void;
  voteDisabled?: boolean;
  voteLabel?: string;
  compact?: boolean;
}) {
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-sm border bg-surface transition-colors ${
        isWinner ? "border-accent/60" : "border-line"
      }`}
    >
      <div className={`relative w-full ${compact ? "aspect-[16/7]" : "aspect-[16/9]"}`}>
        <Cover src={entry.cover_url} alt={`Capa de ${entry.name}`} />
        {isWinner && (
          <span className="absolute left-3 top-3 rounded-sm bg-accent px-2 py-1 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-void">
            Venceu
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="text-base leading-tight font-medium">{entry.name}</h3>
          <p className="mt-1 text-sm text-muted">{entry.artist || "Artista não informado"}</p>
        </div>

        <AudioPlayer trackId={playerId} src={entry.audio_url} title={entry.name} />

        {votes !== null && percent !== null && (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-sm tabular-nums text-text">{percent}%</span>
              <span className="text-xs text-muted">
                {formatVotes(votes)} {votes === 1 ? "voto" : "votos"}
              </span>
            </div>
            <div
              className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line"
              role="img"
              aria-label={`${percent}% dos votos, ${formatVotes(votes)} ${
                votes === 1 ? "voto" : "votos"
              }`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${
                  isMyVote || isWinner ? "bg-accent" : "bg-muted-dim"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-auto">
          {isMyVote ? (
            <p className="flex items-center justify-center gap-2 rounded-sm border border-accent/40 px-5 py-3 text-[0.7rem] uppercase tracking-[0.16em] text-accent">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M6.2 12.4 2 8.2l1.4-1.4 2.8 2.8 6.4-6.4L14 4.6l-7.8 7.8Z" />
              </svg>
              Seu voto
            </p>
          ) : (
            onVote && (
              <Button
                type="button"
                onClick={onVote}
                disabled={voteDisabled}
                className="w-full"
              >
                {voteLabel ?? "Votar nessa música"}
              </Button>
            )
          )}
        </div>
      </div>
    </article>
  );
}
