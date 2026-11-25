"use server";

import { redirect } from "next/navigation";
import { registrarAuditoria } from "@/lib/auditoria";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoLogin = { erro?: string };

export async function entrar(_anterior: EstadoLogin, formulario: FormData): Promise<EstadoLogin> {
  const email = String(formulario.get("email") ?? "").trim();
  const senha = String(formulario.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error || !data.user) {
    await registrarAuditoria({ acao: "login_falhou", detalhes: { email } });
    return { erro: "E-mail ou senha inválidos." };
  }

  await registrarAuditoria({ usuarioId: data.user.id, acao: "login" });
  redirect("/painel");
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (data.user) await registrarAuditoria({ usuarioId: data.user.id, acao: "logout" });
  redirect("/login");
}
