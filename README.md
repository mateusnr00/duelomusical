# Duelo Musical

Chaveamento eliminatório de músicas: **4 faixas → 2 semifinais → 1 final → 1 campeã**,
decidido por voto. Construído com **Next.js 16 (App Router)**, **TypeScript**,
**Tailwind CSS v4** e **Supabase** (Postgres, Auth e Storage).

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm test
npm run build
```

## Como o sistema decide as coisas

A regra de negócio mora no **Postgres**, em funções `SECURITY DEFINER`, e não no
Next. O motivo é que voto e apuração precisam validar e escrever na mesma
transação: repetir a regra no servidor de aplicação criaria duas versões dela, e
a que vale seria sempre a do banco. O Next chama essas funções e cuida da tela.

| Regra | Onde vive | Como é garantida |
| --- | --- | --- |
| Um voto por pessoa em cada confronto | `music_battle_votes` | `unique (match_id, user_id)`. Como a chave é por confronto, votar na semifinal não consome o voto da final. |
| Clique duplo e requisições simultâneas | `music_battle_cast_vote` | `insert ... on conflict do nothing`: a segunda chamada não cria voto nem estoura, devolve o voto que já existia. |
| Voto só em confronto aberto e música do par | `music_battle_cast_vote` | Confere batalha, estado do confronto, prazo e se a música é uma das duas. |
| Vencedor | `music_battle_close_round` | Quem tem mais votos. |
| Empate | `music_battle_close_round` | Marca o confronto como `TIE` e **não** escolhe ninguém — inclusive no 0 a 0. |
| Desempate manual | `music_battle_resolve_tie` | Grava `winner_decision_type = MANUAL`, `decided_by`, `decided_at` e a observação. |
| Montagem da final | `music_battle_sync_bracket` | Roda após toda decisão: com os dois vencedores definidos, cria a final com eles. Sem os dois, não cria nada. |
| Sigilo do placar | `music_battle_view` | Os votos chegam **nulos** ao navegador enquanto o resultado não pode aparecer. Esconder por CSS vazaria o placar no HTML. |

Ninguém escreve em `music_battle_matches` pela API — nem o administrador. Não
existe policy de escrita nessa tabela: apontar um vencedor na mão pularia a
apuração, que é justamente o que o sistema garante.

## Estrutura

```
src/
├── app/
│   ├── page.tsx                       # home: batalha em andamento
│   ├── b/[slug]/                      # página pública do chaveamento
│   ├── entrar/                        # login e cadastro (Supabase Auth)
│   └── admin/
│       ├── batalhas/                  # lista, criação, edição
│       └── batalhas/[id]/resultados/  # apuração, encerrar rodada, desempate
├── components/
│   ├── battle/                        # chaveamento, cards, campeã, contador
│   ├── player/                        # player customizado e barramento de áudio
│   ├── admin/                         # formulários e upload
│   └── ui/                            # botão, campo, modal, toast
├── lib/
│   ├── battle/rules.ts                # regras puras (o que os testes cobrem)
│   ├── supabase/                      # clientes de navegador e servidor
│   └── upload.ts                      # validação de arquivo por assinatura
├── proxy.ts                           # renova a sessão e protege /admin
└── supabase/migrations/               # schema, regras, RLS e buckets
```

## Rotas

| Pública | O que faz |
| --- | --- |
| `/` | Batalha em andamento, se houver |
| `/b/[slug]` | Chaveamento completo: semifinais, final e campeã |
| `/entrar` | Entrar ou criar conta (necessário para votar) |

| Painel | O que faz |
| --- | --- |
| `/admin/login` | Entrada do painel |
| `/admin/batalhas` | Lista, com excluir |
| `/admin/batalhas/nova` | Criação |
| `/admin/batalhas/[id]` | Edição, as 4 músicas e publicação |
| `/admin/batalhas/[id]/resultados` | Placar, encerrar rodada, desempatar, reabrir |

## Banco

Este projeto Supabase **é compartilhado com outra aplicação**. Por isso tudo aqui
nasce com o prefixo `music_battle`, incluindo a função de permissão
(`music_battle_is_admin`), que **não** consulta a tabela `admins` da outra
aplicação: os dois sistemas dividem o banco, não a permissão.

| Tabela | Para quê |
| --- | --- |
| `music_battles` | Batalha: nome, slug, status, modo de exibição do placar, prazos |
| `music_battle_entries` | As 4 músicas, com `seed` de 1 a 4 definindo o chaveamento |
| `music_battle_matches` | Confrontos, vencedor, forma da decisão e rastro do desempate |
| `music_battle_votes` | Votos, com o `unique (match_id, user_id)` |
| `music_battle_admins` | Allowlist de quem administra |

Estados: batalha `DRAFT · SEMIFINAL · FINAL · FINISHED`; confronto
`UPCOMING · OPEN · CLOSED · TIE · FINISHED`; rodada `SEMIFINAL · FINAL`.

As migrações estão em `supabase/migrations/`, na ordem.

### RLS

Ligada nas cinco tabelas.

- Batalha em rascunho é invisível para quem não administra — pela URL direta e
  pela API.
- Cada pessoa lê **apenas o próprio voto**; o placar agregado só sai pelas
  funções, que decidem se ele pode aparecer.
- Não existe policy de `INSERT` em `music_battle_votes`: um `POST` direto em
  `/rest/v1/music_battle_votes` é recusado. Votar só por `music_battle_cast_vote`.

### Configuração

Copie `.env.example` para `.env.local`:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave publicável (`sb_publishable_…`) |

As duas são públicas por natureza — quem protege os dados é a RLS. **Nunca
coloque a `service_role` key no projeto**: ela ignora RLS por completo, e o
sistema foi desenhado para não precisar dela.

Para liberar o primeiro administrador, crie a conta em `/entrar` e rode:

```sql
insert into public.music_battle_admins (user_id, email)
select id, email from auth.users where email = 'voce@exemplo.com';
```

Sem essa linha o login funciona, mas o painel responde "sem permissão" — é a
allowlist fazendo o trabalho dela.

## Upload

| Arquivo | Bucket | Limite | Formatos |
| --- | --- | --- | --- |
| Áudio | `music-battle-audio` | 20 MB | MP3, WAV, M4A |
| Capa | `music-battle-covers` | 5 MB | JPEG, PNG, WebP, AVIF |

O envio sai do navegador direto para o Storage, então o binário não passa pelo
servidor do Next. O formato é conferido lendo os **primeiros bytes do arquivo**
(`src/lib/upload.ts`) e não pela extensão nem pelo `type` que o navegador
declara — os dois se forjam renomeando o arquivo. Essa é a primeira barreira: o
bucket também tem lista de MIME e limite de tamanho, e é ele quem recusa um
envio feito fora da interface.

## Player

Player próprio, sem os controles nativos: botão redondo, barra fina e os tempos.
A barra é um `input[type=range]` de verdade, então seta e Home/End funcionam sem
mouse. `preload="metadata"` carrega só a duração, não a faixa inteira.

**Só uma música toca por vez.** Quem guarda "quem está tocando" é um contexto
único (`AudioProvider`); ao começar uma faixa, o player anterior se pausa
sozinho. Cada player tem identidade própria por posição na tela, e não pelo id
da música: a mesma faixa aparece na semifinal e de novo na final, e um id
repetido faria dois botões mostrarem "pausar" com um único áudio tocando.

## Testes

```bash
npm test
```

`tests/rules.test.ts` — 24 testes das regras puras: montagem das semifinais,
apuração, empate (inclusive 0 a 0), validação de voto, quando o placar pode
aparecer, percentuais e campeã.

`tests/integration/battle-flow.test.ts` — 14 testes contra o Supabase de
verdade, para o que função pura não alcança: o índice único que bloqueia voto
duplicado, a validação dentro das funções e a RLS que barra quem não é admin.
Precisam de rede até o projeto e das variáveis abaixo; sem elas a suíte é
pulada, para `npm test` continuar passando em ambiente sem credencial.

```
DUELO_TEST_ADMIN_EMAIL   DUELO_TEST_ADMIN_PASSWORD    # conta em music_battle_admins
DUELO_TEST_USER_EMAIL    DUELO_TEST_USER_PASSWORD
DUELO_TEST_USER2_EMAIL   DUELO_TEST_USER2_PASSWORD
```

## Prazos

`semifinal_starts_at`, `semifinal_ends_at`, `final_starts_at` e `final_ends_at`
são opcionais. Quando preenchidos, viram contagem regressiva na página e são
conferidos no servidor a cada voto. O encerramento em si é feito pelo painel:
não há cron neste projeto, e criar essa infraestrutura só para isso não se
justifica na primeira versão.
