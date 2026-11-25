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
- [ ] Testes cobrem throttle, retry, paginação e o parser (incluindo casos ambíguos).
- [ ] Trocar a empresa não exige mudar código.
- [ ] Nenhuma chave aparece em log ou em teste.
