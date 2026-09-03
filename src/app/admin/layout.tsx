import Link from "next/link";
import { signOut } from "@/app/entrar/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A tela de login usa este layout e ainda não tem sessão: renderiza só o
  // conteúdo, sem a barra do painel.
  if (!user) return <>{children}</>;

  // Estar autenticado não basta: a escrita depende da allowlist, e a mesma
  // função que a RLS consulta decide o que aparece aqui.
  const { data: isAdmin } = await supabase.rpc("music_battle_is_admin");

  if (!isAdmin) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-20 text-center">
        <h1 className="text-2xl font-medium">Sem permissão</h1>
        <p className="mt-3 text-sm text-muted">
          A conta <strong className="text-text">{user.email}</strong> não está liberada
          para o painel do Duelo Musical.
        </p>
        <form action={signOut} className="mt-8">
          <button
            type="submit"
            className="eyebrow transition-colors hover:text-text"
          >
            Sair
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link href="/admin/batalhas" className="text-sm font-medium tracking-[0.16em] uppercase">
              Duelo Musical
            </Link>
            <nav aria-label="Seções do painel">
              <Link href="/admin/batalhas" className="eyebrow transition-colors hover:text-text">
                Batalhas de música
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/" target="_blank" className="eyebrow transition-colors hover:text-text">
              Ver site ↗
            </Link>
            <span className="hidden text-xs text-muted sm:inline">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="eyebrow transition-colors hover:text-text">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8">{children}</main>
    </div>
  );
}
