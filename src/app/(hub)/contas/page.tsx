import { Suspense } from "react";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ mes?: string }> };

/**
 * A página antiga virou duas (issue 11, D-1). Links antigos (`/contas?mes=AAAA-MM`, como o da pendência
 * `conta_sumiu`) caem em "a pagar", em todas as unidades, com o período daquele mês por vencimento.
 */
async function Redirecionar({ searchParams }: Props): Promise<never> {
  const { mes } = await searchParams;
  if (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    const [ano, m] = mes.split("-").map(Number);
    const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
    redirect(`/contas/pagar?aba=todas&de=${mes}-01&ate=${mes}-${String(ultimo).padStart(2, "0")}`);
  }
  redirect("/contas/pagar");
}

// O endereço só é lido na requisição: fora do Suspense o pré-carregamento do build quebra (cache components).
export default function Contas(props: Props) {
  return (
    <Suspense fallback={null}>
      <Redirecionar {...props} />
    </Suspense>
  );
}
