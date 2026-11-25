# Hub Financeiro Gastrocenter

Sistema web interno que une ProDoctor (e depois Omie), aplica as regras financeiras da clínica e substitui planilhas. Vocabulário em [GLOSSARY.md](GLOSSARY.md), decisões em [docs/adr/](docs/adr/), trabalho em [docs/issues/](docs/issues/).

## Stack
TypeScript, Next.js (App Router), Drizzle, Supabase (Postgres e Auth), Vercel, Vitest. Ver ADR-0001.

## Regras
- Nunca versionar nem imprimir `.env` ou `dados_brutos/` (dados de pacientes, LGPD). Testes usam fixtures anonimizadas.
- O navegador nunca acessa o banco direto. Regras de negócio ficam em módulos puros e testados (ver ADR-0002).
- Toda tabela nova nasce com RLS ligado e sem policy para `anon`/`authenticated` (acesso só pelo servidor). Rodar o advisor de segurança do Supabase depois de cada migration.
- Toda integração é idempotente e guarda o payload bruto antes de normalizar.
- O Hub nunca sobrescreve dado do ProDoctor: divergência vira pendência.
- Omie só entra depois da issue 09 (ADR-0003).
- `scripts/coletar_prodoctor.py` é só referência de endpoints, não faz parte do produto.
