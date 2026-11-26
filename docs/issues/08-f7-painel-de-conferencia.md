# 08 — F7: painel de conferência

Status: ready-for-agent

**Tipo:** AFK · **Depende de:** 06, 07

## Escopo
- Lista de pendências (excluído, glosa, sem de-para, sync falhou) com filtro e status.
- Status das sincronizações (última execução, falhas).
- ~~Contas a pagar/receber do ProDoctor, só leitura.~~ Movido para a issue 08b (decisão de 26/11/2026).
- **Invariante de integridade (retro da issue 06):** todo job de exportação `concluido` dentro da janela de 120 dias tem `conferir_receita_do_job` batendo (linhas e total iguais entre bruto e Hub). Job que não bate aparece em destaque. Na carga inicial, um mês pareceu "concluído sem receita" e só a conferência manual mostrou; isto torna a checagem permanente. Estender a mesma checagem aos repasses (issue 07) quando existir a conferência deles.

## Critérios de aceite
- [ ] Cada pendência aponta para o registro de origem.
- [ ] Resolver uma pendência fica na auditoria.
- [ ] Sync parado há mais de 24 h aparece em destaque.

## Decisões (26/11/2026)
- **D-A:** contas a pagar/receber sai desta issue e vira a [08b](08b-contas-pagar-receber.md): é uma sincronização nova, do tamanho da 07.
- **D-B:** resolver à mão: admin e financeiro (ação `resolver_pendencia`), sempre com justificativa, fechando a pendência e gravando a auditoria na mesma transação. Aprovador só vê (`ver_conferencia`: admin, financeiro e aprovador).
- **D-C:** pendência de de-para (`*_sem_par`, `*_ambiguo`) não se resolve à mão: o painel aponta para `/cadastros`, e ela fecha sozinha na sync seguinte ao cadastro corrigido.
- **D-D:** a invariante de integridade confere só o último job concluído de cada (empresa, rota, mês) nos 119 dias (um dia antes do expurgo do bruto, que apaga o que tem mais de 120). Um job mais antigo do mesmo mês não bate depois que o mês mudou, e daria falso alarme. Job concluído sem nenhuma página bruta também é conferido (mês vazio dos dois lados bate; Hub com dados e bruto vazio não bate).
- **D-E:** "sync falhou" não é pendência na tabela: sai de `sync_jobs` (estado `falhou`), na seção de status das sincronizações. Conta as falhas desde a última conclusão, por empresa e rota, lendo os jobs de 30 dias.
- **D-F (revisão):** "parado há mais de 24 h" tem 2 h de folga (26 h): o agendamento roda uma vez por dia e a fila anda a cada 15 min, então duas conclusões seguidas ficam a ~24 h uma da outra, e sem folga um atraso pequeno daria alarme falso quase todo dia.
- **D-G:** o link de origem leva à tela do mês (`/receita?mes=`, `/repasses?mes=`) ou a `/cadastros`; o texto identifica o registro no ProDoctor (unidade, conta, linha, lote). O Hub não tem tela de um registro só, e um procedimento ou repasse que sumiu não aparece mais na tela do mês: aí o texto é o que leva ao ProDoctor.

## Seams de teste (confirmados em 26/11/2026)
- S1 (puro): classificar pendência: tipo → categoria (excluído, glosa, de-para, repasse), texto, link de origem e se resolve à mão. Todo tipo que o Hub cria tem tratamento próprio (teste); tipo desconhecido aparece como "outra". De-para é todo tipo `*_sem_par`/`*_ambiguo`, a mesma regra no banco.
- S2 (puro): status das sincronizações por rota (última execução, falhas, parado há mais de 24 h, com relógio injetado).
- S3 (SQL): invariante de integridade (último job de cada rota e mês, receita e repasse). Teste SQL com TESTE_OK.
- S4 (SQL): resolver pendência (fecha e audita junto, exige justificativa, recusa de-para e pendência já fechada). Teste SQL.
- S5: permissões e isolamento do navegador com as funções novas.
- Tela `/conferencia`: sem teste automatizado, testada em produção.

## Estado (26/11/2026)
Feito: S1–S5 com testes (classificação, status das sincronizações, permissões `ver_conferencia` e `resolver_pendencia`, teste SQL `conferencia.sql` com TESTE_OK, isolamento do navegador com as duas funções novas), migrations `20261126122034_painel_de_conferencia` e `20261126123242_integridade_sem_bruto`, tela `/conferencia` com link no painel. Integridade nos dados reais: 24 de 24 meses batem (12 de receita, 12 de repasse). Nenhuma pendência no banco hoje.

Falta: testar a tela em produção (resolver uma pendência de verdade só quando houver uma).
