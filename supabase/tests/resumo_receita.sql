-- Teste S7 (issue 06): resumo_receita soma exato, calcula o líquido e ignora linhas sumidas.
-- Termina em erro de propósito (rollback). Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  t record;
begin
  -- Mês fictício que não existe nos dados reais, para isolar o teste.
  perform public.aplicar_mes_de_procedimentos('TESTE_S7', '1999-01', $j${"gravar":[
    {"codigo_local":"1","conta":"A","linha":"1","data":"1999-01-05","valor_total":"0.1","valor_glosa":"0.05","valor_recuperado":"0.01"},
    {"codigo_local":"1","conta":"B","linha":"1","data":"1999-01-06","valor_total":"0.2"},
    {"codigo_local":"1","conta":"C","linha":"1","data":"1999-01-07","valor_total":"1000"}]}$j$);
  perform public.aplicar_mes_de_procedimentos('TESTE_S7', '1999-01', '{"sumiram":["1:C:1"]}');

  select * into t from public.resumo_receita('1999-01') where agrupamento = 'total';
  if t.linhas <> 2 then falhas := falhas || ' LINHAS_' || t.linhas; end if;
  if t.bruto::numeric <> 0.3 then falhas := falhas || ' BRUTO_' || t.bruto; end if; -- em float: 0.30000000000000004
  if t.glosa::numeric <> 0.05 then falhas := falhas || ' GLOSA_' || t.glosa; end if;
  if t.liquido::numeric <> 0.26 then falhas := falhas || ' LIQUIDO_' || t.liquido; end if;
  if not exists (select 1 from public.resumo_receita('1999-01') where agrupamento = 'profissional' and id is null) then
    falhas := falhas || ' SEM_GRUPO_SEM_VINCULO';
  end if;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
