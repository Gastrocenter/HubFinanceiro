/** Como a pendência aparece no painel de conferência (issue 08). */
export type Categoria = "excluido" | "glosa" | "de_para" | "repasse" | "outra";

export type PendenciaDoPainel = { tipo: string; referencia: string; detalhes: Record<string, unknown> };

export type Classificacao = {
  categoria: Categoria;
  /** O registro de origem: como achá-lo no ProDoctor e onde ele aparece no Hub. */
  origem: { texto: string; link: string | null };
  /** De-para não se resolve à mão: fecha sozinho quando o cadastro é corrigido (D-C). */
  resolveAMao: boolean;
};

const comoTexto = (v: unknown) => (typeof v === "string" ? v : "");

/** "1:4521:2" → "Unidade 1, conta 4521, linha 2". */
function procedimento(chave: string) {
  const [unidade, conta, linha] = chave.split(":");
  return `Unidade ${unidade}, conta ${conta}, linha ${linha}`;
}

const listaDeLotes = (lotes: string[]) =>
  lotes.length === 1 ? `lote ${lotes[0]}` : `lotes ${lotes.slice(0, -1).join(", ")} e ${lotes[lotes.length - 1]}`;

const NOME_DO_CADASTRO: Record<string, string> = { profissional: "Profissional", convenio: "Convênio" };

/**
 * De-para é todo tipo terminado em `_sem_par` ou `_ambiguo` (src/sync/vinculador.ts). A mesma regra está em
 * `resolver_pendencia` no banco: pelo sufixo, um cadastro novo nunca vira "resolvível à mão" por engano (D-C).
 */
const DE_PARA = /^(.+)_(sem_par|ambiguo)$/;

export function classificarPendencia({ tipo, referencia, detalhes }: PendenciaDoPainel): Classificacao {
  const mes = comoTexto(detalhes.mes);
  switch (tipo) {
    case "procedimento_sumiu":
      return { categoria: "excluido", origem: { texto: procedimento(referencia), link: `/receita?mes=${mes}` }, resolveAMao: true };
    case "conta_sumiu": {
      const [unidade, numero] = referencia.split(":");
      // Natureza pela situação, como no banco (natureza_da_conta): cada uma tem sua página (issue 11, D-1).
      const situacao = comoTexto(detalhes.situacao);
      const natureza = situacao === "RECEBER" || situacao === "RECEBIDA" ? "receber" : situacao === "PAGAR" || situacao === "PAGA" ? "pagar" : null;
      const mesDoVencimento = /^\d{4}-\d{2}/.test(comoTexto(detalhes.vencimento)) ? comoTexto(detalhes.vencimento).slice(0, 7) : "";
      let periodo = "";
      if (mesDoVencimento) {
        const [ano, mes] = mesDoVencimento.split("-").map(Number);
        const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        periodo = `&de=${mesDoVencimento}-01&ate=${mesDoVencimento}-${String(ultimo).padStart(2, "0")}`;
      }
      return {
        categoria: "excluido",
        origem: {
          texto: `Unidade ${unidade}, conta a ${natureza ?? "pagar/receber"} nº ${numero}`,
          link: `/contas/${natureza ?? "pagar"}?aba=todas${periodo}`,
        },
        resolveAMao: true,
      };
    }
    case "item_sem_categoria": {
      // Como o de-para: fecha sozinha quando o item ganha categoria (issue 11, D-5); o banco recusa resolver à mão.
      const natureza = comoTexto(detalhes.natureza) === "receber" ? "receber" : "pagar";
      return {
        categoria: "de_para",
        origem: {
          texto: `Item “${comoTexto(detalhes.item)}” (${natureza === "pagar" ? "a pagar" : "a receber"}) sem categoria`,
          link: `/cadastros/categorias?natureza=${natureza}`,
        },
        resolveAMao: false,
      };
    }
    case "repasse_sumiu": {
      const lote = referencia.split(":")[3];
      return {
        categoria: "excluido",
        origem: { texto: `${procedimento(referencia)}, ${listaDeLotes([lote])}`, link: `/repasses?mes=${mes}` },
        resolveAMao: true,
      };
    }
    case "repasse_sem_procedimento":
      return {
        categoria: "repasse",
        origem: { texto: `${procedimento(referencia)}, ${listaDeLotes([comoTexto(detalhes.numero_repasse)])}`, link: `/repasses?mes=${mes}` },
        resolveAMao: true,
      };
    case "glosa_apos_repasse": {
      const repasses = Array.isArray(detalhes.repasses) ? (detalhes.repasses as Record<string, unknown>[]) : [];
      const lotes = repasses.map((r) => comoTexto(r.numeroRepasse));
      const mesDoRepasse = comoTexto(repasses[0]?.dataRepasse).slice(0, 7);
      return {
        categoria: "glosa",
        origem: {
          texto: `${procedimento(comoTexto(detalhes.procedimento) || referencia.split("|")[0])}, ${listaDeLotes(lotes)}`,
          link: mesDoRepasse ? `/repasses?mes=${mesDoRepasse}` : "/repasses",
        },
        resolveAMao: true,
      };
    }
  }
  const dePara = DE_PARA.exec(tipo);
  if (dePara) {
    const qual = dePara[1];
    const nome = qual === "unidade" ? `Unidade de código ${referencia}` : `${NOME_DO_CADASTRO[qual] ?? qual} “${referencia}”`;
    return { categoria: "de_para", origem: { texto: nome, link: "/cadastros" }, resolveAMao: false };
  }
  return { categoria: "outra", origem: { texto: referencia, link: null }, resolveAMao: true };
}
