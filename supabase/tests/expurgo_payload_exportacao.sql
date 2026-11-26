-- Teste S8 (issue 06): o expurgo apaga só exportação com mais de 120 dias; cadastro e exportação recente ficam.
-- Termina em erro de propósito (rollback). Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  v_job bigint;
  n integer;
begin
  insert into public.sync_jobs (empresa, rota, caminho_da_lista) values ('TESTE_S8', '/x', 'x') returning id into v_job;
  insert into public.prodoctor_payload_bruto (job_id, empresa, rota, corpo_pedido, pagina, payload, recebido_em) values
    (v_job, 'TESTE_S8', '/api/v1/Exportacoes/ProcedimentosContasPacientes', '{}', 1, '{}', now() - interval '121 days'),
    (v_job, 'TESTE_S8', '/api/v1/Exportacoes/ProcedimentosContasPacientes', '{}', 2, '{}', now() - interval '10 days'),
    (v_job, 'TESTE_S8', '/api/v1/Usuarios', '{}', 3, '{}', now() - interval '400 days');

  n := public.expurgar_payload_de_exportacao(120);
  if n < 1 then falhas := falhas || ' NADA_APAGADO'; end if;

  select count(*) into n from public.prodoctor_payload_bruto where job_id = v_job and pagina = 1;
  if n <> 0 then falhas := falhas || ' EXPORTACAO_ANTIGA_FICOU'; end if;
  select count(*) into n from public.prodoctor_payload_bruto where job_id = v_job and pagina = 2;
  if n <> 1 then falhas := falhas || ' EXPORTACAO_RECENTE_APAGADA'; end if;
  select count(*) into n from public.prodoctor_payload_bruto where job_id = v_job and pagina = 3;
  if n <> 1 then falhas := falhas || ' CADASTRO_APAGADO'; end if;

  begin
    perform public.expurgar_payload_de_exportacao(30);
    falhas := falhas || ' PRAZO_CURTO_ACEITO';
  exception when raise_exception then null;
  end;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
