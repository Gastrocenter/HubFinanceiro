-- Issue 06 / ADR-0005: apaga páginas brutas de EXPORTAÇÃO (trazem dados de paciente) com mais de p_dias.
-- Páginas de cadastro nunca são apagadas. Registra um resumo na auditoria quando apaga algo.
create function public.expurgar_payload_de_exportacao(p_dias integer default 120)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_apagadas integer;
begin
  if p_dias < 120 then
    raise exception 'expurgo com menos de 120 dias fere a janela de re-sync (ADR-0005): %', p_dias;
  end if;

  delete from public.prodoctor_payload_bruto
   where rota like '/api/v1/Exportacoes/%'
     and recebido_em < now() - make_interval(days => p_dias);
  get diagnostics v_apagadas = row_count;

  if v_apagadas > 0 then
    insert into public.auditoria (acao, entidade, detalhes)
    values ('payload_expurgado', 'prodoctor_payload_bruto', jsonb_build_object('paginas', v_apagadas, 'dias', p_dias));
  end if;
  return v_apagadas;
end;
$$;

revoke execute on function public.expurgar_payload_de_exportacao(integer) from public, anon, authenticated;
grant execute on function public.expurgar_payload_de_exportacao(integer) to service_role;
