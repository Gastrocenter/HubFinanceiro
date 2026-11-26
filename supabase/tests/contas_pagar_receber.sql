-- Teste S4 (issue 08b): plano financeiro e contas a pagar/receber. Termina em erro de propósito (rollback).
-- Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  n integer;
  t record;
  jid bigint;
  rota text := '/api/v1/Exportacoes/ContasPagarReceber';
  v_contas jsonb := $j${"gravar": [
    {"codigo_local":"1","numero":"52001","lancamento_financeiro":"7001","data_inclusao":"1999-01-03","data_vencimento":"1999-02-05",
     "situacao":"PAGAR","tipo_cliente_fornecedor":"Fornecedor","cliente_fornecedor":"Fornecedor Teste","historico":"Material",
     "numero_documento":"NF-1","debito_valor":"1234.5","debito_valor_efetivacao":"0","credito_valor":"0","credito_valor_efetivacao":"0",
     "grupo_receita_despesa":"2.01","nome_grupo_receita_despesa":"Material"},
    {"codigo_local":"1","numero":"52002","lancamento_financeiro":"7002","data_inclusao":"1999-01-04","data_vencimento":"1999-01-04",
     "data_efetivacao":"1999-01-04","situacao":"RECEBIDA","tipo_cliente_fornecedor":"Paciente",
     "credito_valor":"350","credito_valor_efetivacao":"336.7","debito_valor":"0","debito_valor_efetivacao":"0","percentual_taxa":"3.8",
     "grupo_receita_despesa":"1.01","nome_grupo_receita_despesa":"Consultas"},
    {"codigo_local":"1","numero":"52003","data_inclusao":"1999-01-06","data_vencimento":"1999-02-10","situacao":"PAGAR",
     "tipo_cliente_fornecedor":"Fornecedor","cliente_fornecedor":"Fornecedor Zero","debito_valor":"0","credito_valor":"0"}
  ]}$j$;
