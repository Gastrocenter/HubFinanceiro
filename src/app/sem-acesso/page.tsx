import Link from "next/link";

export default function SemAcesso() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Sem acesso</h1>
      <p className="mt-2 text-sm text-neutral-600">Seu perfil não permite abrir esta página.</p>
      <Link href="/painel" className="mt-4 inline-block text-sm underline">Voltar ao painel</Link>
    </main>
  );
}
