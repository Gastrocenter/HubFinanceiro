-- Issue 08b: contas a pagar/receber do ProDoctor, só leitura, e o plano financeiro (grupos de receita/despesa e
-- contas contábeis), filtro obrigatório da exportação (D-4). Sem dado de paciente, de funcionário nem bancário (D-1).

create table public.plano_financeiro (
  id bigint generated always as identity primary key,
  empresa text not null,
  tipo text not null check (tipo in ('grupo_receita_despesa', 'conta_contabil')),
  -- Texto: "1.01.02.003".
  codigo text not null,
  nome text not null default '',
  permite_lancamento boolean not null default false,
  inclui_balancete boolean not null default false,
  estado_registro integer,
  visto_na_ultima_sync boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa, tipo, codigo)
);

create table public.contas_pagar_receber (
  id bigint generated always as identity primary key,
  empresa text not null,
  codigo_local text not null,
  numero text not null,
  -- Mês da data de inclusão: o escopo de cada job (D-2).
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  unidade_id bigint references public.unidades (id) on delete restrict,
  lancamento_financeiro text not null default '',
  conta_pagar_receber_pai text not null default '',
  data_inclusao date not null,
  data_efetivacao date,
  data_vencimento date,
  data_compensacao date,
  situacao text not null default '',
  tipo_cliente_fornecedor text not null default '',
  cliente_fornecedor text,
  historico text,
  numero_documento text,
  credito_valor numeric,
  credito_valor_efetivacao numeric,
  debito_valor numeric,
  debito_valor_efetivacao numeric,
  percentual_taxa numeric,
  grupo_receita_despesa text not null default '',
  nome_grupo_receita_despesa text not null default '',
  conta_contabil text not null default '',
  nome_conta_contabil text not null default '',
  conta_contabil_efetivacao text not null default '',
  nome_conta_contabil_efetivacao text not null default '',
  forma_efetivacao text not null default '',
  conta text not null default '',
  fatura text not null default '',
  num_repasse text not null default '',
  visto_na_ultima_sync boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa, codigo_local, numero),
  -- D-1 no banco também: de paciente, nada de nome, histórico ou documento, mesmo que o código erre.
  constraint contas_sem_dado_de_paciente check (
    tipo_cliente_fornecedor <> 'Paciente' or (cliente_fornecedor is null and historico is null and numero_documento is null))
);

create index contas_pagar_receber_empresa_mes_idx on public.contas_pagar_receber (empresa, mes);
create index contas_pagar_receber_vencimento_idx on public.contas_pagar_receber (empresa, data_vencimento);
create index contas_pagar_receber_unidade_id_idx on public.contas_pagar_receber (unidade_id);

-- Aplica a lista inteira de um tipo do plano financeiro. Idempotente. O que não veio fica não visto (nunca apagado).
-- Lista vazia é recusada: quase certamente falha, não exclusão em massa.
create function public.aplicar_plano_financeiro(p_empresa text, p_tipo text, p_itens jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_gravados integer;
  v_sumiram integer;
begin
  if jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) = 0 then
    raise exception 'plano financeiro (%) veio vazio do ProDoctor: recusado', p_tipo;
  end if;

  insert into public.plano_financeiro (empresa, tipo, codigo, nome, permite_lancamento, inclui_balancete, estado_registro,
                                       visto_na_ultima_sync)
  select p_empresa, p_tipo, x.codigo, coalesce(x.nome, ''), coalesce(x.permite_lancamento, false),
         coalesce(x.inclui_balancete, false), x.estado_registro, true
    from jsonb_to_recordset(p_itens)
         as x(codigo text, nome text, permite_lancamento boolean, inclui_balancete boolean, estado_registro integer)
  on conflict (empresa, tipo, codigo) do update set
    nome = excluded.nome, permite_lancamento = excluded.permite_lancamento, inclui_balancete = excluded.inclui_balancete,
    estado_registro = excluded.estado_registro, visto_na_ultima_sync = true, atualizado_em = now()
  where (public.plano_financeiro.nome, public.plano_financeiro.permite_lancamento, public.plano_financeiro.inclui_balancete,
         public.plano_financeiro.estado_registro, public.plano_financeiro.visto_na_ultima_sync)
        is distinct from (excluded.nome, excluded.permite_lancamento, excluded.inclui_balancete, excluded.estado_registro, true);
  get diagnostics v_gravados = row_count;

  update public.plano_financeiro p set visto_na_ultima_sync = false, atualizado_em = now()
   where p.empresa = p_empresa and p.tipo = p_tipo and p.visto_na_ultima_sync
     and not exists (select 1 from jsonb_to_recordset(p_itens) as x(codigo text) where x.codigo = p.codigo);
  get diagnostics v_sumiram = row_count;

  if v_gravados + v_sumiram > 0 then
    insert into public.auditoria (acao, entidade, entidade_id, detalhes)
    values ('plano_financeiro_sincronizado', 'plano_financeiro', p_empresa || ':' || p_tipo,
            jsonb_build_object('empresa', p_empresa, 'tipo', p_tipo, 'gravados', v_gravados, 'sumiram', v_sumiram));
  end if;
