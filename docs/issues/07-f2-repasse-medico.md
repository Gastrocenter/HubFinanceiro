# 07 — F2: repasse ao profissional

Status: ready-for-agent

**Tipo:** AFK + verificação manual · **Depende de:** 05b, 06 · **Decisões:** fechadas em 26/11/2026 (abaixo)

## Contexto
RN-02, RN-03, L10. O repasse vai ao **profissional**, médico ou não (GLOSSARY: Repasse). O ProDoctor já calcula e já organiza os repasses em **lotes** — o Hub consolida, liga ao procedimento e vigia; **não recalcula**.

## Fatos levantados (coleta de out/2026, `dados_brutos/2026-11-23/repasses.json`)
- Rota `POST /api/v1/Exportacoes/Repasses`; lista em `payload.exportacao.registros`. Filtros obrigatórios como nos procedimentos: `locaisProDoctor`, `convenios`, `usuarios` (códigos do de-para) e `periodo` (`dataInicial`/`dataFinal`, dd/mm/aaaa).
- O período filtra pela **data do repasse** (`dataRepasse`): os 1.493 repasses de out/2026 têm `dataRepasse` em outubro, mas os procedimentos (`data`) vão de 2025-08 a 2026-10 (maioria jul–out). A clínica repassa 1–3 meses depois do atendimento.
- **66 lotes** (`numeroRepasse`) em outubro, cada um com **uma** data, criados em 18 dias diferentes; um lote tem de 1 a 16 profissionais.
- Chave do procedimento: `(conta, linha)` — casa com `recebiveis (conta, linha)`. Cada `(conta, linha)` aparece **uma vez** nos repasses. Em out, 363 de 1.493 batem com procedimentos de out; o resto é de meses anteriores (agora carregados no Hub: dez/2025–nov/2026). 5 linhas são de antes de dez/2025.
- Profissional pelo **nome** (`nomeUsuario`), convênio pelo nome (`nomeConvenio`), unidade por `codigoLocalProDoctor` — mesmo casamento por nome exato da issue 06 (D-I).
- Campos de valor (texto pt-BR, até muitas casas): `totalConta`, `baseCalculoBruto`, `valorImposto`, `baseCalculoLiquido`, `valorRepassado`, `valorRepassadoMedico`, `valorRepassadoClinica`. `percentualImposto` vem como `"18 %"` (0, 18, 19, 20 ou 22 %, varia por profissional).
- As fórmulas **não fecham** sempre: bruto − imposto = líquido em 914/1.493; profissional + clínica = líquido em 599/1.493. Regras variam por profissional/convênio → recalcular no Hub seria arriscado.
- **Estranheza para a issue 09:** em 273 linhas (todas com imposto 0 %) `valorRepassado` ≠ `valorRepassadoMedico`, com sinal invertido. Não interpretar; perguntar à Sabrina.
- Traz **dado de paciente** (`nomePaciente`, `prontuario`): não pode sair do parser (ADR-0005), mesmo teste-mutação da issue 06.
- `tipo` sempre `"Repasse"`; `funcaoRepasse` vazio; 1 linha com repasse ao profissional negativo.

## Decisões
- **D1 (quando pagar):** o Hub segue o **lote do ProDoctor**. Cada (profissional, `numeroRepasse`) vira um **título a pagar**; referência = `dataRepasse`. A Sabrina confirma na 09 se `dataRepasse` é a geração do lote ou o pagamento.
- **D2 (quanto):** usar `valorRepassadoMedico` como o devido ao profissional. Guardar também bruto, imposto, líquido, clínica e `valorRepassado` para conferência. Não recalcular.
- **D-T (arredondamento):** valores exatos por linha (ADR-0004); arredonda para centavos **uma vez, no total do título** (meio para cima, `arredondarParaCentavos`), nunca linha a linha.
- **D-U (a repassar):** procedimentos sem repasse aparecem como **quantidade e bruto do procedimento**; o Hub **não estima** o valor do repasse.
- **D-V (glosa após repasse, L10):** glosa nova/alterada em recebível que já tem repasse → pendência `glosa_apos_repasse` com os valores. Ninguém desconta automaticamente.
- **D-W (repasse sem procedimento no Hub):** entra mesmo assim; vira pendência `repasse_sem_procedimento` só se a `data` do procedimento for de um mês carregado no Hub (senão é só fora da janela).
- **D-X (sync):** um job por mês de `dataRepasse`; carga de 12 meses; janela diária de 3 meses (pega lote editado/estornado), no mesmo agendamento das 05:00. Normalização no `aoConcluir` (antes de concluir).

## Seams (confirmados) — TDD em fatias, um teste por vez
| # | Seam | Pega |
|---|---|---|
| S1 | `lerRepasses(payload)` puro | valores exatos, `"18 %"` → número, chave (conta, linha), lote, datas; **nenhum dado de paciente sai** (teste + mutação) |
| S2 | diferença do mês de repasse (reusar o padrão de `diferencaDoMes`) | lote novo, alterado, estornado (sumiu); recusa mês vazio |
| S3 | `montarTitulos(linhas)` puro | agrupa por (profissional, lote) e arredonda só o total (D-T); teste com caso em que linha a linha daria 1 centavo diferente |
| S4 | `detectarGlosaAposRepasse` puro | glosa nova/alterada em procedimento já repassado (D-V) |
| S5 | banco, SQL com rollback em `supabase/tests/` | repasses + títulos + pendências atômicos e idempotentes; vínculo com recebível por (conta, linha); isolamento do navegador (estender `src/integracao/isolamento-do-navegador.test.ts`) |
| S6 | carga real de 12 meses | conferência independente em SQL sobre o bruto: soma de `valorRepassadoMedico` por mês = Hub (como `conferir_receita_do_job`) |
| S7 | tela `/repasses` | por profissional e por lote + "a repassar"; verificação manual |

## Armadilhas já conhecidas neste repo (issue 06)
- O PostgREST devolve **no máximo 1000 linhas**: toda leitura que pode passar disso usa `lerTudo` (`src/lib/ler-tudo.ts`) com ordenação estável.
- `numeric` lido como número JSON **perde casas**: ler como texto (`coluna:coluna::text`), como em `SELECT_RECEBIVEIS` (`src/receita/normalizar.ts`).
- Normalização roda no `aoConcluir` do `executarJob` (`src/sync/executar-job.ts`), nunca depois de concluir.
- Enfileirar carga **só depois** do deploy do código que normaliza.
- Antes de push, listar **todos** os commits que vão subir (`git log origin/main..HEAD`).

## Critérios de aceite
- [ ] Repasse e recebível ficam vinculados nos dois sentidos (rastreabilidade).
- [ ] Glosa posterior em procedimento repassado gera pendência (D-V).
- [ ] O total de repasse de cada mês bate com o ProDoctor por caminho independente (S6).
- [ ] Títulos por (profissional, lote) com total arredondado uma vez (D-T).
- [ ] Tela `/repasses` testada em produção.
