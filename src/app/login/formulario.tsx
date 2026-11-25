"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./acoes";

export function FormularioDeLogin() {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});
  return (
    <form action={acao} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        E-mail
        <input name="email" type="email" autoComplete="username" required className="rounded border border-neutral-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Senha
        <input name="senha" type="password" autoComplete="current-password" required className="rounded border border-neutral-300 px-3 py-2" />
      </label>
      {estado.erro && <p role="alert" className="text-sm text-red-700">{estado.erro}</p>}
      <button type="submit" disabled={enviando} className="rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-60">
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
