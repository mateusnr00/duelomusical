/** Estados espelhados dos enums do Postgres. */
export type BattleStatus = "DRAFT" | "SEMIFINAL" | "FINAL" | "FINISHED";
export type MatchStatus = "UPCOMING" | "OPEN" | "CLOSED" | "TIE" | "FINISHED";
export type Round = "SEMIFINAL" | "FINAL";
export type ShowResultsMode = "ALWAYS" | "AFTER_VOTE" | "AFTER_ROUND" | "HIDDEN";
export type DecisionType = "VOTES" | "MANUAL";

export type Battle = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: BattleStatus;
  show_results_mode: ShowResultsMode;
  semifinal_starts_at: string | null;
  semifinal_ends_at: string | null;
  final_starts_at: string | null;
  final_ends_at: string | null;
};

export type Entry = {
  id: string;
  name: string;
  artist: string | null;
  audio_url: string;
  cover_url: string | null;
  seed: number;
};

/**
 * Confronto como a página pública o enxerga. `votes_a`/`votes_b` chegam nulos
 * enquanto o resultado não pode ser revelado — a decisão é do banco, não do
 * componente, para o placar não vazar no HTML antes do voto.
 */
export type Match = {
  id: string;
  round: Round;
  position: number;
  status: MatchStatus;
  entry_a_id: string | null;
  entry_b_id: string | null;
  winner_id: string | null;
  winner_decision_type: DecisionType | null;
  starts_at: string | null;
  ends_at: string | null;
  my_vote_entry_id: string | null;
  show_results: boolean;
  votes_a: number | null;
  votes_b: number | null;
};

export type BattleView = {
  battle: Battle;
  entries: Entry[];
  matches: Match[];
  viewer: { signed_in: boolean; is_admin: boolean };
};

/** Confronto na visão do painel: o placar aparece sempre. */
export type AdminMatch = {
  id: string;
  round: Round;
  position: number;
  status: MatchStatus;
  entry_a_id: string | null;
  entry_b_id: string | null;
  winner_id: string | null;
  winner_decision_type: DecisionType | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  votes_a: number;
  votes_b: number;
};

export type AdminResults = { matches: AdminMatch[]; total_votes: number };

export type BattleRow = Battle & { created_at: string; updated_at: string };