end;
$$;

-- Aplica um mês de inclusão de contas numa transação só. Idempotente.
-- p_diferenca: {gravar: [linha...], sumiram: [chave...], voltaram: [chave...]}; chave = "codigo_local:numero".
create function public.aplicar_mes_de_contas(p_empresa text, p_mes text, p_diferenca jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_gravados integer;
  v_sumiram integer;
  v_voltaram integer;
begin
  insert into public.contas_pagar_receber (
    empresa, codigo_local, numero, mes, unidade_id, lancamento_financeiro, conta_pagar_receber_pai, data_inclusao,
    data_efetivacao, data_vencimento, data_compensacao, situacao, tipo_cliente_fornecedor, cliente_fornecedor, historico,
    numero_documento, credito_valor, credito_valor_efetivacao, debito_valor, debito_valor_efetivacao, percentual_taxa,
    grupo_receita_despesa, nome_grupo_receita_despesa, conta_contabil, nome_conta_contabil, conta_contabil_efetivacao,
    nome_conta_contabil_efetivacao, forma_efetivacao, conta, fatura, num_repasse, visto_na_ultima_sync)
  select p_empresa, r.codigo_local, r.numero, p_mes,
         (select d.unidade_id from public.de_para d
           where d.empresa = p_empresa and d.tipo = 'unidade' and d.codigo_origem = r.codigo_local),
         coalesce(r.lancamento_financeiro, ''), coalesce(r.conta_pagar_receber_pai, ''), r.data_inclusao, r.data_efetivacao,
         r.data_vencimento, r.data_compensacao, coalesce(r.situacao, ''), coalesce(r.tipo_cliente_fornecedor, ''),
         r.cliente_fornecedor, r.historico, r.numero_documento, r.credito_valor, r.credito_valor_efetivacao, r.debito_valor,
         r.debito_valor_efetivacao, r.percentual_taxa, coalesce(r.grupo_receita_despesa, ''),
         coalesce(r.nome_grupo_receita_despesa, ''), coalesce(r.conta_contabil, ''), coalesce(r.nome_conta_contabil, ''),
         coalesce(r.conta_contabil_efetivacao, ''), coalesce(r.nome_conta_contabil_efetivacao, ''),
         coalesce(r.forma_efetivacao, ''), coalesce(r.conta, ''), coalesce(r.fatura, ''), coalesce(r.num_repasse, ''), true
    from jsonb_populate_recordset(null::public.contas_pagar_receber, coalesce(p_diferenca -> 'gravar', '[]'::jsonb)) as r
  on conflict (empresa, codigo_local, numero) do update set
    mes = excluded.mes, unidade_id = excluded.unidade_id, lancamento_financeiro = excluded.lancamento_financeiro,
    conta_pagar_receber_pai = excluded.conta_pagar_receber_pai, data_inclusao = excluded.data_inclusao,
    data_efetivacao = excluded.data_efetivacao, data_vencimento = excluded.data_vencimento,
    data_compensacao = excluded.data_compensacao, situacao = excluded.situacao,
    tipo_cliente_fornecedor = excluded.tipo_cliente_fornecedor, cliente_fornecedor = excluded.cliente_fornecedor,
    historico = excluded.historico, numero_documento = excluded.numero_documento, credito_valor = excluded.credito_valor,
    credito_valor_efetivacao = excluded.credito_valor_efetivacao, debito_valor = excluded.debito_valor,
    debito_valor_efetivacao = excluded.debito_valor_efetivacao, percentual_taxa = excluded.percentual_taxa,
    grupo_receita_despesa = excluded.grupo_receita_despesa, nome_grupo_receita_despesa = excluded.nome_grupo_receita_despesa,
    conta_contabil = excluded.conta_contabil, nome_conta_contabil = excluded.nome_conta_contabil,
    conta_contabil_efetivacao = excluded.conta_contabil_efetivacao,
    nome_conta_contabil_efetivacao = excluded.nome_conta_contabil_efetivacao, forma_efetivacao = excluded.forma_efetivacao,
    conta = excluded.conta, fatura = excluded.fatura, num_repasse = excluded.num_repasse, visto_na_ultima_sync = true,
    atualizado_em = now();
  get diagnostics v_gravados = row_count;

  -- Conta excluída no ProDoctor: marca, nunca apaga, e vira pendência (com o vencimento, para achar na tela).
  insert into public.pendencias (tipo, empresa, referencia, descricao, detalhes)
  select 'conta_sumiu', p_empresa, c.codigo_local || ':' || c.numero, 'Conta a pagar/receber sumiu do ProDoctor',
         jsonb_build_object('mes', p_mes, 'vencimento', c.data_vencimento, 'situacao', c.situacao)
    from public.contas_pagar_receber c
   where c.empresa = p_empresa and c.mes = p_mes and c.visto_na_ultima_sync
     and c.codigo_local || ':' || c.numero in (select jsonb_array_elements_text(coalesce(p_diferenca -> 'sumiram', '[]'::jsonb)))
     and not exists (select 1 from public.pendencias p
                      where p.tipo = 'conta_sumiu' and p.empresa = p_empresa
                        and p.referencia = c.codigo_local || ':' || c.numero and p.estado = 'aberta');

  update public.contas_pagar_receber set visto_na_ultima_sync = false, atualizado_em = now()
   where empresa = p_empresa and mes = p_mes and visto_na_ultima_sync
     and codigo_local || ':' || numero in (select jsonb_array_elements_text(coalesce(p_diferenca -> 'sumiram', '[]'::jsonb)));
  get diagnostics v_sumiram = row_count;

  update public.contas_pagar_receber set visto_na_ultima_sync = true, atualizado_em = now()
   where empresa = p_empresa and mes = p_mes and not visto_na_ultima_sync
     and codigo_local || ':' || numero in (select jsonb_array_elements_text(coalesce(p_diferenca -> 'voltaram', '[]'::jsonb)));
  get diagnostics v_voltaram = row_count;

  -- Conta que voltou deixa de ser pendência.
  update public.pendencias p
     set estado = 'resolvida', resolvido_em = now()
    from public.contas_pagar_receber c
   where p.empresa = p_empresa and p.tipo = 'conta_sumiu' and p.estado = 'aberta'
     and c.empresa = p_empresa and p.referencia = c.codigo_local || ':' || c.numero and c.visto_na_ultima_sync;

  if v_gravados + v_sumiram + v_voltaram > 0 then
    insert into public.auditoria (acao, entidade, entidade_id, detalhes)
    values ('contas_sincronizadas', 'contas_pagar_receber', p_empresa || ':' || p_mes,
            jsonb_build_object('empresa', p_empresa, 'mes', p_mes, 'gravados', v_gravados, 'sumiram', v_sumiram,
                               'voltaram', v_voltaram));
  end if;
end;
$$;

-- S6: confere um job de contas contra o Hub por um caminho independente do TypeScript (SQL sobre o bruto). Só leitura.
create function public.conferir_contas_do_job(p_job_id bigint)
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
    select distinct on (l ->> 'codigoLocalProDoctor', l ->> 'numero') l
      from public.prodoctor_payload_bruto p
      join job on job.id = p.job_id
      cross join lateral jsonb_array_elements(p.payload -> 'payload' -> 'exportacao' -> 'registros') as l
     where left(l ->> 'dataInclusao', 7) = job.mes
     order by l ->> 'codigoLocalProDoctor', l ->> 'numero', p.pagina desc
  ),
  hub as (
    select c.* from public.contas_pagar_receber c join job on c.empresa = job.empresa and c.mes = job.mes
     where c.visto_na_ultima_sync
  ),
  somas as (
    select
      (select coalesce(sum(replace(nullif(l ->> 'creditoValor', ''), ',', '.')::numeric), 0) from bruto) as credito_bruto,
      (select coalesce(sum(replace(nullif(l ->> 'debitoValor', ''), ',', '.')::numeric), 0) from bruto) as debito_bruto,
      (select coalesce(sum(credito_valor), 0) from hub) as credito_hub,
      (select coalesce(sum(debito_valor), 0) from hub) as debito_hub
  )
  select jsonb_build_object(
    'mes', (select mes from job),
    'linhas_bruto', (select count(*) from bruto),
    'linhas_hub', (select count(*) from hub),
    -- Total = crédito + débito (o movimento do mês); crédito e débito também são conferidos separados.
    'total_bruto', (credito_bruto + debito_bruto)::text,
    'total_hub', (credito_hub + debito_hub)::text,
    'credito_bruto', credito_bruto::text, 'credito_hub', credito_hub::text,
    'debito_bruto', debito_bruto::text, 'debito_hub', debito_hub::text
  ) from somas;
