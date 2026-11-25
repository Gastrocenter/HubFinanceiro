import { FormularioDeLogin } from "./formulario";

export default function Login() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Hub Financeiro</h1>
      <p className="mt-1 text-sm text-neutral-600">Gastrocenter. Acesso restrito.</p>
      <FormularioDeLogin />
    </main>
  );
}
