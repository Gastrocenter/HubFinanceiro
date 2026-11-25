---
status: accepted
---
# Omie só entra depois que o Hub estiver validado com dados do ProDoctor

A clínica ainda não usa o Omie. A Fase 1 entrega valor só com ProDoctor + Hub, e o Hub é a fonte primária das regras. O conector do Omie (leitura e escrita, com escrita atrás de feature flag) só é integrado depois que o Hub estiver montado e conferido com dados reais. O ProDoctor manda na operação, o Hub manda nas regras, e toda divergência vira pendência para decisão humana: o Hub nunca sobrescreve o dado original. O conector do ProDoctor suporta várias empresas desde o início, cada uma com a própria chave guardada como segredo da Vercel.

## Consequences

- O modelo canônico não pode depender de conceitos do Omie.
- Cada CNPJ vira um app Omie separado quando a integração chegar.
