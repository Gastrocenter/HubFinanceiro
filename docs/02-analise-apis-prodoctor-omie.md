# Hub Financeiro Gastrocenter — Análise das APIs (ProDoctor + Omie)

> **O que este documento é:** análise de viabilidade técnica baseada nas **especificações OpenAPI reais** das duas APIs — não em páginas de marketing.
>
> **Fontes consultadas (17/11/2026):**
> - ProDoctor: `https://open-api.prodoctor.net/swagger/v1/swagger.json` (OpenAPI 3.0.1, **88 caminhos**)
> - Omie: `https://api.omie.com.br/docs/openapi.json` (OpenAPI 3.0.3, **179 caminhos / 554 operações em 172 serviços**)
>
> **Documento irmão:** `docs/01-visao-geral-e-escopo-mvp.md` (fluxos F1–F7, regras RN-01…13, decisões D1–D12).

---

## 1. Veredito

**As duas APIs sustentam o projeto.** O que o deck promete é construível sem scraping, sem tela automatizada e sem digitação manual de faturamento.

Três descobertas mudam o desenho do que estava no documento 01:

| # | Achado | Consequência |
|---|---|---|
| **A1** | O **repasse médico já vem calculado inteiro** no ProDoctor, com base bruta, imposto, base líquida e a divisão médico × clínica (`baseCalculoBruto`, `valorImposto`, `baseCalculoLiquido`, `valorRepassadoMedico`, `valorRepassadoClinica`) | F2 deixa de ser "motor de cálculo" e passa a ser **motor de conferência + regra de exceção**. O Hub deve primeiro **consumir** o que o ProDoctor calcula; recalcular só onde houver regra própria |
| **A2** | O Omie **já tem rateio por departamento** nativo no lançamento (`distribuicao` com valor e percentual por departamento, tanto em contas a pagar quanto a receber) | F4 não precisa "criar" o rateio no Omie: o Hub calcula e **envia pronto**. O rateio por regra (nº de funcionários) continua sendo cálculo do Hub |
| **A3** | **Cada empresa no Omie é um aplicativo próprio** — dois CNPJs = **dois tokens, dois webhooks, duas contas** | D3 (dois CNPJs) deixa de ser só regra de negócio e vira **requisito de infraestrutura**: o Hub consolida duas instâncias Omie |

### 1.1 Viabilidade por fluxo

| Fluxo | Lastro nas APIs | Veredito |
|---|---|---|
| **F1** Receita (faturamento → recebível) | ProDoctor: faturas, contas de pacientes, procedimentos. Omie: contas a receber | ✅ **Viável** — leitura completa no ProDoctor |
| **F2** Repasse médico | ProDoctor: `/Exportacoes/Repasses` com valor já calculado. Omie: conta a pagar com rateio | ✅ **Viável** — e mais barato que o previsto (A1) |
| **F3** Insumos | ProDoctor: `/Exportacoes/MovimentacoesEstoque` com `procedimentoAssociado` e `centroCusto` | ⚠️ **Viável com condição** — exige o módulo **Estoque** (Cloud **+Corp**) |
| **F4** Despesas com rateio | Omie: `IncluirContaPagar` + `distribuicao`. ProDoctor: contas a pagar (leitura) | ✅ **Viável** — rateio nativo no Omie (A2) |
| **F5** Folha em PDF | **Nenhuma das duas** | ❌ **Fora das APIs** — importação de PDF no Hub |
| **F6** Plano de saúde / coparticipação | **Nenhuma das duas** | ❌ **Fora das APIs** — Hub + arquivo do convênio |
| **F7** Conferência e monitoramento | ProDoctor (leitura) + Omie (leitura + webhooks) | ✅ **Viável** — é exatamente o papel do Hub |

> **Regra de ouro que sai daqui:** o Hub não é um conector. É a **camada de consolidação, regra e conferência** entre duas fontes que não se falam.

---

## 2. O que precisa estar contratado (antes de qualquer linha de código)

### 2.1 ProDoctor

| Item | Situação |
|---|---|
| **Plano** | API aberta disponível **somente** para **Cloud +Clínica** e **Cloud +Corp** |
| **Módulos** | Faturamento e financeiro: **+Clínica**. Estoque (F3): **+Corp** |
| **Chave de API** | Criada dentro do ProDoctor, com **senha própria**; permissões concedidas **por chave** |
| **Permissões necessárias** | `Acessar Financeiro` · `Acessar Faturamento` · `Acessar Estoque` (só F3) · `Acessar Agenda` (não é foco do MVP) |
| **Contratos** | O limite de **120 req/min** é **por contrato**. Se cada CNPJ tiver contrato próprio, há dois conjuntos de chave e dois limites |

