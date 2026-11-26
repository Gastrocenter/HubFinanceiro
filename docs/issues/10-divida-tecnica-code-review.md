# 10 — Dívida técnica do /code-review de 26/11/2026

**Tipo:** AFK · **Depende de:** nada (pode entrar antes, junto ou depois da 07/08) · **Origem:** `/code-review` desde `fa12330`

Os itens 1 a 4 da revisão já foram corrigidos (commits `56a3cf3`, `ae24e6c`, `5b1198b`, `c8f27f0`). Estes são os 6 restantes, menores. Cada um vira uma fatia com teste que falha antes da correção (`/tdd`).

## 5. Erro de programação tratado como falha de rede
`ehFalhaPassageira` (`src/conectores/prodoctor/retentativa.ts`) trata **qualquer** `TypeError` como passageiro. O `executarJob` usa essa classificação também para erros do `aoConcluir` e do `extrairRegistros`. Um registro malformado que estoura `TypeError` no parser é refeito 5 vezes, e o bug real fica escondido atrás de "tentativas".
- **Correção:** em `src/conectores/prodoctor/cliente.ts`, embrulhar só a falha do `fetch` numa classe própria (ex.: `ErroDeRedeProDoctor`) e tratar como passageiro só ela e o `ErroHttpProDoctor` 429/5xx.
- **Teste:** `TypeError` vindo do parser é definitivo; falha de `fetch` continua passageira.

## 6. "Aceitar sugestões" aplica o que existir na hora do clique
`aceitarSugestoes` (`src/app/cadastros/acoes.ts`) recalcula as sugestões e a lista de não revisados no envio. Profissionais que entraram depois que a tela abriu são marcados com o usuário de quem clicou, sem terem sido vistos.
- **Correção:** o formulário envia os ids de de-para exibidos e a sugestão de cada um; a ação aplica só esses e pula os que mudaram desde então.
- **Teste:** função pura que recebe "exibidos" e "atuais" e devolve só o que pode ser aplicado.

## 7. Procedimento que muda de mês deixa pendência falsa de "sumiu"
A chave do recebível (empresa, unidade, conta, linha) é única entre meses, mas a diferença é por mês. Se o mês antigo roda primeiro, a linha é marcada como sumida e abre `procedimento_sumiu`. O mês novo move a linha (`mes = excluded.mes`, `visto = true`), mas a pendência continua aberta.
- **Correção:** em `aplicar_mes_de_procedimentos`, ao gravar uma linha, resolver a `procedimento_sumiu` aberta da mesma chave (o `resolver` do item 2 já existe).
- **Teste:** SQL em rollback: some no mês A, aparece no mês B, pendência resolvida.

## 8. Sinais dos profissionais sem paginação
`carregarSugestoes` (`src/cadastros/sinais.ts`) lê `sinais_dos_profissionais()` numa chamada só. Acima de 1000 profissionais (somando empresas) o PostgREST corta em silêncio e as sugestões somem. Viola `CODING_STANDARDS.md` (leitura paginada).
- **Correção:** `order by de_para_id` na função SQL e leitura por `lerTudo` com `.range()`.
- **Teste:** unitário com fonte falsa de 2.500 linhas (como `ler-tudo.test.ts`).

## 9. Cadastro desativado aparece como "Sumiu do ProDoctor"
Os cadastros são pedidos com `somenteAtivos: true` (`src/sync/fila.ts`, `CADASTROS`/`enfileirarCadastros`). O inativo nunca vem, cai em `sumiram` e a tela mostra o selo vermelho de "sumiu", como se tivesse sido apagado; o estado "Inativo" nunca acontece.
- **Correção:** pedir `somenteAtivos: false` e deixar `estadoRegistro` definir `ativo` (o parser já lê). Conferir antes, contra a API real, que o ProDoctor devolve os inativos e com qual `estadoRegistro`.
- **Teste:** contrato real (`test:integracao`) e o fluxo de `reconciliar` com um inativo.

