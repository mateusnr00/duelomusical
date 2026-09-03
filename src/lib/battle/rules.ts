import type {
  Battle,
  BattleView,
  Entry,
  Match,
  MatchStatus,
  Round,
  ShowResultsMode,
} from "./types";

/**
 * Regras do chaveamento em funções puras.
 *
 * A autoridade sobre voto e apuração é o banco (funções SECURITY DEFINER):
 * é lá que a validação acontece na mesma transação da escrita. O que está aqui
 * é a mesma regra do lado da interface — para decidir o que desenhar e para
 * ser testável sem rede. Onde as duas discordarem, vale o banco.
 */

/** Endereço da batalha na URL. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Confrontos da semifinal: 1v2 e 3v4, pela seed. */
export function buildSemifinalPairs(
  entries: Pick<Entry, "id" | "seed">[],
): { position: number; entryAId: string; entryBId: string }[] {
  const bySeed = new Map(entries.map((entry) => [entry.seed, entry.id]));
  const seeds = [1, 2, 3, 4];

  if (entries.length !== 4 || seeds.some((seed) => !bySeed.has(seed))) {
    throw new Error("A batalha precisa de exatamente 4 músicas, nas posições 1 a 4.");
  }

  return [
    { position: 1, entryAId: bySeed.get(1)!, entryBId: bySeed.get(2)! },
    { position: 2, entryAId: bySeed.get(3)!, entryBId: bySeed.get(4)! },
  ];
}

export type Decision =
  | { outcome: "WINNER"; winner: "A" | "B" }
  | { outcome: "TIE" };

/**
 * Apura um confronto. Empate nunca escolhe vencedor — inclusive 0 a 0, que é
 * empate de verdade e não "ninguém venceu, tanto faz".
 */
export function decideMatch(votesA: number, votesB: number): Decision {
  if (votesA > votesB) return { outcome: "WINNER", winner: "A" };
  if (votesB > votesA) return { outcome: "WINNER", winner: "B" };
  return { outcome: "TIE" };
}

/** Os dois finalistas saem obrigatoriamente das semifinais. */
export function buildFinalPairing(
  semifinal1WinnerId: string | null,
  semifinal2WinnerId: string | null,
): { entryAId: string; entryBId: string } | null {
  if (!semifinal1WinnerId || !semifinal2WinnerId) return null;
  return { entryAId: semifinal1WinnerId, entryBId: semifinal2WinnerId };
}

export type VoteRejection =
  | "NAO_AUTENTICADO"
  | "CONFRONTO_FECHADO"
  | "FORA_DO_PRAZO"
  | "AINDA_NAO_COMECOU"
  | "MUSICA_FORA_DO_CONFRONTO"
  | "JA_VOTOU";

/**
 * Espelho da validação da `music_battle_cast_vote`. Serve para desabilitar o
 * botão antes do clique; a recusa que vale é a do banco.
 */
export function rejectVote(input: {
  signedIn: boolean;
  battleStatus: Battle["status"];
  match: Pick<Match, "status" | "entry_a_id" | "entry_b_id" | "starts_at" | "ends_at" | "my_vote_entry_id">;
  entryId: string;
  now?: Date;
}): VoteRejection | null {
  const { signedIn, battleStatus, match, entryId } = input;
  const now = input.now ?? new Date();

  if (!signedIn) return "NAO_AUTENTICADO";
  if (battleStatus === "DRAFT" || battleStatus === "FINISHED") return "CONFRONTO_FECHADO";
  if (match.status !== "OPEN") return "CONFRONTO_FECHADO";
  if (match.starts_at && now < new Date(match.starts_at)) return "AINDA_NAO_COMECOU";
  if (match.ends_at && now > new Date(match.ends_at)) return "FORA_DO_PRAZO";
  if (entryId !== match.entry_a_id && entryId !== match.entry_b_id) {
    return "MUSICA_FORA_DO_CONFRONTO";
  }
  if (match.my_vote_entry_id) return "JA_VOTOU";
  return null;
}

/** Mesma tabela de decisão da `music_battle_view`. */
export function shouldShowResults(input: {
  mode: ShowResultsMode;
  battleStatus: Battle["status"];
  matchStatus: MatchStatus;
  hasVoted: boolean;
}): boolean {
  const { mode, battleStatus, matchStatus, hasVoted } = input;

  if (battleStatus === "FINISHED") return true;
  if (mode === "HIDDEN") return false;
  if (mode === "ALWAYS") return true;
  if (matchStatus !== "OPEN") return true;
  if (mode === "AFTER_VOTE") return hasVoted;
  return false;
}

/** Percentuais que somam 100 sem casas decimais, e 0/0 vira 0 e 0. */
export function sharePercent(votesA: number, votesB: number): [number, number] {
  const total = votesA + votesB;
  if (total === 0) return [0, 0];
  const a = Math.round((votesA / total) * 100);
  return [a, 100 - a];
}

export function findMatch(view: BattleView, round: Round, position = 1): Match | null {
  return (
    view.matches.find((m) => m.round === round && m.position === position) ?? null
  );
}

export function entryById(view: BattleView, id: string | null): Entry | null {
  if (!id) return null;
  return view.entries.find((entry) => entry.id === id) ?? null;
}

/** A campeã só existe quando a final terminou com vencedor. */
export function champion(view: BattleView): Entry | null {
  const final = findMatch(view, "FINAL");
  if (!final || view.battle.status !== "FINISHED") return null;
  return entryById(view, final.winner_id);
}

/** Rótulo do confronto: "SEMIFINAL 01", "SEMIFINAL 02", "GRANDE FINAL". */
export function matchLabel(round: Round, position: number): string {
  if (round === "FINAL") return "GRANDE FINAL";
  return `SEMIFINAL ${String(position).padStart(2, "0")}`;
}

export const matchStatusLabel: Record<MatchStatus, string> = {
  UPCOMING: "Em breve",
  OPEN: "Votação aberta",
  CLOSED: "Encerrado",
  TIE: "Empate",
  FINISHED: "Encerrado",
};

export const battleStatusLabel: Record<Battle["status"], string> = {
  DRAFT: "Rascunho",
  SEMIFINAL: "Semifinais",
  FINAL: "Grande final",
  FINISHED: "Encerrada",
};

/** 154 → "2:34". Duração desconhecida vira "--:--". */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

export function formatVotes(count: number): string {
  return new Intl.NumberFormat("pt-BR").format(count);
}
