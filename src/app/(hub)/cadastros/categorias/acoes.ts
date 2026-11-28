"use server";

import { refresh } from "next/cache";
import { exigirAcesso } from "@/lib/sessao";
import { falha, sucesso, type ResultadoDeAcao } from "@/lib/resultado-de-acao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { lerNatureza, validarNomeDeCategoria, validarTrocaDeCategoria, type CategoriaDaLista } from "@/contas/categorias";
import { conferirItensSemCategoria } from "@/contas/conferir-itens-sem-categoria";

const AVISO_DE_PENDENCIAS = " As pendências de item sem categoria serão conferidas na próxima sincronização.";

async function lerCategorias(db: ReturnType<typeof criarClienteAdmin>): Promise<CategoriaDaLista[]> {
  // Lista curta (dezenas): uma página basta.
  const { data, error } = await db.from("categorias").select("id, natureza, nome").order("id").range(0, 999);
  if (error) throw new Error(`ler categorias: ${error.message}`);
  return (data ?? []) as CategoriaDaLista[];
}

/**
 * Troca a categoria de um item do plano (sem sufixo, vale para as três raízes). Admin e financeiro (D-11); o banco
 * grava e audita na mesma transação. Depois confere as pendências de item sem categoria (S5).
 */
export async function trocarCategoria(formulario: FormData): Promise<ResultadoDeAcao> {
  const sessao = await exigirAcesso("revisar_cadastros");
  const db = criarClienteAdmin();
  const troca = validarTrocaDeCategoria(
    { natureza: formulario.get("natureza"), item: formulario.get("item"), categoria: formulario.get("categoria") },
    await lerCategorias(db),
  );
  if (!troca.ok) return falha(troca.erro);

  const { data: mudou, error } = await db.rpc("definir_categoria_do_item", {
    p_natureza: troca.natureza,
    p_item: troca.item,
    p_categoria_id: troca.categoriaId,
    p_usuario: sessao.usuarioId,
  });
  if (error) return falha(`Não foi possível trocar a categoria: ${error.message}`);
  if (mudou === false) return sucesso("A categoria já era essa.");

  const conferiu = await conferirItensSemCategoria(db);
  refresh();
  const texto = troca.categoriaId === null ? `"${troca.item}" ficou sem categoria.` : `Categoria de "${troca.item}" trocada.`;
  return sucesso(conferiu ? texto : texto + AVISO_DE_PENDENCIAS);
}

/** Cria (sem `id`) ou renomeia uma categoria da lista a pagar ou a receber. Admin e financeiro, auditado. */
export async function salvarCategoria(formulario: FormData): Promise<ResultadoDeAcao> {
  const sessao = await exigirAcesso("revisar_cadastros");
  const naturezaBruta = formulario.get("natureza");
  if (naturezaBruta !== "pagar" && naturezaBruta !== "receber") return falha("Natureza inválida.");
  const natureza = lerNatureza(naturezaBruta);
  const idBruto = String(formulario.get("id") ?? "");
  const id = idBruto === "" ? undefined : Number(idBruto);
  if (id !== undefined && !Number.isInteger(id)) return falha("Categoria inválida.");

  const db = criarClienteAdmin();
  // As duas listas: o identificador da categoria é único entre elas (o filtro das páginas de contas é por ele).
  const todas = await lerCategorias(db);
  if (id !== undefined && !todas.some((c) => c.id === id && c.natureza === natureza)) return falha("Essa categoria não existe nesta lista.");
  const nome = validarNomeDeCategoria(String(formulario.get("nome") ?? ""), todas, id);
  if (!nome.ok) return falha(nome.erro);

  const { error } = await db.rpc("salvar_categoria", {
    p_natureza: natureza,
    p_id: id ?? null,
    p_nome: nome.nome,
    p_usuario: sessao.usuarioId,
  });
  if (error) return falha(`Não foi possível salvar a categoria: ${error.message}`);
  refresh();
  return sucesso(id === undefined ? `Categoria "${nome.nome}" criada.` : `Categoria renomeada para "${nome.nome}".`);
}
