"use client";

import { useCallback, useSyncExternalStore } from "react";

function remaining(target: string): string | null {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;

  const total = Math.floor(diff / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

/**
 * Contagem regressiva da fase.
 *
 * O relógio é um sistema externo ao React, então quem o lê é
 * `useSyncExternalStore`: o snapshot do servidor é nulo e o do navegador tem a
 * hora local. Assim não há divergência de hidratação — os dois relógios nunca
 * marcam o mesmo instante — nem `setState` dentro de efeito a cada segundo.
 */
export function Countdown({ endsAt, label }: { endsAt: string; label: string }) {
  const snapshot = useCallback(() => remaining(endsAt), [endsAt]);
  const value = useSyncExternalStore(subscribe, snapshot, () => null);

  if (!value) return null;

  return (
    <p className="eyebrow">
      {label} <span className="font-mono tabular-nums text-accent">{value}</span>
    </p>
  );
}
