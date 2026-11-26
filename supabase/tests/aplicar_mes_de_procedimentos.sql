-- Teste S5 (issue 06): aplicar_mes_de_procedimentos é idempotente, guarda valores exatos, marca sumidos
-- e cria pendências sem duplicar. Termina em erro de propósito (rollback). Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  n integer;
  v numeric;
  dif jsonb := $j${
    "gravar": [
      {"codigo_local":"1","conta":"A","linha":"1","data":"2026-10-10","valor_total":"123.45678901234567","valor_glosa":null},
      {"codigo_local":"1","conta":"B","linha":"1","data":"2026-10-11","valor_total":"100","nome_profissional_origem":"Sem Par Teste"}
    ],
    "pendencias": [{"tipo":"profissional_sem_par","referencia":"Sem Par Teste","descricao":"Profissional sem de-para"}]
  }$j$;
begin
  perform public.aplicar_mes_de_procedimentos('TESTE_S5', '2026-10', dif);
  perform public.aplicar_mes_de_procedimentos('TESTE_S5', '2026-10', dif); -- de novo: não duplica

  select count(*) into n from public.recebiveis where empresa = 'TESTE_S5';
  if n <> 2 then falhas := falhas || ' RECEBIVEIS_ESPERADO_2_VEIO_' || n; end if;
  select valor_total into v from public.recebiveis where empresa = 'TESTE_S5' and conta = 'A';
  if v <> 123.45678901234567 then falhas := falhas || ' VALOR_NAO_EXATO_' || v; end if;
  select count(*) into n from public.pendencias where empresa = 'TESTE_S5' and tipo = 'profissional_sem_par' and estado = 'aberta';
  if n <> 1 then falhas := falhas || ' PENDENCIA_NOME_ESPERADO_1_VEIO_' || n; end if;

  -- Glosa chegou na linha A; a linha B sumiu do ProDoctor.
  perform public.aplicar_mes_de_procedimentos('TESTE_S5', '2026-10', $j${
    "gravar": [{"codigo_local":"1","conta":"A","linha":"1","data":"2026-10-10","valor_total":"123.45678901234567","valor_glosa":"20"}],
    "sumiram": ["1:B:1"]}$j$);
  select valor_glosa into v from public.recebiveis where empresa = 'TESTE_S5' and conta = 'A';
  if v is distinct from 20 then falhas := falhas || ' GLOSA_NAO_ATUALIZADA'; end if;
  select count(*) into n from public.recebiveis where empresa = 'TESTE_S5' and conta = 'B' and not visto_na_ultima_sync;
  if n <> 1 then falhas := falhas || ' SUMIU_NAO_MARCADO'; end if;
  select count(*) into n from public.pendencias where empresa = 'TESTE_S5' and tipo = 'procedimento_sumiu' and referencia = '1:B:1';
  if n <> 1 then falhas := falhas || ' PENDENCIA_SUMIU_ESPERADO_1_VEIO_' || n; end if;

  -- Resumo por mês na auditoria: 3 aplicações mudaram algo? 1ª sim, 2ª grava de novo (upsert conta como gravado), 3ª sim.
  select count(*) into n from public.auditoria where acao = 'receita_sincronizada' and detalhes ->> 'empresa' = 'TESTE_S5';
  if n < 1 then falhas := falhas || ' SEM_RESUMO_NA_AUDITORIA'; end if;

  -- Não existe coluna para dado de paciente: o banco recusa.
  begin
    execute 'select paciente from public.recebiveis limit 1';
    falhas := falhas || ' COLUNA_PACIENTE_EXISTE';
  exception when undefined_column then null;
  end;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
