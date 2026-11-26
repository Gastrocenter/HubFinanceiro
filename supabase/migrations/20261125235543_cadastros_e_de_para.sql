-- Issue 05: entidades do Hub (unidade, profissional, convênio) e de-para com o ProDoctor (D-I a D-M).

create type public.tipo_cadastro as enum ('unidade', 'profissional', 'convenio');

create table public.unidades (
  id bigint generated always as identity primary key,
  nome text not null,
  criado_em timestamptz not null default now()
);

-- eh_medico nulo = ainda não revisado (D-J).
create table public.profissionais (
  id bigint generated always as identity primary key,
  nome text not null,
  eh_medico boolean,
  criado_em timestamptz not null default now()
);

create table public.convenios (
  id bigint generated always as identity primary key,
  nome text not null,
  tipo_convenio integer,
  criado_em timestamptz not null default now()
);

-- (empresa, tipo, código de origem) → uma entidade do Hub. Uma FK por tipo: o banco garante o tipo certo.
create table public.de_para (
  id bigint generated always as identity primary key,
  empresa text not null,
  tipo public.tipo_cadastro not null,
  codigo_origem text not null,
  nome_origem text not null,
  ativo boolean not null default true,
  visto_na_ultima_sync boolean not null default true,
  unidade_id bigint references public.unidades (id) on delete restrict,
  profissional_id bigint references public.profissionais (id) on delete restrict,
  convenio_id bigint references public.convenios (id) on delete restrict,
  revisado_em timestamptz,
  revisado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa, tipo, codigo_origem),
  check ((tipo = 'unidade') = (unidade_id is not null)),
  check ((tipo = 'profissional') = (profissional_id is not null)),
  check ((tipo = 'convenio') = (convenio_id is not null))
);

create index de_para_unidade_id_idx on public.de_para (unidade_id);
create index de_para_profissional_id_idx on public.de_para (profissional_id);
create index de_para_convenio_id_idx on public.de_para (convenio_id);
create index de_para_revisado_por_idx on public.de_para (revisado_por);
create index de_para_a_revisar_idx on public.de_para (tipo) where revisado_em is null;

-- Aplica o plano de reconciliação de uma empresa e um tipo numa transação só, auditando cada mudança.
create function public.aplicar_plano_de_cadastro(p_empresa text, p_tipo public.tipo_cadastro, p_plano jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r jsonb;
  v_id bigint;
  v_codigo text;
begin
  for r in select * from jsonb_array_elements(coalesce(p_plano -> 'criar', '[]'::jsonb)) loop
    v_codigo := r ->> 'codigoOrigem';
    -- Idempotente: se outra rodada já criou, não cria de novo.
    continue when exists (
      select 1 from public.de_para where empresa = p_empresa and tipo = p_tipo and codigo_origem = v_codigo);

    if p_tipo = 'unidade' then
      insert into public.unidades (nome) values (r ->> 'nome') returning id into v_id;
      insert into public.de_para (empresa, tipo, codigo_origem, nome_origem, ativo, unidade_id)
      values (p_empresa, p_tipo, v_codigo, r ->> 'nome', (r ->> 'ativo')::boolean, v_id);
    elsif p_tipo = 'profissional' then
      insert into public.profissionais (nome) values (r ->> 'nome') returning id into v_id;
      insert into public.de_para (empresa, tipo, codigo_origem, nome_origem, ativo, profissional_id)
      values (p_empresa, p_tipo, v_codigo, r ->> 'nome', (r ->> 'ativo')::boolean, v_id);
    else
      insert into public.convenios (nome, tipo_convenio) values (r ->> 'nome', (r ->> 'tipoConvenio')::integer) returning id into v_id;
      insert into public.de_para (empresa, tipo, codigo_origem, nome_origem, ativo, convenio_id)
      values (p_empresa, p_tipo, v_codigo, r ->> 'nome', (r ->> 'ativo')::boolean, v_id);
    end if;

    insert into public.auditoria (acao, entidade, entidade_id, detalhes)
    values ('cadastro_criado', p_tipo::text, v_codigo, jsonb_build_object('empresa', p_empresa, 'nome', r ->> 'nome'));
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_plano -> 'atualizar', '[]'::jsonb)) loop
    update public.de_para
       set nome_origem = coalesce(r ->> 'nome', nome_origem),
           ativo = coalesce((r ->> 'ativo')::boolean, ativo),
           atualizado_em = now()
     where empresa = p_empresa and tipo = p_tipo and codigo_origem = r ->> 'codigoOrigem'
     returning coalesce(unidade_id, profissional_id, convenio_id) into v_id;

    -- O nome da entidade do Hub acompanha o da origem.
    if r ? 'nome' then
      if p_tipo = 'unidade' then update public.unidades set nome = r ->> 'nome' where id = v_id;
      elsif p_tipo = 'profissional' then update public.profissionais set nome = r ->> 'nome' where id = v_id;
      else update public.convenios set nome = r ->> 'nome' where id = v_id;
      end if;
    end if;

    insert into public.auditoria (acao, entidade, entidade_id, detalhes)
    values ('cadastro_alterado', p_tipo::text, r ->> 'codigoOrigem', jsonb_build_object('empresa', p_empresa) || (r - 'codigoOrigem'));
  end loop;

  update public.de_para set visto_na_ultima_sync = false, atualizado_em = now()
   where empresa = p_empresa and tipo = p_tipo
     and codigo_origem in (select jsonb_array_elements_text(coalesce(p_plano -> 'sumiram', '[]'::jsonb)));
  insert into public.auditoria (acao, entidade, entidade_id, detalhes)
  select 'cadastro_sumiu', p_tipo::text, c, jsonb_build_object('empresa', p_empresa)
    from jsonb_array_elements_text(coalesce(p_plano -> 'sumiram', '[]'::jsonb)) as c;

  update public.de_para set visto_na_ultima_sync = true, atualizado_em = now()
   where empresa = p_empresa and tipo = p_tipo
     and codigo_origem in (select jsonb_array_elements_text(coalesce(p_plano -> 'voltaram', '[]'::jsonb)));
  insert into public.auditoria (acao, entidade, entidade_id, detalhes)
  select 'cadastro_voltou', p_tipo::text, c, jsonb_build_object('empresa', p_empresa)
    from jsonb_array_elements_text(coalesce(p_plano -> 'voltaram', '[]'::jsonb)) as c;
end;
$$;

revoke execute on function public.aplicar_plano_de_cadastro(text, public.tipo_cadastro, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_plano_de_cadastro(text, public.tipo_cadastro, jsonb) to service_role;

alter table public.unidades enable row level security;
alter table public.unidades force row level security;
alter table public.profissionais enable row level security;
alter table public.profissionais force row level security;
alter table public.convenios enable row level security;
alter table public.convenios force row level security;
alter table public.de_para enable row level security;
alter table public.de_para force row level security;

revoke all on public.unidades, public.profissionais, public.convenios, public.de_para from public, anon, authenticated;
revoke all on sequence public.unidades_id_seq, public.profissionais_id_seq, public.convenios_id_seq, public.de_para_id_seq
  from public, anon, authenticated;
