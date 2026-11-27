# 11 — Contas a pagar e a receber: páginas separadas, categorias e filtros

Status: ready-for-agent

**Tipo:** AFK + verificação manual · **Depende de:** 08b · **Origem:** sessão de perguntas com o usuário em 26/11/2026

## Problema
A tela `/contas` mistura contas a pagar e a receber, só filtra por mês de vencimento e agrupa pelos grupos do ProDoctor. Esses grupos não respondem às perguntas da clínica ("quanto foi de imposto?", "quanto de repasse médico já foi pago?"): "Despesas Variáveis" mistura taxa de cartão com PIS/COFINS e ISSQN, "Custos Variáveis" mistura insumos com repasse médico e repasse TNI, e o IPTU fica em "Tributárias e Taxas".

## Fatos levantados (26/11/2026, só códigos, nomes de grupos e contagens)
- Código do plano: `raiz.natureza.grupo.item`, por exemplo `1.02.008.0005`. Raiz `1` = Stella Central, `2` = Albert Sabin, `3` = TNI, `0` = Abertura / Fechamento de Caixa. Natureza `01` = receitas, `02` = despesas/custos.
- Cada item se repete por raiz com o sufixo da unidade, por exemplo "Taxa de Cartão sobre a Venda (STELLA)", "(SABIN)" e "(TNI)".
- **Toda conta está no local ProDoctor Stella Central**, inclusive as da Sabin. A unidade só aparece na raiz do código do plano. Contagens: raiz 1 = 12.581, raiz 2 = 641, raiz 3 = 413, raiz 0 = 24.
- Há 23 contas lançadas direto num grupo, sem item (`1.01.001`).
- "Receitas Transição de Sistema (STELLA)" tem 6.013 contas a receber.
- Algumas contas a receber caem em item de despesa (por exemplo, reembolso de INSS).
- `data_inclusao` (entrada), `data_vencimento` e `data_efetivacao` já estão gravadas em `contas_pagar_receber`.

## Decisões (26/11/2026)
- **D-1 (páginas):** `/contas/pagar` e `/contas/receber`, com o mesmo formato. `/contas` redireciona para `/contas/pagar`. Natureza pela situação, como hoje (`PAGAR`/`PAGA` x `RECEBER`/`RECEBIDA`).
- **D-2 (abas):** abas **Stella Central | Albert Sabin | Todas**, com Stella Central aberta por padrão. A aba sai da raiz do código do plano: `1` e `3` (a TNI aparece em Stella Central) → Stella Central; `2` → Albert Sabin; `0` → só em "Todas". A aba substitui o filtro de unidade.
- **D-3 (categorias do Hub):** categoria própria, ligada ao **item sem o sufixo da unidade**, de modo que o mesmo item das três raízes cai na mesma categoria. Listas separadas para pagar e para receber.
  - A pagar: Imposto (PIS/COFINS/CSLL/IRPJ, retidos na fonte, ISSQN, IPTU), Taxa de cartão, Despesa bancária (tarifas, anuidade de cartão), Pessoal (salários, férias, 13º, FGTS, INSS, rescisão, insalubridade, assiduidade, prêmios, estagiários, vale-transporte, alimentação, assistência médica e odontológica, saúde ocupacional), Repasse de honorário médico, Repasse TNI, Insumos (custo de materiais e medicamentos, MAT/MED da TNI; é o que o usuário chama de "repasse de insumos"), Manutenção e exames (manutenção corretiva, esterilização), Administrativo (software, internet, energia, água, aluguel, condomínio, materiais, lanches, correios, motoboy, contador, consultores, sindicatos, seguros, processos), Marketing, Investimento, Retirada, Transferência.
  - A receber: Endoscopia, Colonoscopia (inclui CO2 e kit), Consultas, Testes respiratórios, Manometria (esofágica e anorretal), pH-metria, Exames diversos, TNI (Tirzepatida, intramusculares, endovenosos), Aluguel de sala, Outras receitas não operacionais, Transição de sistema.
  - Uma conta a receber que cai em item de despesa aparece em "a receber" com a categoria da despesa.