> **Ponto a confirmar com a clínica:** a Gastrocenter tem **um contrato com dois "Locais ProDoctor"** ou **dois contratos**? Isso muda o número de chaves, o limite de chamadas e o filtro por unidade (`locaisProDoctor`).

### 2.2 Omie

| Item | Situação |
|---|---|
| **Pacote de APIs** | Empresas com mensalidade precisam ter o **pacote de APIs contratado**; no plano gratuito existe limite diário de uso |
| **Aplicativo** | Criado em *Meus aplicativos*; gera `app_key`, `app_secret`, **token** e **refresh_token** (exibidos uma única vez) |
| **Por empresa** | **Cada empresa é um aplicativo** → os dois CNPJs exigem **dois aplicativos** e **dois fluxos de token** |
| **Ambiente de teste** | **Não há sandbox.** O caminho é usar um **aplicativo de demonstração** |
| **Token** | Vale **24 h**; renovação via `POST /api/portal/apps/{app_hash}/refresh-token/` com `{"token","refresh_token"}`, **sem** header `Authorization` (aceita token vencido) |

---

## 3. Como cada API funciona

### 3.1 ProDoctor — REST por rota, somente leitura no financeiro

| Dimensão | Detalhe |
|---|---|
| **Base** | `https://open-api.prodoctor.net` |
| **Autenticação** | Headers `X-APIKEY`, `X-APIPASSWORD`, `X-APITIMEZONE` (`-03:00`), `X-APITIMEZONENAME` (`America/Sao_Paulo`) |
| **Formato** | JSON; as rotas de exportação declaram `application/json-patch+json`, `application/json` e `text/json` |
| **Datas** | `DD/MM/YYYY` |
| **Números** | ⚠️ **Quase tudo vem como string** (modelo herdado de CSV/planilha), com separador decimal brasileiro. Exige parsing e normalização explícitos |
| **Paginação** | `pagina`, com até **50.000 registros por página** (alterado em **03/11/2026**; antes eram 5.000) |
| **Limite** | **120 requisições/minuto por contrato**, somando leitura e escrita; excedeu → **HTTP 429** e bloqueio até renovar o minuto |
| **Escrita** | Existe em Agenda, Pacientes, Usuários, Imagens/Documentos. **Não existe** rota de escrita para contas a pagar/receber, repasses ou faturamento |
| **Notificação** | ❌ **Sem webhooks** (nenhuma menção no spec) → **polling obrigatório** |
| **Filtro incremental** | ⚠️ **Não há filtro por data de alteração.** Só janelas por data de negócio: inclusão, efetivação ou vencimento |
| **Exclusão** | ⚠️ **Não detectável.** Registro excluído simplesmente desaparece da exportação |

**Consequência prática:** a sincronização do ProDoctor precisa ser **snapshot por janela + comparação**, e não um "me dê o que mudou desde X".

### 3.2 Omie — RPC por serviço, leitura e escrita

| Dimensão | Detalhe |
|---|---|
| **Base** | `https://app.omie.com.br/api/v1/<serviço>/` |
| **Formato** | Todo POST carrega `{"call": "<Operação>", "param": [{...}]}`; a operação vai no corpo, não na URL |
| **Autenticação** | `Authorization: Bearer <token do aplicativo>` |
| **Paginação** | `pagina` + `registros_por_pagina` — **máximo 50** nas listagens financeiras (contas a pagar/receber, movimentos, pesquisa de títulos) |
| **Filtro incremental** | ✅ **Sim**: `filtrar_por_data_de/ate` + `filtrar_apenas_alteracao`, `filtrar_por_registro_de/ate`; em `financas/mf`, `dDtAltDe` / `dDtAltAte` |
| **Exclusão** | ✅ **Sim**, via webhook (`*.Excluido`) |
| **Notificação** | ✅ **Webhooks**: **149 tópicos**, sendo **37 de Finanças** |
| **Erros** | `403` (sem pacote/permissão), `406`, `425` (repetição/bloqueio), `429`, `500`, `503` |
| **Idempotência** | `codigo_lancamento_integracao` (até 60 caracteres) em contas a pagar/receber; `codigo_baixa_integracao` (até 20) em baixas |

**Entrega de webhook:** precisa de **2xx em até 7 s**; o Omie tenta novamente (tentativas rápidas + 1 a cada 10 min por até **5 dias**); entrega **idempotente e em ordem por endereço**. O corpo do evento traz `appKey`/`appHash` — é o que separa os dois CNPJs no mesmo endpoint do Hub.

### 3.3 Comparação direta

