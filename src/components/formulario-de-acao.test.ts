import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { ERRO_INESPERADO, executarAcao } from "./formulario-de-acao";
import { falha, sucesso } from "@/lib/resultado-de-acao";

const avisos = () => ({ sucesso: vi.fn(), erro: vi.fn() });

describe("executarAcao", () => {
  it("sucesso avisa a mensagem e fecha (aoConcluir)", async () => {
    const a = avisos();
    const aoConcluir = vi.fn();
    await executarAcao(async () => sucesso("Pendência resolvida."), new FormData(), a, aoConcluir);
    expect(a.sucesso).toHaveBeenCalledWith("Pendência resolvida.");
    expect(a.erro).not.toHaveBeenCalled();
    expect(aoConcluir).toHaveBeenCalledOnce();
  });

  it("erro de regra mostra o motivo e não fecha", async () => {
    const a = avisos();
    const aoConcluir = vi.fn();
    await executarAcao(async () => falha("Escreva a justificativa antes de resolver."), new FormData(), a, aoConcluir);
    expect(a.erro).toHaveBeenCalledWith("Escreva a justificativa antes de resolver.");
    expect(aoConcluir).not.toHaveBeenCalled();
  });

  it("exceção inesperada vira aviso genérico, sem vazar a mensagem interna", async () => {
    const a = avisos();
    await executarAcao(async () => { throw new Error("detalhe interno do banco"); }, new FormData(), a);
    expect(a.erro).toHaveBeenCalledWith(ERRO_INESPERADO);
  });

  it("redirecionamento do Next (sessão, permissão) é relançado, sem aviso", async () => {
    const a = avisos();
    await expect(executarAcao(async () => redirect("/login"), new FormData(), a)).rejects.toThrow();
    expect(a.erro).not.toHaveBeenCalled();
    expect(a.sucesso).not.toHaveBeenCalled();
  });

  it("passa o formulário para a action", async () => {
    const f = new FormData();
    f.set("id", "7");
    const acao = vi.fn<(f: FormData) => Promise<ReturnType<typeof sucesso>>>(async () => sucesso("ok"));
    await executarAcao(acao, f, avisos());
    expect(acao.mock.calls[0][0].get("id")).toBe("7");
  });
});
