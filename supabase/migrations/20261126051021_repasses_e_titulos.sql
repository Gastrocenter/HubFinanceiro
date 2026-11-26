-- Issue 07: repasses do ProDoctor (um por procedimento repassado) e títulos a pagar por (profissional, lote).
-- O Hub não recalcula (D2): guarda os valores como vieram. Sem nenhum dado de paciente (ADR-0005).

create table public.repasses (
  id bigint generated always as identity primary key,
  empresa text not null,
  codigo_local text not null,
  conta text not null,
  linha text not null,
  -- Mês de data_repasse: o escopo de cada job (D-X).
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  numero_repasse text not null,
  data_repasse date not null,
  -- Data do procedimento.
  data date not null,
  fatura text not null default '',
  tipo text not null default '',
  recebivel_id bigint references public.recebiveis (id) on delete restrict,
  unidade_id bigint references public.unidades (id) on delete restrict,
  profissional_id bigint references public.profissionais (id) on delete restrict,
  convenio_id bigint references public.convenios (id) on delete restrict,
  nome_profissional_origem text not null default '',
  nome_convenio_origem text not null default '',
  codigo_procedimento text not null default '',
  descricao_procedimento text not null default '',
  funcao_repasse text not null default '',
  percentual_imposto numeric,
  total_conta numeric,
  base_calculo_bruto numeric,
  valor_imposto numeric,
  base_calculo_liquido numeric,
  valor_repassado numeric,
  valor_repassado_medico numeric,
  valor_repassado_clinica numeric,
  visto_na_ultima_sync boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa, codigo_local, conta, linha)
);

-- Um repasse por recebível: os dois lados se acham pelo vínculo (rastreabilidade).
create unique index repasses_recebivel_id_idx on public.repasses (recebivel_id);
create index repasses_empresa_mes_idx on public.repasses (empresa, mes);
create index repasses_lote_idx on public.repasses (empresa, numero_repasse, nome_profissional_origem);
create index repasses_unidade_id_idx on public.repasses (unidade_id);
create index repasses_profissional_id_idx on public.repasses (profissional_id);
create index repasses_convenio_id_idx on public.repasses (convenio_id);

-- Título a pagar: um por (profissional, lote do ProDoctor) — D1. Total arredondado uma vez (D-T), no TypeScript.
create table public.titulos_repasse (
  id bigint generated always as identity primary key,
  empresa text not null,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  numero_repasse text not null,
  nome_profissional_origem text not null,
  profissional_id bigint references public.profissionais (id) on delete restrict,
  data_repasse date not null,
  linhas integer not null check (linhas > 0),
  total_exato numeric not null,
  total_centavos bigint not null,
  -- Falso quando o lote some do ProDoctor (estorno): o título não é apagado.
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa, numero_repasse, nome_profissional_origem)
);

create index titulos_repasse_empresa_mes_idx on public.titulos_repasse (empresa, mes);
create index titulos_repasse_profissional_id_idx on public.titulos_repasse (profissional_id);

