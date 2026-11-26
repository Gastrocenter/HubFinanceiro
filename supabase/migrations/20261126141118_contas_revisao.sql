-- Issue 08b (revisão): D-1 à prova de falha (lista fechada dos tipos que guardam nome), natureza pela situação,
-- totais da tela somados no banco (ADR-0004) e conferência que também pega situação desatualizada e conta de outro
-- mês de inclusão no bruto.

alter table public.contas_pagar_receber drop constraint contas_sem_dado_de_paciente;
-- Só fornecedor, convênio e prestador guardam nome, histórico e documento; qualquer outro tipo (paciente, vazio,
-- outra grafia) não guarda nada. A mesma lista está em TIPOS_COM_NOME (src/contas/ler-contas.ts).
alter table public.contas_pagar_receber add constraint contas_sem_dado_de_paciente check (
  tipo_cliente_fornecedor in ('Fornecedor', 'Convênio', 'Prestador de Serviço')
  or (cliente_fornecedor is null and historico is null and numero_documento is null));

-- Natureza da conta pela situação do ProDoctor (não pelo sinal do valor).
create function public.natureza_da_conta(p_situacao text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_situacao in ('PAGAR', 'PAGA') then 'pagar'
              when p_situacao in ('RECEBER', 'RECEBIDA') then 'receber'
              else 'outra' end;
$$;

create or replace function public.resumo_contas(p_mes text)
returns table (natureza text, situacao text, grupo text, nome_grupo text, contas bigint, valor text, efetivado text)
language sql
stable
set search_path = ''
as $$
  select public.natureza_da_conta(c.situacao), c.situacao, c.grupo_receita_despesa, c.nome_grupo_receita_despesa, count(*),
         sum(coalesce(c.debito_valor, 0) + coalesce(c.credito_valor, 0))::text,
         sum(coalesce(c.debito_valor_efetivacao, 0) + coalesce(c.credito_valor_efetivacao, 0))::text
    from public.contas_pagar_receber c
   where c.visto_na_ultima_sync and to_char(c.data_vencimento, 'YYYY-MM') = p_mes
   group by 1, 2, 3, 4
   order by 1, 2, sum(coalesce(c.debito_valor, 0) + coalesce(c.credito_valor, 0)) desc, 3;
$$;

-- Os quatro cartões da tela: em aberto pelo valor; pago e recebido pelo efetivado.
create function public.totais_contas(p_mes text)
returns table (a_pagar text, pago text, a_receber text, recebido text)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(coalesce(c.debito_valor, 0) + coalesce(c.credito_valor, 0)) filter (where c.situacao = 'PAGAR'), 0)::text,
         coalesce(sum(coalesce(c.debito_valor_efetivacao, 0) + coalesce(c.credito_valor_efetivacao, 0))
                    filter (where c.situacao = 'PAGA'), 0)::text,
         coalesce(sum(coalesce(c.debito_valor, 0) + coalesce(c.credito_valor, 0)) filter (where c.situacao = 'RECEBER'), 0)::text,
         coalesce(sum(coalesce(c.debito_valor_efetivacao, 0) + coalesce(c.credito_valor_efetivacao, 0))
                    filter (where c.situacao = 'RECEBIDA'), 0)::text
    from public.contas_pagar_receber c
   where c.visto_na_ultima_sync and to_char(c.data_vencimento, 'YYYY-MM') = p_mes;
$$;

create or replace function public.contas_a_pagar_do_mes(p_mes text)
returns table (codigo_local text, numero text, data_vencimento date, data_efetivacao date, situacao text,
               cliente_fornecedor text, nome_grupo text, valor text, efetivado text)
language sql
stable
set search_path = ''
as $$
  select c.codigo_local, c.numero, c.data_vencimento, c.data_efetivacao, c.situacao, c.cliente_fornecedor,
         c.nome_grupo_receita_despesa, c.debito_valor::text, c.debito_valor_efetivacao::text
    from public.contas_pagar_receber c
   where c.visto_na_ultima_sync and to_char(c.data_vencimento, 'YYYY-MM') = p_mes
     and public.natureza_da_conta(c.situacao) = 'pagar'
   order by c.data_vencimento, c.debito_valor desc, c.codigo_local, c.numero;
$$;

