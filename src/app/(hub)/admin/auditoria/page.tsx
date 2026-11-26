import { Suspense } from "react";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

async function Conteudo() {
  await exigirAcesso("ver_auditoria");
  const { data, error } = await criarClienteAdmin()
    .from("auditoria")
    .select("id, ocorrido_em, usuario_id, acao, entidade, detalhes")
    .order("ocorrido_em", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Log de auditoria</h1>
      <p className="mt-1 text-sm text-neutral-600">Últimos 100 eventos. O log só aceita inserção.</p>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-300">
            <th className="py-2 pr-4">Quando</th>
            <th className="pr-4">Ação</th>
            <th className="pr-4">Usuário</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((e) => (
            <tr key={e.id} className="border-b border-neutral-200 align-top">
              <td className="py-2 pr-4 whitespace-nowrap">{new Date(e.ocorrido_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
              <td className="pr-4">{e.acao}</td>
              <td className="pr-4 font-mono text-xs">{e.usuario_id?.slice(0, 8) ?? "—"}</td>
              <td className="font-mono text-xs">{JSON.stringify(e.detalhes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

export default function Auditoria() {
  return (
    <Suspense fallback={<p className="p-8">Carregando…</p>}>
      <Conteudo />
    </Suspense>
  );
}
