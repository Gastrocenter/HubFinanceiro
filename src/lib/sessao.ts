import "server-only";
import { redirect } from "next/navigation";
import { decidirAcesso, type Sessao } from "@/dominio/acesso";
import type { Acao, Perfil } from "@/dominio/permissoes";
import { criarClienteAdmin } from "./supabase/admin";
import { criarClienteServidor } from "./supabase/servidor";

export type SessaoComEmail = Sessao & { email: string };

export async function carregarSessao(): Promise<SessaoComEmail | null> {
  const supabase = await criarClienteServidor();
  // getUser valida o token no servidor do Supabase; não confiar só no cookie.
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: linhas, error } = await criarClienteAdmin()
    .from("perfis_usuarios")
    .select("perfil")
    .eq("usuario_id", data.user.id)
    .eq("ativo", true);
  if (error) throw new Error(`Falha ao carregar perfis: ${error.message}`);

  const perfis = (linhas ?? []).map((l) => l.perfil as Perfil);
  return { usuarioId: data.user.id, email: data.user.email ?? "", perfis, ativo: perfis.length > 0 };
}

/** Guard das páginas: devolve a sessão ou redireciona. A decisão vem da regra testada em dominio/acesso. */
export async function exigirAcesso(acao: Acao): Promise<SessaoComEmail> {
  const sessao = await carregarSessao();
  const decisao = decidirAcesso(sessao, acao);
  if (decisao.tipo === "redirecionar") redirect(decisao.para);
  if (decisao.tipo === "negado" || !sessao) redirect("/sem-acesso");
  return sessao;
}
