---
status: accepted
---
# Banco acessado só pelo servidor, com payload bruto preservado

O Hub guarda dados de pacientes e folha. O navegador nunca fala direto com o banco: todo acesso passa pelo servidor Next.js, o RLS do Supabase fica ligado como segunda camada, e as tabelas de payload bruto do ProDoctor só o servidor lê. Folha e salário individual ficam atrás de perfil restrito, e o log de auditoria só aceita inserção (append-only). Toda resposta de API é guardada bruta antes de normalizar, para reprocessar sem voltar à API quando uma regra mudar.

## Considered Options

- Usar o cliente Supabase direto no navegador com RLS como única proteção: descartado porque um erro numa policy expõe dados sensíveis, e o domínio exige regras que não cabem em policies.
