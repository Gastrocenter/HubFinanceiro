# 08b — Contas a pagar/receber do ProDoctor (só leitura)

Status: needs-triage

**Tipo:** AFK + verificação manual · **Depende de:** 08 · **Origem:** separada da issue 08 em 26/11/2026 (D-A)

## Escopo
- Sincronizar a exportação `POST /api/v1/Exportacoes/ContasPagarReceber` (máximo de 50 registros por página nas listagens financeiras), um job por mês, como procedimentos e repasses.
- Tabela própria, só leitura, sem nenhum dado de paciente (ADR-0005): parser campo a campo, com teste de vazamento.
- Mostrar no painel de conferência (issue 08).

## Perguntas em aberto
- Quais campos a exportação traz e quais podem ter nome de paciente (precisa de uma amostra anonimizada).
- Período: data de vencimento, de emissão ou de efetivação?
- Janela da sync diária e tamanho da carga inicial.

## Critérios de aceite
- [ ] Contas a pagar e a receber de um mês batem com o ProDoctor por caminho independente.
- [ ] Nenhum dado de paciente gravado (teste de vazamento).
- [ ] Tela só de leitura testada em produção.
