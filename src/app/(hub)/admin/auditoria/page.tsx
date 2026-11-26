import { Suspense } from "react";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { EsqueletoDeTela } from "@/components/esqueleto-de-tela";
import { Vazio } from "@/components/vazio";
import { TabelaDeAuditoria } from "./tabela-de-auditoria";

async function Conteudo() {
  await exigirAcesso("ver_auditoria");
  const { data, error } = await criarClienteAdmin()
    .from("auditoria")
    .select("id, ocorrido_em, usuario_id, acao, entidade, detalhes")
    .order("ocorrido_em", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Log de auditoria</h1>
      <p className="mt-1 text-sm text-muted-foreground">Últimos 100 eventos. O log só aceita inserção.</p>
      {(data ?? []).length === 0 ? (
        <Vazio titulo="Nenhum evento registrado" descricao="Login, revisão de cadastro e resolução de pendência ficam registrados aqui." />
      ) : (
      <TabelaDeAuditoria
        eventos={(data ?? []).map((e) => ({
          id: e.id,
          quando: e.ocorrido_em,
          quandoTexto: new Date(e.ocorrido_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          acao: e.acao,
          usuario: e.usuario_id?.slice(0, 8) ?? "—",
          detalhes: JSON.stringify(e.detalhes),
        }))}
      />
      )}
    </div>
  );
}

export default function Auditoria() {
  return (
    <Suspense fallback={<EsqueletoDeTela filtros={false} largura="max-w-4xl" />}>
      <Conteudo />
    </Suspense>
  );
}
