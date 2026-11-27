-- Teste S4 e S5 (issue 11): lista, totais e resumo por categoria com os filtros da página, e a pendência de item
-- sem categoria. Termina em erro de propósito (rollback). Esperado: "TESTE_OK".
-- Os dados são de 1999 (nenhuma conta real cai nesse período) e da empresa TESTE_CF.
do $$
declare
  falhas text := '';
  n integer;
  t record;
  v numeric;
  hoje date := '1999-03-15';
  sem_filtro text[] := '{}';
  cat_imposto bigint;
  lista text;
begin
  -- Plano: imposto (Stella e Sabin, mesmo item), um item sem categoria, receita de consulta, conta direto num grupo
  -- (sem item) e caixa (raiz 0).
  perform public.aplicar_mes_de_contas('TESTE_CF', '1999-03', $j${"gravar": [
    {"codigo_local":"1","numero":"9001","data_inclusao":"1999-03-01","data_vencimento":"1999-03-10","situacao":"PAGAR",
     "tipo_cliente_fornecedor":"Fornecedor","cliente_fornecedor":"Prefeitura Teste","debito_valor":"100.10",
     "grupo_receita_despesa":"1.02.007.0001","nome_grupo_receita_despesa":"ISSQN (STELLA)"},
    {"codigo_local":"1","numero":"9002","data_inclusao":"1999-03-02","data_vencimento":"1999-03-20","situacao":"PAGAR",
     "tipo_cliente_fornecedor":"Fornecedor","cliente_fornecedor":"Receita Teste","debito_valor":"200.20",
     "grupo_receita_despesa":"2.02.007.0001","nome_grupo_receita_despesa":"ISSQN (SABIN)"},
    {"codigo_local":"1","numero":"9003","data_inclusao":"1999-03-02","data_vencimento":"1999-03-05","data_efetivacao":"1999-03-06",
     "situacao":"PAGA","tipo_cliente_fornecedor":"Fornecedor","cliente_fornecedor":"Prefeitura Teste","debito_valor":"300.30",
     "debito_valor_efetivacao":"300.33","grupo_receita_despesa":"1.02.007.0001","nome_grupo_receita_despesa":"ISSQN (STELLA)"},
    {"codigo_local":"1","numero":"9004","data_inclusao":"1999-03-03","data_vencimento":"1999-03-11","situacao":"PAGAR",
     "tipo_cliente_fornecedor":"Fornecedor","cliente_fornecedor":"Fornecedor Sem Cat","debito_valor":"0.01",
     "grupo_receita_despesa":"3.02.099.0001","nome_grupo_receita_despesa":"Item Teste Sem Categoria (TNI)"},
    {"codigo_local":"1","numero":"9005","data_inclusao":"1999-03-04","data_vencimento":"1999-03-04","data_efetivacao":"1999-03-04",
     "situacao":"RECEBIDA","tipo_cliente_fornecedor":"Paciente","credito_valor":"350","credito_valor_efetivacao":"336.7",
     "grupo_receita_despesa":"1.01.002.0001","nome_grupo_receita_despesa":"Receitas Consultas (STELLA)"},
    {"codigo_local":"1","numero":"9006","data_inclusao":"1999-03-05","data_vencimento":"1999-03-25","situacao":"RECEBER",
     "tipo_cliente_fornecedor":"Convênio","cliente_fornecedor":"Convênio Teste","credito_valor":"10",
     "grupo_receita_despesa":"1.01.098","nome_grupo_receita_despesa":"Grupo Teste Sem Item"},
    {"codigo_local":"1","numero":"9007","data_inclusao":"1999-03-05","data_vencimento":"1999-03-05","situacao":"RECEBER",
     "tipo_cliente_fornecedor":"Fornecedor","credito_valor":"5","grupo_receita_despesa":"0",
     "nome_grupo_receita_despesa":"Caixa Teste"},
    {"codigo_local":"1","numero":"9008","data_inclusao":"1999-03-06","data_vencimento":"1999-03-12","situacao":"RECEBER",
     "tipo_cliente_fornecedor":"Fornecedor","cliente_fornecedor":"Reembolso Teste","credito_valor":"1",
     "grupo_receita_despesa":"1.02.007.0001","nome_grupo_receita_despesa":"ISSQN (STELLA)"}
  ]}$j$);
  insert into public.categoria_do_item (natureza, item, categoria_id)
  select 'receber', 'Receitas Consultas', id from public.categorias where natureza = 'receber' and nome = 'Consultas'
  on conflict (natureza, item) do nothing;
  select id into cat_imposto from public.categorias where natureza = 'pagar' and nome = 'Imposto';

  -- Aba: Stella (raízes 1 e 3), Sabin (2), Todas (inclui o caixa).
  select count(*) into n from public.listar_contas('pagar', 'stella', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if n <> 3 then falhas := falhas || ' ABA_STELLA_' || n; end if;
  select count(*) into n from public.listar_contas('pagar', 'sabin', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if n <> 1 then falhas := falhas || ' ABA_SABIN_' || n; end if;
  select count(*) into n from public.listar_contas('receber', 'stella', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if n <> 3 then falhas := falhas || ' ABA_STELLA_RECEBER_SEM_CAIXA_' || n; end if;
  select count(*) into n from public.listar_contas('receber', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if n <> 4 then falhas := falhas || ' ABA_TODAS_COM_CAIXA_' || n; end if;

  -- Um dia só, por tipo de data: só as contas daquele dia.
  select count(*) into n from public.listar_contas('pagar', 'todas', '1999-03-10', '1999-03-10', 'vencimento', sem_filtro, sem_filtro, null, hoje)
   where numero = '9001';
  if n <> 1 or (select count(*) from public.listar_contas('pagar', 'todas', '1999-03-10', '1999-03-10', 'vencimento', sem_filtro, sem_filtro, null, hoje)) <> 1 then
    falhas := falhas || ' UM_DIA_VENCIMENTO';
  end if;
  select string_agg(numero, ',' order by numero) into lista
    from public.listar_contas('pagar', 'todas', '1999-03-02', '1999-03-02', 'entrada', sem_filtro, sem_filtro, null, hoje);
  if lista is distinct from '9002,9003' then falhas := falhas || ' UM_DIA_ENTRADA_' || coalesce(lista, 'nada'); end if;
  select string_agg(numero, ',' order by numero) into lista
    from public.listar_contas('pagar', 'todas', '1999-03-06', '1999-03-06', 'efetivacao', sem_filtro, sem_filtro, null, hoje);
  if lista is distinct from '9003' then falhas := falhas || ' UM_DIA_EFETIVACAO_' || coalesce(lista, 'nada'); end if;
  select string_agg(numero, ',' order by numero) into lista
    from public.listar_contas('receber', 'todas', '1999-03-05', '1999-03-05', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if lista is distinct from '9007' then falhas := falhas || ' UM_DIA_VENCIMENTO_RECEBER_' || coalesce(lista, 'nada'); end if;
  select string_agg(numero, ',' order by numero) into lista
    from public.listar_contas('receber', 'todas', '1999-03-05', '1999-03-05', 'entrada', sem_filtro, sem_filtro, null, hoje);
  if lista is distinct from '9006,9007' then falhas := falhas || ' UM_DIA_ENTRADA_RECEBER_' || coalesce(lista, 'nada'); end if;
  select string_agg(numero, ',' order by numero) into lista
    from public.listar_contas('receber', 'todas', '1999-03-04', '1999-03-04', 'efetivacao', sem_filtro, sem_filtro, null, hoje);
  if lista is distinct from '9005' then falhas := falhas || ' UM_DIA_EFETIVACAO_RECEBER_' || coalesce(lista, 'nada'); end if;
  -- O dia só, por qualquer tipo de data, bate com a tabela (as contas de teste são as únicas de 1999).
  select count(*) into n from public.listar_contas('pagar', 'todas', '1999-03-02', '1999-03-02', 'entrada', sem_filtro, sem_filtro, null, hoje)
   where data_inclusao <> '1999-03-02';
  if n <> 0 then falhas := falhas || ' UM_DIA_ENTRADA_FORA_DO_DIA'; end if;

  -- Valor fora da lista é recusado, não vira lista vazia.
  begin
    perform public.listar_contas('pagar', 'unimed', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
    falhas := falhas || ' ABA_INVALIDA_ACEITA';
  exception when raise_exception then null;
  end;
  begin
    perform public.totais_contas_filtradas('pagar', 'todas', '1999-03-01', '1999-03-31', 'pagamento', sem_filtro, sem_filtro, null, hoje);
    falhas := falhas || ' TIPO_DE_DATA_INVALIDO_ACEITO';
  exception when raise_exception then null;
  end;
  begin
    perform public.resumo_por_categoria('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', '{paga}', sem_filtro, null, hoje);
    falhas := falhas || ' SITUACAO_INVALIDA_ACEITA';
  exception when raise_exception then null;
  end;
  begin
    perform public.listar_contas('pagar', 'todas', '1999-03-31', '1999-03-01', 'vencimento', sem_filtro, sem_filtro, null, hoje);
    falhas := falhas || ' PERIODO_INVERTIDO_ACEITO';
  exception when raise_exception then null;
  end;
  begin
    perform public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje, 'historico');
    falhas := falhas || ' ORDEM_INVALIDA_ACEITA';
  exception when raise_exception then null;
  end;

  -- Situação: vencida = em aberto com vencimento antes de hoje; várias combinam com OU.
  select string_agg(numero, ',' order by numero) into lista
    from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', '{vencida}', sem_filtro, null, hoje);
  if lista is distinct from '9001,9004' then falhas := falhas || ' VENCIDA_' || coalesce(lista, 'nada'); end if;
  select string_agg(numero, ',' order by numero) into lista
    from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', '{vencida,efetivada}', sem_filtro, null, hoje);
  if lista is distinct from '9001,9003,9004' then falhas := falhas || ' VENCIDA_OU_EFETIVADA_' || coalesce(lista, 'nada'); end if;
  select string_agg(numero, ',' order by numero) into lista
    from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', '{aberta}', sem_filtro, null, hoje);
  if lista is distinct from '9001,9002,9004' then falhas := falhas || ' ABERTA_' || coalesce(lista, 'nada'); end if;

  -- Categoria: mesmo item nas raízes cai na mesma categoria; "sem-categoria" pega o item sem ligação.
  select string_agg(numero, ',' order by numero) into lista
    from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, '{imposto}', null, hoje);
  if lista is distinct from '9001,9002,9003' then falhas := falhas || ' CATEGORIA_IMPOSTO_' || coalesce(lista, 'nada'); end if;
  select string_agg(numero, ',' order by numero) into lista
    from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, '{sem-categoria}', null, hoje);
  if lista is distinct from '9004' then falhas := falhas || ' SEM_CATEGORIA_' || coalesce(lista, 'nada'); end if;
  select count(*) into n from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, '{sem-categoria}', null, hoje)
   where categoria = 'Sem categoria' and categoria_id is null and item = 'Item Teste Sem Categoria';
  if n <> 1 then falhas := falhas || ' SEM_CATEGORIA_ROTULO'; end if;

  -- Fornecedor: trecho, sem diferenciar maiúsculas; % e _ são texto, não curinga.
  select count(*) into n from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, 'prefeitura', hoje);
  if n <> 2 then falhas := falhas || ' FORNECEDOR_' || n; end if;
  select count(*) into n from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, '%', hoje);
  if n <> 0 then falhas := falhas || ' FORNECEDOR_CURINGA_' || n; end if;

  -- Paciente aparece só como "Paciente" (ADR-0005).
  select count(*) into n from public.listar_contas('receber', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje)
   where numero = '9005' and fornecedor = 'Paciente' and categoria = 'Consultas' and categoria_slug = 'consultas';
  if n <> 1 then falhas := falhas || ' PACIENTE_OU_CATEGORIA_RECEBER'; end if;

  -- Ordem: por vencimento por padrão; por valor decrescente quando pedido.
  select string_agg(numero, ',' order by ordem) into lista
    from (select numero, row_number() over () ordem
            from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje)) x;
  if lista is distinct from '9003,9001,9004,9002' then falhas := falhas || ' ORDEM_PADRAO_' || coalesce(lista, 'nada'); end if;
  select string_agg(numero, ',' order by ordem) into lista
    from (select numero, row_number() over () ordem
            from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje,
                                      'valor', true)) x;
  if lista is distinct from '9003,9002,9001,9004' then falhas := falhas || ' ORDEM_VALOR_' || coalesce(lista, 'nada'); end if;
  select string_agg(numero, ',' order by ordem) into lista
    from (select numero, row_number() over () ordem
            from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje,
                                      'numero', true)) x;
  if lista is distinct from '9004,9003,9002,9001' then falhas := falhas || ' ORDEM_NUMERO_' || coalesce(lista, 'nada'); end if;

  -- Totais batem com a soma da lista, com os mesmos filtros, em numeric exato (ADR-0004).
  select * into t from public.totais_contas_filtradas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if t.contas <> 4 or t.em_aberto::numeric <> 300.31 or t.vencido::numeric <> 100.11 or t.efetivado::numeric <> 300.33 then
    falhas := falhas || format(' TOTAIS_%s_%s_%s_%s', t.contas, t.em_aberto, t.vencido, t.efetivado);
  end if;
  select coalesce(sum(valor::numeric) filter (where situacao in ('PAGAR', 'RECEBER')), 0) into v
    from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if v <> t.em_aberto::numeric then falhas := falhas || ' TOTAL_EM_ABERTO_NAO_BATE_COM_LISTA'; end if;
  select coalesce(sum(valor::numeric) filter (where vencida), 0) into v
    from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if v <> t.vencido::numeric then falhas := falhas || ' TOTAL_VENCIDO_NAO_BATE_COM_LISTA'; end if;
  select coalesce(sum(efetivado::numeric) filter (where situacao in ('PAGA', 'RECEBIDA')), 0) into v
    from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if v <> t.efetivado::numeric then falhas := falhas || ' TOTAL_EFETIVADO_NAO_BATE_COM_LISTA'; end if;
  select * into t from public.totais_contas_filtradas('pagar', 'stella', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, '{imposto}', null, hoje);
  if t.contas <> 2 or t.em_aberto::numeric <> 100.10 or t.efetivado::numeric <> 300.33 then falhas := falhas || ' TOTAIS_FILTRADOS'; end if;
  select * into t from public.totais_contas_filtradas('pagar', 'todas', '1998-01-01', '1998-01-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if t.contas <> 0 or t.em_aberto::numeric <> 0 or t.vencido::numeric <> 0 or t.efetivado::numeric <> 0 then falhas := falhas || ' TOTAIS_VAZIOS'; end if;

  -- Resumo por categoria: dois níveis, categoria → item sem sufixo; a categoria soma os itens.
  select * into t from public.resumo_por_categoria('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje)
   where categoria_slug = 'imposto' and item is null;
  if t.contas is distinct from 3::bigint or t.em_aberto::numeric <> 300.30 or t.efetivado::numeric <> 300.33 then falhas := falhas || ' RESUMO_IMPOSTO'; end if;
  select count(*) into n from public.resumo_por_categoria('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje)
   where categoria_slug = 'imposto' and item = 'ISSQN' and contas = 3;
  if n <> 1 then falhas := falhas || ' RESUMO_ITEM_SEM_SUFIXO'; end if;
  select count(*) into n from public.resumo_por_categoria('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje)
   where categoria_slug = 'sem-categoria' and categoria = 'Sem categoria';
  if n <> 2 then falhas := falhas || ' RESUMO_SEM_CATEGORIA_' || n; end if;
  select coalesce(sum(em_aberto::numeric), 0) into v
    from public.resumo_por_categoria('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje) where item is null;
  if v <> 300.31 then falhas := falhas || ' RESUMO_NAO_BATE_COM_TOTAIS_' || v; end if;
  -- "Sem categoria" vem por último.
  select categoria_slug into lista
    from public.resumo_por_categoria('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje)
   order by ordem desc limit 1;
  if lista is distinct from 'sem-categoria' then falhas := falhas || ' RESUMO_SEM_CATEGORIA_NAO_E_ULTIMA'; end if;
  -- Conta a receber em item de despesa aparece em "a receber" com a categoria da despesa (D-3), depois das categorias
  -- a receber e antes de "Sem categoria".
  select string_agg(coalesce(categoria_slug, '') || '/' || coalesce(item, ''), ',' order by ordem) into lista
    from public.resumo_por_categoria('receber', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, sem_filtro, null, hoje);
  if lista is distinct from
     'consultas/,consultas/Receitas Consultas,imposto/,imposto/ISSQN,sem-categoria/,sem-categoria/Caixa Teste,sem-categoria/Grupo Teste Sem Item' then
    falhas := falhas || ' RESUMO_RECEBER_ORDEM_' || coalesce(lista, 'nada');
  end if;

  -- Slug: nome sem acento; dois nomes com o mesmo slug na mesma natureza são recusados; "sem-categoria" é reservado.
  if public.slug_da_categoria('Manutenção e exames') <> 'manutencao-e-exames' or public.slug_da_categoria(' pH-metria ') <> 'ph-metria' then
    falhas := falhas || ' SLUG';
  end if;
  begin
    insert into public.categorias (natureza, nome) values ('pagar', 'IMPOSTO');
    falhas := falhas || ' SLUG_REPETIDO_ACEITO';
  exception when unique_violation then null;
  end;
  begin
    insert into public.categorias (natureza, nome) values ('pagar', 'Sem Categoria');
    falhas := falhas || ' SLUG_RESERVADO_ACEITO';
  exception when check_violation then null;
  end;

  -- S5: item sem categoria vira pendência "a revisar"; raiz 0 (caixa) fica fora; conta direto no grupo conta como item.
  perform public.conferir_itens_sem_categoria();
  if public.conferir_itens_sem_categoria() <> '{"novas": 0, "resolvidas": 0}'::jsonb then
    falhas := falhas || ' SEGUNDA_RODADA_MUDOU_ALGO';
  end if;
  select count(*) into n from public.pendencias
   where tipo = 'item_sem_categoria' and empresa = 'TESTE_CF' and estado = 'aberta';
  if n <> 2 then falhas := falhas || ' PENDENCIAS_ESPERADO_2_VEIO_' || n; end if;
  select count(*) into n from public.pendencias
   where tipo = 'item_sem_categoria' and empresa = 'TESTE_CF' and estado = 'aberta' and referencia = 'pagar:Item Teste Sem Categoria'
     and detalhes ->> 'natureza' = 'pagar' and detalhes ->> 'item' = 'Item Teste Sem Categoria';
  if n <> 1 then falhas := falhas || ' PENDENCIA_ITEM'; end if;
  select count(*) into n from public.pendencias
   where tipo = 'item_sem_categoria' and empresa = 'TESTE_CF' and estado = 'aberta' and referencia = 'receber:Grupo Teste Sem Item';
  if n <> 1 then falhas := falhas || ' PENDENCIA_GRUPO_SEM_ITEM'; end if;
  select count(*) into n from public.pendencias
   where tipo = 'item_sem_categoria' and empresa = 'TESTE_CF' and referencia like '%Caixa Teste%';
  if n <> 0 then falhas := falhas || ' PENDENCIA_DO_CAIXA'; end if;

  -- Não se resolve à mão: fecha sozinha quando o item ganha categoria.
  begin
    perform public.resolver_pendencia(
      (select id from public.pendencias where tipo = 'item_sem_categoria' and empresa = 'TESTE_CF' and estado = 'aberta' limit 1),
      null, 'tentativa');
    falhas := falhas || ' RESOLVEU_A_MAO';
  exception when others then
    if sqlerrm not like '%categoria%' then falhas := falhas || ' ERRO_ERRADO_A_MAO:' || sqlerrm; end if;
  end;
  insert into public.categoria_do_item (natureza, item, categoria_id) values ('pagar', 'Item Teste Sem Categoria', cat_imposto);
  perform public.conferir_itens_sem_categoria();
  select count(*) into n from public.pendencias
   where tipo = 'item_sem_categoria' and empresa = 'TESTE_CF' and referencia = 'pagar:Item Teste Sem Categoria' and estado = 'resolvida'
     and resolvido_em is not null and resolvido_por is null;
  if n <> 1 then falhas := falhas || ' NAO_RESOLVEU_AO_GANHAR_CATEGORIA'; end if;
  select count(*) into n from public.pendencias
   where tipo = 'item_sem_categoria' and empresa = 'TESTE_CF' and estado = 'aberta';
  if n <> 1 then falhas := falhas || ' RESOLVEU_DEMAIS_' || n; end if;
  perform public.conferir_itens_sem_categoria();
  select count(*) into n from public.pendencias where tipo = 'item_sem_categoria' and empresa = 'TESTE_CF';
  if n <> 2 then falhas := falhas || ' REABRIU_OU_DUPLICOU_' || n; end if;
  select count(*) into n from public.listar_contas('pagar', 'todas', '1999-03-01', '1999-03-31', 'vencimento', sem_filtro, '{sem-categoria}', null, hoje);
  if n <> 0 then falhas := falhas || ' LISTA_NAO_VIU_A_CATEGORIA_NOVA'; end if;
  -- Perdeu a categoria de novo: abre outra pendência (a resolvida fica no histórico).
  delete from public.categoria_do_item where natureza = 'pagar' and item = 'Item Teste Sem Categoria';
  perform public.conferir_itens_sem_categoria();
  select count(*) into n from public.pendencias
   where tipo = 'item_sem_categoria' and empresa = 'TESTE_CF' and referencia = 'pagar:Item Teste Sem Categoria' and estado = 'aberta';
  if n <> 1 then falhas := falhas || ' NAO_REABRIU_AO_PERDER_CATEGORIA'; end if;

  -- Fechadas ao navegador.
  for t in select unnest(array['listar_contas', 'totais_contas_filtradas', 'resumo_por_categoria', 'contas_filtradas',
                               'conferir_itens_sem_categoria', 'slug_da_categoria']) as f loop
    if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = t.f
                 and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))) then
      falhas := falhas || ' ABERTA_AO_NAVEGADOR_' || t.f;
    end if;
  end loop;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
