-- Teste (issue 05): revisar_cadastro marca médico, registra quem revisou e audita; recusa revisão incoerente.
-- Termina em erro de propósito (rollback). Resultado esperado: erro "TESTE_OK".
do $$
declare
  falhas text := '';
  v_prof bigint;
  v_conv bigint;
  v_usuario uuid := (select id from auth.users order by created_at limit 1);
  n integer;
begin
  perform public.aplicar_plano_de_cadastro('TESTE_REV', 'profissional', '{"criar":[{"codigoOrigem":"1","nome":"Ana Teste","ativo":true}]}');
  perform public.aplicar_plano_de_cadastro('TESTE_REV', 'convenio', '{"criar":[{"codigoOrigem":"9","nome":"Plano Teste","ativo":true,"tipoConvenio":1}]}');
  select id into v_prof from public.de_para where empresa = 'TESTE_REV' and tipo = 'profissional';
  select id into v_conv from public.de_para where empresa = 'TESTE_REV' and tipo = 'convenio';

  perform public.revisar_cadastro(v_prof, v_usuario, true);
  select count(*) into n from public.de_para d join public.profissionais p on p.id = d.profissional_id
   where d.id = v_prof and p.eh_medico and d.revisado_por = v_usuario and d.revisado_em is not null;
  if n <> 1 then falhas := falhas || ' PROFISSIONAL_NAO_REVISADO'; end if;

  perform public.revisar_cadastro(v_conv, v_usuario);
  select count(*) into n from public.de_para where id = v_conv and revisado_em is not null;
  if n <> 1 then falhas := falhas || ' CONVENIO_NAO_REVISADO'; end if;

  select count(*) into n from public.auditoria where acao = 'cadastro_revisado' and usuario_id = v_usuario and detalhes ->> 'empresa' = 'TESTE_REV';
  if n <> 2 then falhas := falhas || ' AUDITORIA_ESPERADO_2_VEIO_' || n; end if;

  begin
    perform public.revisar_cadastro(v_prof, v_usuario, null);
    falhas := falhas || ' PROFISSIONAL_SEM_MARCACAO_ACEITO';
  exception when raise_exception then null;
  end;
  begin
    perform public.revisar_cadastro(v_conv, v_usuario, true);
    falhas := falhas || ' CONVENIO_COM_MARCACAO_ACEITO';
  exception when raise_exception then null;
  end;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