| Dimensão | ProDoctor | Omie |
|---|---|---|
| Modelo | REST por rota | RPC (`call` no corpo) |
| Escrita financeira | ❌ | ✅ |
| Webhook | ❌ | ✅ (149 tópicos) |
| Sync incremental | ❌ (só data de negócio) | ✅ (data de alteração) |
| Detecta exclusão | ❌ | ✅ |
| Página | 50.000 | 50 |
| Número no JSON | string (pt-BR) | number |
| Sandbox | ❌ documentado | ❌ (app de demonstração) |
| Limite | 120 req/min por contrato | cota por pacote |

---

## 4. Catálogo ProDoctor — rotas que interessam

### 4.1 Faturamento (consulta/exportação)

| Rota | O que entrega | Permissão | Fluxo |
|---|---|---|---|
| `POST /api/v1/Exportacoes/GerenciarFaturas` | Faturas de convênio por período (criação, fechamento ou envio), com totais por categoria | Faturamento | F1 |
| `POST /api/v1/Faturamento/Faturas` | Busca faturas com **glosa, recursado, recuperado, a receber** | Faturamento | F1, F7 |
| `POST /api/v1/Faturamento/Fatura/Detalhar` | Fatura + lista de contas que a compõem | Faturamento | F1, F7 |
| `POST /api/v1/Exportacoes/ContasPacientes` | Contas de pacientes com **totais e glosas por categoria** | Faturamento | F1, F2 |
| `POST /api/v1/Exportacoes/ProcedimentosContasPacientes` | **Uma linha por procedimento**, com glosa, recuperado, médico e flags de repasse | Faturamento | F1, F2, F7 |
| `GET /api/v1/Faturamento/ContaPaciente/{conta}` | Detalhe completo da conta (procedimentos, materiais, taxas, problemas, repasse) | Faturamento | F1, F2 |
| `POST /api/v1/Faturamento/ContasPacientes/Listar` | Contas de um paciente | Faturamento | F1 |
| `POST /api/v1/Exportacoes/OutrasDespesas` | Despesas acessórias da conta (OD) com glosa e vínculo ao procedimento | Faturamento | F1 |
| `POST /api/v1/Exportacoes/Repasses` | **Repasses por médico**, já calculados | Faturamento | **F2** |
| `POST /api/v1/Exportacoes/Orcamentos` | Orçamentos do período | Faturamento | — |

### 4.2 Financeiro

| Rota | O que entrega | Permissão | Fluxo |
|---|---|---|---|
| `POST /api/v1/Exportacoes/ContasPagarReceber` | Contas a pagar/receber, pagas/recebidas, com situação, efetivação e classificação | Financeiro | F1, F4, F7 |
| `POST /api/v1/Financeiro/ContasContabeis` | Plano de contas contábil (código, nome, permite lançamento) | Financeiro | DRE |
| `POST /api/v1/Financeiro/GruposReceitasDespesas` | Grupos de receita/despesa | Financeiro | DRE |

### 4.3 Estoque (exige módulo Estoque — Cloud **+Corp**)

| Rota | O que entrega | Permissão | Fluxo |
|---|---|---|---|
| `POST /api/v1/Exportacoes/MovimentacoesEstoque` | Entradas/saídas com **centro de custo, procedimento associado, conta, fatura, paciente, valor e NF** | Estoque | **F3** |
| `POST /api/v1/Estoque/MateriaisMedicamentos` | Cadastro de materiais/medicamentos | Estoque | F3 |

### 4.4 Cadastros auxiliares (para o de-para e a Fase 0)

| Rota | Uso |
|---|---|
| `POST /api/v1/LocaisProDoctor` · `GET /LocaisProDoctor/Detalhar/{codigo}` | **Mapa unidade → código** (Sabin, Stella Central) |
| `POST /api/v1/Convenios` · `GET /Convenios/Detalhar/{codigo}` | Convênios e regras |
| `POST /api/v1/Usuarios` · `GET /Usuarios/Detalhar/{codigo}` | **Mapa médico → código** (chave do repasse) |
| `POST /api/v1/Agenda/Listar` | Agenda (fora do MVP, útil para conferência de atendimento) |

---

## 5. Catálogo Omie — operações que interessam

