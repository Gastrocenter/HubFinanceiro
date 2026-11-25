# 02 — Login, perfis e auditoria

**Tipo:** AFK · **Depende de:** 01

## Contexto
Requisitos RN-06, RN-07, RN-11 e [ADR-0002](../adr/0002-acesso-so-pelo-servidor-e-raw-landing.md). Auditoria desde o dia 1.

## Escopo
- Login por e-mail e senha (Supabase Auth).
- Perfis: admin, financeiro, aprovador, restrito.
- Rota protegida por perfil, acesso ao banco só pelo servidor, RLS ligado.
- Log de auditoria append-only (quem, o quê, quando).

## Critérios de aceite
- [x] Regra de decisão (sem login → /login, sem perfil → negado, usuário desativado → negado) testada em `src/dominio/acesso.test.ts`.
- [x] Rota protegida de verdade: `proxy` manda quem não tem sessão para /login (307); `exigirAcesso` aplica a regra por perfil em /painel e /admin/auditoria. Verificado localmente.
- [x] Teste prova que não dá UPDATE/DELETE/TRUNCATE no log de auditoria (`supabase/tests/auditoria_append_only.sql`).
- [x] Cliente (navegador) não consegue ler nem gravar nas tabelas (`src/integracao/isolamento-do-navegador.test.ts`, 401 / 42501).
- [x] Login e troca de perfil geram entradas no log (`login`, `login_falhou`, `logout`, `perfil_concedido`). Confirmado em produção em 25/11/2026.

## Estado (25/11/2026)
Feito: regras de permissão (S1) e de acesso (S2), migration `20261125170000_perfis_e_auditoria.sql` (tabelas `perfis_usuarios` e `auditoria`, RLS forçado, sem policy), auditoria append-only por trigger (S3), isolamento do navegador (S4), tela de login, sessão no servidor, guard de rotas e página de auditoria do admin. Primeiro admin (`yurigermano11@gmail.com`) com perfil `admin`, registrado na auditoria.

**Fechada em 25/11/2026.** Login real testado em produção; auditoria registrou `login_falhou` e `login`.
