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
- [ ] Usuário sem login é redirecionado; usuário sem perfil adequado recebe 403.
- [ ] Teste prova que não dá UPDATE/DELETE no log de auditoria.
- [ ] Cliente (navegador) não consegue ler nenhuma tabela diretamente.
- [ ] Login e troca de perfil geram entradas no log.