| Serviço (`/api/v1/...`) | Operações | Uso no Hub | Fluxo |
|---|---|---|---|
| `financas/contapagar` | `Incluir`, `Upsert`, `PorLote`, `Alterar`, `Consultar`, `Listar`, `LancarPagamento`, `CancelarPagamento`, `Excluir` | Conta a pagar do repasse (F2) e das despesas rateadas (F4) | F2, F4 |
| `financas/contareceber` | `Incluir`, `Upsert`, `PorLote`, `LancarRecebimento`, `ConciliarRecebimento`, `Desconciliar`, `Listar` | Recebíveis de convênio/particular (F1) | F1 |
| `financas/mf` | `ListarMovimentos` | **Conciliação por data de alteração**, com `cExibirDepartamentos` | F7, DRE |
| `financas/pesquisartitulos` | `PesquisarLancamentos` | Busca de títulos por NFe, categoria, status | F7 |
| `financas/extrato` | `ListarExtrato` | Extrato por conta corrente (caixa) | DRE caixa |
| `financas/resumo` | `ObterResumoFinancas`, `ObterListaEmAberto` | Posição de caixa e em aberto | F7 |
| `financas/caixa` | `ListarOrcamentos` | Previsto × realizado | Fase 3 |
| `financas/consultaaging` | Consultas de aging | Aging de recebíveis | Fase 3 |
| `geral/categorias` | `ListarCategorias` (filtro R/D) | **De-para categoria → linha do DRE** | DRE |
| `geral/departamentos` | `ListarDepartamentos` | **De-para departamento → unidade/centro de custo** | F4, DRE |
| `geral/contacorrente` | `ListarContasCorrentes` | Contas bancárias por CNPJ | F7 |
| `geral/clientes` | `ListarClientes` | Fornecedores (médicos PJ) e convênios | F2 |
| `geral/projetos` | `ListarProjetos` | Centro de custo alternativo | F4 |
| `geral/dre` | **`ListarCadastroDRE`** apenas | Só o **cadastro** do DRE — **não devolve valores** | DRE |
| `contador/*` | `planocontas`, `lancamentoscontabeis`, `resumo`, `xml` | Contabilidade formal | Fase 2+ |

### 5.1 Rateio no Omie (A2)

`IncluirContaPagar` e `IncluirContaReceber` aceitam:

```json
"distribuicao": [
  { "cCodDep": "001", "cDesDep": "Sabin",           "nValDep": 6000.00, "nPerDep": 60 },
  { "cCodDep": "002", "cDesDep": "Stella Central",  "nValDep": 4000.00, "nPerDep": 40 }
]
```

O Hub calcula o critério (nº de funcionários, percentual fixo, valor fixo, receita) e envia **já dividido** — o Omie só registra. Isso satisfaz RN-04 sem trabalho de adaptação.

### 5.2 Campos decisivos do Omie

- **Identificação/idempotência:** `codigo_lancamento_integracao` (60), `codigo_lancamento_omie`.
- **Classificação:** `codigo_categoria`, `categorias[]`, `codigo_projeto`, `id_conta_corrente`, `distribuicao[]`.
- **Datas:** `data_emissao`, `data_vencimento`, `data_previsao`, `data_registro`.
- **Valores:** `valor_documento`, `valor_pag`.
- **Documento:** `numero_documento`, `numero_documento_fiscal`, `chave_nfe`, `observacao` (o `|` vira quebra de linha).
- **Retenções:** `valor_iss`/`retem_iss`, `inss`, `ir`, `csll`, `pis`, `cofins`.
- **Baixa:** `baixar_documento`, `conciliar_documento`, `pagamento` — usados por `LancarPagamento`.

### 5.3 Webhooks relevantes (Finanças — 37 tópicos)

`Financas.ContaPagar.Incluido` · `.Alterado` · `.Excluido` · `.BaixaRealizada` · `.BaixaCancelada` · `.Rateio.Departamento` · `.Rateio.Categoria`
`Financas.ContaReceber.*` (mesma família) · `Financas.ContaCorrente.Lancamento.*` · `Departamento.*` · `Categoria.*`

> **Uso no Hub:** webhook é **gatilho**, não fonte de verdade. Ao receber, o Hub busca o registro por `Consultar*`/`Listar*`. Isso evita depender do payload completo e mantém a consistência.

---

## 6. Campos que decidem o desenho

### 6.1 Repasses — o ProDoctor já faz a conta (A1)

`/Exportacoes/Repasses` devolve, por linha de repasse:

| Campo | Significado | Uso |
|---|---|---|
| `dataRepasse`, `numeroRepasse` | Data e número do repasse | Chave do lote de repasse |
| `fatura`, `conta`, `linha` | Origem do valor | **Vínculo com F1** (recebível ↔ repasse) |
| `tipo`, `funcaoRepasse` | Tipo e função do repasse | Classificação |
| `nomeUsuario`, `codigoAmb` | Médico e especialidade | **Centro de custo médico** |
| `nomeConvenio`, `nomePaciente`, `prontuario` | Contexto clínico | Rastreabilidade |
| `totalConta` | Total do atendimento | Base bruta |
| `baseCalculoBruto` | Base antes de impostos | Conferência |
| `percentualImposto`, `valorImposto` | Imposto retido no repasse | **Composição do líquido** |
| `baseCalculoLiquido` | Base após imposto | Conferência |
| `valorRepassado` | Valor repassado | Conferência |
| **`valorRepassadoMedico`** | **Quanto é do médico** | **Conta a pagar (F2)** |
| **`valorRepassadoClinica`** | **Quanto é da clínica** | **Receita retida / margem** |

