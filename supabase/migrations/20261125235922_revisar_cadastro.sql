-- Issue 05: revisão de um cadastro na tela de de-para (D-J). Atômica e auditada.
create function public.revisar_cadastro(p_de_para_id bigint, p_usuario uuid, p_eh_medico boolean default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v public.de_para;
begin
  select * into v from public.de_para where id = p_de_para_id for update;
  if not found then raise exception 'de-para % não existe', p_de_para_id; end if;
  if v.tipo = 'profissional' and p_eh_medico is null then
    raise exception 'revisar profissional exige dizer se é médico';
  end if;
  if v.tipo <> 'profissional' and p_eh_medico is not null then
    raise exception 'só profissional tem marcação de médico';
  end if;

  if v.tipo = 'profissional' then
    update public.profissionais set eh_medico = p_eh_medico where id = v.profissional_id;
  end if;
  update public.de_para set revisado_em = now(), revisado_por = p_usuario, atualizado_em = now() where id = p_de_para_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, detalhes)
  values (p_usuario, 'cadastro_revisado', v.tipo::text, v.codigo_origem,
          jsonb_strip_nulls(jsonb_build_object('empresa', v.empresa, 'eh_medico', p_eh_medico)));
end;
$$;

revoke execute on function public.revisar_cadastro(bigint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.revisar_cadastro(bigint, uuid, boolean) to service_role;
