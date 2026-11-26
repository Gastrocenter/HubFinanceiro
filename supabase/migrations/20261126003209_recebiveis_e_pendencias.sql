-- Issue 06: recebíveis (um por procedimento) e pendências. Sem nenhum dado de paciente (ADR-0005).

create table public.recebiveis (
  id bigint generated always as identity primary key,
  empresa text not null,
  codigo_local text not null,
  conta text not null,
  linha text not null,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  data date not null,
  fatura text not null default '',
  unidade_id bigint references public.unidades (id) on delete restrict,
  profissional_id bigint references public.profissionais (id) on delete restrict,
  convenio_id bigint references public.convenios (id) on delete restrict,
  nome_profissional_origem text not null default '',
  nome_convenio_origem text not null default '',
  funcao text not null default '',
  funcao_repasse text not null default '',
  codigo_procedimento text not null default '',
  descricao_procedimento text not null default '',
  tipo_procedimento text not null default '',
  grupo_procedimentos_repasses text not null default '',
  quantidade numeric,
  valor_total numeric,
  valor_diferenca numeric,
  valor_glosa numeric,
  valor_recuperado numeric,
  total_materiais_medicamentos numeric,
  total_taxas_diarias numeric,
  total_glosas_materiais_medicamentos numeric,
  total_glosas_taxas_diarias numeric,
  total_recuperado_materiais_medicamentos numeric,
  total_recuperado_taxas_diarias numeric,
  nao_repassar boolean not null default false,
  somente_repasse boolean not null default false,
  nao_incluir_repasse boolean not null default false,
  visto_na_ultima_sync boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa, codigo_local, conta, linha)
);

create index recebiveis_empresa_mes_idx on public.recebiveis (empresa, mes);
create index recebiveis_unidade_id_idx on public.recebiveis (unidade_id);
create index recebiveis_profissional_id_idx on public.recebiveis (profissional_id);
create index recebiveis_convenio_id_idx on public.recebiveis (convenio_id);

create type public.estado_pendencia as enum ('aberta', 'resolvida');

create table public.pendencias (
  id bigint generated always as identity primary key,
  tipo text not null,
  empresa text not null,
  referencia text not null,
  descricao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  estado public.estado_pendencia not null default 'aberta',
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users (id) on delete set null
);

create index pendencias_abertas_idx on public.pendencias (tipo, empresa, referencia) where estado = 'aberta';
create index pendencias_resolvido_por_idx on public.pendencias (resolvido_por);

