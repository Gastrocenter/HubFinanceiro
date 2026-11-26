<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Hub Financeiro — notas para sessões OpenCode

## Onde procurar
- `CLAUDE.md` tem as regras do projeto; `CODING_STANDARDS.md` tem os julgamentos que o linter não faz (revisão de código); `GLOSSARY.md` fixa o vocabulário (empresa ≠ tenant, recebível ≠ receita, de-para ≠ mapeamento); `docs/adr/` explica o porquê; `docs/issues/` é o estado do trabalho.
- `MAPA_DO_PROJETO.md` é local/ignorado e pode estar desatualizado: não é fonte de verdade. Em conflito, valem scripts/configs (`package.json`, `vitest.config.ts`, `vercel.json`).

## Comandos
- `npm run check` = `next typegen && tsc --noEmit --incremental false` → ESLint → `vitest run --project unitarios`. É o que o CI roda (`npm ci`, Node 24); rode antes de entregar.
- Um teste só: `npm test -- src/dominio/valor.test.ts`. Não rode `tsc` direto: sem `next typegen` os tipos gerados das rotas ficam errados.
- `npm run test:integracao` (`vitest run --project integracao`) carrega `.env.local` e fala com Supabase/ProDoctor reais quando há credencial; nunca roda no CI. Testes sem credencial são pulados (`skipIf`).
- Agendamentos de produção não vivem no código: `vercel.json` registra as duas rotas `api/agendamentos/*` (`experimentalTriggers` + `schedules`, `America/Sao_Paulo`). Ao mexer na rotina diária, ajuste também esse arquivo.
- Esperar deploy: `vercel inspect <url> --wait --timeout 5m`. macOS não tem o `timeout` do GNU coreutils.

## Banco e migrations
- Escreva a SQL em `supabase/migrations/` e aplique exatamente esse conteúdo pelo Supabase MCP. O nome do arquivo é a versão que o banco gravou (`list_migrations`); renomeie logo após aplicar. Rode o advisor de segurança depois.
- Tabela/função nova nasce fechada ao navegador: RLS ligado e forçado, sem policy, `revoke` de `anon`/`authenticated`, `search_path = ''` nas funções. Acrescente-a a `src/integracao/isolamento-do-navegador.test.ts` com corpo/argumentos reais e exija `401` + `42501`; `404`/`400` não provam isolamento.
- Leitura que pode passar de 1000 linhas usa `lerTudo` (`src/lib/ler-tudo.ts`) com `.order()` estável e `.range()`: o PostgREST corta em 1000 em silêncio, e leitura cortada faz linha existente parecer nova.

## Regras que o lint não pega
- `numeric` volta como texto (`coluna::text`) e é somado no Postgres (`resumo_receita`). Nunca `Number`/`parseFloat`/`toFixed` sobre dinheiro; arredondar só em `arredondarParaCentavos` (`src/dominio/formatar-reais.ts`), meio para cima, no total de tela/título — nunca linha a linha (ADR-0004).
- Trabalho derivado de um job roda no `aoConcluir` de `executarJob`, antes de concluir (`src/sync/fila.ts`): job "concluído" já virou de-para/receita. Se a rodada morrer, a posse vence e outra refaz; mantenha tudo idempotente.
- Integração é idempotente e guarda o payload bruto antes de normalizar. O modelo do Hub não tem coluna de paciente: o parser copia campo a campo (`src/receita/ler-procedimentos.ts`), nunca `...linha` (ADR-0005). Payload de exportação é expurgado após 120 dias.
- O Hub não sobrescreve dado do ProDoctor: divergência vira pendência. Omie só depois da issue 09 (ADR-0003). `scripts/coletar_prodoctor.py` é referência de endpoints, não produto.

## Segurança e fluxo
- Nunca abrir, imprimir ou versionar `.env`, `.env.local` nem `dados_brutos/` (dados de pacientes, LGPD). Testes unitários não carregam credencial.
- O navegador nunca acessa o banco direto; regras de negócio ficam em módulos puros e testados em `src/dominio/`.
- Antes de `git push`: rode `git log origin/main..HEAD`, mostre ao usuário todo commit que vai subir, aponte os que não são desta tarefa e espere o ok.