**Impacto em F2:** o Hub não precisa recalcular. Ele precisa:
1. **Consumir** o valor do ProDoctor;
2. **comparar** com a regra cadastrada (D2) e sinalizar divergência;
3. gerar a conta a pagar no Omie com `codigo_lancamento_integracao` derivado de `numeroRepasse + conta + linha` (idempotência);
4. **reagir à glosa** reabrindo o repasse.

> Isso reduz muito o risco de F2 — e transforma a decisão D2 de "como calcular" em "**aceitar o cálculo do ProDoctor ou recalcular?**".

### 6.2 Procedimentos da conta — onde o repasse nasce

Campos de `/Exportacoes/ProcedimentosContasPacientes` que importam:

| Campo | Uso |
|---|---|
| `conta`, `linhaProcedimento`, `fatura` | Chave natural do item |
| `usuario`, `funcao`, `funcaoRepasse`, `usuarioEspecialidade` | Médico executor e regra de repasse |
| `grupoProcedimentosRepasses` | Agrupamento usado no repasse |
| `valorTotal`, `valorDiferenca`, `valorGlosa`, `valorRecuperado` | Receita, glosa e recuperação por item |
| `naoRepassar`, `somenteRepasse`, `naoIncluirRepasse` | **Exceções de repasse já marcadas no ProDoctor** |
| `quantidade`, `tipoProcedimento`, `tipoGuia`, `guia` | Detalhe e rastreio TISS |
| `localProDoctor`, `codigoLocalProDoctor` | Unidade → CNPJ (D3) |

### 6.3 Contas de pacientes — receita por categoria

`/Exportacoes/ContasPacientes` entrega, na mesma linha, os totais e as glosas de: **procedimentos, materiais, medicamentos, gases, taxas e diárias** (valor, glosa e recuperado de cada um).

**Uso:** separar **receita de serviço** de **receita de insumo** no DRE e alimentar a margem por médico (D7) sem depender de planilha.

### 6.4 Contas a pagar/receber do ProDoctor

`/Exportacoes/ContasPagarReceber` (35 campos) — filtros `tipoPeriodo` (0 inclusão, 1 efetivação, 2 vencimento) e `tipos` (0 CP, 1 CR, 2 pagas, 3 recebidas).

Campos-chave: `situacao`, `dataInclusao`, `dataEfetivacao`, `dataVencimento`, `dataCompensacao`, `creditoValor`, `debitoValor`, `creditoValorEfetivacao`, `debitoValorEfetivacao`, `grupoReceitaDespesa` + `nomeGrupoReceitaDespesa`, `contaContabil` + `nomeContaContabil`, `clienteFornecedor`, `tipoClienteFornecedor`, `fatura`, `numRepasse`, `contaPagarReceberPai`, `percentualTaxa`, `numeroDocumento`, `formaEfetivacao`, `banco`/`agencia`/`contaCorrente`.

**Usos:**
- **F4:** as despesas lançadas no ProDoctor entram já classificadas (`grupoReceitaDespesa` → de-para do DRE).
- **F7:** `numRepasse` e `fatura` permitem conciliar CP/CR do ProDoctor com o Omie **pelo documento**, não por valor.
- **`percentualTaxa`** explica a diferença entre bruto e líquido em cartão.

### 6.5 Estoque (F3)

`/Exportacoes/MovimentacoesEstoque` já traz **`centroCusto`, `procedimentoAssociado`, `conta`, `fatura`, `paciente`, `convenio`, `valorUnitario`, `valorTotal`, `notaFiscal`, `fornecedor`**.

**Leitura:** o vínculo **insumo → procedimento → paciente → conta** já existe no ProDoctor. F3 pode ser, no MVP, **apenas leitura e consolidação** — sem criar movimentação. Criar estoque continua fora de escopo (D4).

⚠️ **Restrição dura:** a rota só existe para produtos com a funcionalidade **Estoque** (Cloud **+Corp**). Se o contrato for **+Clínica**, F3 não tem lastro via API.

### 6.6 Faturas de convênio (F1, F7)

