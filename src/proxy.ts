import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ehRotaSemSessao, ficaForaDaSessao } from "@/lib/rota-sem-sessao";

/**
 * Renova o token de sessão a cada requisição e manda quem não tem sessão para o login (307).
 * É só uma checagem prévia: a decisão por perfil fica nas páginas (exigirAcesso).
 */
export async function proxy(request: NextRequest) {
  if (ficaForaDaSessao(request.nextUrl.pathname)) return NextResponse.next();
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

  if (!data.user && !ehRotaSemSessao(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return resposta;
}

export const config = {
  // Só os arquivos do próprio Next ficam fora, ancorados com "/" ou fim. As exceções (login, ilustrações,
  // agendamentos) ficam em ehRotaSemSessao, testada (code-review item 10).
  matcher: ["/((?!_next/static/|_next/image(?:/|$)|favicon\\.ico$).*)"],
};
