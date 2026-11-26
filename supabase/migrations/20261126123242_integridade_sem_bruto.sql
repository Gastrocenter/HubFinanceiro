-- Issue 08 (revisão): a integridade passa a conferir também o job concluído sem nenhuma página bruta (o
-- "concluído sem receita" da retro da issue 06 não pode sumir da checagem), com janela de 119 dias para nunca
-- pegar bruto já expurgado (o expurgo apaga o que tem mais de 120). De-para em resolver_pendencia passa a ser
-- pelo sufixo (_sem_par, _ambiguo), a mesma regra do painel: um cadastro novo nunca vira resolvível à mão.

create or replace function public.integridade_das_exportacoes()
returns table (empresa text, job_id bigint, rota text, mes text, concluido_em timestamptz, linhas_bruto bigint,
               linhas_hub bigint, total_bruto text, total_hub text, titulos_bruto bigint, titulos_hub bigint,
               total_titulos text, bate boolean)
language sql
stable
set search_path = ''
as $$
  with ultimos as (
    select distinct on (j.empresa, j.rota, m.mes) j.id, j.empresa, j.rota, m.mes, j.concluido_em
      from public.sync_jobs j
      cross join lateral (
        select substring(j.corpo -> 'periodo' ->> 'dataInicial' from 7 for 4) || '-' ||
               substring(j.corpo -> 'periodo' ->> 'dataInicial' from 4 for 2) as mes) m
     where j.estado = 'concluido'
       and j.concluido_em > now() - interval '119 days'
       and j.rota in ('/api/v1/Exportacoes/ProcedimentosContasPacientes', '/api/v1/Exportacoes/Repasses')
     order by j.empresa, j.rota, m.mes, j.concluido_em desc, j.id desc
  ),
  conferidos as (
    select u.id, u.empresa, u.rota, u.mes, u.concluido_em,
           case when u.rota = '/api/v1/Exportacoes/Repasses' then public.conferir_repasse_do_job(u.id)
                else public.conferir_receita_do_job(u.id) end as c
      from ultimos u
  )
  select x.empresa, x.id, x.rota, x.mes, x.concluido_em,
         (x.c ->> 'linhas_bruto')::bigint, (x.c ->> 'linhas_hub')::bigint, x.c ->> 'total_bruto', x.c ->> 'total_hub',
         (x.c ->> 'titulos_bruto')::bigint, (x.c ->> 'titulos_hub')::bigint, x.c ->> 'total_titulos',
         (x.c ->> 'linhas_bruto') = (x.c ->> 'linhas_hub')
           and (x.c ->> 'total_bruto')::numeric = (x.c ->> 'total_hub')::numeric
           -- Repasse: os títulos também batem com o bruto (quantidade e soma exata).
           and (not (x.c ? 'titulos_bruto')
                or ((x.c ->> 'titulos_bruto') = (x.c ->> 'titulos_hub')
                    and (x.c ->> 'total_titulos')::numeric = (x.c ->> 'total_bruto')::numeric))
    from conferidos x
   order by x.empresa, x.rota, x.mes desc;
$$;

-- S4: resolver uma pendência à mão (D-B). Fecha e grava a auditoria na mesma transação; exige justificativa;
-- de-para não fecha à mão (D-C): fecha sozinho quando o cadastro é corrigido.
create or replace function public.resolver_pendencia(p_id bigint, p_usuario uuid, p_justificativa text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v public.pendencias;
  v_justificativa text := btrim(coalesce(p_justificativa, ''));
begin
  if v_justificativa = '' then
    raise exception 'resolver pendência exige justificativa';
  end if;
  if length(v_justificativa) > 1000 then
    raise exception 'justificativa com mais de 1000 caracteres';
  end if;

  select * into v from public.pendencias where id = p_id for update;
  if not found then
    raise exception 'pendência % não existe', p_id;
  end if;
  if v.estado <> 'aberta' then
    raise exception 'pendência % não está aberta', p_id;
  end if;
  if v.tipo ~ '_(sem_par|ambiguo)$' then
    raise exception 'pendência de de-para fecha corrigindo o cadastro, não à mão';
  end if;

  update public.pendencias
     set estado = 'resolvida', resolvido_em = now(), resolvido_por = p_usuario, justificativa = v_justificativa
   where id = p_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, detalhes)
  values (p_usuario, 'pendencia_resolvida', 'pendencias', p_id::text,
          jsonb_build_object('tipo', v.tipo, 'empresa', v.empresa, 'referencia', v.referencia,
                             'justificativa', v_justificativa));
end;
$$;

