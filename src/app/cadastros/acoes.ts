"use server";

import { refresh } from "next/cache";
import { exigirAcesso } from "@/lib/sessao";
import { carregarSugestoes } from "@/cadastros/sinais";
import { sugestoesAplicaveis } from "@/cadastros/sugestoes-aplicaveis";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { lerTudo } from "@/lib/ler-tudo";

/** Revisa um cadastro do de-para. Para profissional, `medico` diz se é médico (D-J). */
export async function revisarCadastro(formulario: FormData): Promise<void> {
  const sessao = await exigirAcesso("revisar_cadastros");
  const id = Number(formulario.get("id"));
  const medico = formulario.get("medico");
  if (!Number.isInteger(id)) throw new Error("Cadastro inválido.");

  const { error } = await criarClienteAdmin().rpc("revisar_cadastro", {
    p_de_para_id: id,
    p_usuario: sessao.usuarioId,
    p_eh_medico: medico === "sim" ? true : medico === "nao" ? false : null,
  });
  if (error) throw new Error(`Não foi possível revisar: ${error.message}`);
  refresh();
}

/**
 * Aceita, de uma vez, as sugestões de médico / não médico que estavam na tela. Recalcula as sugestões no servidor
 * e aplica só as exibidas que não mudaram desde então (code-review item 6). Exige a confirmação marcada e audita
 * cada marcação (D-J).
 */
export async function aceitarSugestoes(formulario: FormData): Promise<void> {
  const sessao = await exigirAcesso("revisar_cadastros");
  if (formulario.get("confirmo") !== "sim") throw new Error("Marque a confirmação antes de aceitar as sugestões.");

  const db = criarClienteAdmin();
  const sugestoes = await carregarSugestoes(db);
  const aRevisar = await lerTudo(
    (de, ate) => db.from("de_para").select("id").eq("tipo", "profissional").is("revisado_em", null).order("id").range(de, ate),
    "ler profissionais a revisar",
  );
  const atuais = new Map(aRevisar.map(({ id }) => [id as number, sugestoes.get(id)?.sugestao ?? null]));
  const exibidas = formulario.getAll("exibida").map(String);

  for (const { id, ehMedico } of sugestoesAplicaveis(exibidas, atuais)) {
    const { error: e } = await db.rpc("revisar_cadastro", { p_de_para_id: id, p_usuario: sessao.usuarioId, p_eh_medico: ehMedico });
    if (e) throw new Error(`Não foi possível revisar o cadastro ${id}: ${e.message}`);
  }
  refresh();
}
