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

## Critérios de aceite
- [ ] Cada item com teste que falhou antes da correção.
- [ ] `npm run check` verde no CI.
- [ ] Itens 7 e 9 conferidos contra o banco/API reais.
