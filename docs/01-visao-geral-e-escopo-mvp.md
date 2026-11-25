# Hub Financeiro Gastrocenter — Visão Geral e Escopo do MVP

> Documento consolidado a partir de:
> - `transcri_o_da_reuni_o_projeto_gastrocenter.md` (reunião de alinhamento)
> - `Hub Financeiro Gastrocenter ProDoctor + Omie.pdf` (deck de 10 páginas — "Proposta para validação")
>
> Status: **rascunho para validação**. As decisões marcadas como abertas precisam do aval do grupo antes do desenho das telas.
>
> **Correção de premissa (17/11/2026):** a Gastrocenter usa **exclusivamente o ProDoctor + planilhas**. O **Omie ainda não é usado** — será **adotado como parte do projeto** como registro financeiro/contábil. A proposta é um **sistema central** que une ProDoctor e Omie num só lugar e simplifica os processos.

---

## 1. Sumário executivo

A Gastrocenter opera hoje com **duas coisas apenas: o ProDoctor e planilhas**.

- O **ProDoctor** registra o que acontece na clínica: atendimentos, procedimentos, insumos, convênios e faturamento.
- As **planilhas** fazem o que o ProDoctor não faz: rateio entre unidades, controle de folha, coparticipação de plano de saúde, conciliação de despesas e consolidação para o DRE.
- O **Omie** **não é usado hoje**. Ele entra no projeto como o registro financeiro/contábil oficial a ser adotado — e o Hub é a camada que o integra ao ProDoctor.

A proposta é construir **um grande sistema central — o Hub Financeiro** — que **une os dados do ProDoctor e do Omie num só lugar**, aplica as regras da clínica e **simplifica os processos**: acaba com o retrabalho de planilha, o lançamento manual e a consolidação feita à mão.

**Princípio de arquitetura:** a inteligência e a operação ficam no Hub. ProDoctor e Omie continuam existindo como fontes de dados — o Hub é a camada que os une.

> **Implicação importante:** como o Omie ainda não está em uso, o MVP **não pode depender** de o Omie já estar vivo. A Fase 1 precisa entregar valor só com ProDoctor + Hub (e substituir as planilhas), com o Omie entrando como integração progressiva.

---

## 2. Fontes, nomenclatura e correções

| Termo na reunião | Termo correto | Observação |
|---|---|---|
| "Homer" / "banco da Homer" | **Omie** | Sistema de contas a pagar/receber, conciliação e contabilidade. A transcrição capturou "Omie" como "Homer". **Ainda não é usado pela clínica** — será adotado no projeto. |
| "Control Hub" | **Hub Financeiro** | Mesmo produto. O deck consolida o nome como Hub Financeiro. |
| "unidade A / unidade B" (deck) | **Sabin** e **Stella Central** | As duas unidades da clínica. Nomes confirmados por Yuri em 21/11/2026; a transcrição da reunião mantém "Save"/"Estrela Central" por ser fonte bruta. |

> Ação: confirmar a razão social/CNPJ de cada unidade (os nomes já foram confirmados em 21/11/2026).

---

## 3. Problema a resolver

| Dor | Como é hoje | Impacto |
|---|---|---|
| **Tudo depende de planilha** | Rateio, folha, coparticipação, conciliação de despesas e DRE são controlados em planilhas paralelas ao ProDoctor | Trabalho manual, versões desencontradas, erro humano |
| **Lançamento manual** | Faturamento, repasses médicos e insumos precisam ser consolidados fora do ProDoctor | Erro, retrabalho e atraso |
| **Rateio difícil** | Despesas compartilhadas (ex.: plano de saúde dos funcionários) rateadas em planilha pela Raíssa | Custo não reflete a realidade por unidade |
| **DRE que não serve** | O ProDoctor não produz DRE de gestão; hoje ele é montado à mão a partir das planilhas | Decisão de gestão sem base confiável |
| **Conciliação e folha** | Folha vem da contabilidade em PDF/impresso; composição (salário, hora extra, insalubridade, coparticipação, FGTS, INSS) tratada fora do sistema | Contas a pagar bruto × valor líquido pago no banco não fecha |
| **Acerto entre unidades** | Levantamento manual do que é de cada unidade e transferência entre contas | Fechamento mensal lento e frágil |
| **ProDoctor imaturo em financeiro** | Contas a pagar só passou a ser usado em outubro; previsões até março | Não dá para depender dele como fonte financeira completa |
| **Nenhum sistema financeiro oficial** | O Omie ainda não é usado; não existe contas a pagar/receber confiável hoje | Sem fonte única de verdade financeira |

