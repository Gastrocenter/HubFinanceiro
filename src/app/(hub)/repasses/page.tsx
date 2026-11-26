import { Suspense } from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { rotuloDoMes } from "@/dominio/rotulo-do-mes";
import { formatarData as dataBr } from "@/dominio/formatar-data";
import { formatarCentavos, formatarReais } from "@/dominio/formatar-reais";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { CircleCheck } from "lucide-react";
import { EsqueletoDeTela } from "@/components/esqueleto-de-tela";
import { Status } from "@/components/status";
import { Vazio } from "@/components/vazio";

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


function Nome({ nome, id, ehMedico }: { nome: string; id: number | null; ehMedico: boolean | null }) {
  return (
    <>
      {nome}
      {id === null && <Status tom="erro" className="ml-2" title="Sem profissional no de-para">sem de-para</Status>}
      {ehMedico === false && <Status tom="neutro" className="ml-2">não é médico</Status>}
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
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">Repasse ao profissional</h1>
      <p className="mt-1 text-sm text-muted-foreground">
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
                className={`rounded-lg border px-3 py-1 ${m === mes ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
              >
                {rotuloDoMes(m)}
              </Link>
            ))}
          </nav>

          {total && (
            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {([["A pagar", formatarCentavos(total.total_centavos)], ["Títulos", String(total.titulos)], ["Procedimentos", String(total.linhas)]] as const).map(
                ([rotulo, valor]) => (
                  <div key={rotulo} className="rounded-xl bg-card p-4">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums">{valor}</dd>
                  </div>
                ),
              )}
            </dl>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Por profissional em {rotuloDoMes(mes)}</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-right">Títulos</TableHead>
                    <TableHead className="text-right">Proced.</TableHead>
                    <TableHead className="text-right">A pagar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profissionais.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell><Nome nome={l.nome} id={l.profissional_id} ehMedico={l.eh_medico} /></TableCell>
                      <TableCell className="text-right tabular-nums">{l.titulos}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.linhas}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarCentavos(l.total_centavos)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {total && (
                  <TableFooter>
                    <TableRow>
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">{total.titulos}</TableCell>
                      <TableCell className="text-right tabular-nums">{total.linhas}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarCentavos(total.total_centavos)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Títulos por profissional e lote</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-right">Proced.</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {titulos.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="tabular-nums">{dataBr(l.data_repasse)}</TableCell>
                      <TableCell className="tabular-nums">{l.numero_repasse}</TableCell>
                      <TableCell><Nome nome={l.nome} id={l.profissional_id} ehMedico={l.eh_medico} /></TableCell>
                      <TableCell className="text-right tabular-nums">{l.linhas}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarCentavos(l.total_centavos)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {total && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3}>Total ({total.titulos} títulos)</TableCell>
                      <TableCell className="text-right tabular-nums">{total.linhas}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatarCentavos(total.total_centavos)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </section>
        </>
      ) : (
        <Vazio titulo="Ainda não há repasse sincronizado" descricao="Os lotes de repasse aparecem aqui depois da sincronização com o ProDoctor." />
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">A repassar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Procedimentos no Hub ainda sem repasse no ProDoctor (fora os marcados &quot;não repassar&quot;). Mostra o bruto do
          procedimento; o Hub não estima o valor do repasse.
        </p>
        {pendentes.length === 0 ? (
          <Vazio icone={CircleCheck} titulo="Nada a repassar" descricao="Todo procedimento do Hub já tem repasse no ProDoctor." />
        ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead className="text-right">Proced.</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendentes.map((l, i) => (
                <TableRow key={i}>
                  <TableCell><Nome nome={l.nome || "Sem profissional"} id={l.profissional_id} ehMedico={l.eh_medico} /></TableCell>
                  <TableCell className="text-right tabular-nums">{l.procedimentos}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarReais(l.bruto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{rotuloDoMes(l.mes_mais_antigo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}
      </section>
    </div>
  );
}

export default function Repasses({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  return (
    <Suspense fallback={<EsqueletoDeTela indicadores={3} tabelas={3} />}>
      <Conteudo busca={searchParams} />
    </Suspense>
  );
}