-- Aplica a diferença de um mês de procedimentos numa transação só. Idempotente.
-- p_diferenca: {gravar: [linha...], sumiram: [chave...], voltaram: [chave...], pendencias: [{tipo, referencia, descricao, detalhes}]}
-- chave = "codigo_local:conta:linha".
create function public.aplicar_mes_de_procedimentos(p_empresa text, p_mes text, p_diferenca jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_gravados integer;
  v_sumiram integer;
  v_voltaram integer;
  v_pendencias integer;
begin
  insert into public.recebiveis (
    empresa, codigo_local, conta, linha, mes, data, fatura, unidade_id, profissional_id, convenio_id,
    nome_profissional_origem, nome_convenio_origem, funcao, funcao_repasse, codigo_procedimento,
    descricao_procedimento, tipo_procedimento, grupo_procedimentos_repasses, quantidade, valor_total,
    valor_diferenca, valor_glosa, valor_recuperado, total_materiais_medicamentos, total_taxas_diarias,
    total_glosas_materiais_medicamentos, total_glosas_taxas_diarias, total_recuperado_materiais_medicamentos,
    total_recuperado_taxas_diarias, nao_repassar, somente_repasse, nao_incluir_repasse, visto_na_ultima_sync)
  select p_empresa, r.codigo_local, r.conta, r.linha, p_mes, r.data, coalesce(r.fatura, ''), r.unidade_id, r.profissional_id, r.convenio_id,
    coalesce(r.nome_profissional_origem, ''), coalesce(r.nome_convenio_origem, ''), coalesce(r.funcao, ''), coalesce(r.funcao_repasse, ''),
    coalesce(r.codigo_procedimento, ''), coalesce(r.descricao_procedimento, ''), coalesce(r.tipo_procedimento, ''),
    coalesce(r.grupo_procedimentos_repasses, ''), r.quantidade, r.valor_total, r.valor_diferenca, r.valor_glosa, r.valor_recuperado,
    r.total_materiais_medicamentos, r.total_taxas_diarias, r.total_glosas_materiais_medicamentos, r.total_glosas_taxas_diarias,
    r.total_recuperado_materiais_medicamentos, r.total_recuperado_taxas_diarias,
    coalesce(r.nao_repassar, false), coalesce(r.somente_repasse, false), coalesce(r.nao_incluir_repasse, false), true
  from jsonb_populate_recordset(null::public.recebiveis, coalesce(p_diferenca -> 'gravar', '[]'::jsonb)) as r
  on conflict (empresa, codigo_local, conta, linha) do update set
    mes = excluded.mes, data = excluded.data, fatura = excluded.fatura, unidade_id = excluded.unidade_id,
    profissional_id = excluded.profissional_id, convenio_id = excluded.convenio_id,
    nome_profissional_origem = excluded.nome_profissional_origem, nome_convenio_origem = excluded.nome_convenio_origem,
    funcao = excluded.funcao, funcao_repasse = excluded.funcao_repasse, codigo_procedimento = excluded.codigo_procedimento,
    descricao_procedimento = excluded.descricao_procedimento, tipo_procedimento = excluded.tipo_procedimento,
    grupo_procedimentos_repasses = excluded.grupo_procedimentos_repasses, quantidade = excluded.quantidade,
    valor_total = excluded.valor_total, valor_diferenca = excluded.valor_diferenca, valor_glosa = excluded.valor_glosa,
    valor_recuperado = excluded.valor_recuperado, total_materiais_medicamentos = excluded.total_materiais_medicamentos,
    total_taxas_diarias = excluded.total_taxas_diarias, total_glosas_materiais_medicamentos = excluded.total_glosas_materiais_medicamentos,
    total_glosas_taxas_diarias = excluded.total_glosas_taxas_diarias,
    total_recuperado_materiais_medicamentos = excluded.total_recuperado_materiais_medicamentos,
    total_recuperado_taxas_diarias = excluded.total_recuperado_taxas_diarias, nao_repassar = excluded.nao_repassar,
    somente_repasse = excluded.somente_repasse, nao_incluir_repasse = excluded.nao_incluir_repasse,
    visto_na_ultima_sync = true, atualizado_em = now();
  get diagnostics v_gravados = row_count;

  update public.recebiveis set visto_na_ultima_sync = false, atualizado_em = now()
   where empresa = p_empresa and mes = p_mes and visto_na_ultima_sync
     and codigo_local || ':' || conta || ':' || linha in (select jsonb_array_elements_text(coalesce(p_diferenca -> 'sumiram', '[]'::jsonb)));
  get diagnostics v_sumiram = row_count;

  -- Procedimento que sumiu do ProDoctor vira pendência (L3), uma por linha, sem duplicar.
  insert into public.pendencias (tipo, empresa, referencia, descricao, detalhes)
  select 'procedimento_sumiu', p_empresa, c, 'Procedimento sumiu do ProDoctor', jsonb_build_object('mes', p_mes)
    from jsonb_array_elements_text(coalesce(p_diferenca -> 'sumiram', '[]'::jsonb)) as c
   where not exists (select 1 from public.pendencias p
                      where p.tipo = 'procedimento_sumiu' and p.empresa = p_empresa and p.referencia = c and p.estado = 'aberta');

  update public.recebiveis set visto_na_ultima_sync = true, atualizado_em = now()
   where empresa = p_empresa and mes = p_mes and not visto_na_ultima_sync
     and codigo_local || ':' || conta || ':' || linha in (select jsonb_array_elements_text(coalesce(p_diferenca -> 'voltaram', '[]'::jsonb)));
  get diagnostics v_voltaram = row_count;

  insert into public.pendencias (tipo, empresa, referencia, descricao, detalhes)
  select x.tipo, p_empresa, x.referencia, x.descricao, coalesce(x.detalhes, '{}'::jsonb)
    from jsonb_to_recordset(coalesce(p_diferenca -> 'pendencias', '[]'::jsonb))
         as x(tipo text, referencia text, descricao text, detalhes jsonb)
   where not exists (select 1 from public.pendencias p
                      where p.tipo = x.tipo and p.empresa = p_empresa and p.referencia = x.referencia and p.estado = 'aberta');
  get diagnostics v_pendencias = row_count;

  -- Um resumo por mês na auditoria, só quando algo mudou.
  if v_gravados + v_sumiram + v_voltaram + v_pendencias > 0 then
    insert into public.auditoria (acao, entidade, entidade_id, detalhes)
    values ('receita_sincronizada', 'recebiveis', p_empresa || ':' || p_mes,
            jsonb_build_object('empresa', p_empresa, 'mes', p_mes, 'gravados', v_gravados, 'sumiram', v_sumiram,
                               'voltaram', v_voltaram, 'pendencias_novas', v_pendencias));
  end if;
end;
$$;

revoke execute on function public.aplicar_mes_de_procedimentos(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_mes_de_procedimentos(text, text, jsonb) to service_role;

alter table public.recebiveis enable row level security;
alter table public.recebiveis force row level security;
alter table public.pendencias enable row level security;
alter table public.pendencias force row level security;

revoke all on public.recebiveis, public.pendencias from public, anon, authenticated;
revoke all on sequence public.recebiveis_id_seq, public.pendencias_id_seq from public, anon, authenticated;
