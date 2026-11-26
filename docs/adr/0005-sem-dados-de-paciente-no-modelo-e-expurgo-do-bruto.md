---
status: accepted
---
# Nenhum dado de paciente no modelo do Hub; payload bruto de exportação apagado após 120 dias

As exportações do ProDoctor trazem dados de paciente (nome, prontuário, matrícula do plano, guia). O Hub não precisa deles para receita, repasse ou DRE, e guardá-los aumenta o risco e a obrigação sob a LGPD. Por isso o modelo do Hub não guarda nenhum identificador de paciente: o rastreio é por (empresa, unidade, conta, linha), e o vínculo com o paciente continua só no ProDoctor. O payload bruto, que é guardado como veio (ADR-0002), tem as páginas de exportação apagadas 120 dias depois de recebidas (janela de re-sync de 90 dias mais folga). Páginas de cadastro não são apagadas.

## Consequences

- Reprocessar uma regra só é possível dentro dos últimos 120 dias; antes disso, só o modelo do Hub existe.
- Qualquer tela ou relatório que precise do nome do paciente tem que buscar no ProDoctor, não no Hub.
