-- Teste (issue 10, item 7): procedimento que some de um mês e reaparece (em outro mês, ou no mesmo) fecha a
-- pendência procedimento_sumiu. Termina em erro de propósito (rollback). Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  n integer;
  m text;
begin
  -- A linha 1:A:1 está em setembro; na sync de setembro ela some (mudou de mês no ProDoctor).
  perform public.aplicar_mes_de_procedimentos('TESTE_I7', '2026-09',
    '{"gravar":[{"codigo_local":"1","conta":"A","linha":"1","data":"2026-09-30","valor_total":"100"},
                {"codigo_local":"1","conta":"B","linha":"1","data":"2026-09-15","valor_total":"50"}]}');
  perform public.aplicar_mes_de_procedimentos('TESTE_I7', '2026-09', '{"sumiram":["1:A:1","1:B:1"]}');
  -- Outra empresa com a mesma referência sumida: não pode ser tocada.
  perform public.aplicar_mes_de_procedimentos('TESTE_I7_OUTRA', '2026-09',
    '{"gravar":[{"codigo_local":"1","conta":"A","linha":"1","data":"2026-09-30","valor_total":"1"}]}');
  perform public.aplicar_mes_de_procedimentos('TESTE_I7_OUTRA', '2026-09', '{"sumiram":["1:A:1"]}');

  select count(*) into n from public.pendencias where empresa = 'TESTE_I7' and tipo = 'procedimento_sumiu' and estado = 'aberta';
  if n <> 2 then falhas := falhas || ' PRE_ESPERADO_2_ABERTAS_VEIO_' || n; end if;

  -- Outubro traz a linha 1:A:1 (agora com data de outubro): ela muda de mês e a pendência fecha.
  perform public.aplicar_mes_de_procedimentos('TESTE_I7', '2026-10',
    '{"gravar":[{"codigo_local":"1","conta":"A","linha":"1","data":"2026-10-01","valor_total":"100"}]}');
  select mes into m from public.recebiveis where empresa = 'TESTE_I7' and conta = 'A' and visto_na_ultima_sync;
  if m is distinct from '2026-10' then falhas := falhas || ' NAO_MUDOU_DE_MES_' || coalesce(m, 'null'); end if;
  select count(*) into n from public.pendencias
   where empresa = 'TESTE_I7' and tipo = 'procedimento_sumiu' and referencia = '1:A:1' and estado = 'resolvida' and resolvido_em is not null;
  if n <> 1 then falhas := falhas || ' MUDOU_DE_MES_PENDENCIA_NAO_RESOLVIDA'; end if;

  -- A linha 1:B:1 volta no próprio mês: a pendência também fecha.
  perform public.aplicar_mes_de_procedimentos('TESTE_I7', '2026-09', '{"voltaram":["1:B:1"]}');
  select count(*) into n from public.pendencias
   where empresa = 'TESTE_I7' and tipo = 'procedimento_sumiu' and referencia = '1:B:1' and estado = 'resolvida';
  if n <> 1 then falhas := falhas || ' VOLTOU_PENDENCIA_NAO_RESOLVIDA'; end if;

  -- A da outra empresa continua aberta.
  select count(*) into n from public.pendencias where empresa = 'TESTE_I7_OUTRA' and tipo = 'procedimento_sumiu' and estado = 'aberta';
  if n <> 1 then falhas := falhas || ' OUTRA_EMPRESA_TOCADA'; end if;

  -- Corrida (meses em paralelo): setembro calculou a diferença antes de outubro levar a linha 1:C:1. O "sumiram"
  -- de setembro não marca linha nenhuma (ela já está em outubro), então não pode abrir pendência.
  perform public.aplicar_mes_de_procedimentos('TESTE_I7', '2026-10',
    '{"gravar":[{"codigo_local":"1","conta":"C","linha":"1","data":"2026-10-02","valor_total":"70"}]}');
  perform public.aplicar_mes_de_procedimentos('TESTE_I7', '2026-09', '{"sumiram":["1:C:1"]}');
  select count(*) into n from public.pendencias where empresa = 'TESTE_I7' and referencia = '1:C:1';
  if n <> 0 then falhas := falhas || ' CORRIDA_ABRIU_PENDENCIA_FALSA'; end if;
  select count(*) into n from public.recebiveis where empresa = 'TESTE_I7' and conta = 'C' and mes = '2026-10' and visto_na_ultima_sync;
  if n <> 1 then falhas := falhas || ' CORRIDA_MEXEU_NA_LINHA'; end if;

  -- O fechamento conta no resumo da auditoria.
  select count(*) into n from public.auditoria
   where acao = 'receita_sincronizada' and detalhes ->> 'empresa' = 'TESTE_I7' and detalhes ->> 'mes' = '2026-10'
     and (detalhes ->> 'pendencias_resolvidas')::int = 1;
  if n <> 1 then falhas := falhas || ' RESOLUCAO_FORA_DA_AUDITORIA'; end if;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
