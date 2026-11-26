-- Testes S3 e S4 (issue 08). Termina em erro de propósito (rollback). Esperado: "TESTE_OK".
-- S3: integridade_das_exportacoes confere só o último job concluído de cada (rota, mês) nos 119 dias (D-D),
--     receita e repasse, e marca o que não bate. Job concluído sem página bruta também é conferido.
-- S4: resolver_pendencia fecha e audita na mesma transação, exige justificativa, recusa de-para e pendência fechada.
do $$
declare
  falhas text := '';
  n integer;
  t record;
  antigo bigint;
  novo bigint;
  fev bigint;
  velho bigint;
  rep bigint;
  pid bigint;
  pdp bigint;
  pnovo bigint;
  abr bigint;
  mai bigint;
  uid uuid;
  rota_proc text := '/api/v1/Exportacoes/ProcedimentosContasPacientes';
  rota_rep text := '/api/v1/Exportacoes/Repasses';
  corpo_jan jsonb := '{"periodo":{"dataInicial":"01/01/1999","dataFinal":"31/01/1999"}}';
begin
  -- Receita de jan/1999: um job antigo (só A) e um novo (A e B). O Hub tem A e B: só o novo conta.
  insert into public.sync_jobs (empresa, rota, corpo, caminho_da_lista, estado, concluido_em)
  values ('TESTE_C8', rota_proc, corpo_jan, 'exportacao.registros', 'concluido', now() - interval '2 days') returning id into antigo;
  insert into public.sync_jobs (empresa, rota, corpo, caminho_da_lista, estado, concluido_em)
  values ('TESTE_C8', rota_proc, corpo_jan, 'exportacao.registros', 'concluido', now() - interval '1 day') returning id into novo;
  insert into public.prodoctor_payload_bruto (job_id, empresa, rota, corpo_pedido, pagina, payload) values
    (antigo, 'TESTE_C8', rota_proc, corpo_jan, 1,
     '{"payload":{"exportacao":{"registros":[{"conta":"A","linha":"1","data":"1999-01-05","valorTotal":"100,00"}]}}}'),
    (novo, 'TESTE_C8', rota_proc, corpo_jan, 1,
     '{"payload":{"exportacao":{"registros":[{"conta":"A","linha":"1","data":"1999-01-05","valorTotal":"100,00"},
                                              {"conta":"B","linha":"1","data":"1999-01-06","valorTotal":"50,5"}]}}}');
  perform public.aplicar_mes_de_procedimentos('TESTE_C8', '1999-01', $j${"gravar":[
    {"codigo_local":"1","conta":"A","linha":"1","data":"1999-01-05","valor_total":"100"},
    {"codigo_local":"1","conta":"B","linha":"1","data":"1999-01-06","valor_total":"50.5"}]}$j$);

  -- Receita de fev/1999: o bruto tem C, o Hub não tem nada (o caso "concluído sem receita" da issue 06).
  insert into public.sync_jobs (empresa, rota, corpo, caminho_da_lista, estado, concluido_em)
  values ('TESTE_C8', rota_proc, '{"periodo":{"dataInicial":"01/02/1999","dataFinal":"28/02/1999"}}', 'exportacao.registros',
          'concluido', now() - interval '1 day') returning id into fev;
  insert into public.prodoctor_payload_bruto (job_id, empresa, rota, corpo_pedido, pagina, payload) values
    (fev, 'TESTE_C8', rota_proc, '{}', 1,
     '{"payload":{"exportacao":{"registros":[{"conta":"C","linha":"1","data":"1999-02-01","valorTotal":"10"}]}}}');

  -- Job concluído há 200 dias: fora da janela do expurgo, não é conferido.
  insert into public.sync_jobs (empresa, rota, corpo, caminho_da_lista, estado, concluido_em)
  values ('TESTE_C8', rota_proc, '{"periodo":{"dataInicial":"01/12/1998","dataFinal":"31/12/1998"}}', 'exportacao.registros',
          'concluido', now() - interval '200 days') returning id into velho;
  insert into public.prodoctor_payload_bruto (job_id, empresa, rota, corpo_pedido, pagina, payload) values
    (velho, 'TESTE_C8', rota_proc, '{}', 1, '{"payload":{"exportacao":{"registros":[{"conta":"Z","linha":"1","data":"1998-12-01","valorTotal":"1"}]}}}');

  -- Concluídos sem nenhuma página bruta: abril com receita no Hub (não bate) e maio vazio dos dois lados (bate).
  insert into public.sync_jobs (empresa, rota, corpo, caminho_da_lista, estado, concluido_em)
  values ('TESTE_C8', rota_proc, '{"periodo":{"dataInicial":"01/04/1999","dataFinal":"30/04/1999"}}', 'exportacao.registros',
          'concluido', now() - interval '1 day') returning id into abr;
  perform public.aplicar_mes_de_procedimentos('TESTE_C8', '1999-04', $j${"gravar":[
    {"codigo_local":"1","conta":"D","linha":"1","data":"1999-04-05","valor_total":"7"}]}$j$);
  insert into public.sync_jobs (empresa, rota, corpo, caminho_da_lista, estado, concluido_em)
  values ('TESTE_C8', rota_proc, '{"periodo":{"dataInicial":"01/05/1999","dataFinal":"31/05/1999"}}', 'exportacao.registros',
          'concluido', now() - interval '1 day') returning id into mai;

  -- Repasse de mar/1999 que bate: uma linha, um título.
  insert into public.sync_jobs (empresa, rota, corpo, caminho_da_lista, estado, concluido_em)
  values ('TESTE_C8', rota_rep, '{"periodo":{"dataInicial":"01/03/1999","dataFinal":"31/03/1999"}}', 'exportacao.registros',
          'concluido', now() - interval '1 day') returning id into rep;
  insert into public.prodoctor_payload_bruto (job_id, empresa, rota, corpo_pedido, pagina, payload) values
    (rep, 'TESTE_C8', rota_rep, '{}', 1,
     '{"payload":{"exportacao":{"registros":[{"codigoLocalProDoctor":"1","conta":"A","linha":"1","numeroRepasse":"L1",
       "nomeUsuario":"Dra. Teste","dataRepasse":"1999-03-10","valorRepassadoMedico":"88,244"}]}}}');
  perform public.aplicar_mes_de_repasses('TESTE_C8', '1999-03', $j${
    "gravar": [{"codigo_local":"1","conta":"A","linha":"1","numero_repasse":"L1","data_repasse":"1999-03-10","data":"1999-01-05",
                "nome_profissional_origem":"Dra. Teste","valor_repassado_medico":"88.244"}],
    "titulos": [{"numero_repasse":"L1","nome_profissional_origem":"Dra. Teste","data_repasse":"1999-03-10","linhas":1,
                 "total_exato":"88.244","total_centavos":8824}]}$j$);

  select count(*) into n from public.integridade_das_exportacoes() where empresa = 'TESTE_C8';
  if n <> 5 then falhas := falhas || ' ESPERADO_5_JOBS_VEIO_' || n; end if;
  select * into t from public.integridade_das_exportacoes() where job_id = abr;
  if coalesce(t.bate, true) or t.linhas_hub <> 1 then falhas := falhas || ' SEM_BRUTO_COM_HUB_DEVIA_NAO_BATER'; end if;
  select * into t from public.integridade_das_exportacoes() where job_id = mai;
  if not coalesce(t.bate, false) then falhas := falhas || ' MES_VAZIO_DEVIA_BATER'; end if;
  if exists (select 1 from public.integridade_das_exportacoes() where job_id in (antigo, velho)) then
    falhas := falhas || ' CONFERIU_JOB_ANTIGO_OU_FORA_DA_JANELA';
  end if;
  select * into t from public.integridade_das_exportacoes() where job_id = novo;
  if not coalesce(t.bate, false) or t.linhas_hub <> 2 or t.total_hub::numeric <> 150.5 then
    falhas := falhas || ' RECEITA_DE_JANEIRO_DEVIA_BATER';
  end if;
  select * into t from public.integridade_das_exportacoes() where job_id = fev;
  if coalesce(t.bate, true) or t.linhas_bruto <> 1 or t.linhas_hub <> 0 then falhas := falhas || ' FEVEREIRO_DEVIA_NAO_BATER'; end if;
  select * into t from public.integridade_das_exportacoes() where job_id = rep;
  if not coalesce(t.bate, false) or t.mes <> '1999-03' then falhas := falhas || ' REPASSE_DEVIA_BATER'; end if;

  -- Título faltando no repasse: deixa de bater.
  update public.titulos_repasse set ativo = false where empresa = 'TESTE_C8';
  select * into t from public.integridade_das_exportacoes() where job_id = rep;
  if coalesce(t.bate, true) then falhas := falhas || ' REPASSE_SEM_TITULO_DEVIA_NAO_BATER'; end if;

  -- S4: resolver pendência.
  select id into uid from auth.users order by created_at limit 1;
  insert into public.pendencias (tipo, empresa, referencia, descricao, detalhes)
  values ('procedimento_sumiu', 'TESTE_C8', '1:A:1', 'Procedimento sumiu do ProDoctor', '{"mes":"1999-01"}') returning id into pid;
  insert into public.pendencias (tipo, empresa, referencia, descricao, detalhes)
  values ('profissional_sem_par', 'TESTE_C8', 'Dra. Sem Par', 'Nome de profissional sem cadastro no de-para', '{}') returning id into pdp;
  insert into public.pendencias (tipo, empresa, referencia, descricao, detalhes)
  values ('especialidade_ambiguo', 'TESTE_C8', 'Gastro', 'Cadastro novo ambíguo', '{}') returning id into pnovo;

  begin
    perform public.resolver_pendencia(pid, uid, '   ');
    falhas := falhas || ' ACEITOU_SEM_JUSTIFICATIVA';
  exception when others then
    if sqlerrm not like '%justificativa%' then falhas := falhas || ' ERRO_ERRADO_SEM_JUSTIFICATIVA:' || sqlerrm; end if;
  end;
  begin
    perform public.resolver_pendencia(pdp, uid, 'Tentando fechar de-para');
    falhas := falhas || ' RESOLVEU_DE_PARA_A_MAO';
  exception when others then
    if sqlerrm not like '%cadastro%' then falhas := falhas || ' ERRO_ERRADO_DE_PARA:' || sqlerrm; end if;
  end;
  begin
    perform public.resolver_pendencia(pnovo, uid, 'Cadastro novo também é de-para');
    falhas := falhas || ' RESOLVEU_DE_PARA_NOVO_A_MAO';
  exception when others then
    if sqlerrm not like '%cadastro%' then falhas := falhas || ' ERRO_ERRADO_DE_PARA_NOVO:' || sqlerrm; end if;
  end;

  perform public.resolver_pendencia(pid, uid, '  Estorno conferido com o faturamento  ');
  select count(*) into n from public.pendencias
   where id = pid and estado = 'resolvida' and resolvido_por is not distinct from uid and resolvido_em is not null
     and justificativa = 'Estorno conferido com o faturamento';
  if n <> 1 then falhas := falhas || ' PENDENCIA_NAO_FECHOU'; end if;
  select count(*) into n from public.auditoria
   where acao = 'pendencia_resolvida' and entidade = 'pendencias' and entidade_id = pid::text
     and usuario_id is not distinct from uid and detalhes ->> 'justificativa' = 'Estorno conferido com o faturamento'
     and detalhes ->> 'tipo' = 'procedimento_sumiu';
  if n <> 1 then falhas := falhas || ' SEM_AUDITORIA'; end if;

  begin
    perform public.resolver_pendencia(pid, uid, 'De novo');
    falhas := falhas || ' RESOLVEU_DUAS_VEZES';
  exception when others then
    if sqlerrm not like '%aberta%' then falhas := falhas || ' ERRO_ERRADO_JA_FECHADA:' || sqlerrm; end if;
  end;
  select count(*) into n from public.auditoria where acao = 'pendencia_resolvida' and entidade_id = pid::text;
  if n <> 1 then falhas := falhas || ' AUDITORIA_DUPLICADA_' || n; end if;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
