"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type AudioBus = {
  /** Id da faixa tocando agora, ou null. */
  playingId: string | null;
  setPlayingId: (id: string | null) => void;
};

const AudioContext = createContext<AudioBus | null>(null);

/**
 * Só uma música toca por vez na página.
 *
 * A regra vive aqui e não em cada player: guardar "quem está tocando" num
 * único lugar faz o player anterior se pausar sozinho quando outro começa,
 * sem os players precisarem se conhecer.
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  return (
    <AudioContext.Provider value={{ playingId, setPlayingId }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudioBus(): AudioBus {
  const bus = useContext(AudioContext);
  if (!bus) throw new Error("useAudioBus precisa do AudioProvider acima na árvore.");
  return bus;
}
