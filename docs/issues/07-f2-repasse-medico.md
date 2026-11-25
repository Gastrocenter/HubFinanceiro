# 07 — F2: repasse médico

**Tipo:** AFK · **Depende de:** 06 · **Premissas a confirmar:** D1 e D2

## Contexto
RN-02, RN-03, L10. Assume as recomendações dos docs: pagar após o convênio pagar (D1=b) e consumir o cálculo do ProDoctor, líquido (D2). Se a gestão decidir outro caminho, só esta issue muda.

## Escopo
- Consumir bruto, imposto e líquido de `Exportacoes/Repasses`.
- Gerar a conta a pagar do repasse vinculada ao recebível.
- Repasse provisionado, ajustado quando chegar glosa.
- Alerta de glosa (pendência).

## Critérios de aceite
- [ ] Repasse e recebível ficam vinculados nos dois sentidos (rastreabilidade).
- [ ] Glosa posterior reabre o repasse e gera pendência.
- [ ] O valor do repasse de um médico conhecido bate com o ProDoctor.
