-- Teste S3: a auditoria rejeita UPDATE, DELETE e TRUNCATE.
-- Roda tudo dentro de uma transação que termina em erro de propósito (rollback),
-- então não deixa linha nenhuma na tabela. Resultado esperado: erro "TESTE_OK".
do $$
declare
  falhas text := '';
begin
  insert into public.auditoria (acao) values ('teste_append_only');

  begin
    update public.auditoria set acao = 'adulterado';
    falhas := falhas || ' UPDATE_PERMITIDO';
  exception when others then
    if sqlerrm not like 'auditoria é append-only%' then falhas := falhas || ' UPDATE_ERRO_INESPERADO:' || sqlerrm; end if;
  end;

  begin
    delete from public.auditoria;
    falhas := falhas || ' DELETE_PERMITIDO';
  exception when others then
    if sqlerrm not like 'auditoria é append-only%' then falhas := falhas || ' DELETE_ERRO_INESPERADO:' || sqlerrm; end if;
  end;

  begin
    truncate public.auditoria;
    falhas := falhas || ' TRUNCATE_PERMITIDO';
  exception when others then
    if sqlerrm not like 'auditoria é append-only%' then falhas := falhas || ' TRUNCATE_ERRO_INESPERADO:' || sqlerrm; end if;
  end;

  if falhas <> '' then
    raise exception 'TESTE_FALHOU:%', falhas;
  end if;
  raise exception 'TESTE_OK';
end;
$$;
