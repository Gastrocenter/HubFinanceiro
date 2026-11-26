-- Issue 07 (S7): leitura da tela /repasses. Valores em texto (ADR-0004); só títulos ativos (lote estornado fica de fora).
-- agrupamento: 'total' | 'profissional' | 'titulo'. total_centavos soma os títulos já arredondados (o que será pago).
create function public.resumo_repasses(p_mes text)
returns table (agrupamento text, numero_repasse text, data_repasse date, profissional_id bigint, nome text, eh_medico boolean,
               titulos bigint, linhas bigint, total_exato text, total_centavos text)
language sql
stable
set search_path = ''
as $$
  with base as (
    select t.*, p.nome as nome_cadastro, p.eh_medico
      from public.titulos_repasse t left join public.profissionais p on p.id = t.profissional_id
     where t.mes = p_mes and t.ativo
  )
  select 'total', null::text, null::date, null::bigint, 'Total', null::boolean, count(*), sum(linhas)::bigint,
         coalesce(sum(total_exato), 0)::text, coalesce(sum(total_centavos), 0)::text
    from base
  union all
  select 'profissional', null, null, profissional_id, coalesce(max(nome_cadastro), nome_profissional_origem), bool_and(eh_medico),
         count(*), sum(linhas)::bigint, sum(total_exato)::text, sum(total_centavos)::text
    from base group by profissional_id, nome_profissional_origem
  union all
  select 'titulo', numero_repasse, data_repasse, profissional_id, coalesce(nome_cadastro, nome_profissional_origem), eh_medico,
         1, linhas, total_exato::text, total_centavos::text
    from base;
$$;

-- D-U: procedimentos ainda sem repasse, por profissional: quantidade e bruto do procedimento. O Hub não estima o repasse.
-- Fora: linha que sumiu do ProDoctor e procedimento marcado "não repassar".
create function public.a_repassar()
returns table (profissional_id bigint, nome text, eh_medico boolean, procedimentos bigint, bruto text, mes_mais_antigo text)
language sql
stable
set search_path = ''
as $$
  select r.profissional_id, coalesce(max(p.nome), r.nome_profissional_origem), bool_and(p.eh_medico), count(*),
         coalesce(sum(r.valor_total), 0)::text, min(r.mes)
    from public.recebiveis r
    left join public.profissionais p on p.id = r.profissional_id
   where r.visto_na_ultima_sync and not r.nao_repassar
     and not exists (select 1 from public.repasses rp where rp.recebivel_id = r.id and rp.visto_na_ultima_sync)
   group by r.profissional_id, r.nome_profissional_origem;
$$;

-- Meses (de data_repasse) com algum título ativo, do mais recente ao mais antigo.
create function public.meses_com_repasse()
returns setof text
language sql
stable
set search_path = ''
as $$ select distinct mes from public.titulos_repasse where ativo order by mes desc $$;

revoke execute on function public.resumo_repasses(text) from public, anon, authenticated;
revoke execute on function public.a_repassar() from public, anon, authenticated;
revoke execute on function public.meses_com_repasse() from public, anon, authenticated;
grant execute on function public.resumo_repasses(text) to service_role;
grant execute on function public.a_repassar() to service_role;
grant execute on function public.meses_com_repasse() to service_role;
