import Link from "next/link";
import { deleteBattle } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ButtonLink } from "@/components/ui/button";
import { battleStatusLabel } from "@/lib/battle/rules";
import { createClient } from "@/lib/supabase/server";
import type { BattleRow } from "@/lib/battle/types";

export const dynamic = "force-dynamic";

const flashes: Record<string, string> = {
  excluida: "Batalha excluída.",
};

export default async function AdminBattlesPage({
  searchParams,
}: PageProps<"/admin/batalhas">) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("music_battles")
    .select("id, name, slug, description, status, show_results_mode, created_at, updated_at, semifinal_starts_at, semifinal_ends_at, final_starts_at, final_ends_at")
    .order("created_at", { ascending: false });

  const battles = (data ?? []) as BattleRow[];
  const flashKey = Object.keys(flashes).find((key) => params[key]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl leading-tight font-medium">Batalhas de música</h1>
          <p className="mt-2 text-sm text-muted">
            {battles.length} {battles.length === 1 ? "batalha criada" : "batalhas criadas"}
          </p>
        </div>
        <ButtonLink href="/admin/batalhas/nova">+ Nova batalha</ButtonLink>
      </div>

      {flashKey && (
        <p role="status" className="mt-8 border-l-2 border-accent bg-accent/5 px-5 py-3 text-sm">
          {flashes[flashKey]}
        </p>
      )}

      {params.erro === "exclusao" && (
        <p role="alert" className="mt-8 border-l-2 border-danger bg-danger/5 px-5 py-3 text-sm text-danger">
          Não foi possível excluir a batalha.
        </p>
      )}

      {battles.length === 0 ? (
        <p className="mt-12 rounded-sm border border-dashed border-line p-10 text-center text-sm text-muted">
          Nenhuma batalha ainda. Crie a primeira e cadastre as quatro músicas.
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {battles.map((battle) => (
            <li key={battle.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div className="min-w-0">
                <Link
                  href={`/admin/batalhas/${battle.id}`}
                  className="text-base font-medium transition-colors hover:text-accent"
                >
                  {battle.name}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  /b/{battle.slug} · {battleStatusLabel[battle.status]}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <Link
                  href={`/admin/batalhas/${battle.id}/resultados`}
                  className="eyebrow transition-colors hover:text-text"
                >
                  Resultados
                </Link>
                {battle.status !== "DRAFT" && (
                  <Link
                    href={`/b/${battle.slug}`}
                    target="_blank"
                    className="eyebrow transition-colors hover:text-text"
                  >
                    Ver página ↗
                  </Link>
                )}
                <form action={deleteBattle}>
                  <input type="hidden" name="id" value={battle.id} />
                  <ConfirmButton
                    pendingLabel="Excluindo…"
                    question={`Excluir "${battle.name}"? Os votos registrados também serão apagados. Essa ação não pode ser desfeita.`}
                  >
                    Excluir
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
