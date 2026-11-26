-- Teste (code-review item 1): erro passageiro não volta a ser pego na mesma hora; a espera dobra a cada falha.
-- Termina em erro de propósito (rollback). Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  v_job bigint;
  v_espera1 interval;
  v_espera2 interval;
  pegos bigint[];
begin
  insert into public.sync_jobs (empresa, rota, caminho_da_lista, estado, criado_em)
  values ('TESTE_ESPERA', '/x', 'x', 'executando', '2000-01-01') returning id into v_job;

  perform public.registrar_erro_job(v_job, '503', false);
  select disponivel_em - now() into v_espera1 from public.sync_jobs where id = v_job;
  if v_espera1 is null or v_espera1 < interval '4 minutes' then falhas := falhas || ' SEM_ESPERA_' || coalesce(v_espera1::text, 'null'); end if;

  select array_agg(id) into pegos from public.reivindicar_proximo_job(60);
  if v_job = any(coalesce(pegos, '{}')) then falhas := falhas || ' PEGO_ANTES_DA_ESPERA'; end if;

  update public.sync_jobs set disponivel_em = now() - interval '1 second' where id = v_job;
  -- Pode haver outros jobs pendentes reais mais antigos: pega até achar o de teste (máx. 50).
  for i in 1..50 loop
    select array_agg(id) into pegos from public.reivindicar_proximo_job(60);
    exit when pegos is null or v_job = any(pegos);
  end loop;
  if pegos is null or not v_job = any(pegos) then falhas := falhas || ' NAO_PEGO_DEPOIS_DA_ESPERA'; end if;

  perform public.registrar_erro_job(v_job, '503', false);
  select disponivel_em - now() into v_espera2 from public.sync_jobs where id = v_job;
  if v_espera2 < v_espera1 * 1.9 then falhas := falhas || ' ESPERA_NAO_DOBROU_' || v_espera1 || '_' || v_espera2; end if;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