$$;

-- Integridade da issue 08, agora também com as contas.
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
           -- Contas: crédito e débito batem cada um.
           and (not (x.c ? 'credito_bruto')
                or ((x.c ->> 'credito_bruto')::numeric = (x.c ->> 'credito_hub')::numeric
                    and (x.c ->> 'debito_bruto')::numeric = (x.c ->> 'debito_hub')::numeric))
    from conferidos x
   order by x.empresa, x.rota, x.mes desc;
$$;

-- Tela /contas (S7): totais do mês de VENCIMENTO por natureza, situação e grupo; lista do que há a pagar.
create function public.resumo_contas(p_mes text)
returns table (natureza text, situacao text, grupo text, nome_grupo text, contas bigint, valor text, efetivado text)
language sql
stable
set search_path = ''
as $$
  select case when coalesce(c.debito_valor, 0) <> 0 then 'pagar' else 'receber' end,
         c.situacao, c.grupo_receita_despesa, c.nome_grupo_receita_despesa, count(*),
         sum(coalesce(c.debito_valor, 0) + coalesce(c.credito_valor, 0))::text,
         sum(coalesce(c.debito_valor_efetivacao, 0) + coalesce(c.credito_valor_efetivacao, 0))::text
    from public.contas_pagar_receber c
   where c.visto_na_ultima_sync and to_char(c.data_vencimento, 'YYYY-MM') = p_mes
   group by 1, 2, 3, 4
   order by 1, 2, sum(coalesce(c.debito_valor, 0) + coalesce(c.credito_valor, 0)) desc, 3;
