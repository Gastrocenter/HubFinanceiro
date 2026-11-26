import { extrairRegistros } from "@/conectores/prodoctor/resposta";

export type TipoDeCadastro = "unidade" | "profissional" | "convenio";

/** Um cadastro como veio de uma conta do ProDoctor (antes do de-para). */
export type RegistroDeOrigem = {
  tipo: TipoDeCadastro;
  codigoOrigem: string;
  nome: string;
  ativo: boolean;
  tipoConvenio?: number;
};

/** Onde cada cadastro vem na resposta e que tipo ele vira no Hub. */
const ROTAS: Record<string, { lista: string; tipo: TipoDeCadastro }> = {
  "/api/v1/LocaisProDoctor": { lista: "locaisProDoctor", tipo: "unidade" },
  "/api/v1/Usuarios": { lista: "usuarios", tipo: "profissional" },
  "/api/v1/Convenios": { lista: "convenios", tipo: "convenio" },
};

type Bruto = { codigo: number; nome: string; estadoRegistro?: number; tipoConvenio?: number };

export function lerCadastros(rota: string, pagina: unknown): RegistroDeOrigem[] {
  const destino = ROTAS[rota];
  if (!destino) throw new Error(`${rota} não é um cadastro conhecido.`);
  const { lista, tipo } = destino;
  return extrairRegistros(pagina, lista).map((r, i) => {
    const { codigo, nome, estadoRegistro, tipoConvenio } = r as Bruto;
    if (!Number.isInteger(codigo)) throw new Error(`${rota}: registro ${i} sem código inteiro.`);
    if (typeof nome !== "string" || !nome.trim()) throw new Error(`${rota}: registro ${i} (código ${codigo}) sem nome.`);
    // Usuários não trazem estadoRegistro; vêm só os ativos (somenteAtivos).
    const registro: RegistroDeOrigem = { tipo, codigoOrigem: String(codigo), nome, ativo: (estadoRegistro ?? 0) === 0 };
    if (tipo === "convenio") registro.tipoConvenio = tipoConvenio;
    return registro;
  });
}
