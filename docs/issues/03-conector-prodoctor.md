# 03 — Conector ProDoctor

**Tipo:** AFK · **Depende de:** 01

## Contexto
Módulo profundo (interface pequena, complexidade escondida). Ver docs/02, lacunas L4 e L8, e [scripts/coletar_prodoctor.py](../../scripts/coletar_prodoctor.py) como referência.

## Escopo
- Cliente HTTP com throttle de 120 req/min, retry com backoff e paginação.
- Parser único de números pt-BR (`1.234,56`) que **rejeita** valor ambíguo.
- Multiempresa: uma chave por empresa, vinda de segredo.
- Fixtures **anonimizadas** derivadas de `dados_brutos/` (sem nome, CPF ou dado de paciente).

## Critérios de aceite
- [x] Testes cobrem throttle, retry, paginação e o parser (incluindo formatos inesperados). 34 testes.
- [x] Trocar a empresa não exige mudar código (`PRODOCTOR_<EMPRESA>_APIKEY` / `_APIPASSWORD`).
- [x] Nenhuma chave aparece em erro (mensagem da API é mascarada); testes usam credenciais e números inventados.

## Estado (25/11/2026)
Feito: parser de valores exatos (ADR-0004; o parser antigo em centavos foi removido), extração de registros que acusa erro em vez de devolver lista vazia, paginação com teto, limitador de 120/min com fila (o teste pegou um bug de concorrência), novas tentativas só em falha passageira, e cliente multiempresa em `src/conectores/prodoctor/`.

Falta: rodar o teste de contrato real (`src/integracao/prodoctor-contrato.test.ts`), que depende das credenciais no padrão novo no `.env.local`.

Descoberta: os valores do ProDoctor não seguem `1.234,56`. Vêm com vírgula decimal, sem milhar, com até 14 casas, inteiros sem vírgula, negativos e texto vazio.