## 10. Prefixos frouxos no `proxy`
Em `src/proxy.ts`, `startsWith("/login")` torna pública qualquer rota que comece com `/login` (ex.: `/login-suporte`), e o `matcher` pula a checagem de sessão para qualquer caminho que comece com `illustrations` ou `api/agendamentos` (ex.: `/api/agendamentos-x`). Hoje não há rota assim, mas uma futura passaria sem a checagem do proxy.
- **Correção:** `pathname === rota || pathname.startsWith(rota + "/")`, e ancorar as exclusões do `matcher` com `/` ou `$`.
- **Teste:** função pura `ehRotaPublica(pathname)` com os casos de borda.

## Estado (26/11/2026)
Seams confirmadas: S1 item 5 (cliente e executarJob), S2 item 6 (`sugestoesAplicaveis`), S3 item 7 (SQL em rollback), S4 item 8 (`carregarSugestoes` com 2.500 linhas), S5 item 9 (contrato real), S6 item 10 (`ehRotaSemSessao`). Cada teste foi escrito e visto falhar antes da correção.

- **Item 7:** migration `20261126161651_issue_10_divida_tecnica`. A linha gravada (em qualquer mês) ou que voltou fecha a `procedimento_sumiu` aberta da mesma empresa e chave, e o fechamento entra em `pendencias_resolvidas` na auditoria. `supabase/tests/procedimento_que_muda_de_mes.sql` deu TESTE_OK no banco real; os testes SQL antigos da função também.
- **Item 9, fato da API real (sonda só com contagens):** unidades e convênios trazem `estadoRegistro` (convênios: 128 ativos, 174 com estado 1). `Usuarios` não traz estado nenhum: com `somenteAtivos: false` vêm 142 em vez de 50, sem como saber quem está inativo. Pedir todos marcaria 92 inativos como ativos.
- **Item 9, decisão (D-1, "selo honesto"):** unidades e convênios pedem todos e o `estadoRegistro` decide; profissionais continuam só ativos, e quem sai da lista ganha o selo "Inativo ou removido no ProDoctor" (sem o vermelho de "sumiu"). O contrato real falha se um dia o ProDoctor passar a mandar o estado do usuário.
- **Efeito do item 9 na próxima sync:** os 174 convênios inativos entram no de-para como "a revisar", com o selo "Inativo". Não abrem pendência.
- **Item 10:** o `matcher` exclui só os arquivos do Next (`_next/static/`, `_next/image`, `favicon.ico`), conferido na regex compilada do build. Login, ilustrações e agendamentos ficam em `ehRotaSemSessao`; ilustrações e agendamentos saem do proxy antes de tocar a sessão, como antes.

- **Revisão (/code-review, dois eixos):** sem violação de padrão documentado. Corrigidos, com teste vermelho antes:
  - item 5: conexão que cai no meio do corpo (`TypeError` ao ler o JSON) voltou a ser passageira; JSON malformado segue definitivo;
  - item 7: com os meses em paralelo, o "sumiram" de um mês podia chegar depois que outro mês levou a linha e abrir pendência falsa. Migration `20261126163213_issue_10_sumiu_so_o_que_marcou`: a pendência só abre para a linha que o update marcou de fato, e o "voltaram" só fecha a da linha que voltou de fato.

  Ajustes menores: `.order("de_para_id")` também no PostgREST (item 8); marcações (`MARCACOES`) numa fonte só; o selo da tela lê de `CADASTROS` (`pedeSoAtivos`) em vez de deduzir pelo tipo.
- **Dívida registrada (não corrigida):** a chave `codigo_local:conta:linha` é montada à mão no SQL e no TS; os comentários "code-review item N" apontam para esta issue.

**Fechada em 26/11/2026.** Itens 5 a 10 corrigidos e em produção; CI verde no `64b6acc`.

## Critérios de aceite
- [x] Cada item com teste que falhou antes da correção.
- [x] `npm run check` verde no CI.
- [x] Itens 7 e 9 conferidos contra o banco/API reais.
