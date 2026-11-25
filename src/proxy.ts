import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rotas abertas sem login. Todo o resto exige sessão. */
const ROTAS_PUBLICAS = ["/login"];

/**
 * Renova o token de sessão a cada requisição e manda quem não tem sessão para o login (307).
 * É só uma checagem prévia: a decisão por perfil fica nas páginas (exigirAcesso).
 */
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();

  const publica = ROTAS_PUBLICAS.some((rota) => request.nextUrl.pathname.startsWith(rota));
  if (!data.user && !publica) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return resposta;
}

export const config = {
  // Agendamentos ficam fora: o agendador não tem sessão de usuário.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/agendamentos).*)"],
};
