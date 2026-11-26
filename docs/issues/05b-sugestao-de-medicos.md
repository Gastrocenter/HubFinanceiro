# 05b — Sugestão de médicos na revisão de cadastros

**Tipo:** AFK + verificação manual · **Depende de:** 05, 06 · **Vem antes de:** 07

## Contexto
Os 50 profissionais do ProDoctor chegam "a revisar", e o ProDoctor não diz quem é médico. A análise dos dados mostrou sinais fortes: a **especialidade** registrada nos procedimentos ("Médico endoscopista", "Nutricionista em geral") e o **volume** de procedimentos (14 profissionais não fizeram nenhum em 12 meses). Também mostrou que receber repasse não define médico: a nutricionista recebe.

## Escopo
- Guardar a especialidade do profissional em cada recebível (não é dado de paciente).
- `sugerirMarcacao`: especialidade médica → médico; especialidade não médica ou nenhum procedimento → não médico; misturado ou sem especialidade → revisar.
- Tela `/cadastros` mostra sinais, sugestão e motivo; "Aceitar sugestões" aplica de uma vez, com confirmação, auditando cada marcação.
- Glossário: "Médico" e "Repasse" corrigidos (repasse vai ao profissional, médico ou não).

## Critérios de aceite
- [x] Sugestão testada nos casos médico, não médico, sem procedimentos e duvidoso.
- [x] Especialidade preenchida nos 32.185 recebíveis existentes (reprocessamento da carga, sem linha nova nem sumida).
- [x] Sugestão para os 50 profissionais: 35 médicos, 15 não médicos.
- [x] Sugestões conferidas e aceitas em produção: 50 profissionais revisados (35 médicos, 15 não médicos), auditados.

**Fechada em 26/11/2026.**
