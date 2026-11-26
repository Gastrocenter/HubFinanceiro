import { Suspense } from "react";
import Link from "next/link";
import { formatarCentavos, formatarReais } from "@/dominio/formatar-reais";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

type Linha = {
  agrupamento: "total" | "profissional" | "titulo";
  numero_repasse: string | null;
  data_repasse: string | null;
  profissional_id: number | null;
  nome: string;
  eh_medico: boolean | null;
  titulos: number;
  linhas: number;
  total_exato: string;
  total_centavos: string;
};

type ARepassar = {
  profissional_id: number | null;
  nome: string;
  eh_medico: boolean | null;
  procedimentos: number;
  bruto: string;
  mes_mais_antigo: string;
};

const NOMES_DOS_MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function rotuloDoMes(mes: string) {
  const [ano, m] = mes.split("-");
  return `${NOMES_DOS_MESES[Number(m) - 1]}/${ano}`;
}
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

function Nome({ nome, id, ehMedico }: { nome: string; id: number | null; ehMedico: boolean | null }) {
  return (
    <>
      {id === null ? <span className="text-red-700" title="Sem profissional no de-para">{nome}</span> : nome}
      {ehMedico === false && <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs">não é médico</span>}
    </>
  );
}

async function Conteudo({ busca }: { busca: Promise<{ mes?: string }> }) {
  await exigirAcesso("ver_repasse");
  const db = criarClienteAdmin();
  const [{ data: meses, error: e1 }, { data: aRepassar, error: e2 }] = await Promise.all([
    db.rpc("meses_com_repasse"),
    db.rpc("a_repassar"),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const disponiveis = (meses ?? []) as string[];
  const pedido = (await busca).mes;
  const mes = pedido && disponiveis.includes(pedido) ? pedido : disponiveis[0];

  let linhas: Linha[] = [];
  if (mes) {
    const { data, error } = await db.rpc("resumo_repasses", { p_mes: mes });
    if (error) throw new Error(error.message);
    linhas = (data ?? []) as Linha[];
  }
  const total = linhas.find((l) => l.agrupamento === "total");
  // A ordem (maior valor primeiro) vem do banco, em numeric exato.
  const profissionais = linhas.filter((l) => l.agrupamento === "profissional");
  const titulos = linhas.filter((l) => l.agrupamento === "titulo");
  const pendentes = (aRepassar ?? []) as ARepassar[];

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/painel" className="text-sm underline">← Painel</Link>
      <h1 className="mt-2 text-2xl font-semibold">Repasse ao profissional</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Lotes do ProDoctor pela data do repasse. Um título por profissional e lote; o valor é o repassado ao profissional
        calculado pelo ProDoctor, arredondado uma vez no total do título.
      </p>

      {mes ? (
        <>
          <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Mês">
            {disponiveis.map((m) => (
              <Link
                key={m}
                href={`/repasses?mes=${m}`}
                aria-current={m === mes ? "page" : undefined}
                className={`rounded border px-3 py-1 ${m === mes ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}
              >
                {rotuloDoMes(m)}
              </Link>
            ))}
          </nav>

          {total && (
            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {([["A pagar", formatarCentavos(total.total_centavos)], ["Títulos", String(total.titulos)], ["Procedimentos", String(total.linhas)]] as const).map(
                ([rotulo, valor]) => (
                  <div key={rotulo} className="rounded border border-neutral-200 p-4">
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">{rotulo}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums">{valor}</dd>
                  </div>
                ),
              )}
            </dl>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Por profissional em {rotuloDoMes(mes)}</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-300">
                    <th className="py-2 pr-4">Profissional</th>
                    <th className="pr-4 text-right">Títulos</th>
                    <th className="pr-4 text-right">Proced.</th>
                    <th className="pr-4 text-right">A pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {profissionais.map((l, i) => (
                    <tr key={i} className="border-b border-neutral-200">
                      <td className="py-2 pr-4"><Nome nome={l.nome} id={l.profissional_id} ehMedico={l.eh_medico} /></td>
                      <td className="pr-4 text-right tabular-nums">{l.titulos}</td>
                      <td className="pr-4 text-right tabular-nums">{l.linhas}</td>
                      <td className="pr-4 text-right tabular-nums">{formatarCentavos(l.total_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Títulos por profissional e lote</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-300">
                    <th className="py-2 pr-4">Data</th>
                    <th className="pr-4">Lote</th>
                    <th className="pr-4">Profissional</th>
                    <th className="pr-4 text-right">Proced.</th>
                    <th className="pr-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {titulos.map((l, i) => (
                    <tr key={i} className="border-b border-neutral-200">
                      <td className="py-2 pr-4 tabular-nums">{dataBr(l.data_repasse)}</td>
                      <td className="pr-4 tabular-nums">{l.numero_repasse}</td>
                      <td className="pr-4"><Nome nome={l.nome} id={l.profissional_id} ehMedico={l.eh_medico} /></td>
                      <td className="pr-4 text-right tabular-nums">{l.linhas}</td>
                      <td className="pr-4 text-right tabular-nums">{formatarCentavos(l.total_centavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <p className="mt-4 text-sm text-neutral-600">Ainda não há repasse sincronizado.</p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">A repassar</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Procedimentos no Hub ainda sem repasse no ProDoctor (fora os marcados &quot;não repassar&quot;). Mostra o bruto do
          procedimento; o Hub não estima o valor do repasse.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-300">
                <th className="py-2 pr-4">Profissional</th>
                <th className="pr-4 text-right">Proced.</th>
                <th className="pr-4 text-right">Bruto</th>
                <th className="pr-4 text-right">Desde</th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map((l, i) => (
                <tr key={i} className="border-b border-neutral-200">
                  <td className="py-2 pr-4"><Nome nome={l.nome || "Sem profissional"} id={l.profissional_id} ehMedico={l.eh_medico} /></td>
                  <td className="pr-4 text-right tabular-nums">{l.procedimentos}</td>
                  <td className="pr-4 text-right tabular-nums">{formatarReais(l.bruto)}</td>
                  <td className="pr-4 text-right tabular-nums">{rotuloDoMes(l.mes_mais_antigo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default function Repasses({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<p className="p-8">Carregando…</p>}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
