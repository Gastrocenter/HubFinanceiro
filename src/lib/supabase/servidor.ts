import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente com a sessão do usuário (cookies). Usa só a chave pública; sem poder sobre as tabelas. */
export async function criarClienteServidor() {
  const armazem = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => armazem.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) => armazem.set(name, value, options));
          } catch {
            // Chamado de um Server Component: o proxy renova a sessão, então pode ignorar.
          }
        },
      },
    },
  );
}
