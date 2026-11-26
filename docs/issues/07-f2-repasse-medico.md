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

## Estado (26/11/2026)
Feito: parser sem dados de paciente (S1, mutação provando o teste), diferença do mês de repasse (S2, reusa `diferencaPorChave`, agora comum à receita), títulos por (profissional, lote) com arredondamento só no total (S3), glosa após repasse (S4, detectada na sync de procedimentos; cada mudança de glosa é uma pendência), banco (S5: `repasses`, `titulos_repasse`, `aplicar_mes_de_repasses`, testes SQL `aplicar_mes_de_repasses` e `resumo_repasses` com TESTE_OK, isolamento do navegador estendido), tela `/repasses` (S7) e o job no agendamento das 05:00 (janela de 3 meses, depois dos procedimentos).

Ensaio sem banco com o arquivo de out/2026: 1.493 linhas, 394 títulos, total exato R$ 329.902,8676 (igual ao cálculo independente em Python). A soma dos títulos arredondados dá R$ 329.902,90, 3 centavos acima porque cada título arredonda uma vez (D-T).

Decisões tomadas na implementação:
- Chave do repasse = a do recebível `(empresa, codigo_local, conta, linha)`; `recebivel_id` único liga os dois sentidos. O vínculo é refeito a cada sync de repasses, então um procedimento que chega depois se liga no dia seguinte.
- Repasse que some do mês vira `repasse_sumiu` (fecha sozinha se ele voltar); título do lote que sumiu fica `ativo = false`, nunca é apagado.
- Lote com duas `dataRepasse`, ou linha sem `valorRepassadoMedico`, faz o job do mês falhar de forma visível (fato levantado: um lote tem uma data só).

Carga real de 12 meses (S6) rodada em 26/11/2026, jobs 73–84, rótulo `carga-inicial`. Os 12 jobs concluíram; o teste viu só 9 porque o agendador de produção pegou 3 em paralelo. Conferência em SQL (`conferir_repasse_do_job`) de cada job:
- Títulos: quantidade e soma exata batem com o bruto em todos os 12 meses. O valor a pagar por título está certo.
- Linhas: out/2026 (1.493) e nov/2026 (vazio) batem. De dez/2025 a set/2026 faltam 444 linhas no Hub (15.427 no bruto, 14.983 chaves distintas).

**Bug dos lotes (corrigido em 26/11/2026):** o mesmo procedimento (conta, linha) aparece em lotes de meses diferentes. São 432 chaves, por exemplo: lote de jan com valor e lote de fev com 0, ou o contrário. A chave de `repasses` era só a do procedimento, então o upsert do mês seguinte movia a linha do mês anterior. Faltavam linhas de detalhe nos meses anteriores; os títulos não foram afetados. Nenhuma pendência foi criada.
Correção (migration `20261126104824_repasse_por_lote`):
- Um repasse é um procedimento num lote: a chave passa a ser `(empresa, codigo_local, conta, linha, numero_repasse)`, e `chaveDoRepasse` inclui o lote.
- Um recebível pode ter vários repasses: `recebivel_id` deixou de ser único.
- `planejarGravacao` recebe a chave de quem chama (antes usava a do procedimento fixa).
- Glosa após repasse traz todos os repasses do procedimento em `detalhes.repasses`.
- `repasse_sem_procedimento` continua por procedimento (dois lotes, uma pendência); `repasse_sumiu` passa a ser por repasse (procedimento e lote).
- Testes: S2 (o lote refeito entra como novo e o antigo some), `planejarGravacao` (dois lotes, duas linhas), S4 (dois repasses na pendência) e o teste SQL `aplicar_mes_de_repasses` (dois lotes em meses diferentes ficam), todos vistos falhando antes da correção.
Falta, depois do deploy: recarregar os 12 meses e rodar o S6 de novo. Perguntar à Sabrina o que significa a linha de valor 0 num segundo lote (estorno, ajuste?).

O S6 continua aberto até a recarga. Falta ainda o teste da tela em produção (S7).

Para a issue 09 (perguntar à Sabrina):
- `nao_incluir_repasse`: "a repassar" só tira os marcados `nao_repassar`.
- Glosa em procedimento mais antigo que a janela de 3 meses não é detectada (só a sync de procedimentos vê glosa).
- Procedimento que some depois de repassado gera só `procedimento_sumiu`, sem o contexto do repasse.
- As telas de receita e repasse somam todas as empresas (hoje só há uma).

## Critérios de aceite
- [ ] Repasse e recebível ficam vinculados nos dois sentidos (rastreabilidade).
- [ ] Glosa posterior em procedimento repassado gera pendência (D-V).
- [ ] O total de repasse de cada mês bate com o ProDoctor por caminho independente (S6).
- [ ] Títulos por (profissional, lote) com total arredondado uma vez (D-T).
- [ ] Tela `/repasses` testada em produção.
