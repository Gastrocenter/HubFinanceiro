"use server";

import { refresh } from "next/cache";
import { exigirAcesso } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

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
