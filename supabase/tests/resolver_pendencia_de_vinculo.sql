-- Teste (code-review item 2): quando o nome passa a casar, a pendência "sem par" é resolvida na mesma transação.
-- Termina em erro de propósito (rollback). Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  n integer;
begin
  perform public.aplicar_mes_de_procedimentos('TESTE_REL', '1999-02', $j${
    "gravar": [{"codigo_local":"1","conta":"A","linha":"1","data":"1999-02-01","valor_total":"10","nome_profissional_origem":"Novo Teste"}],
    "pendencias": [{"tipo":"profissional_sem_par","referencia":"Novo Teste","descricao":"x"}]}$j$);

  perform public.aplicar_mes_de_procedimentos('TESTE_REL', '1999-02', $j${
    "resolver": [{"tipo":"profissional_sem_par","referencia":"Novo Teste"}, {"tipo":"convenio_sem_par","referencia":"Nenhum Aberto"}]}$j$);

  select count(*) into n from public.pendencias where empresa = 'TESTE_REL' and tipo = 'profissional_sem_par' and estado = 'resolvida' and resolvido_em is not null;
  if n <> 1 then falhas := falhas || ' NAO_RESOLVIDA'; end if;
  select count(*) into n from public.pendencias where empresa = 'TESTE_REL' and estado = 'aberta';
  if n <> 0 then falhas := falhas || ' AINDA_ABERTA_' || n; end if;
  select count(*) into n from public.auditoria where acao = 'receita_sincronizada' and detalhes ->> 'empresa' = 'TESTE_REL' and (detalhes ->> 'pendencias_resolvidas')::integer = 1;
  if n <> 1 then falhas := falhas || ' AUDITORIA_SEM_RESOLVIDAS'; end if;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
