"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/battle/rules";
import { useAudioBus } from "./audio-provider";

/**
 * Player mínimo: um botão redondo, uma barra fina e os tempos.
 *
 * O `<audio>` fica sem `controls` (escondido do desenho, presente no DOM) e a
 * barra é um `input[type=range]` de verdade — assim seta e Home/End já
 * funcionam sem mouse, o que uma div com onPointerDown não daria de graça.
 */
export function AudioPlayer({
  trackId,
  src,
  title,
}: {
  trackId: string;
  src: string;
  title: string;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const { playingId, setPlayingId } = useAudioBus();
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const isPlaying = playingId === trackId;

  /**
   * Com `preload="metadata"` o áudio pode ficar pronto antes da hidratação, e
   * aí o `onLoadedMetadata` do React já passou sem ninguém ouvindo — era o que
   * deixava a duração em "--:--" na tela da campeã. Ao receber o elemento,
   * lemos o que ele já sabe em vez de esperar um evento que não virá.
   */
  const attach = useCallback((audio: HTMLAudioElement | null) => {
    ref.current = audio;
    if (audio && audio.readyState > 0 && Number.isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  }, []);

  // Outra faixa assumiu: esta se pausa sozinha.
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    if (!isPlaying && !audio.paused) audio.pause();
  }, [isPlaying]);

  async function toggle() {
    const audio = ref.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    // Marca antes de tocar: o player que estava tocando recebe a mudança e se
    // pausa, então nunca há dois tocando durante o await.
    setPlayingId(trackId);
    try {
      await audio.play();
    } catch {
      setPlayingId(null);
      setFailed(true);
    }
  }

  const max = duration && Number.isFinite(duration) ? duration : 0;

  return (
    <div className="flex items-center gap-3">
      <audio
        ref={attach}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlayingId(null);
          setCurrent(0);
        }}
        onError={() => setFailed(true)}
      />

      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        aria-label={isPlaying ? `Pausar ${title}` : `Tocar ${title}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
      >
        {isPlaying ? (
          <svg viewBox="0 0 12 14" className="h-3.5 w-3.5" aria-hidden="true" fill="currentColor">
            <rect x="0" y="0" width="4" height="14" rx="1" />
            <rect x="8" y="0" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 14" className="ml-0.5 h-3.5 w-3.5" aria-hidden="true" fill="currentColor">
            <path d="M0 1.2C0 .4.9-.1 1.6.3l10 5.6c.7.4.7 1.4 0 1.8l-10 5.6C.9 13.7 0 13.2 0 12.4V1.2Z" />
          </svg>
        )}
      </button>

      <span className="w-9 shrink-0 font-mono text-[0.68rem] tabular-nums text-muted">
        {formatTime(current)}
      </span>

      <input
        type="range"
        min={0}
        max={max || 0}
        step={0.1}
        value={Math.min(current, max || 0)}
        disabled={!max || failed}
        aria-label={`Posição de ${title}`}
        onChange={(event) => {
          const audio = ref.current;
          if (!audio) return;
          const next = Number(event.target.value);
          audio.currentTime = next;
          setCurrent(next);
        }}
        className="h-1 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-line accent-accent disabled:cursor-not-allowed [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
      />

      <span className="w-9 shrink-0 text-right font-mono text-[0.68rem] tabular-nums text-muted">
        {failed ? "erro" : formatTime(duration)}
      </span>
    </div>
  );
}