begin
  -- Plano financeiro: grava, repetir não duplica, o que não veio fica não visto, e lista vazia é recusada.
  perform public.aplicar_plano_financeiro('TESTE_CP', 'grupo_receita_despesa',
    '[{"codigo":"1.01","nome":"Consultas","permite_lancamento":true},{"codigo":"2.01","nome":"Material","permite_lancamento":true}]');
  perform public.aplicar_plano_financeiro('TESTE_CP', 'grupo_receita_despesa', '[{"codigo":"1.01","nome":"Consultas particulares","permite_lancamento":true}]');
  select count(*) into n from public.plano_financeiro where empresa = 'TESTE_CP';
  if n <> 2 then falhas := falhas || ' PLANO_ESPERADO_2_VEIO_' || n; end if;
  select count(*) into n from public.plano_financeiro where empresa = 'TESTE_CP' and visto_na_ultima_sync and nome = 'Consultas particulares';
  if n <> 1 then falhas := falhas || ' PLANO_NAO_ATUALIZOU'; end if;
  select count(*) into n from public.plano_financeiro where empresa = 'TESTE_CP' and codigo = '2.01' and not visto_na_ultima_sync;
  if n <> 1 then falhas := falhas || ' PLANO_SUMIDO_NAO_MARCADO'; end if;
  begin
    perform public.aplicar_plano_financeiro('TESTE_CP', 'grupo_receita_despesa', '[]');
    falhas := falhas || ' PLANO_VAZIO_ACEITO';
  exception when others then
    if sqlerrm not like '%vazi%' then falhas := falhas || ' ERRO_ERRADO_PLANO_VAZIO:' || sqlerrm; end if;
  end;

  -- Contas: grava com valor exato, idempotente.
  perform public.aplicar_mes_de_contas('TESTE_CP', '1999-01', v_contas);
  perform public.aplicar_mes_de_contas('TESTE_CP', '1999-01', v_contas);
  select count(*) into n from public.contas_pagar_receber where empresa = 'TESTE_CP';
  if n <> 3 then falhas := falhas || ' CONTAS_ESPERADO_3_VEIO_' || n; end if;
  select count(*) into n from public.contas_pagar_receber where empresa = 'TESTE_CP' and numero = '52002' and credito_valor_efetivacao = 336.7;
  if n <> 1 then falhas := falhas || ' VALOR_NAO_EXATO'; end if;

  -- O banco recusa nome ou histórico de paciente, mesmo que o TypeScript erre (D-1).
  begin
    perform public.aplicar_mes_de_contas('TESTE_CP', '1999-01', $j${"gravar": [
      {"codigo_local":"1","numero":"52009","data_inclusao":"1999-01-05","situacao":"RECEBER","tipo_cliente_fornecedor":"Paciente",
       "cliente_fornecedor":"PACIENTE FICTICIO"}]}$j$);
    falhas := falhas || ' ACEITOU_NOME_DE_PACIENTE';
  exception when check_violation then null;
  end;
  -- Lista fechada (à prova de falha): outra grafia ou tipo vazio também não guarda nome.
  begin
    perform public.aplicar_mes_de_contas('TESTE_CP', '1999-01', $j${"gravar": [
      {"codigo_local":"1","numero":"52010","data_inclusao":"1999-01-05","situacao":"RECEBER","tipo_cliente_fornecedor":"PACIENTE",
       "historico":"Recebimento de PACIENTE FICTICIO"}]}$j$);
    falhas := falhas || ' ACEITOU_HISTORICO_COM_OUTRA_GRAFIA';
  exception when check_violation then null;
  end;

  -- Conta excluída no ProDoctor: marca, nunca apaga, vira pendência com o vencimento; voltar fecha a pendência.
  perform public.aplicar_mes_de_contas('TESTE_CP', '1999-01', '{"sumiram": ["1:52001"]}');
  select count(*) into n from public.contas_pagar_receber where empresa = 'TESTE_CP' and numero = '52001' and not visto_na_ultima_sync;
  if n <> 1 then falhas := falhas || ' SUMIU_NAO_MARCADO'; end if;
  select count(*) into n from public.pendencias
   where empresa = 'TESTE_CP' and tipo = 'conta_sumiu' and referencia = '1:52001' and estado = 'aberta' and detalhes ->> 'vencimento' = '1999-02-05';
  if n <> 1 then falhas := falhas || ' SEM_PENDENCIA_CONTA_SUMIU'; end if;
  perform public.aplicar_mes_de_contas('TESTE_CP', '1999-01', '{"voltaram": ["1:52001"]}');
  select count(*) into n from public.pendencias where empresa = 'TESTE_CP' and tipo = 'conta_sumiu' and estado = 'aberta';
  if n <> 0 then falhas := falhas || ' PENDENCIA_NAO_FECHOU_AO_VOLTAR'; end if;
  select count(*) into n from public.auditoria where acao = 'contas_sincronizadas' and detalhes ->> 'empresa' = 'TESTE_CP';
  if n < 1 then falhas := falhas || ' SEM_AUDITORIA'; end if;

  -- Resumo por vencimento: fevereiro tem a conta a pagar; janeiro, a recebida.
  select count(*) into n from public.resumo_contas('1999-02') where natureza = 'pagar' and situacao = 'PAGAR' and contas = 1 and valor::numeric = 1234.5;
  if n <> 1 then falhas := falhas || ' RESUMO_FEVEREIRO'; end if;
  select count(*) into n from public.resumo_contas('1999-01')
   where natureza = 'receber' and situacao = 'RECEBIDA' and valor::numeric = 350 and efetivado::numeric = 336.7;
  if n <> 1 then falhas := falhas || ' RESUMO_JANEIRO'; end if;
  select count(*) into n from public.contas_a_pagar_do_mes('1999-02') where numero = '52001' and cliente_fornecedor = 'Fornecedor Teste';
  if n <> 1 then falhas := falhas || ' LISTA_A_PAGAR'; end if;
  if not exists (select 1 from public.meses_com_contas() m where m = '1999-02') then falhas := falhas || ' SEM_MES'; end if;
  -- A natureza sai da situação: conta PAGAR com débito zero continua "a pagar".
  select coalesce(sum(contas), 0) into n from public.resumo_contas('1999-02') where natureza = 'pagar' and situacao = 'PAGAR';
  if n <> 2 then falhas := falhas || ' NATUREZA_PELA_SITUACAO_' || n; end if;
  select count(*) into n from public.contas_a_pagar_do_mes('1999-02') where numero = '52003';
  if n <> 1 then falhas := falhas || ' LISTA_A_PAGAR_SEM_A_DE_DEBITO_ZERO'; end if;
  -- Totais dos cartões, somados no banco (ADR-0004).
  select * into t from public.totais_contas('1999-02');
  if t.a_pagar::numeric <> 1234.5 or t.pago::numeric <> 0 or t.a_receber::numeric <> 0 or t.recebido::numeric <> 0 then
    falhas := falhas || ' TOTAIS_FEVEREIRO';
  end if;
  select * into t from public.totais_contas('1999-01');
  if t.recebido::numeric <> 336.7 then falhas := falhas || ' TOTAIS_JANEIRO_RECEBIDO_' || t.recebido; end if;

  -- Conferência do job contra o bruto (S6) e integridade da issue 08.
  insert into public.sync_jobs (empresa, rota, corpo, caminho_da_lista, estado, concluido_em)
  values ('TESTE_CP', rota, '{"periodo":{"dataInicial":"01/01/1999","dataFinal":"31/01/1999"}}', 'exportacao.registros',
          'concluido', now() - interval '1 hour') returning id into jid;
  insert into public.prodoctor_payload_bruto (job_id, empresa, rota, corpo_pedido, pagina, payload) values
    (jid, 'TESTE_CP', rota, '{}', 1, '{"payload":{"exportacao":{"registros":[
      {"codigoLocalProDoctor":"1","numero":"52001","dataInclusao":"1999-01-03","creditoValor":"0","debitoValor":"1234,5"},
      {"codigoLocalProDoctor":"1","numero":"52002","dataInclusao":"1999-01-04","creditoValor":"350","debitoValor":"0",
       "creditoValorEfetivacao":"336,7","debitoValorEfetivacao":"0"},
      {"codigoLocalProDoctor":"1","numero":"52003","dataInclusao":"1999-01-06","creditoValor":"0","debitoValor":"0"}]}}}');
  select * into t from public.integridade_das_exportacoes() where job_id = jid;
  if not coalesce(t.bate, false) or t.linhas_bruto <> 3 or t.linhas_hub <> 3 then falhas := falhas || ' CONTAS_DEVIAM_BATER'; end if;
  -- Situação desatualizada (o efetivado mudou no ProDoctor e não no Hub) não bate.
  update public.contas_pagar_receber set credito_valor_efetivacao = 0 where empresa = 'TESTE_CP' and numero = '52002';
  select * into t from public.integridade_das_exportacoes() where job_id = jid;
  if coalesce(t.bate, true) then falhas := falhas || ' EFETIVADO_DIFERENTE_DEVIA_NAO_BATER'; end if;
  update public.contas_pagar_receber set credito_valor_efetivacao = 336.7 where empresa = 'TESTE_CP' and numero = '52002';
  update public.contas_pagar_receber set debito_valor = 1234 where empresa = 'TESTE_CP' and numero = '52001';
  select * into t from public.integridade_das_exportacoes() where job_id = jid;
  if coalesce(t.bate, true) then falhas := falhas || ' DEBITO_DIFERENTE_DEVIA_NAO_BATER'; end if;
  update public.contas_pagar_receber set debito_valor = 1234.5 where empresa = 'TESTE_CP' and numero = '52001';
  -- Conta de outro mês de inclusão no bruto: o filtro do ProDoctor não fez o que se esperava; não bate.
  insert into public.prodoctor_payload_bruto (job_id, empresa, rota, corpo_pedido, pagina, payload) values
    (jid, 'TESTE_CP', rota, '{}', 2, '{"payload":{"exportacao":{"registros":[
      {"codigoLocalProDoctor":"1","numero":"52099","dataInclusao":"1998-12-30","creditoValor":"5","debitoValor":"0"}]}}}');
  select * into t from public.integridade_das_exportacoes() where job_id = jid;
  if coalesce(t.bate, true) then falhas := falhas || ' FORA_DO_MES_NO_BRUTO_DEVIA_NAO_BATER'; end if;

  -- Nenhuma coluna de funcionário nem bancária.
  for t in select unnest(array['usuario_inclusao', 'usuario_efetivacao', 'banco', 'agencia', 'conta_corrente', 'cheque']) as c loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contas_pagar_receber' and column_name = t.c) then
      falhas := falhas || ' COLUNA_PROIBIDA_' || t.c;
    end if;
  end loop;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
