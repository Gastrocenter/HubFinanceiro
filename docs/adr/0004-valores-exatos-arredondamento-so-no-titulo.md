---
status: accepted
---
# Valores do ProDoctor guardados exatos; arredondamento só ao gerar o título

O ProDoctor envia valores como texto com vírgula decimal, sem separador de milhar e com até 14 casas decimais (por exemplo, `baseCalculoLiquido`). Converter para centavos na leitura faria somatórios divergirem do ProDoctor. Por isso o Hub guarda o valor exato (texto decimal normalizado no domínio, `numeric` no Postgres) e só arredonda para centavos ao gerar um título a pagar ou receber, sempre com a regra "meio para cima" (`0,005` → `0,01`), definida num único lugar. Texto vazio vira "não informado" (`null`), nunca zero.

## Considered Options

- Converter para centavos (inteiro) na leitura: descartado porque perde precisão antes de qualquer conta.
- Usar `number` do JavaScript: descartado porque ponto flutuante erra em somas de dinheiro.
