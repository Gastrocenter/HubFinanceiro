# 08 — F7: painel de conferência

Status: ready-for-agent

**Tipo:** AFK · **Depende de:** 06, 07

## Escopo
- Lista de pendências (excluído, glosa, sem de-para, sync falhou) com filtro e status.
- Status das sincronizações (última execução, falhas).
- Contas a pagar/receber do ProDoctor, só leitura.
- **Invariante de integridade (retro da issue 06):** todo job de exportação `concluido` dentro da janela de 120 dias tem `conferir_receita_do_job` batendo (linhas e total iguais entre bruto e Hub). Job que não bate aparece em destaque. Na carga inicial, um mês pareceu "concluído sem receita" e só a conferência manual mostrou; isto torna a checagem permanente. Estender a mesma checagem aos repasses (issue 07) quando existir a conferência deles.

## Critérios de aceite
- [ ] Cada pendência aponta para o registro de origem.
- [ ] Resolver uma pendência fica na auditoria.
- [ ] Sync parado há mais de 24 h aparece em destaque.
