# 06 — F1: receita consolidada

**Tipo:** AFK · **Depende de:** 05 · **Risco:** alto (volume, idempotência, exclusões)

## Contexto
Fluxo F1, RN-01, lacunas L2 e L3. Recomendado um `prototype` descartável do cálculo de receita por médico antes de começar.

## Escopo
- Sync de faturas e procedimentos: backfill de 12–24 meses + re-sync diário da janela móvel de 90 dias.
- Recebível com centro de custo médico + unidade.
- Idempotência por chave natural `PD:{local}:{fatura}:{conta}:{linha}`.
- Detecção de registro excluído por comparação de snapshots (vira pendência).
- Tela de receita por unidade e médico.

## Critérios de aceite
- [ ] Reprocessar o mesmo mês não duplica recebíveis.
- [ ] Registro que sumiu do ProDoctor aparece como pendência.
- [ ] Totais do mês batem com `faturas.json` e `procedimentos.json` de referência.
