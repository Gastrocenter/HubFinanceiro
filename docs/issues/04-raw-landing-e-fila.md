# 04 — Raw landing e fila de jobs

**Tipo:** AFK · **Depende de:** 02, 03

## Contexto
Guardar o payload bruto antes de normalizar e sincronizar em lotes (limite de tempo da Vercel + 120 req/min).

## Escopo
- Tabela de payload bruto (fechada ao cliente) com origem, empresa, parâmetros e data.
- Fila em Postgres; Vercel Schedules (substituto do Cron) processa lotes a cada 15 min e retoma de onde parou.
- Primeiro caso de ponta a ponta: sincronizar Locais, Usuários e Convênios.
- Registro de execução (início, fim, falhas) para o painel F7.

## Critérios de aceite
- [x] Rodar o sync duas vezes não duplica nada: enfileirar é idempotente por dia e (job, página) é único. Cada execução guarda uma cópia nova, de propósito (D-F).
- [x] Um job interrompido retoma sem reiniciar (posse com prazo no banco; página salva antes de avançar).
- [x] Falha de uma chamada fica registrada (`ultimo_erro`, `tentativas`), sem derrubar o lote. Passageira volta à fila até 5 vezes.

## Estado (25/11/2026)
Feito e testado: executor de job (S1), fila no Postgres com `SKIP LOCKED` testada com 8 rodadas paralelas (S2), isolamento do navegador nas tabelas e funções novas (S3), e sincronização real de Locais, Usuários e Convênios (S4: 1, 50 e 128 registros).

**Fechada em 25/11/2026.** Agendamentos ativos em produção; disparados uma vez pela CLI: jobs 16–18 concluídos (1 unidade, 50 usuários, 128 convênios), sem retentativa.