-- S6: além de linhas, crédito e débito, confere os valores efetivados (o que muda quando a conta é paga, D-3) e
-- conta as linhas do bruto de outro mês de inclusão (se o filtro do ProDoctor não fizer o esperado, não bate).
create or replace function public.conferir_contas_do_job(p_job_id bigint)
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
  todas as (
    select distinct on (l ->> 'codigoLocalProDoctor', l ->> 'numero') l
      from public.prodoctor_payload_bruto p
      join job on job.id = p.job_id
      cross join lateral jsonb_array_elements(p.payload -> 'payload' -> 'exportacao' -> 'registros') as l
     order by l ->> 'codigoLocalProDoctor', l ->> 'numero', p.pagina desc
  ),
  bruto as (
    select t.l from todas t join job on left(t.l ->> 'dataInclusao', 7) = job.mes
  ),
  hub as (
    select c.* from public.contas_pagar_receber c join job on c.empresa = job.empresa and c.mes = job.mes
     where c.visto_na_ultima_sync
  ),
  somas as (
    select
      (select coalesce(sum(replace(nullif(l ->> 'creditoValor', ''), ',', '.')::numeric), 0) from bruto) as credito_bruto,
      (select coalesce(sum(replace(nullif(l ->> 'debitoValor', ''), ',', '.')::numeric), 0) from bruto) as debito_bruto,
      (select coalesce(sum(replace(nullif(l ->> 'creditoValorEfetivacao', ''), ',', '.')::numeric), 0) from bruto)
        as credito_efetivado_bruto,
      (select coalesce(sum(replace(nullif(l ->> 'debitoValorEfetivacao', ''), ',', '.')::numeric), 0) from bruto)
        as debito_efetivado_bruto,
      (select coalesce(sum(credito_valor), 0) from hub) as credito_hub,
      (select coalesce(sum(debito_valor), 0) from hub) as debito_hub,
      (select coalesce(sum(credito_valor_efetivacao), 0) from hub) as credito_efetivado_hub,
      (select coalesce(sum(debito_valor_efetivacao), 0) from hub) as debito_efetivado_hub
  )
  select jsonb_build_object(
    'mes', (select mes from job),
    'linhas_bruto', (select count(*) from bruto),
    'linhas_hub', (select count(*) from hub),
    'linhas_fora_do_mes', (select count(*) from todas) - (select count(*) from bruto),
    -- Total = crédito + débito (o movimento do mês); crédito e débito também são conferidos separados.
    'total_bruto', (credito_bruto + debito_bruto)::text,
    'total_hub', (credito_hub + debito_hub)::text,
    'credito_bruto', credito_bruto::text, 'credito_hub', credito_hub::text,
    'debito_bruto', debito_bruto::text, 'debito_hub', debito_hub::text,
    'efetivado_bruto', (credito_efetivado_bruto + debito_efetivado_bruto)::text,
    'efetivado_hub', (credito_efetivado_hub + debito_efetivado_hub)::text
  ) from somas;
$$;

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
       and j.rota in ('/api/v1/Exportacoes/ProcedimentosContasPacientes', '/api/v1/Exportacoes/Repasses',
                      '/api/v1/Exportacoes/ContasPagarReceber')
     order by j.empresa, j.rota, m.mes, j.concluido_em desc, j.id desc
  ),
  conferidos as (
    select u.id, u.empresa, u.rota, u.mes, u.concluido_em,
           case u.rota
             when '/api/v1/Exportacoes/Repasses' then public.conferir_repasse_do_job(u.id)
             when '/api/v1/Exportacoes/ContasPagarReceber' then public.conferir_contas_do_job(u.id)
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
           -- Contas: crédito, débito e efetivado batem cada um, e nada do bruto é de outro mês de inclusão.
           and (not (x.c ? 'credito_bruto')
                or ((x.c ->> 'credito_bruto')::numeric = (x.c ->> 'credito_hub')::numeric
                    and (x.c ->> 'debito_bruto')::numeric = (x.c ->> 'debito_hub')::numeric
                    and (x.c ->> 'efetivado_bruto')::numeric = (x.c ->> 'efetivado_hub')::numeric
                    and (x.c ->> 'linhas_fora_do_mes')::bigint = 0))
    from conferidos x
   order by x.empresa, x.rota, x.mes desc;
$$;

revoke execute on function public.natureza_da_conta(text) from public, anon, authenticated;
grant execute on function public.natureza_da_conta(text) to service_role;
revoke execute on function public.totais_contas(text) from public, anon, authenticated;
grant execute on function public.totais_contas(text) to service_role;
