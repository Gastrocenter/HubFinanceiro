"use client";

import { unstable_rethrow } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import type { ResultadoDeAcao } from "@/lib/resultado-de-acao";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Avisos = { sucesso: (mensagem: string) => void; erro: (mensagem: string) => void };

export const ERRO_INESPERADO = "Não foi possível concluir. Tente de novo; se continuar, avise o suporte.";

/**
 * Roda a action e diz o resultado: sucesso avisa e chama `aoConcluir`; erro de regra mostra o motivo;
 * exceção inesperada vira um aviso genérico. Redirecionamento do Next (sessão, permissão) é relançado.
 */
export async function executarAcao(
  acao: (formulario: FormData) => Promise<ResultadoDeAcao>,
  formulario: FormData,
  avisos: Avisos,
  aoConcluir?: () => void,
): Promise<void> {
  let resultado: ResultadoDeAcao | undefined;
  try {
    resultado = await acao(formulario);
  } catch (erro) {
    unstable_rethrow(erro);
    avisos.erro(ERRO_INESPERADO);
    return;
  }
  if (!resultado) return;
  if (resultado.ok) {
    avisos.sucesso(resultado.mensagem);
    aoConcluir?.();
  } else {
    avisos.erro(resultado.erro);
  }
}

const avisosPorToast: Avisos = { sucesso: (m) => toast.success(m), erro: (m) => toast.error(m) };

/**
 * Formulário que chama uma server action e mostra o resultado num toast. O sucesso pode fechar um diálogo
 * (`aoConcluir`). Redirecionamento (sessão expirada, sem permissão) segue para o Next.
 */
export function FormularioDeAcao({
  acao,
  aoConcluir,
  children,
  ...props
}: Omit<React.ComponentProps<"form">, "action"> & {
  acao: (formulario: FormData) => Promise<ResultadoDeAcao>;
  aoConcluir?: () => void;
}) {
  const enviar = (formulario: FormData) => executarAcao(acao, formulario, avisosPorToast, aoConcluir);

  return (
    <form {...props} action={enviar}>
      {children}
    </form>
  );
}

/**
 * Botão de envio que mostra o spinner enquanto a action roda e trava o formulário contra clique duplo.
 * Com `name`/`value`, só o botão clicado mostra o spinner.
 */
export function BotaoDeEnvio({ children, disabled, name, value, ...props }: React.ComponentProps<typeof Button>) {
  const { pending, data } = useFormStatus();
  const esteBotao = pending && (name === undefined || data?.get(name) === value);
  return (
    <Button {...props} type="submit" name={name} value={value} disabled={pending || disabled} aria-busy={esteBotao || undefined}>
      {esteBotao && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  );
}
