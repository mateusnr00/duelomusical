-- Cadastro por nome de usuário, sem e-mail.
--
-- O fluxo padrão do Supabase (`auth.signUp`) manda e-mail de confirmação, e o
-- SMTP embutido do projeto tem limite baixíssimo — numa votação com várias
-- pessoas entrando ao mesmo tempo, a maioria recebia "email rate limit
-- exceeded" e não conseguia votar. Aqui a conta nasce pronta: sem e-mail, sem
-- confirmação, já podendo entrar.
--
-- O endereço é sintético e o domínio é fixo em `.local`, que a RFC 6762
-- reserva e nunca resolve na internet. Isso é a barreira que impede alguém de
-- se cadastrar como `dono@gmail.com` e assumir uma conta real: o que a função
-- grava é sempre `<nome>@duelo-musical.local`.
create or replace function public.music_battle_signup(
  p_username text,
  p_password text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := lower(btrim(coalesce(p_username, '')));
  v_email text;
  v_id uuid;
begin
  -- A normalização amigável (acento, espaço, maiúscula) acontece no cliente.
  -- Aqui só entra o que já está no formato: é esta checagem que vale, porque
  -- a função é chamável direto pela API.
  if v_nome !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'Use de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.'
      using errcode = '22023';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'A senha precisa ter ao menos 6 caracteres.' using errcode = '22023';
  end if;

  v_email := v_nome || '@duelo-musical.local';

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Esse nome já está em uso. Escolha outro.' using errcode = '23505';
  end if;

  v_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    -- Já confirmado: é o que dispensa o e-mail e deixa entrar na hora.
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', v_nome),
    '', '', '', ''
  );

  -- Sem a identidade o login por senha não encontra a conta.
  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );
end;
$$;

-- Quem se cadastra ainda não tem sessão, então o papel é `anon`.
-- A função só cria votante comum: não encosta em `music_battle_admins`, então
-- não há como virar administrador por aqui.
revoke all on function public.music_battle_signup(text, text) from public, anon, authenticated;
grant execute on function public.music_battle_signup(text, text) to anon, authenticated;
