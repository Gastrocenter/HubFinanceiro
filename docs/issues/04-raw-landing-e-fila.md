# 04 — Raw landing e fila de jobs

**Tipo:** AFK · **Depende de:** 02, 03

## Contexto
Guardar o payload bruto antes de normalizar e sincronizar em lotes (limite de tempo da Vercel + 120 req/min).

## Escopo
- Tabela de payload bruto (fechada ao cliente) com origem, empresa, parâmetros e data.
- Fila em Postgres; Vercel Cron processa lotes pequenos e retoma de onde parou.
- Primeiro caso de ponta a ponta: sincronizar Locais, Usuários e Convênios.
- Registro de execução (início, fim, falhas) para o painel F7.

## Critérios de aceite
- [ ] Rodar o sync duas vezes não duplica nada.
- [ ] Um job interrompido retoma sem reiniciar.
- [ ] Falha de uma chamada fica registrada e visível, sem derrubar o lote.
