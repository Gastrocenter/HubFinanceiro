-- Teste S5 (issue 07): aplicar_mes_de_repasses é atômica e idempotente, guarda valores exatos, liga o repasse
-- ao recebível pela chave do procedimento, mantém os títulos do mês, marca estornos e cria pendências (D-W) sem
-- duplicar. Termina em erro de propósito (rollback). Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  n integer;
  v numeric;
  rid bigint;
  dif jsonb := $j${
    "gravar": [
      {"codigo_local":"1","conta":"A","linha":"1","numero_repasse":"L1","data_repasse":"1999-03-10","data":"1999-01-05",
       "nome_profissional_origem":"Dra. Teste","valor_repassado_medico":"88.24879999999999","percentual_imposto":"18"},
      {"codigo_local":"1","conta":"B","linha":"1","numero_repasse":"L1","data_repasse":"1999-03-10","data":"1999-01-06",
       "nome_profissional_origem":"Dra. Teste","valor_repassado_medico":"10"},
      {"codigo_local":"1","conta":"Z","linha":"1","numero_repasse":"L1","data_repasse":"1999-03-10","data":"1998-06-01",
       "nome_profissional_origem":"Dra. Teste","valor_repassado_medico":"1"}
    ],
    "titulos": [{"numero_repasse":"L1","nome_profissional_origem":"Dra. Teste","data_repasse":"1999-03-10","linhas":3,
                 "total_exato":"99.24879999999999","total_centavos":9925}]
  }$j$;
begin
  -- Procedimentos de jan/1999 no Hub: A existe; B não (é do mês carregado → pendência); Z é de mês não carregado.
  perform public.aplicar_mes_de_procedimentos('TESTE_R5', '1999-01', $j${"gravar":[
    {"codigo_local":"1","conta":"A","linha":"1","data":"1999-01-05","valor_total":"100"}]}$j$);

  perform public.aplicar_mes_de_repasses('TESTE_R5', '1999-03', dif);
  perform public.aplicar_mes_de_repasses('TESTE_R5', '1999-03', dif); -- de novo: não duplica

  select count(*) into n from public.repasses where empresa = 'TESTE_R5';
  if n <> 3 then falhas := falhas || ' REPASSES_ESPERADO_3_VEIO_' || n; end if;
  select valor_repassado_medico into v from public.repasses where empresa = 'TESTE_R5' and conta = 'A';
  if v <> 88.24879999999999 then falhas := falhas || ' VALOR_NAO_EXATO_' || v; end if;

  -- Vínculo nos dois sentidos.
  select id into rid from public.recebiveis where empresa = 'TESTE_R5' and conta = 'A';
  select count(*) into n from public.repasses where empresa = 'TESTE_R5' and conta = 'A' and recebivel_id = rid;
  if n <> 1 then falhas := falhas || ' REPASSE_NAO_LIGADO_AO_RECEBIVEL'; end if;

  select count(*) into n from public.titulos_repasse where empresa = 'TESTE_R5' and ativo and total_centavos = 9925 and linhas = 3;
  if n <> 1 then falhas := falhas || ' TITULO_ESPERADO_1_VEIO_' || n; end if;

  select count(*) into n from public.pendencias where empresa = 'TESTE_R5' and tipo = 'repasse_sem_procedimento' and estado = 'aberta';
  if n <> 1 then falhas := falhas || ' SEM_PROCEDIMENTO_ESPERADO_1_VEIO_' || n; end if;
  select count(*) into n from public.pendencias where empresa = 'TESTE_R5' and referencia = '1:Z:1';
  if n <> 0 then falhas := falhas || ' FORA_DA_JANELA_VIROU_PENDENCIA'; end if;

  -- O procedimento B chega depois: na próxima rodada o repasse liga e a pendência fecha.
  perform public.aplicar_mes_de_procedimentos('TESTE_R5', '1999-01', $j${"gravar":[
    {"codigo_local":"1","conta":"B","linha":"1","data":"1999-01-06","valor_total":"50"}]}$j$);
  -- Lote editado: A some (estorno), B muda de valor, o título muda e um título antigo do mês deixa de vir.
  perform public.aplicar_mes_de_repasses('TESTE_R5', '1999-03', $j${
    "gravar": [{"codigo_local":"1","conta":"B","linha":"1","numero_repasse":"L2","data_repasse":"1999-03-20","data":"1999-01-06",
                "nome_profissional_origem":"Dra. Teste","valor_repassado_medico":"12"}],
    "sumiram": ["1:A:1"],
    "titulos": [{"numero_repasse":"L2","nome_profissional_origem":"Dra. Teste","data_repasse":"1999-03-20","linhas":2,
                 "total_exato":"13","total_centavos":1300}]}$j$);

  select count(*) into n from public.repasses where empresa = 'TESTE_R5' and conta = 'B' and recebivel_id is not null;
  if n <> 1 then falhas := falhas || ' RECEBIVEL_TARDIO_NAO_LIGOU'; end if;
  select count(*) into n from public.pendencias where empresa = 'TESTE_R5' and tipo = 'repasse_sem_procedimento' and estado = 'aberta';
  if n <> 0 then falhas := falhas || ' PENDENCIA_SEM_PROCEDIMENTO_NAO_FECHOU'; end if;
  select count(*) into n from public.repasses where empresa = 'TESTE_R5' and conta = 'A' and not visto_na_ultima_sync;
  if n <> 1 then falhas := falhas || ' ESTORNO_NAO_MARCADO'; end if;
  select count(*) into n from public.pendencias where empresa = 'TESTE_R5' and tipo = 'repasse_sumiu' and referencia = '1:A:1';
  if n <> 1 then falhas := falhas || ' PENDENCIA_SUMIU_ESPERADO_1_VEIO_' || n; end if;
  select count(*) into n from public.titulos_repasse where empresa = 'TESTE_R5' and numero_repasse = 'L1' and not ativo;
  if n <> 1 then falhas := falhas || ' TITULO_ANTIGO_NAO_INATIVADO'; end if;
  select count(*) into n from public.titulos_repasse where empresa = 'TESTE_R5' and numero_repasse = 'L2' and ativo and total_centavos = 1300;
  if n <> 1 then falhas := falhas || ' TITULO_NOVO_AUSENTE'; end if;

  select count(*) into n from public.auditoria where acao = 'repasse_sincronizado' and detalhes ->> 'empresa' = 'TESTE_R5';
  if n < 1 then falhas := falhas || ' SEM_RESUMO_NA_AUDITORIA'; end if;

  -- Nenhuma coluna para dado de paciente.
  begin
    execute 'select nome_paciente from public.repasses limit 1';
    falhas := falhas || ' COLUNA_PACIENTE_EXISTE';
  exception when undefined_column then null;
  end;
  begin
    execute 'select prontuario from public.repasses limit 1';
    falhas := falhas || ' COLUNA_PRONTUARIO_EXISTE';
  exception when undefined_column then null;
  end;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
