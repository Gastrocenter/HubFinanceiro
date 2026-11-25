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
- [x] `npm test` roda e passa (parser de valores pt-BR, 2 testes).
- [x] Página "ok" publicada na Vercel, com o Supabase respondendo "conectado" (checagem de saúde da API de Auth; ler uma linha fica para a issue 02, quando existir a primeira tabela).
- [x] `.env`, `dados_brutos/` e `fontes/` confirmados fora do git.
- [ ] Migration inicial versionada no repo (adiada para a issue 02: o schema está vazio, e a primeira migration real cria as tabelas de perfil e auditoria).

## Estado
Feita em 25/11/2026: Supabase (São Paulo) limpo, projeto Vercel ligado a `Gastrocenter/HubFinanceiro` com deploy automático em `main`, produção em `hub-financeiro-gastrocenter.vercel.app`.