$$;

create function public.contas_a_pagar_do_mes(p_mes text)
returns table (codigo_local text, numero text, data_vencimento date, data_efetivacao date, situacao text,
               cliente_fornecedor text, nome_grupo text, valor text, efetivado text)
language sql
stable
set search_path = ''
as $$
  select c.codigo_local, c.numero, c.data_vencimento, c.data_efetivacao, c.situacao, c.cliente_fornecedor,
         c.nome_grupo_receita_despesa, c.debito_valor::text, c.debito_valor_efetivacao::text
    from public.contas_pagar_receber c
   where c.visto_na_ultima_sync and to_char(c.data_vencimento, 'YYYY-MM') = p_mes and coalesce(c.debito_valor, 0) <> 0
   order by c.data_vencimento, c.debito_valor desc, c.numero;
$$;

create function public.meses_com_contas()
returns setof text
language sql
stable
set search_path = ''
as $$
  select distinct to_char(data_vencimento, 'YYYY-MM') from public.contas_pagar_receber
   where visto_na_ultima_sync and data_vencimento is not null
   order by 1 desc;
$$;

revoke execute on function public.aplicar_plano_financeiro(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_plano_financeiro(text, text, jsonb) to service_role;
revoke execute on function public.aplicar_mes_de_contas(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_mes_de_contas(text, text, jsonb) to service_role;
revoke execute on function public.conferir_contas_do_job(bigint) from public, anon, authenticated;
grant execute on function public.conferir_contas_do_job(bigint) to service_role;
revoke execute on function public.resumo_contas(text) from public, anon, authenticated;
grant execute on function public.resumo_contas(text) to service_role;
revoke execute on function public.contas_a_pagar_do_mes(text) from public, anon, authenticated;
grant execute on function public.contas_a_pagar_do_mes(text) to service_role;
revoke execute on function public.meses_com_contas() from public, anon, authenticated;
grant execute on function public.meses_com_contas() to service_role;

alter table public.plano_financeiro enable row level security;
alter table public.plano_financeiro force row level security;
alter table public.contas_pagar_receber enable row level security;
alter table public.contas_pagar_receber force row level security;

revoke all on public.plano_financeiro, public.contas_pagar_receber from public, anon, authenticated;
revoke all on sequence public.plano_financeiro_id_seq, public.contas_pagar_receber_id_seq from public, anon, authenticated;