---

## 4. Papéis dos sistemas

| Camada | Sistema | Responsabilidade | Situação |
|---|---|---|---|
| **Fonte operacional** | ProDoctor | Atendimentos, procedimentos, insumos, convênios, faturamento | Em uso |
| **Planilhas** | Excel/Sheets | Rateio, folha, coparticipação, consolidação do DRE | Em uso — **a serem substituídas** |
| **Sistema central** | **Hub Financeiro** (novo) | Recebe os dados, consolida, aplica as regras, controla alçadas, gera o DRE próprio e **substitui as planilhas** | A construir |
| **Registro financeiro/contábil** | Omie | Contas a pagar e a receber, conciliação bancária, contabilidade | **A adotar no projeto** |

---

## 5. Atores e permissões

| Ator | Papel | Observações |
|---|---|---|
| **Raíssa** | Prepara/aprova pagamentos; faz rateio manual hoje | Acesso ao financeiro; a confirmar se opera o Omie |
| **Sabrina** | Financeiro/administrativo; **efetua o pagamento** | Principal usuária-chave do Hub |
| **Marcela** | Orienta o projeto, especialmente as funções contabeis do Omie | Referência de desenho de alçada |
| **Técnicas de enfermagem** | Lançam NFs de material/medicamento e material de escritório no ProDoctor | Vão lançar despesas pelo Hub |
| **Médicos** | Não operam o sistema; têm **regra de repasse** cadastrada | PJ do médico recebe o repasse |

**Princípio de segregação de funções:** quem **aprova** não é necessariamente quem **paga**.
- Modelo A: Raíssa aprova → Sabrina paga.
- Modelo B: Sabrina aprova e paga.
- Modelo Viva (referência): várias pessoas movem cards para "aprovado"; apenas uma pessoa efetua o pagamento.
- Dá para ter *n* combinações por tipo de despesa/valor.

> Regra herdada: cadastro de usuários e permissões deve ser feito **pelo próprio cliente**, com orientação — não terceirizado ao desenvolvedor.

---

## 6. Fluxos funcionais

### F1 — Receita (faturamento → contas a receber)
- **Fonte:** ProDoctor (consultas e procedimentos, particular e convênio).
- **Ação do Hub:** registra o recebível no próprio Hub, com **centro de custo (médico + unidade)**; conforme D11, espelha no Omie.
- **Regra:** um atendimento pertence a um CNPJ/unidade (ver decisão D3 — dois CNPJs).
- **Exceções:** atendimento sem correspondência no Omie → pendência no painel de conferência.

### F2 — Repasse médico (conta a pagar automática)
- **Regra cadastrada no Hub por médico:** percentual **ou** valor fixo.
- **Fluxo (exemplo Unimed R$ 500):**
  1. ProDoctor registra o procedimento da Unimed.
  2. Hub registra o recebível da Unimed — R$ 500.
  3. Hub aplica a regra do médico e gera a conta a pagar para a PJ dele — R$ __.
  4. Os dois ficam **vinculados**. Se a Unimed **glosar**, o painel avisa para ajustar o repasse.
- **Decisões abertas:** D1 (quando pagar), D2 (base do repasse), D7 (margem por médico).

### F3 — Insumos
- **Fonte:** materiais/seringas lançados pelas funcionárias no ProDoctor.
- **Ação do Hub:** gera despesa **ligada ao procedimento**.
- **Decisão aberta:** D4 — despesa direta ou controle de estoque.

### F4 — Despesas gerais com rateio (lançador no painel)
- **Escopo:** aluguel, contas de consumo, fornecedores, despesas gerais.
- **Ação:** o usuário lança no painel e **rateia em poucos cliques** entre centros de custo; o painel registra as N parcelas do rateio (e, conforme D11, espelha no Omie já dividido).
- **Exemplo do deck:** plano de saúde R$ 10.000 → 60%/40% por número de funcionários → R$ 6.000 (Sabin) + R$ 4.000 (Stella Central), dois lançamentos.
- **Critérios de rateio necessários:** por número de funcionários, percentual fixo, valor fixo, por receita, manual.
- **Decisão aberta:** D5 — lançar direto ou aprovar no painel antes.

