-- Duelo Musical — leitura da página pública, apuração do painel e RLS.

-- Payload da página pública numa chamada só.
--
-- Quem decide se o placar aparece é esta função, não o componente: mandar os
-- números para o navegador e escondê-los no CSS vazaria o resultado para
-- qualquer um que abrisse o DevTools antes de votar.
create or replace function public.music_battle_view(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_admin boolean := public.music_battle_is_admin();
  v_battle public.music_battles;
  v_match public.music_battle_matches;
  v_matches jsonb := '[]'::jsonb;
  v_a int; v_b int; v_meu uuid; v_mostrar boolean;
begin
  select * into v_battle from public.music_battles where slug = p_slug;
  if not found then return null; end if;

  -- Rascunho é invisível para quem não administra, mesmo com o link.
  if v_battle.status = 'DRAFT' and not v_admin then return null; end if;

  for v_match in
    select * from public.music_battle_matches
     where battle_id = v_battle.id order by round, position
  loop
    select entry_id into v_meu
      from public.music_battle_votes
     where match_id = v_match.id and user_id = v_user;

    v_mostrar := case
      when v_battle.show_results_mode = 'HIDDEN' then v_battle.status = 'FINISHED'
      when v_battle.show_results_mode = 'ALWAYS' then true
      -- Rodada encerrada: o resultado já é público de qualquer forma.
      when v_match.status <> 'OPEN' then true
      when v_battle.show_results_mode = 'AFTER_VOTE' then v_meu is not null
      else false
    end;

    if v_mostrar then
      select
        count(*) filter (where entry_id = v_match.entry_a_id),
        count(*) filter (where entry_id = v_match.entry_b_id)
        into v_a, v_b
        from public.music_battle_votes where match_id = v_match.id;
    else
      v_a := null; v_b := null;
    end if;

    v_matches := v_matches || jsonb_build_object(
      'id', v_match.id,
      'round', v_match.round,
      'position', v_match.position,
      'status', v_match.status,
      'entry_a_id', v_match.entry_a_id,
      'entry_b_id', v_match.entry_b_id,
      'winner_id', v_match.winner_id,
      'winner_decision_type', v_match.winner_decision_type,
      'starts_at', v_match.starts_at,
      'ends_at', v_match.ends_at,
      'my_vote_entry_id', v_meu,
      'show_results', v_mostrar,
      'votes_a', v_a,
      'votes_b', v_b
    );
  end loop;

  return jsonb_build_object(
    'battle', jsonb_build_object(
      'id', v_battle.id, 'name', v_battle.name, 'slug', v_battle.slug,
      'description', v_battle.description, 'status', v_battle.status,
      'show_results_mode', v_battle.show_results_mode,
      'semifinal_starts_at', v_battle.semifinal_starts_at,
      'semifinal_ends_at', v_battle.semifinal_ends_at,
      'final_starts_at', v_battle.final_starts_at,
      'final_ends_at', v_battle.final_ends_at
    ),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'artist', e.artist,
        'audio_url', e.audio_url, 'cover_url', e.cover_url, 'seed', e.seed
      ) order by e.seed)
      from public.music_battle_entries e where e.battle_id = v_battle.id
    ), '[]'::jsonb),
    'matches', v_matches,
    'viewer', jsonb_build_object('signed_in', v_user is not null, 'is_admin', v_admin)
  );
end;
$$;

