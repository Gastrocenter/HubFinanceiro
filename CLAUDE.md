# Hub Financeiro Gastrocenter

Sistema web interno que une ProDoctor (e depois Omie), aplica as regras financeiras da clínica e substitui planilhas. Vocabulário em [GLOSSARY.md](GLOSSARY.md), decisões em [docs/adr/](docs/adr/), trabalho em [docs/issues/](docs/issues/).

## Stack
TypeScript, Next.js (App Router), Drizzle, Supabase (Postgres e Auth), Vercel, Vitest. Ver ADR-0001.

## Regras
- Nunca versionar nem imprimir `.env` ou `dados_brutos/` (dados de pacientes, LGPD). Testes usam fixtures anonimizadas.
- O navegador nunca acessa o banco direto. Regras de negócio ficam em módulos puros e testados (ver ADR-0002).
- Migration: escreva o arquivo em `supabase/migrations/` e aplique exatamente esse conteúdo. O nome do arquivo usa a versão que o banco gravou (`list_migrations`); renomeie logo após aplicar.
- Toda tabela nova nasce com RLS ligado e sem policy para `anon`/`authenticated` (acesso só pelo servidor). Rodar o advisor de segurança do Supabase depois de cada migration.
- Toda integração é idempotente e guarda o payload bruto antes de normalizar.
- O Hub nunca sobrescreve dado do ProDoctor: divergência vira pendência.
- Omie só entra depois da issue 09 (ADR-0003).
- `scripts/coletar_prodoctor.py` é só referência de endpoints, não faz parte do produto.
- Antes de `git push`, rode `git log origin/main..HEAD` e mostre ao usuário todo commit que vai subir; aponte os que não são desta tarefa e espere o ok.

## Comandos
- `npm run check`: tipos, lint e testes unitários (o mesmo que o CI roda). `npm run test:integracao` toca o Supabase e o ProDoctor reais.
- Revisão de código segue [CODING_STANDARDS.md](CODING_STANDARDS.md).
- Esperar um deploy: `vercel inspect <url> --wait --timeout 5m`.
- Ambiente macOS: não há `timeout` do GNU coreutils.

## Agent skills

### Issue tracker

Issues em markdown local, um arquivo por issue em `docs/issues/NN-slug.md`. See `docs/agents/issue-tracker.md`.

### Triage labels

Os cinco estados padrão (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), numa linha `Status:` no topo da issue. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` e `docs/adr/` na raiz. See `docs/agents/domain.md`.