### F5 — Folha de pagamento e encargos *(da reunião, não está no deck)*
- **Fonte:** contabilidade, em **PDF** e impresso.
- **Ação:** Hub **importa o PDF** e gera lançamentos **individualizados**, com composição por categoria (salário, hora extra, insalubridade, assiduidade, coparticipação, FGTS, INSS).
- **Restrição de privacidade:** o contas a pagar **não pode expor "Fulano recebeu R$ X.000"** — só um número reduzido de pessoas manipula o sistema. Precisa de agregação por natureza (ex.: "INSS" como um bloco) e/ou controle de acesso.
- **Problema do bruto × líquido:** lança-se R$ 10.000 de despesa, mas paga-se R$ 8.500 no banco. O Hub precisa representar **valor bruto + descontos/encargos**, fechando no valor efetivamente pago.
- **Regime:** salário é tratado por **competência**, não pelo valor pago no mês.

### F6 — Plano de saúde, coparticipação e rateio de benefícios
- Unimed envia mensalmente o valor por funcionário + dependentes.
- Coparticipação é **descontada na folha** do funcionário.
- Rateio entre unidades (ex.: 50/50, 40/60) proporcional ao número de funcionários.
- O boleto tem parte da empresa e parte do colaborador — precisam ser lançamentos distintos.

### F7 — Monitoramento e conferência da integração
- **Conferência:** compara ProDoctor × Omie × Hub — o que foi recebido, o que falhou, o que ficou divergente.
- **Pendências:** atendimento sem lançamento · insumo sem procedimento · repasse sem regra cadastrada.
- **Visões:** faturamento por médico · repasses a pagar · resultado por centro de custo.

---

## 7. DRE próprio

O DRE no modelo do grupo, não no do sistema.

| Requisito | Descrição |
|---|---|
| **Estrutura própria** | As linhas do DRE são definidas pelo grupo |
| **De-para** | Cada categoria do Omie e do ProDoctor ligada a uma linha do DRE |
| **Rateio** | O DRE fecha certo por unidade e por médico |
| **Visões** | Consolidado · por CNPJ · por unidade · por médico |
| **Regime** | O mesmo DRE em **competência** ou **caixa** |
| **Sem buraco** | Lançamento sem linha vinculada aparece como **alerta** |
| **Drill-down** | Clicar na linha e ver os lançamentos que a compõem |

**Uso na gestão (exemplos da reunião):** "quanto gastamos de plano de saúde?", "quanto de vale alimentação?" — com a composição correta (parte empresa × parte funcionário), para decisão do Ronaldo/gestão.

---

## 8. Regras de negócio catalogadas

| ID | Regra | Fonte |
|---|---|---|
| RN-01 | Toda receita do ProDoctor deve gerar recebível no Hub com centro de custo (médico + unidade) — e no Omie conforme D11 | Deck |
| RN-02 | Todo procedimento gera repasse à PJ do médico conforme regra cadastrada (% ou fixo) | Deck |
| RN-03 | Recebível e repasse ficam vinculados; glosa gera alerta para ajuste | Deck |
| RN-04 | Despesa rateada é registrada **já dividida** em N lançamentos por centro de custo (e espelhada no Omie conforme D11) | Deck |
| RN-05 | Lançamento sem linha de DRE vinculada gera alerta (nada fica fora do DRE) | Deck |
| RN-06 | Aprovação e pagamento são permissões separáveis por usuário e por tipo de despesa | Reunião |
| RN-07 | Só usuários com permissão de pagamento efetuam pagamento no Omie | Reunião |
| RN-08 | Rateio de benefícios (plano de saúde) proporcional ao número de funcionários por unidade | Reunião |
| RN-09 | Coparticipação de plano é lançamento distinto da parte da empresa | Reunião |
| RN-10 | Folha é tratada por **competência** | Reunião |
| RN-11 | Contas a pagar de folha não expõe salário individual a todos os usuários | Reunião |
| RN-12 | Acerto mensal entre unidades por centro de custo (conta corrente intercompany) | Reunião |
| RN-13 | Despesas compartilhadas podem ser lançadas no Hub e replicadas no ProDoctor/Omie para registro duplo | Reunião |

