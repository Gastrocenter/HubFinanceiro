import { Suspense } from "react";
import { connection } from "next/server";

async function StatusSupabase() {
  await connection();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let status = "variáveis ausentes";
  if (url && chave) {
    try {
      const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: chave }, cache: "no-store" });
      status = r.ok ? "conectado" : `erro ${r.status}`;
    } catch {
      status = "inacessível";
    }
  }
  return <p className="mt-4">Supabase: {status}</p>;
}

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Hub Financeiro Gastrocenter</h1>
      <p className="mt-2 text-sm text-neutral-600">Fundação no ar.</p>
      <Suspense fallback={<p className="mt-4">Supabase: verificando…</p>}>
        <StatusSupabase />
      </Suspense>
    </main>
  );
}
