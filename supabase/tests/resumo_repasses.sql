-- Teste S7 (issue 07): resumo_repasses soma os títulos ativos (exato e em centavos) por profissional e por lote;
-- a_repassar mostra quantidade e bruto dos procedimentos sem repasse (D-U), sem os marcados "não repassar".
-- Termina em erro de propósito (rollback). Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  t record;
  n integer;
  pid bigint;
begin
  perform public.aplicar_mes_de_procedimentos('TESTE_R7', '1999-01', $j${"gravar":[
    {"codigo_local":"1","conta":"A","linha":"1","data":"1999-01-05","valor_total":"100","nome_profissional_origem":"Dra. R7"},
    {"codigo_local":"1","conta":"B","linha":"1","data":"1999-01-06","valor_total":"0.1","nome_profissional_origem":"Dra. R7"},
    {"codigo_local":"1","conta":"C","linha":"1","data":"1999-01-07","valor_total":"0.2","nome_profissional_origem":"Dra. R7"},
    {"codigo_local":"1","conta":"D","linha":"1","data":"1999-01-08","valor_total":"999","nao_repassar":true}]}$j$);
  perform public.aplicar_mes_de_repasses('TESTE_R7', '1999-03', $j${
    "gravar": [{"codigo_local":"1","conta":"A","linha":"1","numero_repasse":"R7-1","data_repasse":"1999-03-10","data":"1999-01-05",
                "nome_profissional_origem":"Dra. R7","valor_repassado_medico":"88.244"}],
    "titulos": [
      {"numero_repasse":"R7-1","nome_profissional_origem":"Dra. R7","data_repasse":"1999-03-10","linhas":1,"total_exato":"88.244","total_centavos":8824},
      {"numero_repasse":"R7-2","nome_profissional_origem":"Dra. R7","data_repasse":"1999-03-20","linhas":1,"total_exato":"0.005","total_centavos":1}]}$j$);

  select * into t from public.resumo_repasses('1999-03') where agrupamento = 'total';
  if t.titulos <> 2 then falhas := falhas || ' TITULOS_' || t.titulos; end if;
  if t.total_exato::numeric <> 88.249 then falhas := falhas || ' TOTAL_EXATO_' || t.total_exato; end if;
  -- Soma dos títulos já arredondados (o que será pago), não o arredondamento da soma.
  if t.total_centavos::bigint <> 8825 then falhas := falhas || ' TOTAL_CENTAVOS_' || t.total_centavos; end if;
  select count(*) into n from public.resumo_repasses('1999-03') where agrupamento = 'titulo';
  if n <> 2 then falhas := falhas || ' LINHAS_DE_TITULO_' || n; end if;
  select count(*) into n from public.resumo_repasses('1999-03') where agrupamento = 'profissional' and nome = 'Dra. R7' and titulos = 2;
  if n <> 1 then falhas := falhas || ' SEM_GRUPO_DO_PROFISSIONAL'; end if;

  -- A repassar: B e C (0,1 + 0,2 exato), não A (repassado) nem D (não repassar).
  select procedimentos, bruto into t from public.a_repassar() where nome = 'Dra. R7';
  if t.procedimentos <> 2 then falhas := falhas || ' A_REPASSAR_QTD_' || t.procedimentos; end if;
  if t.bruto::numeric <> 0.3 then falhas := falhas || ' A_REPASSAR_BRUTO_' || t.bruto; end if;

  if not exists (select 1 from public.meses_com_repasse() m where m = '1999-03') then falhas := falhas || ' SEM_MES'; end if;

  -- Duas grafias de origem ligadas ao mesmo cadastro: uma linha só por profissional, nas duas telas.
  insert into public.profissionais (nome, eh_medico) values ('Profissional R7 Unico', true) returning id into pid;
  perform public.aplicar_mes_de_procedimentos('TESTE_R7', '1999-02', format($j${"gravar":[
    {"codigo_local":"1","conta":"E","linha":"1","data":"1999-02-01","valor_total":"10","nome_profissional_origem":"Grafia 1","profissional_id":%s},
    {"codigo_local":"1","conta":"F","linha":"1","data":"1999-02-02","valor_total":"20","nome_profissional_origem":"Grafia 2","profissional_id":%s}]}$j$, pid, pid)::jsonb);
  perform public.aplicar_mes_de_repasses('TESTE_R7', '1999-04', format($j${"titulos": [
    {"numero_repasse":"R7-3","nome_profissional_origem":"Grafia 1","profissional_id":%s,"data_repasse":"1999-04-10","linhas":1,"total_exato":"1","total_centavos":100},
    {"numero_repasse":"R7-3","nome_profissional_origem":"Grafia 2","profissional_id":%s,"data_repasse":"1999-04-10","linhas":1,"total_exato":"2","total_centavos":200}]}$j$, pid, pid)::jsonb);
  select count(*) into n from public.resumo_repasses('1999-04') where agrupamento = 'profissional';
  if n <> 1 then falhas := falhas || ' RESUMO_DIVIDIU_O_PROFISSIONAL_' || n; end if;
  select count(*) into n from public.resumo_repasses('1999-04') where agrupamento = 'profissional' and total_centavos = '300' and titulos = 2;
  if n <> 1 then falhas := falhas || ' RESUMO_TOTAL_DO_PROFISSIONAL'; end if;
  select count(*) into n from public.a_repassar() where profissional_id = pid;
  if n <> 1 then falhas := falhas || ' A_REPASSAR_DIVIDIU_O_PROFISSIONAL_' || n; end if;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
