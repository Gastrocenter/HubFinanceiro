-- Issue 06 (S7, D-R): totais de receita do mês por unidade e por profissional, somados em numeric exato.
-- Líquido = bruto - glosa + recuperado. Linhas que sumiram do ProDoctor ficam de fora. Valores em texto (ADR-0004).
create function public.resumo_receita(p_mes text)
returns table (agrupamento text, id bigint, nome text, eh_medico boolean, linhas bigint,
               bruto text, glosa text, recuperado text, liquido text)
language sql
stable
set search_path = ''
as $$
  with base as (
    select r.*, coalesce(r.valor_total, 0) as b, coalesce(r.valor_glosa, 0) as g, coalesce(r.valor_recuperado, 0) as rc
      from public.recebiveis r where r.mes = p_mes and r.visto_na_ultima_sync
  )
  select 'total', null::bigint, 'Total', null::boolean, count(*), sum(b)::text, sum(g)::text, sum(rc)::text, (sum(b) - sum(g) + sum(rc))::text
    from base
  union all
  select 'unidade', u.id, coalesce(u.nome, 'Sem unidade no de-para'), null, count(*), sum(b)::text, sum(g)::text, sum(rc)::text,
         (sum(b) - sum(g) + sum(rc))::text
    from base left join public.unidades u on u.id = base.unidade_id group by u.id, u.nome
  union all
  select 'profissional', p.id, coalesce(p.nome, 'Sem profissional no de-para'), p.eh_medico, count(*), sum(b)::text, sum(g)::text,
         sum(rc)::text, (sum(b) - sum(g) + sum(rc))::text
    from base left join public.profissionais p on p.id = base.profissional_id group by p.id, p.nome, p.eh_medico;
$$;

-- Meses que têm receita, do mais recente ao mais antigo.
create function public.meses_com_receita()
returns setof text
language sql
stable
set search_path = ''
as $$ select distinct mes from public.recebiveis order by mes desc $$;

revoke execute on function public.resumo_receita(text) from public, anon, authenticated;
revoke execute on function public.meses_com_receita() from public, anon, authenticated;
grant execute on function public.resumo_receita(text) to service_role;
grant execute on function public.meses_com_receita() to service_role;
