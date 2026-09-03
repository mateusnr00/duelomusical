-- Duelo Musical — buckets próprios.
--
-- Buckets separados dos de outras aplicações do mesmo projeto Supabase. O
-- limite de tamanho e a lista de MIME ficam no bucket: o Storage recusa o
-- arquivo mesmo que o navegador minta no Content-Type, o que a validação do
-- formulário sozinha não garante.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-battle-audio', 'music-battle-audio', true, 20971520,
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
        'audio/vnd.wave', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-battle-covers', 'music-battle-covers', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- Leitura pública: o player e a capa carregam sem URL assinada.
create policy "duelo: audio publico para leitura" on storage.objects
  for select to anon, authenticated using (bucket_id = 'music-battle-audio');
create policy "duelo: capas publicas para leitura" on storage.objects
  for select to anon, authenticated using (bucket_id = 'music-battle-covers');

-- Escrita só para a allowlist do Duelo Musical, e só nos buckets dele.
create policy "duelo: admin envia audio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'music-battle-audio' and public.music_battle_is_admin());
create policy "duelo: admin substitui audio" on storage.objects
  for update to authenticated
  using (bucket_id = 'music-battle-audio' and public.music_battle_is_admin())
  with check (bucket_id = 'music-battle-audio' and public.music_battle_is_admin());
create policy "duelo: admin apaga audio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'music-battle-audio' and public.music_battle_is_admin());

create policy "duelo: admin envia capa" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'music-battle-covers' and public.music_battle_is_admin());
create policy "duelo: admin substitui capa" on storage.objects
  for update to authenticated
  using (bucket_id = 'music-battle-covers' and public.music_battle_is_admin())
  with check (bucket_id = 'music-battle-covers' and public.music_battle_is_admin());
create policy "duelo: admin apaga capa" on storage.objects
  for delete to authenticated
  using (bucket_id = 'music-battle-covers' and public.music_battle_is_admin());