-- Aplica um mês de repasses numa transação só. Idempotente.
-- p_diferenca: {gravar: [linha...], sumiram: [chave...], voltaram: [chave...], titulos: [título...],
--               pendencias: [{tipo, referencia, descricao, detalhes}], resolver: [{tipo, referencia}]}
-- chave = "codigo_local:conta:linha". `titulos` é o conjunto completo do mês: o que não veio fica inativo.
create function public.aplicar_mes_de_repasses(p_empresa text, p_mes text, p_diferenca jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_gravados integer;
  v_sumiram integer;
  v_voltaram integer;
  v_titulos integer;
  v_inativos integer;
  v_ligados integer;
  v_pendencias integer;
  v_pendencias_vinculo integer;
  v_resolvidas integer;
begin
  insert into public.repasses (
    empresa, codigo_local, conta, linha, mes, numero_repasse, data_repasse, data, fatura, tipo, unidade_id, profissional_id,
    convenio_id, nome_profissional_origem, nome_convenio_origem, codigo_procedimento, descricao_procedimento, funcao_repasse,
    percentual_imposto, total_conta, base_calculo_bruto, valor_imposto, base_calculo_liquido, valor_repassado,
    valor_repassado_medico, valor_repassado_clinica, visto_na_ultima_sync)
  select p_empresa, r.codigo_local, r.conta, r.linha, p_mes, r.numero_repasse, r.data_repasse, r.data, coalesce(r.fatura, ''),
    coalesce(r.tipo, ''), r.unidade_id, r.profissional_id, r.convenio_id, coalesce(r.nome_profissional_origem, ''),
    coalesce(r.nome_convenio_origem, ''), coalesce(r.codigo_procedimento, ''), coalesce(r.descricao_procedimento, ''),
    coalesce(r.funcao_repasse, ''), r.percentual_imposto, r.total_conta, r.base_calculo_bruto, r.valor_imposto,
    r.base_calculo_liquido, r.valor_repassado, r.valor_repassado_medico, r.valor_repassado_clinica, true
  from jsonb_populate_recordset(null::public.repasses, coalesce(p_diferenca -> 'gravar', '[]'::jsonb)) as r
  on conflict (empresa, codigo_local, conta, linha) do update set
    mes = excluded.mes, numero_repasse = excluded.numero_repasse, data_repasse = excluded.data_repasse, data = excluded.data,
    fatura = excluded.fatura, tipo = excluded.tipo, unidade_id = excluded.unidade_id, profissional_id = excluded.profissional_id,
    convenio_id = excluded.convenio_id, nome_profissional_origem = excluded.nome_profissional_origem,
    nome_convenio_origem = excluded.nome_convenio_origem, codigo_procedimento = excluded.codigo_procedimento,
    descricao_procedimento = excluded.descricao_procedimento, funcao_repasse = excluded.funcao_repasse,
    percentual_imposto = excluded.percentual_imposto, total_conta = excluded.total_conta,
    base_calculo_bruto = excluded.base_calculo_bruto, valor_imposto = excluded.valor_imposto,
    base_calculo_liquido = excluded.base_calculo_liquido, valor_repassado = excluded.valor_repassado,
    valor_repassado_medico = excluded.valor_repassado_medico, valor_repassado_clinica = excluded.valor_repassado_clinica,
    visto_na_ultima_sync = true, atualizado_em = now();
  get diagnostics v_gravados = row_count;

  -- Repasse que sumiu do mês (estorno ou lote refeito): marca, nunca apaga, e vira pendência.
  update public.repasses set visto_na_ultima_sync = false, atualizado_em = now()
   where empresa = p_empresa and mes = p_mes and visto_na_ultima_sync
     and codigo_local || ':' || conta || ':' || linha in (select jsonb_array_elements_text(coalesce(p_diferenca -> 'sumiram', '[]'::jsonb)));
  get diagnostics v_sumiram = row_count;

  insert into public.pendencias (tipo, empresa, referencia, descricao, detalhes)
  select 'repasse_sumiu', p_empresa, c, 'Repasse sumiu do ProDoctor (estorno ou lote refeito)', jsonb_build_object('mes', p_mes)
    from jsonb_array_elements_text(coalesce(p_diferenca -> 'sumiram', '[]'::jsonb)) as c
   where not exists (select 1 from public.pendencias p
                      where p.tipo = 'repasse_sumiu' and p.empresa = p_empresa and p.referencia = c and p.estado = 'aberta');

  update public.repasses set visto_na_ultima_sync = true, atualizado_em = now()
   where empresa = p_empresa and mes = p_mes and not visto_na_ultima_sync
     and codigo_local || ':' || conta || ':' || linha in (select jsonb_array_elements_text(coalesce(p_diferenca -> 'voltaram', '[]'::jsonb)));
  get diagnostics v_voltaram = row_count;

  -- Títulos do mês: os que vieram ficam ativos com o total novo; os do mês que não vieram, inativos.
  insert into public.titulos_repasse (empresa, mes, numero_repasse, nome_profissional_origem, profissional_id, data_repasse,
                                      linhas, total_exato, total_centavos, ativo)
  select p_empresa, p_mes, t.numero_repasse, t.nome_profissional_origem, t.profissional_id, t.data_repasse,
         t.linhas, t.total_exato, t.total_centavos, true
    from jsonb_to_recordset(coalesce(p_diferenca -> 'titulos', '[]'::jsonb))
         as t(numero_repasse text, nome_profissional_origem text, profissional_id bigint, data_repasse date,
              linhas integer, total_exato numeric, total_centavos bigint)
  on conflict (empresa, numero_repasse, nome_profissional_origem) do update set
    mes = excluded.mes, profissional_id = excluded.profissional_id, data_repasse = excluded.data_repasse,
    linhas = excluded.linhas, total_exato = excluded.total_exato, total_centavos = excluded.total_centavos, ativo = true,
    atualizado_em = now()
  where (public.titulos_repasse.mes, public.titulos_repasse.profissional_id, public.titulos_repasse.data_repasse,
         public.titulos_repasse.linhas, public.titulos_repasse.total_exato, public.titulos_repasse.ativo)
        is distinct from (excluded.mes, excluded.profissional_id, excluded.data_repasse, excluded.linhas, excluded.total_exato, true);
  get diagnostics v_titulos = row_count;

  update public.titulos_repasse t set ativo = false, atualizado_em = now()
   where t.empresa = p_empresa and t.mes = p_mes and t.ativo
     and not exists (select 1 from jsonb_to_recordset(coalesce(p_diferenca -> 'titulos', '[]'::jsonb))
                                   as x(numero_repasse text, nome_profissional_origem text)
                      where x.numero_repasse = t.numero_repasse and x.nome_profissional_origem = t.nome_profissional_origem);
  get diagnostics v_inativos = row_count;

  -- Vínculo com o recebível pela chave do procedimento. Roda na empresa toda: liga também o repasse
  -- que chegou antes do procedimento.
  update public.repasses rp set recebivel_id = r.id, atualizado_em = now()
    from public.recebiveis r
   where rp.empresa = p_empresa and rp.recebivel_id is null
     and r.empresa = rp.empresa and r.codigo_local = rp.codigo_local and r.conta = rp.conta and r.linha = rp.linha;
  get diagnostics v_ligados = row_count;

  -- D-W: repasse sem procedimento só é pendência se o mês do procedimento está carregado no Hub.
  insert into public.pendencias (tipo, empresa, referencia, descricao, detalhes)
  select 'repasse_sem_procedimento', p_empresa, rp.codigo_local || ':' || rp.conta || ':' || rp.linha,
         'Repasse de procedimento que não está no Hub',
         jsonb_build_object('mes', p_mes, 'data', rp.data, 'numero_repasse', rp.numero_repasse)
    from public.repasses rp
   where rp.empresa = p_empresa and rp.mes = p_mes and rp.visto_na_ultima_sync and rp.recebivel_id is null
     and exists (select 1 from public.recebiveis r where r.empresa = p_empresa and r.mes = to_char(rp.data, 'YYYY-MM'))
     and not exists (select 1 from public.pendencias p
                      where p.tipo = 'repasse_sem_procedimento' and p.empresa = p_empresa
                        and p.referencia = rp.codigo_local || ':' || rp.conta || ':' || rp.linha and p.estado = 'aberta');
  get diagnostics v_pendencias = row_count;

  insert into public.pendencias (tipo, empresa, referencia, descricao, detalhes)
  select x.tipo, p_empresa, x.referencia, x.descricao, coalesce(x.detalhes, '{}'::jsonb)
    from jsonb_to_recordset(coalesce(p_diferenca -> 'pendencias', '[]'::jsonb))
         as x(tipo text, referencia text, descricao text, detalhes jsonb)
   where not exists (select 1 from public.pendencias p
                      where p.tipo = x.tipo and p.empresa = p_empresa and p.referencia = x.referencia and p.estado = 'aberta');
  get diagnostics v_pendencias_vinculo = row_count;

  -- Fecha o que deixou de ser problema: vínculo de-para que casou e repasse que achou o procedimento.
  update public.pendencias p
     set estado = 'resolvida', resolvido_em = now()
    from jsonb_to_recordset(coalesce(p_diferenca -> 'resolver', '[]'::jsonb)) as x(tipo text, referencia text)
   where p.empresa = p_empresa and p.tipo = x.tipo and p.referencia = x.referencia and p.estado = 'aberta';
  get diagnostics v_resolvidas = row_count;

  update public.pendencias p
     set estado = 'resolvida', resolvido_em = now()
    from public.repasses rp
   where p.empresa = p_empresa and p.tipo = 'repasse_sem_procedimento' and p.estado = 'aberta'
     and rp.empresa = p_empresa and p.referencia = rp.codigo_local || ':' || rp.conta || ':' || rp.linha
     and rp.recebivel_id is not null;

  -- Repasse estornado que voltou (no mesmo mês ou num lote de outra data) deixa de ser pendência.
  update public.pendencias p
     set estado = 'resolvida', resolvido_em = now()
    from public.repasses rp
   where p.empresa = p_empresa and p.tipo = 'repasse_sumiu' and p.estado = 'aberta'
     and rp.empresa = p_empresa and p.referencia = rp.codigo_local || ':' || rp.conta || ':' || rp.linha
     and rp.visto_na_ultima_sync;

  if v_gravados + v_sumiram + v_voltaram + v_titulos + v_inativos + v_ligados + v_pendencias + v_pendencias_vinculo + v_resolvidas > 0 then
    insert into public.auditoria (acao, entidade, entidade_id, detalhes)
    values ('repasse_sincronizado', 'repasses', p_empresa || ':' || p_mes,
            jsonb_build_object('empresa', p_empresa, 'mes', p_mes, 'gravados', v_gravados, 'sumiram', v_sumiram,
                               'voltaram', v_voltaram, 'titulos_gravados', v_titulos, 'titulos_inativos', v_inativos,
                               'ligados_a_recebivel', v_ligados, 'pendencias_novas', v_pendencias + v_pendencias_vinculo,
                               'pendencias_resolvidas', v_resolvidas));
  end if;
end;
$$;

-- S6: confere um job de repasses contra o Hub por um caminho independente do TypeScript (SQL sobre o bruto). Só leitura.
create function public.conferir_repasse_do_job(p_job_id bigint)
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
    select distinct on (l ->> 'codigoLocalProDoctor', l ->> 'conta', l ->> 'linha') l
      from public.prodoctor_payload_bruto p
      join job on job.id = p.job_id
      cross join lateral jsonb_array_elements(p.payload -> 'payload' -> 'exportacao' -> 'registros') as l
     where left(l ->> 'dataRepasse', 7) = job.mes
     order by l ->> 'codigoLocalProDoctor', l ->> 'conta', l ->> 'linha', p.pagina desc
  ),
  hub as (
    select r.* from public.repasses r join job on r.empresa = job.empresa and r.mes = job.mes where r.visto_na_ultima_sync
  ),
  titulos as (
    select t.* from public.titulos_repasse t join job on t.empresa = job.empresa and t.mes = job.mes where t.ativo
  )
  select jsonb_build_object(
    'mes', (select mes from job),
    'linhas_bruto', (select count(*) from bruto),
    'linhas_hub', (select count(*) from hub),
    'total_bruto', (select coalesce(sum(replace(l ->> 'valorRepassadoMedico', ',', '.')::numeric), 0)::text
                      from bruto where coalesce(l ->> 'valorRepassadoMedico', '') <> ''),
    'total_hub', (select coalesce(sum(valor_repassado_medico), 0)::text from hub),
    'titulos_bruto', (select count(distinct (l ->> 'numeroRepasse', l ->> 'nomeUsuario')) from bruto),
    'titulos_hub', (select count(*) from titulos),
    'total_titulos', (select coalesce(sum(total_exato), 0)::text from titulos)
  );
$$;

revoke execute on function public.aplicar_mes_de_repasses(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_mes_de_repasses(text, text, jsonb) to service_role;
revoke execute on function public.conferir_repasse_do_job(bigint) from public, anon, authenticated;
grant execute on function public.conferir_repasse_do_job(bigint) to service_role;

alter table public.repasses enable row level security;
alter table public.repasses force row level security;
alter table public.titulos_repasse enable row level security;
alter table public.titulos_repasse force row level security;

revoke all on public.repasses, public.titulos_repasse from public, anon, authenticated;
revoke all on sequence public.repasses_id_seq, public.titulos_repasse_id_seq from public, anon, authenticated;