-- Apuração completa para o painel: aqui o placar aparece sempre, porque quem
-- chama já é administrador.
create or replace function public.music_battle_results(p_battle_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_match public.music_battle_matches;
  v_a int; v_b int;
  v_matches jsonb := '[]'::jsonb;
  v_total int := 0;
begin
  if not public.music_battle_is_admin() then
    raise exception 'Ação restrita a administradores.' using errcode = '42501';
  end if;

  for v_match in
    select * from public.music_battle_matches
     where battle_id = p_battle_id order by round, position
  loop
    select
      count(*) filter (where entry_id = v_match.entry_a_id),
      count(*) filter (where entry_id = v_match.entry_b_id)
      into v_a, v_b
      from public.music_battle_votes where match_id = v_match.id;

    v_total := v_total + v_a + v_b;

    v_matches := v_matches || jsonb_build_object(
      'id', v_match.id, 'round', v_match.round, 'position', v_match.position,
      'status', v_match.status, 'entry_a_id', v_match.entry_a_id,
      'entry_b_id', v_match.entry_b_id, 'winner_id', v_match.winner_id,
      'winner_decision_type', v_match.winner_decision_type,
      'decided_at', v_match.decided_at, 'decided_by', v_match.decided_by,
      'decision_note', v_match.decision_note,
      'votes_a', v_a, 'votes_b', v_b
    );
  end loop;

  return jsonb_build_object('matches', v_matches, 'total_votes', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.music_battle_admins enable row level security;
alter table public.music_battles enable row level security;
alter table public.music_battle_entries enable row level security;
alter table public.music_battle_matches enable row level security;
alter table public.music_battle_votes enable row level security;

-- O admin enxerga a própria linha; ninguém escreve na allowlist pela API.
create policy "duelo: admin le a propria linha" on public.music_battle_admins
  for select to authenticated using (user_id = (select auth.uid()));

-- Batalha publicada é pública; rascunho só para quem administra.
create policy "duelo: batalhas publicadas sao visiveis" on public.music_battles
  for select to anon, authenticated using (status <> 'DRAFT');
create policy "duelo: admin le todas as batalhas" on public.music_battles
  for select to authenticated using (public.music_battle_is_admin());
create policy "duelo: admin cria batalha" on public.music_battles
  for insert to authenticated with check (public.music_battle_is_admin());
create policy "duelo: admin edita batalha" on public.music_battles
  for update to authenticated using (public.music_battle_is_admin())
  with check (public.music_battle_is_admin());
create policy "duelo: admin exclui batalha" on public.music_battles
  for delete to authenticated using (public.music_battle_is_admin());

create policy "duelo: musicas de batalha publicada" on public.music_battle_entries
  for select to anon, authenticated using (
    exists (select 1 from public.music_battles b
             where b.id = battle_id and b.status <> 'DRAFT')
  );
create policy "duelo: admin le musicas" on public.music_battle_entries
  for select to authenticated using (public.music_battle_is_admin());
create policy "duelo: admin cria musica" on public.music_battle_entries
  for insert to authenticated with check (public.music_battle_is_admin());
create policy "duelo: admin edita musica" on public.music_battle_entries
  for update to authenticated using (public.music_battle_is_admin())
  with check (public.music_battle_is_admin());
create policy "duelo: admin exclui musica" on public.music_battle_entries
  for delete to authenticated using (public.music_battle_is_admin());

create policy "duelo: confrontos de batalha publicada" on public.music_battle_matches
  for select to anon, authenticated using (
    exists (select 1 from public.music_battles b
             where b.id = battle_id and b.status <> 'DRAFT')
  );
create policy "duelo: admin le confrontos" on public.music_battle_matches
  for select to authenticated using (public.music_battle_is_admin());
-- Confronto nasce e muda só pelas funções de chaveamento: não há policy de
-- escrita para ninguém, nem para o admin. Apontar um vencedor na mão pela API
-- pularia a apuração, que é justamente o que o sistema garante.

-- O voto é do votante: cada um vê só o seu.
create policy "duelo: cada um le o proprio voto" on public.music_battle_votes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "duelo: admin le os votos" on public.music_battle_votes
  for select to authenticated using (public.music_battle_is_admin());
-- Sem policy de INSERT: votar só por music_battle_cast_vote, que valida o
-- confronto antes de gravar. Um POST direto em /rest/v1/music_battle_votes
-- é recusado pela RLS.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- EXECUTE é concedido a PUBLIC por padrão: revogamos e devolvemos só o que
-- cada papel precisa.
revoke all on function public.music_battle_is_admin() from public, anon, authenticated;
revoke all on function public.music_battle_sync_bracket(uuid) from public, anon, authenticated;
revoke all on function public.music_battle_publish(uuid) from public, anon, authenticated;
revoke all on function public.music_battle_cast_vote(uuid, uuid) from public, anon, authenticated;
revoke all on function public.music_battle_close_round(uuid, public.music_battle_round) from public, anon, authenticated;
revoke all on function public.music_battle_resolve_tie(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.music_battle_reopen_round(uuid, public.music_battle_round) from public, anon, authenticated;
revoke all on function public.music_battle_view(text) from public, anon, authenticated;
revoke all on function public.music_battle_results(uuid) from public, anon, authenticated;

grant execute on function public.music_battle_is_admin() to authenticated;
grant execute on function public.music_battle_view(text) to anon, authenticated;
grant execute on function public.music_battle_cast_vote(uuid, uuid) to authenticated;
-- As funções de painel checam a allowlist por dentro; o grant apenas permite
-- chamar, e quem não é admin recebe 42501.
grant execute on function public.music_battle_publish(uuid) to authenticated;
grant execute on function public.music_battle_close_round(uuid, public.music_battle_round) to authenticated;
grant execute on function public.music_battle_resolve_tie(uuid, uuid, text) to authenticated;
grant execute on function public.music_battle_reopen_round(uuid, public.music_battle_round) to authenticated;
grant execute on function public.music_battle_results(uuid) to authenticated;
