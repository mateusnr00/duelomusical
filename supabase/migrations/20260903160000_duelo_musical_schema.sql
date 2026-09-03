-- Duelo Musical — schema base.
--
-- Este projeto Supabase é compartilhado com outra aplicação (imóveis). Por isso
-- tudo aqui nasce com o prefixo `music_battle`: tabelas, enums, funções e
-- políticas. Nada existente é lido, alterado ou renomeado.

-- Enums em vez de text: o banco recusa estado inválido mesmo que um cliente
-- futuro escreva fora do painel.
create type public.music_battle_status as enum ('DRAFT', 'SEMIFINAL', 'FINAL', 'FINISHED');
create type public.music_battle_round as enum ('SEMIFINAL', 'FINAL');
create type public.music_battle_match_status as enum ('UPCOMING', 'OPEN', 'CLOSED', 'TIE', 'FINISHED');
create type public.music_battle_show_results as enum ('ALWAYS', 'AFTER_VOTE', 'AFTER_ROUND', 'HIDDEN');
create type public.music_battle_decision as enum ('VOTES', 'MANUAL');

-- Quem administra o Duelo Musical. Allowlist própria: estar autenticado não
-- basta, porque a chave publicável é pública e qualquer um chama signUp.
-- Não reaproveita a tabela `admins` da outra aplicação de propósito.
create table public.music_battle_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table public.music_battles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  status public.music_battle_status not null default 'DRAFT',
  show_results_mode public.music_battle_show_results not null default 'AFTER_VOTE',

  -- Janelas de cada fase. Opcionais: a v1 encerra pelo painel, mas o contador
  -- da página pública e a checagem de prazo no voto já leem estes campos.
  semifinal_starts_at timestamptz,
  semifinal_ends_at timestamptz,
  final_starts_at timestamptz,
  final_ends_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint music_battles_nome_preenchido check (length(btrim(name)) > 0),
  constraint music_battles_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index music_battles_status_idx on public.music_battles (status, created_at desc);

-- As 4 músicas. `seed` é a posição no chaveamento: 1v2 na semifinal 01 e
-- 3v4 na semifinal 02. O unique impede duas músicas na mesma posição.
create table public.music_battle_entries (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.music_battles (id) on delete cascade,
  name text not null,
  artist text,
  audio_url text not null,
  cover_url text,
  seed smallint not null,
  created_at timestamptz not null default now(),

  constraint music_battle_entries_nome_preenchido check (length(btrim(name)) > 0),
  constraint music_battle_entries_seed_valida check (seed between 1 and 4),
  constraint music_battle_entries_seed_unica unique (battle_id, seed)
);

create index music_battle_entries_battle_idx on public.music_battle_entries (battle_id, seed);

create table public.music_battle_matches (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.music_battles (id) on delete cascade,
  round public.music_battle_round not null,
  position smallint not null,

  -- `restrict` e não `cascade`: apagar uma música que já está num confronto
  -- deve falhar, não sumir com o confronto e com os votos dele.
  entry_a_id uuid references public.music_battle_entries (id) on delete restrict,
  entry_b_id uuid references public.music_battle_entries (id) on delete restrict,
  winner_id uuid references public.music_battle_entries (id) on delete restrict,
  winner_decision_type public.music_battle_decision,

  status public.music_battle_match_status not null default 'UPCOMING',
  starts_at timestamptz,
  ends_at timestamptz,

  -- Rastro do desempate manual: quem decidiu, quando e por quê.
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint music_battle_matches_posicao_unica unique (battle_id, round, position),
  constraint music_battle_matches_posicao_valida check (position between 1 and 2),
  -- A final é sempre uma só; semifinal vai até a posição 2.
  constraint music_battle_matches_final_posicao check (round <> 'FINAL' or position = 1),
  constraint music_battle_matches_pares_distintos
    check (entry_a_id is null or entry_b_id is null or entry_a_id <> entry_b_id),
  -- Vencedor tem de ser um dos dois participantes: impede apontar para uma
  -- música de outro confronto por engano ou por chamada direta à API.
  constraint music_battle_matches_vencedor_participa
    check (winner_id is null or winner_id = entry_a_id or winner_id = entry_b_id),
  -- Ou existem vencedor e forma de decisão, ou não existe nenhum dos dois.
  constraint music_battle_matches_decisao_coerente
    check ((winner_id is null) = (winner_decision_type is null))
);

create index music_battle_matches_battle_idx on public.music_battle_matches (battle_id, round, position);

-- O voto. `unique (match_id, user_id)` é a regra de verdade do sistema: um
-- voto por pessoa em cada confronto, garantido pelo banco e não pelo React.
-- Como a chave é por confronto, votar na semifinal não consome o voto da final.
create table public.music_battle_votes (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.music_battles (id) on delete cascade,
  match_id uuid not null references public.music_battle_matches (id) on delete cascade,
  entry_id uuid not null references public.music_battle_entries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint music_battle_votes_um_por_confronto unique (match_id, user_id)
);

-- Apuração: conta votos por música dentro do confronto.
create index music_battle_votes_apuracao_idx on public.music_battle_votes (match_id, entry_id);
create index music_battle_votes_usuario_idx on public.music_battle_votes (user_id, battle_id);

create or replace function public.music_battle_touch_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger music_battles_touch_updated_at
  before update on public.music_battles
  for each row execute function public.music_battle_touch_updated_at();

create trigger music_battle_matches_touch_updated_at
  before update on public.music_battle_matches
  for each row execute function public.music_battle_touch_updated_at();

-- O grant padrão de EXECUTE é para PUBLIC; revogar só de `anon` não bastaria.
revoke all on function public.music_battle_touch_updated_at() from public, anon, authenticated;
