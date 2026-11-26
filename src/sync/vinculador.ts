import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverPorNome } from "@/receita/resolver-por-nome";
import type { Vinculos } from "@/receita/planejar-gravacao";
import { lerTudo } from "@/lib/ler-tudo";

type Origem = {
  tipo: string;
  codigo_origem: string;
  nome_origem: string;
  unidade_id: number | null;
  profissional_id: number | null;
  convenio_id: number | null;
};

export type PendenciaNova = { tipo: string; referencia: string; descricao: string; detalhes: Record<string, unknown> };
export type PendenciaAResolver = { tipo: string; referencia: string };

export async function lerOrigens(db: SupabaseClient, empresa: string): Promise<Origem[]> {
  return lerTudo(
    (de, ate) =>
      db.from("de_para").select("tipo, codigo_origem, nome_origem, unidade_id, profissional_id, convenio_id").eq("empresa", empresa).order("id").range(de, ate),
    "ler de-para",
  ) as Promise<Origem[]>;
}

/**
 * Liga uma linha de exportação ao de-para: unidade pelo código, profissional e convênio pelo nome exato (D-I).
 * Nome sem par ou ambíguo vira pendência (D-S); o que casou fecha a pendência de vínculo correspondente.
 */
export function criarVinculador(origens: readonly Origem[], mes: string) {
  const doTipo = (tipo: string) => origens.filter((o) => o.tipo === tipo);
  const profissionais = doTipo("profissional").map((o) => ({ id: o.profissional_id!, nome: o.nome_origem }));
  const convenios = doTipo("convenio").map((o) => ({ id: o.convenio_id!, nome: o.nome_origem }));
  const unidades = new Map(doTipo("unidade").map((o) => [o.codigo_origem, o.unidade_id!]));

  const pendencias = new Map<string, PendenciaNova>();
  const resolver = new Map<string, PendenciaAResolver>();
  function marcarResolvido(qual: string, referencia: string) {
    for (const tipo of [`${qual}_sem_par`, `${qual}_ambiguo`]) resolver.set(`${tipo}:${referencia}`, { tipo, referencia });
  }
  function porNome(nome: string, cadastros: { id: number; nome: string }[], qual: "profissional" | "convenio"): number | null {
    const r = resolverPorNome(nome, cadastros);
    if (r.tipo === "casou") {
      marcarResolvido(qual, nome);
      return r.id;
    }
    const tipo = r.tipo === "ambiguo" ? `${qual}_ambiguo` : `${qual}_sem_par`;
    pendencias.set(`${tipo}:${nome}`, {
      tipo,
      referencia: nome,
      descricao: r.tipo === "ambiguo" ? `Nome de ${qual} casa com mais de um cadastro` : `Nome de ${qual} sem cadastro no de-para`,
      detalhes: { mes, ...(r.tipo === "ambiguo" ? { candidatos: r.ids } : {}) },
    });
    return null;
  }

  return {
    vincular(r: { codigoLocal: string; nomeProfissional: string; nomeConvenio: string }): Vinculos {
      const unidade = unidades.get(r.codigoLocal) ?? null;
      if (unidade === null) {
        pendencias.set(`unidade_sem_par:${r.codigoLocal}`, {
          tipo: "unidade_sem_par", referencia: r.codigoLocal, descricao: "Código de unidade sem de-para", detalhes: { mes },
        });
      } else {
        marcarResolvido("unidade", r.codigoLocal);
      }
      return {
        unidade_id: unidade,
        profissional_id: porNome(r.nomeProfissional, profissionais, "profissional"),
        convenio_id: porNome(r.nomeConvenio, convenios, "convenio"),
      };
    },
    pendencias: () => [...pendencias.values()],
    resolver: () => [...resolver.values()],
  };
}
