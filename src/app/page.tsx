import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { battleStatusLabel } from "@/lib/battle/rules";
import { createClient } from "@/lib/supabase/server";
import type { BattleRow } from "@/lib/battle/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  // A RLS já esconde rascunho de quem não administra, então a home pode
  // simplesmente pedir as batalhas mais recentes.
  const { data } = await supabase
    .from("music_battles")
    .select("id, name, slug, description, status")
    .neq("status", "DRAFT")
    .order("created_at", { ascending: false })
    .limit(6);

  const battles = (data ?? []) as Pick<
    BattleRow,
    "id" | "name" | "slug" | "description" | "status"
  >[];
  const [current, ...previous] = battles;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-20 sm:px-8">
      <p className="eyebrow">Duelo Musical</p>
      <h1 className="mt-3 text-4xl leading-tight font-medium">
        Quatro músicas. Duas semifinais. Uma campeã.
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
        Ouça os confrontos, vote na sua favorita e acompanhe quem avança até a final.
      </p>

      {current ? (
        <article className="mt-12 rounded-sm border border-line bg-surface p-7">
          <p className="eyebrow text-accent">
            Batalha em andamento · {battleStatusLabel[current.status]}
          </p>
          <h2 className="mt-3 text-2xl leading-tight font-medium">{current.name}</h2>
          {current.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted">{current.description}</p>
          )}
          <div className="mt-7">
            <ButtonLink href={`/b/${current.slug}`}>Acessar batalha</ButtonLink>
          </div>
        </article>
      ) : (
        <p className="mt-12 rounded-sm border border-dashed border-line p-8 text-center text-sm text-muted">
          Nenhuma batalha no ar ainda. Volte em breve.
        </p>
      )}

      {previous.length > 0 && (
        <section className="mt-14">
          <h2 className="eyebrow">Outras batalhas</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {previous.map((battle) => (
              <li key={battle.id}>
                <Link
                  href={`/b/${battle.slug}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 transition-colors hover:text-accent"
                >
                  <span className="text-sm">{battle.name}</span>
                  <span className="eyebrow">{battleStatusLabel[battle.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
