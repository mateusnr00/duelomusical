-- Duelo Musical — regras de negócio e RLS.
--
-- Tudo que decide resultado (voto, apuração, desempate, montagem da final)
-- vive aqui, em funções SECURITY DEFINER, e não no Next. Duas razões:
-- a validação acontece na mesma transação da escrita, então clique duplo e
-- requisição forjada caem na mesma regra; e a página nunca precisa de uma
-- chave que ignore RLS.

-- Allowlist própria do Duelo Musical. Não consulta a tabela `admins` da outra
-- aplicação: os dois sistemas dividem o banco, não a permissão.
create or replace function public.music_battle_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.music_battle_admins where user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Chaveamento
-- ---------------------------------------------------------------------------

-- Cria a final assim que as duas semifinais têm vencedor, e encerra a batalha
-- quando a final tem. É interna e roda depois de toda decisão, para o avanço
-- nunca depender de o admin escolher os finalistas na mão.
create or replace function public.music_battle_sync_bracket(p_battle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_semi_1 public.music_battle_matches;
  v_semi_2 public.music_battle_matches;
  v_final public.music_battle_matches;
  v_battle public.music_battles;
begin
  select * into v_battle from public.music_battles where id = p_battle_id;
  if not found then return; end if;

  select * into v_semi_1 from public.music_battle_matches
    where battle_id = p_battle_id and round = 'SEMIFINAL' and position = 1;
  select * into v_semi_2 from public.music_battle_matches
    where battle_id = p_battle_id and round = 'SEMIFINAL' and position = 2;
  select * into v_final from public.music_battle_matches
    where battle_id = p_battle_id and round = 'FINAL' and position = 1;

  -- Enquanto faltar um vencedor (inclusive por empate não resolvido), não há
  -- final: é exatamente o caso em que o admin precisa decidir antes.
  if v_semi_1.winner_id is null or v_semi_2.winner_id is null then
    return;
  end if;

  if v_final.id is null then
    insert into public.music_battle_matches
      (battle_id, round, position, entry_a_id, entry_b_id, status, starts_at, ends_at)
    values
      (p_battle_id, 'FINAL', 1, v_semi_1.winner_id, v_semi_2.winner_id, 'OPEN',
       v_battle.final_starts_at, v_battle.final_ends_at);
  elsif v_final.status <> 'FINISHED' then
    -- Um desempate refeito pode trocar o finalista. Só mexe enquanto a final
    -- não acabou, e zera votos que tenham ficado órfãos da troca.
    if v_final.entry_a_id is distinct from v_semi_1.winner_id
       or v_final.entry_b_id is distinct from v_semi_2.winner_id then
      delete from public.music_battle_votes where match_id = v_final.id;
      update public.music_battle_matches
        set entry_a_id = v_semi_1.winner_id,
            entry_b_id = v_semi_2.winner_id,
            winner_id = null,
            winner_decision_type = null,
            status = 'OPEN'
        where id = v_final.id;
    end if;
  end if;

  select * into v_final from public.music_battle_matches
    where battle_id = p_battle_id and round = 'FINAL' and position = 1;

  if v_final.winner_id is not null then
    update public.music_battles set status = 'FINISHED' where id = p_battle_id and status <> 'FINISHED';
  else
    update public.music_battles set status = 'FINAL' where id = p_battle_id and status = 'SEMIFINAL';
  end if;
end;
$$;

-- Publicar: monta as duas semifinais a partir das seeds (1v2, 3v4) e abre a
-- votação. Exige exatamente 4 músicas — a regra do produto vira restrição.
create or replace function public.music_battle_publish(p_battle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_total int;
  v_battle public.music_battles;
  v_e1 uuid; v_e2 uuid; v_e3 uuid; v_e4 uuid;
begin
  if not public.music_battle_is_admin() then
    raise exception 'Ação restrita a administradores.' using errcode = '42501';
  end if;

  select * into v_battle from public.music_battles where id = p_battle_id;
  if not found then
    raise exception 'Batalha não encontrada.' using errcode = 'P0002';
  end if;

  select count(*) into v_total from public.music_battle_entries where battle_id = p_battle_id;
  if v_total <> 4 then
    raise exception 'A batalha precisa de exatamente 4 músicas para ser publicada (tem %).', v_total
      using errcode = '23514';
  end if;

  select id into v_e1 from public.music_battle_entries where battle_id = p_battle_id and seed = 1;
  select id into v_e2 from public.music_battle_entries where battle_id = p_battle_id and seed = 2;
  select id into v_e3 from public.music_battle_entries where battle_id = p_battle_id and seed = 3;
  select id into v_e4 from public.music_battle_entries where battle_id = p_battle_id and seed = 4;

  insert into public.music_battle_matches
    (battle_id, round, position, entry_a_id, entry_b_id, status, starts_at, ends_at)
  values
    (p_battle_id, 'SEMIFINAL', 1, v_e1, v_e2, 'OPEN', v_battle.semifinal_starts_at, v_battle.semifinal_ends_at),
    (p_battle_id, 'SEMIFINAL', 2, v_e3, v_e4, 'OPEN', v_battle.semifinal_starts_at, v_battle.semifinal_ends_at)
  on conflict (battle_id, round, position) do nothing;

  update public.music_battles set status = 'SEMIFINAL' where id = p_battle_id and status = 'DRAFT';
end;
$$;

-- ---------------------------------------------------------------------------
-- Voto
-- ---------------------------------------------------------------------------

-- Idempotente de propósito: o segundo clique não cria voto nem devolve erro,
-- devolve o voto que já existia. Duas requisições simultâneas disputam o
-- unique (match_id, user_id) e só uma grava.
create or replace function public.music_battle_cast_vote(p_match_id uuid, p_entry_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_match public.music_battle_matches;
  v_battle public.music_battles;
  v_inserted uuid;
  v_current uuid;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para votar.' using errcode = '42501';
  end if;

  select * into v_match from public.music_battle_matches where id = p_match_id;
  if not found then
    raise exception 'Confronto não encontrado.' using errcode = 'P0002';
  end if;

  select * into v_battle from public.music_battles where id = v_match.battle_id;
  if not found then
    raise exception 'Batalha não encontrada.' using errcode = 'P0002';
  end if;

  if v_battle.status in ('DRAFT', 'FINISHED') then
    raise exception 'A votação não está aberta.' using errcode = '22023';
  end if;

  if v_match.status <> 'OPEN' then
    raise exception 'A votação deste confronto está encerrada.' using errcode = '22023';
  end if;

  if v_match.starts_at is not null and now() < v_match.starts_at then
    raise exception 'A votação deste confronto ainda não começou.' using errcode = '22023';
  end if;

  if v_match.ends_at is not null and now() > v_match.ends_at then
    raise exception 'O prazo de votação deste confronto terminou.' using errcode = '22023';
  end if;

  -- A música precisa ser uma das duas do confronto: sem isso daria para votar
  -- numa música de outro confronto chamando a API direto.
  if p_entry_id is distinct from v_match.entry_a_id
     and p_entry_id is distinct from v_match.entry_b_id then
    raise exception 'Essa música não participa deste confronto.' using errcode = '22023';
  end if;

  insert into public.music_battle_votes (battle_id, match_id, entry_id, user_id)
  values (v_match.battle_id, p_match_id, p_entry_id, v_user)
  on conflict (match_id, user_id) do nothing
  returning entry_id into v_inserted;

  select entry_id into v_current
    from public.music_battle_votes where match_id = p_match_id and user_id = v_user;

  return jsonb_build_object(
    'entry_id', v_current,
    'already_voted', v_inserted is null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Apuração
-- ---------------------------------------------------------------------------

-- Encerra uma rodada: quem tem mais votos vence. Empate NÃO escolhe ninguém —
-- o confronto vai para TIE e espera decisão do admin.
create or replace function public.music_battle_close_round(
  p_battle_id uuid,
  p_round public.music_battle_round
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_match public.music_battle_matches;
  v_a int; v_b int;
  v_resultado jsonb := '[]'::jsonb;
begin
  if not public.music_battle_is_admin() then
    raise exception 'Ação restrita a administradores.' using errcode = '42501';
  end if;

  for v_match in
    select * from public.music_battle_matches
     where battle_id = p_battle_id and round = p_round and status <> 'FINISHED'
     order by position
  loop
    select
      count(*) filter (where entry_id = v_match.entry_a_id),
      count(*) filter (where entry_id = v_match.entry_b_id)
      into v_a, v_b
      from public.music_battle_votes where match_id = v_match.id;

    if v_a > v_b then
      update public.music_battle_matches
        set winner_id = v_match.entry_a_id, winner_decision_type = 'VOTES',
            status = 'FINISHED', decided_at = now(), decided_by = null, decision_note = null
        where id = v_match.id;
    elsif v_b > v_a then
      update public.music_battle_matches
        set winner_id = v_match.entry_b_id, winner_decision_type = 'VOTES',
            status = 'FINISHED', decided_at = now(), decided_by = null, decision_note = null
        where id = v_match.id;
    else
      -- Inclui 0 a 0: sem voto não há vencedor legítimo.
      update public.music_battle_matches
        set winner_id = null, winner_decision_type = null, status = 'TIE'
        where id = v_match.id;
    end if;

    v_resultado := v_resultado || jsonb_build_object(
      'match_id', v_match.id, 'position', v_match.position,
      'votes_a', v_a, 'votes_b', v_b,
      'tie', v_a = v_b
    );
  end loop;

  perform public.music_battle_sync_bracket(p_battle_id);
  return jsonb_build_object('round', p_round, 'matches', v_resultado);
end;
$$;

-- Desempate manual: o admin escolhe quem avança e o banco guarda que a
-- decisão foi humana, quem decidiu, quando e por quê.
create or replace function public.music_battle_resolve_tie(
  p_match_id uuid,
  p_entry_id uuid,
  p_note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_match public.music_battle_matches;
begin
  if not public.music_battle_is_admin() then
    raise exception 'Ação restrita a administradores.' using errcode = '42501';
  end if;

  select * into v_match from public.music_battle_matches where id = p_match_id;
  if not found then
    raise exception 'Confronto não encontrado.' using errcode = 'P0002';
  end if;

  if v_match.status <> 'TIE' then
    raise exception 'Este confronto não está empatado.' using errcode = '22023';
  end if;

  if p_entry_id is distinct from v_match.entry_a_id
     and p_entry_id is distinct from v_match.entry_b_id then
    raise exception 'Essa música não participa deste confronto.' using errcode = '22023';
  end if;

  update public.music_battle_matches
    set winner_id = p_entry_id,
        winner_decision_type = 'MANUAL',
        status = 'FINISHED',
        decided_by = (select auth.uid()),
        decided_at = now(),
        decision_note = nullif(btrim(coalesce(p_note, '')), '')
    where id = p_match_id;

  perform public.music_battle_sync_bracket(v_match.battle_id);
end;
$$;

-- Reabre a votação de uma rodada encerrada por engano. Só enquanto a rodada
-- seguinte não começou a receber voto, senão o resultado já contaminou a final.
create or replace function public.music_battle_reopen_round(
  p_battle_id uuid,
  p_round public.music_battle_round
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_votos_final int;
begin
  if not public.music_battle_is_admin() then
    raise exception 'Ação restrita a administradores.' using errcode = '42501';
  end if;

  if p_round = 'SEMIFINAL' then
    select count(*) into v_votos_final
      from public.music_battle_votes v
      join public.music_battle_matches m on m.id = v.match_id
     where m.battle_id = p_battle_id and m.round = 'FINAL';

    if v_votos_final > 0 then
      raise exception 'A final já recebeu votos: reabrir a semifinal invalidaria o resultado.'
        using errcode = '22023';
    end if;

    delete from public.music_battle_matches where battle_id = p_battle_id and round = 'FINAL';
    update public.music_battles set status = 'SEMIFINAL' where id = p_battle_id;
  else
    update public.music_battles set status = 'FINAL' where id = p_battle_id;
  end if;

  update public.music_battle_matches
    set status = 'OPEN', winner_id = null, winner_decision_type = null,
        decided_by = null, decided_at = null, decision_note = null
    where battle_id = p_battle_id and round = p_round;
end;
$$;