`/Faturamento/Faturas` devolve, por fatura: `totalConta`, `totalProcedimentos`, `totalMateriais`, `totalMedicamentos`, `totalGases`, `totalTaxas`, `totalDiarias`, `totalGlosa`, `totalRecursado`, `totalRecuperado`, **`aReceber`**, `situacao`, `enviado`, `dataHoraEnvioAtual`, `totalProcedimentosSemGuia`, `tipoRepasse`, `localProDoctor`.

**Uso:** é a unidade natural de **conciliação de F1**. Glosa e recurso aparecem no nível da fatura — o Hub detecta mudança de `aReceber` e abre pendência, sem reprocessar tudo.

---

## 7. Mapa fluxo → endpoints → o que o Hub faz

### F1 — Receita
- **ProDoctor:** `GerenciarFaturas` → `Faturas` → `Fatura/Detalhar` → `ContasPacientes` → `ProcedimentosContasPacientes` (+ `OutrasDespesas`).
- **Hub:** normaliza para o modelo canônico de **conta → itens → fatura**; atribui unidade/CNPJ por `codigoLocalProDoctor`; classifica receita (serviço × insumo).
- **Omie (D11=b):** `IncluirContaReceber` com `codigo_cliente_fornecedor` do convênio, `codigo_categoria`, `numero_documento` = `fatura`, `codigo_lancamento_integracao` = `PD:{local}:{fatura}:{conta}`.
- **Lacuna:** convênio precisa existir como cliente no Omie → de-para obrigatório.

### F2 — Repasse
- **ProDoctor:** `Repasses` (valor pronto) + `Procedimentos` (origem e exceções).
- **Hub:** vincula repasse ↔ conta; compara com a regra do médico; gera CP com vencimento e categoria próprios; monitora glosa.
- **Omie:** `IncluirContaPagar` (`codigo_cliente_fornecedor` = PJ do médico), `distribuicao` para ratear entre unidades quando o atendimento for compartilhado.
- **Lacuna:** se o ProDoctor **não** calcula algum caso (ex.: regra interna da clínica diferente), o Hub precisa recalcular — mas isso é **exceção**, não o caminho principal.

### F3 — Insumos
- **ProDoctor:** `MovimentacoesEstoque` (leitura) + `Estoque/MateriaisMedicamentos`.
- **Hub:** liga insumo ao procedimento e ao centro de custo; calcula consumo por médico/unidade.
- **Omie:** pode virar CP de fornecedor (estoque) ou permanecer só como custo no Hub.
- **Lacuna:** exige módulo Estoque contratado; escrita não existe.

### F4 — Despesas com rateio
- **Hub:** lançador + regra de rateio (nº de funcionários, %, valor, receita, manual) → N parcelas.
- **Omie:** N lançamentos **ou** 1 lançamento com `distribuicao` (A2) — decisão de modelagem, não de API.
- **ProDoctor:** `ContasPagarReceber` tipo 0/2 para conferir despesas lançadas lá.
- **Lacuna:** nenhuma técnica. É a parte mais "do Hub" do projeto.

### F5 — Folha
- **APIs:** nada.
- **Caminho:** upload do PDF → parser → lançamentos individualizados com bruto, descontos e líquido → agregação por natureza para exibição.
- **Omie:** CP por natureza (salário, INSS, FGTS) ou por funcionário — depende de D9.

### F6 — Plano de saúde / coparticipação
- **APIs:** nada.
- **Caminho:** arquivo do convênio → rateio por nº de funcionários → dois lançamentos (empresa × coparticipação).
- **Omie:** CP da parte da empresa; a coparticipação é desconto em folha (F5), não receita.

### F7 — Conferência
- **Hub:** motor de conciliação com quatro estados: `ok`, `divergente`, `faltante_no_omie`, `faltante_no_prodoctor`.
- **Chaves de confronto:** `fatura` + `conta` + `linha` (ProDoctor) × `numero_documento` + `codigo_lancamento_integracao` (Omie).
- **Sinais:** `aReceber` × título no Omie; `valorRepassadoMedico` × CP; despesa no ProDoctor × CP no Omie.
- **Lacuna:** exclusão no ProDoctor não é detectável → conciliação precisa de **varredura de janela** e não só de eventos.

---

## 8. Lacunas e restrições (L1–L10)