---

## 9. Decisões em aberto

> As recomendações abaixo são propostas técnicas para acelerar a reunião de validação — **não são decisões tomadas**.

| ID | Decisão | Opções | Recomendação inicial | Dono |
|---|---|---|---|---|
| **D1** | Quando pagar o médico | (a) na data do procedimento · (b) após o convênio pagar | (b) — preserva o caixa e evita repasse sobre recebível glosado | Gestão |
| **D2** | Base do repasse | bruto ou líquido (impostos, taxa de cartão, glosa) | Líquido, com a composição visível no Hub | Gestão + contabilidade |
| **D3** | Dois CNPJs | qual CNPJ fatura cada atendimento e de qual sai o repasse | Regra por unidade do atendimento, com exceções cadastráveis | Gestão + contabilidade |
| **D4** | Insumos | despesa direta ou controle de estoque | Fase 1: despesa direta vinculada ao procedimento (estoque é escopo futuro) | Sabrina |
| **D5** | Aprovação | lançar direto ou aprovar no painel antes | Aprovar no painel (alçadas), com opção de autoaprovação por valor/tipo | Gestão |
| **D6** | Estrutura e regime do DRE | quais linhas e visão principal (competência × caixa) | Competência como principal, caixa como visão secundária | Gestão |
| **D7** | Margem por médico | só receita, repasse e insumos, ou com rateio de fixos | Fase 1 sem rateio de fixos; fase 2 com critério definido | Gestão |
| **D8** | Segregação aprovação × pagamento | Raíssa aprova/Sabrina paga, ou acumulado | Raíssa aprova · Sabrina paga (mantém o desenho atual) | Gestão |
| **D9** | Visibilidade da folha | salário individual × agregação por natureza | Agregado por natureza para a maioria; detalhe só para perfil restrito | Sabrina |
| **D10** | Fonte da verdade em divergência | ProDoctor × Omie × Hub | Hub como árbitro; ProDoctor manda em operação, Omie em registro fiscal | Yuri |
| **D11** | **Direção da integração com o Omie** | (a) somente leitura — Hub consome os dados · (b) leitura + escrita — Hub também lança no Omie | (a) na Fase 1; escrita só se a contabilidade exigir | Gestão + contabilidade |
| **D12** | **Quem opera o Omie hoje** | (a) contabilidade · (b) ninguém, é projeto futuro · (c) financeiro da clínica | Confirmar antes de assumir qualquer acoplamento | Sabrina |

---

## 10. Escopo proposto do MVP

### Fase 0 — Validação e acessos (1–2 semanas)
- Fechar as decisões D1–D12.
- Confirmar o papel real do Omie (D12) e obter credenciais/API; validar o que existe de API no ProDoctor.
- Coletar amostras reais: extrato de faturamento, PDF de folha, **todas as planilhas em uso**, categorias do Omie.
- Definir as linhas do DRE e o de-para inicial.

### Fase 1 — MVP "ponta a ponta" (o menor fluxo que prova valor)
1. **Integração de leitura com o ProDoctor** (faturamento + procedimentos; insumos se houver API).
2. **Consolidação de receita no Hub** com centro de custo (médico + unidade) — e espelho no Omie conforme D11. *(F1)*
3. **Regra de repasse médico** cadastrável + geração automática da conta a pagar vinculada + alerta de glosa. *(F2)*
4. **Painel de conferência** ProDoctor × Omie × Hub com pendências. *(F7)*
5. **Lançador de despesa com rateio**, substituindo a planilha de rateio. *(F4)*
6. **Autenticação e alçadas** (quem lança, quem aprova, quem paga). *(RN-06/07)*

**Fora da Fase 1:** estoque de insumos, importação de folha, DRE completo, dashboards analíticos avançados.

### Fase 2 — Fechamento financeiro
- Importação de **folha em PDF** com lançamentos individualizados e composição bruta × líquida. *(F5)*
- **Plano de saúde / coparticipação** com rateio automático. *(F6)*
- **Acerto mensal intercompany** entre Sabin e Stella Central. *(RN-12)*
- **DRE próprio** com de-para, visões, competência/caixa, drill-down. *(§7)*

