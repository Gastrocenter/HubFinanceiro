# 06 — F1: receita consolidada

**Tipo:** AFK · **Depende de:** 05 · **Risco:** alto (volume, idempotência, exclusões)

## Contexto
Fluxo F1, RN-01, lacunas L2 e L3. Recomendado um `prototype` descartável do cálculo de receita por médico antes de começar.

## Escopo
- Sync de procedimentos: carga inicial de 12 meses + re-sync diário do mês atual e dos 2 anteriores (D-P). Faturas ficam para a conciliação (issue 08).
- Recebível com centro de custo médico + unidade.
- Idempotência por chave natural (empresa, unidade, conta, linha), sem a fatura (D-N).
- Detecção de registro excluído por comparação de snapshots (vira pendência).
- Tela de receita por unidade e médico.

## Critérios de aceite
- [x] Reprocessar o mesmo mês não duplica recebíveis (teste SQL S5 e carga real S6).
- [x] Registro que sumiu do ProDoctor vira pendência `procedimento_sumiu` (S3 e S5).
- [x] Totais do mês batem com o bruto por um caminho independente (SQL sobre o JSON): out/2026, 2.667 linhas, R$ 566.865,90. Faturas ficam para a issue 08 (contam por outra data).

## Estado (26/11/2026)
Feito: parser sem dados de paciente (S1, com mutação provando o teste), casamento por nome (S2), diferença do mês com proteção contra mês vazio (S3), planejamento dos meses (S4), banco com recebíveis e pendências (S5), carga real de out/2026 conferida (S6), tela `/receita` (S7) e expurgo LGPD de 120 dias (S8, ADR-0005).

Bugs pegos no caminho: leitura cortada em 1.000 linhas pelo PostgREST (corrigido com `lerTudo`) e perda de precisão ao ler `numeric` como número JSON (corrigido lendo como texto).

Carga inicial em produção (26/11/2026): 12 meses, dez/2025 a nov/2026, 32.185 recebíveis, todos conferidos em linhas e em reais contra o bruto, todos vinculados a médico, convênio e unidade, sem pendências.

Correção feita durante a carga: a normalização passou a rodar antes de o job ser marcado como concluído (`aoConcluir`). No código antigo havia uma janela em que o job aparecia "concluído" sem receita ainda.

Falta: verificação da tela `/receita` por você.
