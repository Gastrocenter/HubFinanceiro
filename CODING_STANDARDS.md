# Padrões de código — Hub Financeiro

Lido na revisão (`/code-review`). Cada regra é um julgamento que nenhum linter faz por nós; o mecânico fica em `npm run check`.

## Leitura de tabelas do Supabase

**Leitura que pode passar de 1000 linhas usa `lerTudo` com ordenação estável.** O PostgREST devolve no máximo 1000 linhas por consulta, sem avisar. Uma leitura cortada faz linhas existentes parecerem "novas" e cega a detecção de sumidos (L3).
- Certo: `lerTudo((de, ate) => db.from("recebiveis").select(...).eq(...).order("id").range(de, ate), "contexto")` — ver `src/lib/ler-tudo.ts` e `src/receita/normalizar.ts`.
- Sinal na revisão: `.from(<tabela que cresce>).select(...)` sem `.range(...)`, `.single()` ou `head: true`.

## Valores em dinheiro

**Coluna `numeric` volta do banco como texto (`coluna:coluna::text`) e soma no Postgres.** Como número JSON, o JavaScript perde casas além de ~15 dígitos: todo dia pareceria "alterado" e somas divergem (ADR-0004).
- Certo: `SELECT_RECEBIVEIS` em `src/receita/normalizar.ts`; totais por `resumo_receita` (SQL); exibição por `formatarReais`.
- Exceção: o total de um título é somado no TypeScript, por `somarValores` (`src/dominio/valor.ts`, BigInt exato), porque o arredondamento do título é regra pura e testada (`montarTitulos`, issue 07). Nenhuma outra soma de dinheiro em TS.
- **Arredondar para centavos só em `arredondarParaCentavos`** (`src/dominio/formatar-reais.ts`), meio para cima, e só no total que vira título ou tela — nunca linha a linha.
- Sinal na revisão: `Number(...)`, `parseFloat`, `+` ou `toFixed` sobre valor de dinheiro; `numeric` selecionado sem `::text`.

## Jobs da fila

**Trabalho derivado de um job (normalizar) roda no `aoConcluir` do `executarJob`, antes de concluir.** Job "concluído" significa que já virou de-para ou receita; se a rodada morrer no meio, a posse vence e outra rodada refaz (idempotente).
- Certo: `src/sync/fila.ts` passando `aoConcluir` para `executarJob`.
- Sinal na revisão: normalização ou efeito colateral chamado depois de `concluir`, ou fora do `aoConcluir`.

## Dados de paciente

**Parser de exportação copia campo a campo, nomeando cada um; tabela do Hub não tem coluna de paciente** (ADR-0005). O vínculo com o paciente fica só no ProDoctor.
- Certo: `lerProcedimentos` (`src/receita/ler-procedimentos.ts`) e o teste "não deixa sair nenhum dado de paciente".
- Sinal na revisão: espalhar o registro bruto (`...linha`, `Object.assign` do bruto) num tipo do Hub; coluna com nome, prontuário, matrícula ou guia de paciente; parser novo sem o teste de vazamento.

## Banco

**Tabela e função novas nascem fechadas ao navegador**: RLS ligado e forçado, sem policy, privilégios de `anon`/`authenticated` revogados, `search_path = ''` nas funções, e a tabela/função acrescentada a `src/integracao/isolamento-do-navegador.test.ts` com corpo real (a recusa tem que ser `401`/`42501`, não `400`/`404`).
