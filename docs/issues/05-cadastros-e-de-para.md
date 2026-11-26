# 05 — Cadastros e de-para

**Tipo:** AFK · **Depende de:** 04

## Escopo
- Modelo canônico: `Unidade`, `Profissional` (com marcação de médico), `Convênio`, e o `de_para` por (empresa, tipo, código de origem).
- Tela para ver e corrigir o de-para ProDoctor → Hub (o cliente opera o próprio cadastro).
- Item sem de-para vira pendência.

## Critérios de aceite
- [x] Os cadastros sincronizados aparecem na tela (`/cadastros`) com o código de origem.
- [x] Revisar um cadastro fica registrado na auditoria (`cadastro_revisado`, com o usuário). Criação, alteração, sumiço e volta também.
- [x] Profissional ou convênio novo no ProDoctor fica "a revisar" até alguém confirmar (profissional: dizer se é médico).

## Estado (26/11/2026)
Feito: leitura dos cadastros (S1), reconciliação pura com proteção contra cadastro vazio (S2), banco com de-para tipado e aplicação atômica e idempotente (S3, testes SQL com rollback), normalização ligada à fila (D-M) e a tela `/cadastros` (S4). Primeira carga real: 1 unidade, 50 profissionais e 128 convênios, todos a revisar.

Descoberta: as exportações referenciam profissional e convênio **pelo nome**, não pelo código (só a unidade vem com código). Hoje 100% dos nomes batem com os cadastros, sem homônimos. O casamento por nome entra na issue 06 (D-I).

Falta: verificação manual da tela em produção (S4).
