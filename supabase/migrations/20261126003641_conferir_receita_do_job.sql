-- Issue 06 (S6) e 08 (F7): confere um job de procedimentos contra o Hub por um caminho independente do TypeScript.
-- Conta e soma direto do JSON bruto (parser do Postgres) e compara com recebiveis do mesmo mês. Só leitura.
create function public.conferir_receita_do_job(p_job_id bigint)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with job as (
    select id, empresa,
           substring(corpo -> 'periodo' ->> 'dataInicial' from 7 for 4) || '-' ||
           substring(corpo -> 'periodo' ->> 'dataInicial' from 4 for 2) as mes
      from public.sync_jobs where id = p_job_id
  ),
  bruto as (
    select l
      from public.prodoctor_payload_bruto p
      join job on job.id = p.job_id
      cross join lateral jsonb_array_elements(p.payload -> 'payload' -> 'exportacao' -> 'registros') as l
     where left(l ->> 'data', 7) = job.mes
  ),
  hub as (
    select r.* from public.recebiveis r join job on r.empresa = job.empresa and r.mes = job.mes
     where r.visto_na_ultima_sync
  )
  select jsonb_build_object(
    'mes', (select mes from job),
    'linhas_bruto', (select count(*) from bruto),
    'linhas_hub', (select count(*) from hub),
    'total_bruto', (select coalesce(sum(replace(l ->> 'valorTotal', ',', '.')::numeric), 0)::text
                      from bruto where coalesce(l ->> 'valorTotal', '') <> ''),
    'total_hub', (select coalesce(sum(valor_total), 0)::text from hub)
  );
$$;

revoke execute on function public.conferir_receita_do_job(bigint) from public, anon, authenticated;
grant execute on function public.conferir_receita_do_job(bigint) to service_role;