- **D-4 (manutenção):** tela **Cadastros → Categorias**, editável só por admin e financeiro, com auditoria. A ligação inicial vem pronta (D-3), numa migration de dados.
- **D-5 (item sem categoria):** a conta aparece como "Sem categoria" e o item gera uma pendência "a revisar" no painel de conferência. Nada some da lista.
- **D-6 (filtros):** botão **Filtros** que abre um painel lateral, com o número de filtros ligados ("Filtros · 3"). Os filtros ficam no endereço da página.
  - Período de / até, com atalhos: hoje, ontem, esta semana, este mês, mês passado. O padrão é este mês.
  - Data do período: vencimento (padrão), entrada ou pagamento/recebimento.
  - Situação: Em aberto, Paga/Recebida e Vencida (em aberto com vencimento antes de hoje, no fuso de São Paulo).
  - Categoria, com várias de uma vez.
  - Fornecedor/cliente.
- **D-7 (um filtro só):** o filtro de categoria e o de situação são o mesmo no painel, no cabeçalho da coluna da tabela e no menu de categorias. Mudar em um lugar muda nos outros, porque tudo lê o mesmo estado no endereço.
- **D-8 (menu de categorias):** um bloco com dois níveis, categoria → item do ProDoctor (sem sufixo), cada um com quantidade, total em aberto e total pago/recebido dentro dos filtros e da aba. Clicar filtra a lista.
- **D-9 (tabela):** colunas Entrada, Vencimento, Pagamento/Recebimento, Nº, Fornecedor/Cliente, Categoria, Item, Valor, Situação. Ordenada por vencimento, e clicar no título de uma coluna muda a ordem. Paciente continua aparecendo só como "Paciente" (ADR-0005).
- **D-10 (totais):** cartões Em aberto, Vencido e Pago/Recebido, somados no banco em numeric exato (ADR-0004) sobre os mesmos filtros e a mesma aba.
- **D-11 (permissão):** `ver_contas` nas duas páginas. Editar categorias segue a permissão de cadastros, só para admin e financeiro.
- **Fora do escopo:** exportar para Excel, período antes de dez/2025 (a sync lê 12 meses por data de inclusão) e editar conta pelo Hub.

## Seams de teste (propostos)
- S1 (puro): `unidadeDoPlano(codigo)` → `stella | sabin | caixa`, e `itemSemUnidade(nome)` (tira o sufixo "(STELLA)", "(SABIN)", "(TNI)").
- S2 (puro): leitura e validação dos filtros do endereço (período, tipo de data, situação, categorias, aba), com padrões e valores inválidos caindo no padrão. Atalhos de período no fuso de São Paulo.
- S3 (SQL): tabela `categorias` e ligação `categoria_do_item` (natureza + item sem sufixo → categoria), com RLS e sem policy. Migration de dados com a ligação inicial. Teste SQL com TESTE_OK: os itens do plano gravado têm categoria, exceto os deixados de propósito.
- S4 (SQL): funções `listar_contas`, `totais_contas_filtradas` e `resumo_por_categoria`, com os mesmos filtros (aba, período por tipo de data, situação, vencida, categorias, fornecedor), lidas página a página. Teste de que os totais batem com a soma da lista.
- S5 (SQL): pendência "a revisar" para item sem categoria, idempotente.
- S6: tela Cadastros → Categorias, com auditoria e permissão.
- S7: páginas `/contas/pagar` e `/contas/receber`, com as abas, o painel de filtros, o menu de categorias e a tabela. Testadas em produção.

## Critérios de aceite
- [ ] Contas a pagar e a receber em páginas separadas, com as abas Stella Central (com TNI), Albert Sabin e Todas.
- [ ] O filtro por um dia só mostra exatamente as contas daquele dia, por vencimento, entrada ou pagamento.
- [ ] "Imposto" pago em out/2026, na aba Todas, bate com a soma dos itens de imposto conferida em SQL contra a tabela.
- [ ] Item novo sem categoria aparece como "Sem categoria" e gera pendência.
- [ ] Filtro de categoria sincronizado entre painel, cabeçalho da tabela e menu de categorias.
- [ ] Nenhum dado de paciente novo exposto (ADR-0005).