| ID | Lacuna | Impacto | Mitigação |
|---|---|---|---|
| **L1** | ProDoctor não tem escrita em financeiro/faturamento | Hub não pode "corrigir" o ProDoctor | Hub é dono da regra; ProDoctor segue como operação |
| **L2** | ProDoctor não tem filtro por data de alteração | Sync incremental "de verdade" é impossível | Backfill + **re-sync de janela móvel** (ex.: 90 dias) + diff de snapshot |
| **L3** | Exclusão no ProDoctor é invisível | Registro pode sumir sem aviso | Comparar IDs do snapshot anterior; ausência = suspeita → pendência em F7 |
| **L4** | 120 req/min por contrato | Backfill grande pode estourar | Fila com throttling, retry com backoff, cache de cadastros |
| **L5** | Omie 50 registros/página | Muitas chamadas em volume grande | Paginação paralela controlada; preferir `Consultar` por ID após webhook |
| **L6** | Omie sem sandbox | Teste em produção | Usar aplicativo de demonstração; `Upsert` + `codigo_lancamento_integracao` para reverter com segurança |
| **L7** | Dois CNPJs = dois apps Omie (A3) | Token, webhook e conciliação duplicados | Abstração `empresa` no conector; webhook único separando por `appHash` |
| **L8** | Números do ProDoctor vêm como string pt-BR | Erro silencioso de parsing (`1.234,56`) | Parser único e testado; rejeitar valor ambíguo em vez de "adivinhar" |
| **L9** | `geral/dre` do Omie só lista cadastro | Não existe DRE pronto | DRE é 100% do Hub (confirma §7 do doc 01) |
| **L10** | Glosa/recurso chega depois do fechamento | Repasse pago pode ficar errado | Provisionar repasse (D1=b) e reabrir por evento de fatura |

---

## 9. Arquitetura de integração recomendada

```
┌──────────────┐        ┌──────────────────────────────────────────┐        ┌──────────────┐
│  ProDoctor   │        │            HUB FINANCEIRO                │        │     Omie     │
│  (leitura)   │        │                                          │        │              │
│  Faturas     │──poll─▶│  1. Conectores (throttle, retry, log)    │        │  CP / CR     │
│  Contas      │        │  2. Raw landing (payload bruto)          │◀─webhook│  Rateio      │
│  Procedim.   │        │  3. Normalização (modelo canônico)       │──write─▶│  Baixas      │
│  Repasses    │        │  4. Regras (repasse, rateio, DRE)        │        │  Extrato     │
│  Estoque     │        │  5. Conciliação + pendências (F7)        │        │  Categorias  │
└──────────────┘        │  6. API/UI (alçadas, painéis)            │        └──────────────┘
                        └──────────────────────────────────────────┘
                                        │
                                   ┌────▼─────┐
                                   │  DRE     │  ← só o Hub produz
                                   └──────────┘
```

### 9.1 Decisões de arquitetura

1. **Dois conectores, um modelo canônico.** Nada de "campo do ProDoctor" vazando para a tela. O modelo é do Hub: `Unidade`, `Medico`, `Paciente`, `Conta`, `ItemConta`, `Fatura`, `Repasse`, `Titulo`, `Rateio`, `CategoriaDRE`.
2. **Raw landing antes de normalizar.** Guardar o payload original é o que permite reprocessar quando a regra mudar — sem voltar à API.
3. **Idempotência por chave natural.** `codigo_lancamento_integracao` = hash determinístico da origem (`PD:{local}:{fatura}:{conta}:{linha}`). Reexecutar nunca duplica.
4. **Webhook é gatilho, não verdade.** Receber → 2xx imediato → enfileirar → `Consultar*` → atualizar.
5. **Conciliação diária obrigatória.** `financas/mf` com `dDtAltDe/dDtAltAte` cobre o que o webhook perder (o Omie reentrega por 5 dias, mas o Hub não deve depender disso).
6. **ProDoctor por janela.** Backfill inicial de 12–24 meses + re-sync diário dos últimos 90 dias + re-sync mensal do ano corrente (pega glosa tardia).
7. **Escrita no Omie atrás de feature flag.** D11 pode começar como leitura e virar escrita sem refatorar o conector.

### 9.2 Ordem de implementação sugerida

| Onda | Entrega | Depende de |
|---|---|---|
| **0** | Conectores + raw landing + modelo canônico + de-para de unidades/médicos/convênios | Chaves e permissões |
| **1** | F1 (receita consolidada) + F2 (repasse conferido, CP no Hub) | Onda 0 |
| **2** | F4 (lançador com rateio) + F7 (conciliação) | Onda 1 |
| **3** | Escrita no Omie (D11=b) + DRE | Onda 2 + decisão D6 |
| **4** | F3 (estoque), F5 (folha), F6 (plano de saúde) | Contrato + arquivos |

> **Observação estratégica:** F1 + F2 + F7 já entregam valor **só com ProDoctor + Hub** — o que respeita a premissa de que o Omie ainda não está em uso.

---

## 10. O que esta análise muda nas decisões abertas

