---
status: accepted
---
# Stack: TypeScript full-stack em Next.js, Supabase (Postgres e Auth) e Vercel

O script em Python foi só um teste de viabilidade da API do ProDoctor. O Hub é um sistema interno de baixo volume, construído e mantido por uma pessoa com o Claude Code, então escolhemos uma única linguagem no front e no back: Next.js (App Router), Drizzle como ORM com migrations versionadas, Vitest nos testes, Supabase para Postgres e Auth, e Vercel para hospedagem. Supabase e Vercel ficam em região do Brasil quando possível, por causa da LGPD.

## Consequences

- A Vercel limita a duração das funções, e o ProDoctor limita a 120 req/min. A sincronização roda numa fila em Postgres processada por Vercel Cron em lotes. Se isso limitar, trocar por Inngest ou Trigger.dev.
- As regras de negócio (repasse, rateio, idempotência, parser de números pt-BR) ficam em módulos TypeScript puros, sem dependência de framework, para testar sem banco nem tela.
- Trocar de banco ou de hospedagem depois custa um trimestre. Por isso esta decisão está registrada.
