# 01 — Fundação do repo

**Tipo:** HITL (você cria os projetos e segredos; o resto é automático) · **Depende de:** nada

## Contexto
Sair do script Python de teste e criar o esqueleto do Hub conforme [ADR-0001](../adr/0001-stack-typescript-nextjs-supabase-vercel.md).

## Escopo
- Next.js (App Router) + TypeScript, Drizzle, Vitest.
- Projeto Supabase (região Brasil) e deploy na Vercel, com variáveis de ambiente configuradas.
- `CLAUDE.md` com comandos, regras de segurança e ponteiros para `GLOSSARY.md` e ADRs.
- O script Python permanece em `scripts/` só como referência de endpoints.

## Critérios de aceite
- [ ] `npm test` roda e passa (um teste trivial).
- [ ] Página "ok" publicada na Vercel lendo uma linha do Supabase.
- [ ] `.env` e `dados_brutos/` confirmados fora do git.
- [ ] Migration inicial versionada no repo.
