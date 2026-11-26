-- Issue 07 (revisão): resumo_repasses e a_repassar agrupam pelo profissional do cadastro; só quem não tem vínculo
-- agrupa pelo nome de origem. Antes, duas grafias ligadas ao mesmo cadastro viravam duas linhas com o mesmo nome.
-- A ordem (maior valor primeiro) sai daqui, em numeric exato: a tela não arredonda só para ordenar.
create or replace function public.resumo_repasses(p_mes text)
returns table (agrupamento text, numero_repasse text, data_repasse date, profissional_id bigint, nome text, eh_medico boolean,
               titulos bigint, linhas bigint, total_exato text, total_centavos text)
language sql
stable
set search_path = ''
as $$
  with base as (
    select t.*, p.nome as nome_cadastro, p.eh_medico,
           coalesce('id:' || t.profissional_id, 'nome:' || t.nome_profissional_origem) as grupo
      from public.titulos_repasse t left join public.profissionais p on p.id = t.profissional_id
     where t.mes = p_mes and t.ativo
  )
  select agrupamento, numero_repasse, data_repasse, profissional_id, nome, eh_medico, titulos, linhas, total_exato::text, total_centavos::text
    from (
      select 'total' as agrupamento, null::text as numero_repasse, null::date as data_repasse, null::bigint as profissional_id,
             'Total' as nome, null::boolean as eh_medico, count(*) as titulos, sum(linhas)::bigint as linhas,
             coalesce(sum(total_exato), 0) as total_exato, coalesce(sum(total_centavos), 0) as total_centavos
        from base
      union all
      select 'profissional', null, null, max(profissional_id), coalesce(max(nome_cadastro), max(nome_profissional_origem)),
             bool_and(eh_medico), count(*), sum(linhas)::bigint, sum(total_exato), sum(total_centavos)
        from base group by grupo
      union all
      select 'titulo', numero_repasse, data_repasse, profissional_id, coalesce(nome_cadastro, nome_profissional_origem), eh_medico,
             1, linhas, total_exato, total_centavos
        from base
    ) x
   order by total_centavos desc, total_exato desc, data_repasse, numero_repasse, nome;
$$;

create or replace function public.a_repassar()
returns table (profissional_id bigint, nome text, eh_medico boolean, procedimentos bigint, bruto text, mes_mais_antigo text)
language sql
stable
set search_path = ''
as $$
  select max(r.profissional_id), coalesce(max(p.nome), max(r.nome_profissional_origem)), bool_and(p.eh_medico), count(*),
         coalesce(sum(r.valor_total), 0)::text, min(r.mes)
    from public.recebiveis r
    left join public.profissionais p on p.id = r.profissional_id
   where r.visto_na_ultima_sync and not r.nao_repassar
     and not exists (select 1 from public.repasses rp where rp.recebivel_id = r.id and rp.visto_na_ultima_sync)
   group by coalesce('id:' || r.profissional_id, 'nome:' || r.nome_profissional_origem)
   order by coalesce(sum(r.valor_total), 0) desc;
$$;
