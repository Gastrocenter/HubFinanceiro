-- Teste S3 (issue 05): aplicar_plano_de_cadastro é idempotente, atômico e respeita o tipo.
-- Termina em erro de propósito (rollback): não deixa nada em de_para, entidades nem auditoria.
-- Resultado esperado: erro "TESTE_OK".
do $$
declare
  falhas text := '';
  n integer;
  plano_criar jsonb := '{"criar":[{"tipo":"profissional","codigoOrigem":"1","nome":"Ana Teste","ativo":true},
                                  {"tipo":"profissional","codigoOrigem":"2","nome":"Bruno Teste","ativo":true}]}';
begin
  perform public.aplicar_plano_de_cadastro('TESTE_S3', 'profissional', plano_criar);
  perform public.aplicar_plano_de_cadastro('TESTE_S3', 'profissional', plano_criar); -- de novo: não duplica

  select count(*) into n from public.de_para where empresa = 'TESTE_S3';
  if n <> 2 then falhas := falhas || ' DE_PARA_ESPERADO_2_VEIO_' || n; end if;
  select count(*) into n from public.profissionais p join public.de_para d on d.profissional_id = p.id where d.empresa = 'TESTE_S3';
  if n <> 2 then falhas := falhas || ' PROFISSIONAIS_ESPERADO_2_VEIO_' || n; end if;
  select count(*) into n from public.profissionais p join public.de_para d on d.profissional_id = p.id
   where d.empresa = 'TESTE_S3' and p.eh_medico is null and d.revisado_em is null;
  if n <> 2 then falhas := falhas || ' NOVOS_DEVEM_FICAR_A_REVISAR'; end if;

  perform public.aplicar_plano_de_cadastro('TESTE_S3', 'profissional',
    '{"atualizar":[{"codigoOrigem":"2","nome":"Bruno Souza Teste"}],"sumiram":["1"]}');
  select count(*) into n from public.profissionais p join public.de_para d on d.profissional_id = p.id
   where d.empresa = 'TESTE_S3' and d.codigo_origem = '2' and p.nome = 'Bruno Souza Teste' and d.nome_origem = 'Bruno Souza Teste';
  if n <> 1 then falhas := falhas || ' RENOMEAR_FALHOU'; end if;
  select count(*) into n from public.de_para where empresa = 'TESTE_S3' and codigo_origem = '1' and not visto_na_ultima_sync;
  if n <> 1 then falhas := falhas || ' SUMIU_NAO_MARCADO'; end if;
  select count(*) into n from public.auditoria where detalhes ->> 'empresa' = 'TESTE_S3';
  if n <> 4 then falhas := falhas || ' AUDITORIA_ESPERADO_4_VEIO_' || n; end if; -- 2 criados, 1 alterado, 1 sumiu

  -- O banco recusa de-para com o tipo errado (convênio apontando para profissional).
  begin
    insert into public.de_para (empresa, tipo, codigo_origem, nome_origem, profissional_id)
    select 'TESTE_S3', 'convenio', '99', 'x', id from public.profissionais limit 1;
    falhas := falhas || ' TIPO_ERRADO_ACEITO';
  exception when check_violation then null;
  end;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