| Decisão | Efeito da análise | Recomendação atualizada |
|---|---|---|
| **D1** (quando pagar o médico) | O ProDoctor já registra `dataRepasse` | Manter (b) — pagar após o convênio — e usar `dataRepasse` como referência |
| **D2** (base do repasse) | **Já existe base pronta**: bruto, imposto, líquido | Trocar a pergunta: **consumir o cálculo do ProDoctor** (recomendado) × recalcular no Hub |
| **D3** (dois CNPJs) | `localProDoctor` no ProDoctor; **app separado** no Omie | Regra por local + duas instâncias Omie |
| **D5** (aprovação) | Nenhuma API cobre alçada | 100% no Hub — confirma |
| **D6** (DRE) | Omie só entrega **cadastro** de DRE | Estrutura e valores 100% no Hub — confirma |
| **D7** (margem por médico) | `valorRepassadoClinica` já existe | Fase 1 pode ter margem **sem** rateio de fixos |
| **D11** (leitura × escrita no Omie) | Escrita é tecnicamente trivial (`Incluir`/`Upsert` + rateio) | Fase 1 leitura; escrita na onda 3 |
| **D12** (quem opera o Omie) | Dois apps exigem um responsável técnico | Confirmar **quem** cria e mantém os aplicativos |

---

## 11. Checklist de validação da Fase 0

Cada item é um teste **executável**, não uma suposição.

| # | Teste | Critério de aceite |
|---|---|---|
| 1 | Criar chave ProDoctor e chamar `POST /LocaisProDoctor` | Retorna as duas unidades com código |
| 2 | `POST /Usuarios` | Retorna médicos com código (base do de-para de repasse) |
| 3 | `POST /Convenios` | Lista convênios com código |
| 4 | `Exportacoes/GerenciarFaturas` em 1 mês fechado | Retorna faturas com `aReceber` e `situacao` |
| 5 | `Exportacoes/ProcedimentosContasPacientes` no mesmo mês | Retorna linhas com `valorGlosa`, `usuario`, `funcaoRepasse` |
| 6 | `Exportacoes/Repasses` no mesmo mês | Confirma que `valorRepassadoMedico` bate com a regra real de um médico conhecido |
| 7 | `Exportacoes/ContasPagarReceber` (tipos 0 e 2) | Retorna despesas com `grupoReceitaDespesa` preenchido |
| 8 | `Exportacoes/MovimentacoesEstoque` | **Confirma se o módulo Estoque existe** no contrato |
| 9 | Medir tempo e volume de 1 mês de exportação | Estimar backfill dentro de 120 req/min |
| 10 | Criar aplicativo Omie (CNPJ 1) e chamar `ListarCategorias` | 200 OK com categorias |
| 11 | `ListarDepartamentos` + `ListarContasCorrentes` | De-para de unidade e banco |
| 12 | `IncluirContaPagar` de teste com `distribuicao` em 2 departamentos | Rateio aparece na tela do Omie |
| 13 | `IncluirContaPagar` duas vezes com o mesmo `codigo_lancamento_integracao` | Segunda chamada **não duplica** |
| 14 | Configurar webhook `Financas.ContaPagar.Incluido` | Evento chega com `appKey`/`appHash` e 2xx em < 7 s |
| 15 | Repetir 10–13 no **segundo CNPJ** | Confirma que são duas instâncias independentes |
| 16 | `financas/mf` com `dDtAltDe/dDtAltAte` | Retorna alterações do dia, com departamentos |

---

## Anexos

### A. Como obter as especificações

```bash
# ProDoctor (exige User-Agent de navegador; sem ele retorna 403)
curl -sL "https://open-api.prodoctor.net/swagger/v1/swagger.json" \
  -H "User-Agent: Mozilla/5.0" -o pd-swagger.json

# Omie
curl -sL "https://api.omie.com.br/docs/openapi.json" \
  -H "User-Agent: Mozilla/5.0" -o omie-openapi.json
```

### B. Referências

- ProDoctor — documentação: `https://open-api.prodoctor.net/api-docs/`
- ProDoctor — exemplos oficiais: `https://github.com/ProDoctorSoftware/api-aberta-exemplos`
- Omie — referência: `https://api.omie.com.br/docs/apis`
- Omie — webhooks: `https://api.omie.com.br/docs/webhooks`
- Omie — MCP/IA: `https://api.omie.com.br/docs/mcp`
- Documento de escopo: `docs/01-visao-geral-e-escopo-mvp.md`

> ⚠️ O post do blog do ProDoctor sobre a API aberta (jul/2025) está **desatualizado**: não menciona faturamento nem financeiro, que hoje existem e são o núcleo deste projeto. Não usar como referência de escopo.
