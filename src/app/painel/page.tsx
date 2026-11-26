import { Suspense } from "react";
import Link from "next/link";
import { temPermissao } from "@/dominio/permissoes";
import { exigirAcesso } from "@/lib/sessao";
import { sair } from "../login/acoes";

async function Conteudo() {
  const sessao = await exigirAcesso("acessar_painel");
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Painel</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {sessao.email} · perfis: {sessao.perfis.join(", ")}
      </p>
      <nav className="mt-6 flex flex-col gap-2 text-sm">
        {temPermissao(sessao.perfis, "revisar_cadastros") && (
          <Link href="/cadastros" className="underline">Cadastros e de-para</Link>
        )}
        {temPermissao(sessao.perfis, "ver_auditoria") && (
          <Link href="/admin/auditoria" className="underline">Log de auditoria</Link>
        )}
      </nav>
      <form action={sair} className="mt-8">
        <button type="submit" className="text-sm underline">Sair</button>
      </form>
    </main>
  );
}

export default function Painel() {
  return (
    <Suspense fallback={<p className="p-8">Carregando…</p>}>
      <Conteudo />
    </Suspense>
  );
}
