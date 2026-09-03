import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { BattleBoard } from "@/components/battle/battle-board";
import { createClient } from "@/lib/supabase/server";
import type { BattleView } from "@/lib/battle/types";

// A página depende de quem está olhando (voto e placar liberado), então é
// sempre dinâmica: cache compartilhado entregaria o resultado de um usuário
// para outro.
export const dynamic = "force-dynamic";

async function loadView(slug: string): Promise<BattleView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("music_battle_view", { p_slug: slug });
  if (error || !data) return null;
  return data as BattleView;
}

export async function generateMetadata({
  params,
}: PageProps<"/b/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const view = await loadView(slug);
  if (!view) return { title: "Batalha não encontrada" };

  return {
    title: view.battle.name,
    description: view.battle.description || undefined,
  };
}

export default async function BattlePage({ params }: PageProps<"/b/[slug]">) {
  const { slug } = await params;
  const view = await loadView(slug);

  if (!view) notFound();

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8">
      <Link
        href="/"
        className="eyebrow inline-block transition-colors hover:text-text"
      >
        ← Duelo Musical
      </Link>
      <div className="mt-8">
        <BattleBoard view={view} />
      </div>
    </main>
  );
}
