# 08b — Contas a pagar/receber do ProDoctor (só leitura)

Status: ready-for-agent

**Tipo:** AFK + verificação manual · **Depende de:** 08 · **Origem:** separada da issue 08 em 26/11/2026 (D-A)

## Escopo
- Sincronizar a exportação `POST /api/v1/Exportacoes/ContasPagarReceber` (máximo de 50 registros por página nas listagens financeiras), um job por mês, como procedimentos e repasses.
- Tabela própria, só leitura, sem nenhum dado de paciente (ADR-0005): parser campo a campo, com teste de vazamento.
- Mostrar no painel de conferência (issue 08).

## Fatos levantados (26/11/2026, sonda só com nomes de campos e contagens)
- 35 campos; página de 100 registros; datas `AAAA-MM-DD`; valores com vírgula decimal (`99,99`).
- Filtros obrigatórios: além de unidades, convênios e profissionais, `GruposReceitasDespesas` (403) e `ContasContabeis` (5), com código em texto (`{ "codigo": "1.01.02" }`). Sem eles, 400.
- Chave: unidade + `numero` (1.610 distintos em 1.610 linhas de out/2026). `lancamentoFinanceiro` se repete (agrupa parcelas).
- Situações: `PAGAR`, `PAGA`, `RECEBER`, `RECEBIDA`. Tipos de cliente/fornecedor: `Paciente` (74% em out/2026), `Fornecedor`, `Convênio`, `Prestador de Serviço`.
- Volume: de 800 a 1.600 contas por mês de inclusão.

## Decisões (26/11/2026)
- **D-1 (LGPD):** de paciente o Hub guarda só o tipo "Paciente": sem nome (`clienteFornecedor`), sem `historico` e sem `numeroDocumento`. De fornecedor, convênio e prestador guarda nome e histórico. Lista fechada, à prova de falha (revisão): só `Fornecedor`, `Convênio` e `Prestador de Serviço` guardam nome; qualquer outro tipo (paciente, vazio, outra grafia) não guarda nada, no parser e numa constraint do banco. Nunca guarda nome de funcionário (`usuarioInclusao`, `usuarioEfetivacao`) nem dados bancários (`banco`, `agencia`, `contaCorrente`, `cheque`).
- **D-2:** o mês de cada conta na sync é o da **data de inclusão** (`tipoPeriodo` 0), que nunca muda: a conta não pula de mês nem gera "sumiu" falso. A tela mostra por vencimento sobre o que foi carregado.
- **D-3:** a sync diária relê **12 meses** (a carga inicial também é de 12): a situação de uma conta paga meses depois fica atual. Cerca de 160 páginas por dia.
- **D-4:** grupos de receita/despesa e contas contábeis viram cadastro diário numa tabela própria (`plano_financeiro`), lida no enfileiramento como o de-para. Serve depois ao DRE.
- **D-5:** os quatro tipos (`tipos` 0, 1, 2 e 3) num job só por mês.

## Seams de teste (confirmados em 26/11/2026)
- S1 (puro): `lerContas`, campo a campo, com D-1; teste de vazamento e de mutação.
- S2 (puro): `lerPlanoFinanceiro`.
- S3 (puro): diferença do mês de contas por unidade + número (`diferencaPorChave`).
- S4 (SQL): `plano_financeiro`, `contas_pagar_receber`, `aplicar_mes_de_contas` (pendência `conta_sumiu`), `conferir_contas_do_job`, integridade da 08 estendida, resumo por vencimento. Teste SQL com TESTE_OK.
- S5: permissão `ver_contas` (admin, financeiro, aprovador) e isolamento do navegador.
- S6: carga real de 12 meses conferida em SQL contra o bruto, e repetir não muda nada.
- S7: tela `/contas`, só leitura, testada em produção.

## Estado (26/11/2026)
Feito: S1–S5 com testes (parser com teste de vazamento, visto falhar com o parser copiando o registro bruto; plano financeiro; diferença do mês; teste SQL `contas_pagar_receber.sql` com TESTE_OK; permissão `ver_contas`; isolamento do navegador com as duas tabelas e as oito funções novas), migrations `20261126135756_contas_pagar_receber` e `20261126141118_contas_revisao`, normalização no `aoConcluir`, jobs do plano financeiro entre os cadastros do dia, contas no agendamento das 05:00 (12 meses), pendência `conta_sumiu` no painel de conferência, integridade da 08 estendida, tela `/contas`.
Ensaio sem banco com out/2026: 17 páginas, 1.610 contas, todas do mês de inclusão, nenhuma de paciente com nome, histórico ou documento.

Revisão de código (corrigido): D-1 à prova de falha (acima); natureza (pagar ou receber) pela situação, não pelo sinal do valor; totais da tela somados no banco (`totais_contas`, ADR-0004); lista de contas a pagar lida página a página; conferência também compara os valores efetivados (o que muda quando a conta é paga, D-3) e acusa conta de outro mês de inclusão no bruto.
Dívida registrada (não corrigida): o mapeamento rota → nome/normalizador/tipo está em quatro lugares (status das sincronizações, conferência, fila, contas); a leitura das páginas do job e `mesDoCorpo` se repetem entre receita, repasse e contas.

Falta, depois do deploy: carga de 12 meses (S6) com `RODAR_SYNC_REAL=1 MESES_CARGA=2025-12,...,2026-11 ROTULO_CARGA=carga-inicial npm run test:integracao -- carga-contas-real` (sincroniza o plano financeiro antes) e teste da tela em produção (S7). No primeiro dia o agendamento não cria job de contas (o plano ainda está vazio); a carga resolve.

## Critérios de aceite
- [ ] Contas a pagar e a receber de um mês batem com o ProDoctor por caminho independente.
- [ ] Nenhum dado de paciente gravado (teste de vazamento).
- [ ] Tela só de leitura testada em produção.
