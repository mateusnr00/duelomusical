import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão do Supabase em cookie e barra o painel de quem não entrou.
 *
 * Aqui só se checa se existe sessão. Se a pessoa está na allowlist do Duelo
 * Musical é decidido no layout do painel, com uma consulta ao banco: fazer
 * essa consulta no proxy custaria uma ida ao banco em toda requisição do site.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return new NextResponse(
      "Configuração ausente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() revalida o token no servidor. Não trocar por getSession(), que
  // confia no cookie sem verificar e por isso não serve para autorizar.
  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (cause) {
    console.error("Supabase indisponível ao validar a sessão:", cause);
  }

  const { pathname } = request.nextUrl;
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminLogin = pathname === "/admin/login";

  if (isAdminArea && !isAdminLogin && !user) {
    const target = request.nextUrl.clone();
    target.pathname = "/admin/login";
    target.search = "";
    return NextResponse.redirect(target);
  }

  if (isAdminArea) {
    response.headers.set("x-robots-tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    // Arquivos estáticos ficam de fora: renovar sessão em cada imagem seria
    // uma ida ao Supabase por asset.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|mp3|wav|m4a)$).*)",
  ],
};