### Fase 3 — Gestão e inteligência
- Dashboards de gestão (plano de saúde, vale alimentação, margem por médico, resultado por unidade).
- Alertas e automações (divergência, glosa, despesa sem linha).
- Evolução para controle de estoque de insumos.

---

## 11. Requisitos não funcionais e princípios

- **Velocidade de ciclo:** fazer rápido, consertar rápido, testar rápido. O gargalo é validação de usuário, não programação.
- **Usuários reais testando desde o dia 1** — o sistema parado no laboratório não prova nada.
- **Cliente opera o próprio cadastro** (usuários, regras, de-para), não o desenvolvedor.
- **Rastreabilidade:** todo lançamento deve apontar para a origem (atendimento/procedimento/despesa) e vice-versa.
- **Idempotência:** reprocessar a integração não pode duplicar lançamento.
- **Auditoria:** quem lançou, quem aprovou, quem pagou, quando.
- **Segurança de dados sensíveis:** folha e salários com acesso restrito e agregação.
- **Substituir planilha, não empilhar:** cada planilha em uso deve ter um destino claro no Hub; se não tiver, não entra no escopo.
- **Capacidade:** duas unidades, ~dezenas de usuários, volume baixo/médio — não é um problema de escala.

---

## 12. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| ProDoctor não ter API utilizável | Alto — quebra a premissa de leitura automática | Validar cedo (Fase 0); plano B: exportação/importação de arquivo |
| Omie ser inacessível para integração (API, contrato ou contabilidade) | Alto | Confirmar D12 na Fase 0; se não houver acesso, redesenhar o Hub para ser a fonte primária |
| Hub tentar fazer papel de ERP e "engolir" escopo | Alto | Delimitar: o Hub consolida e controla; não vira sistema de estoque, RH e fiscal |
| Regra de repasse médico variar demais | Médio | Motor de regras com % / valor fixo / faixas + exceções |
| Glosa de convênio chegar tarde | Médio | Repasse provisionado com ajuste posterior, não pagamento imediato |
| DRE virar projeto infinito | Alto | Começar com poucas linhas acordadas e evoluir |
| Resistência a abandonar planilhas | Médio | Migração gradual; a planilha vira fonte de validação do Hub |
| Dados de folha expostos | Alto (jurídico/RH) | Perfis restritos, agregação, log de acesso |

---

## 13. Perguntas para a Gastrocenter

**Financeiro**
5. Lista oficial de unidades e CNPJs, e qual CNPJ fatura o quê.
6. **Quais planilhas existem hoje** e quem é dono de cada uma (o mapa de substituição).
7. Planilha de rateio atual da Raíssa (para extrair os critérios reais).
8. PDF de folha da contabilidade (modelo real, mesmo que anonimizado).
9. Tabela de convênios e regras de glosa.
10. Cadastro dos médicos: PJ, percentual/fixo, o que entra na base.
11. Categorias/plano de contas usado hoje e o DRE que o grupo usa.
12. Exemplos reais de extrato/conciliação bancária.

---

## 14. Glossário

| Termo | Significado |
|---|---|
| **Hub Financeiro** | Sistema novo e central: consolida dados, aplica regras, controla alçadas, gera o DRE |
| **Omie** | Fonte de dados financeiros/contábeis (contas a pagar/receber, conciliação, contabilidade) — não é operado pela clínica |
| **ProDoctor** | Fonte operacional: gestão clínica (atendimento, procedimentos, insumos) |
| **Repasse** | Valor pago ao médico pela produção (regra % ou fixo) |
| **Glosa** | Recusa/redução de pagamento por parte do convênio |
| **Rateio** | Divisão de uma despesa entre centros de custo/unidades |
| **Centro de custo** | Unidade de acumulação de custo (unidade, médico, departamento) |
| **DRE** | Demonstrativo de resultado (receitas − custos − despesas) |
| **Competência** | Regime em que a despesa é reconhecida no mês do fato gerador |
| **Caixa** | Regime em que a despesa é reconhecida no mês do pagamento |
| **Coparticipação** | Parte do plano de saúde descontada do funcionário |
| **Intercompany** | Acerto financeiro entre as empresas/unidades do mesmo grupo |
| **Alçada** | Limite de permissão para lançar/aprovar/pagar |
