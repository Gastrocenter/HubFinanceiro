-- Issue 11 (S3): categorias do Hub, ligadas ao item do plano financeiro sem o sufixo da unidade (D-3), e as funções
-- que leem a unidade e a natureza do código do plano (D-2). Acesso só pelo servidor.

-- "Taxa de Cartão sobre a Venda (SABIN)" → "Taxa de Cartão sobre a Venda". Tira só o último sufixo (STELLA)/(SABIN)/
-- (TNI), só no fim, sem diferenciar maiúsculas e tolerando espaços; depois apara as pontas.
-- ATENÇÃO: espelho de itemSemUnidade (src/contas/unidade-do-plano.ts). As duas precisam bater: mudou aqui, muda lá.
-- Os mesmos casos estão nos dois testes (supabase/tests/categorias.sql e src/contas/unidade-do-plano.test.ts).
create function public.item_sem_unidade(p_nome text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(regexp_replace(p_nome, '\s*\(\s*(stella|sabin|tni)\s*\)\s*$', '', 'i'), '^\s+|\s+$', '', 'g');
$$;

-- Aba da conta pela raiz do código do plano: 1 (Stella Central) e 3 (TNI) → stella; 2 → sabin; 0, vazio ou outra → caixa
-- (só aparece em "Todas").
-- ATENÇÃO: espelho de unidadeDoPlano (src/contas/unidade-do-plano.ts). As duas precisam bater.
create function public.unidade_do_plano(p_codigo text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case split_part(btrim(coalesce(p_codigo, '')), '.', 1)
           when '1' then 'stella' when '3' then 'stella' when '2' then 'sabin' else 'caixa' end;
$$;

-- Natureza do item pelo código do plano (segunda parte): 01 → receber, 02 → pagar; outra (ou raiz sem natureza) → null.
-- É a natureza da ligação com a categoria, não a da conta: conta a receber em item de despesa usa a categoria da
-- despesa (D-3). A natureza da conta continua em natureza_da_conta(situacao).
create function public.natureza_do_plano(p_codigo text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case split_part(btrim(coalesce(p_codigo, '')), '.', 2) when '01' then 'receber' when '02' then 'pagar' end;
$$;

create table public.categorias (
  id bigint generated always as identity primary key,
  natureza text not null check (natureza in ('pagar', 'receber')),
  nome text not null check (btrim(nome) <> '' and nome = btrim(nome)),
  -- Ordem de exibição dentro da natureza.
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (natureza, nome),
  -- Alvo da chave composta da ligação: a categoria tem a mesma natureza do item.
  unique (natureza, id)
);

-- Item do plano (sem sufixo, igual nas três raízes) → categoria. Item sem linha aqui é "Sem categoria" (D-5).
create table public.categoria_do_item (
  natureza text not null check (natureza in ('pagar', 'receber')),
  item text not null check (item <> '' and item = public.item_sem_unidade(item)),
  categoria_id bigint not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (natureza, item),
  foreign key (natureza, categoria_id) references public.categorias (natureza, id) on delete restrict
);

create index categoria_do_item_categoria_id_idx on public.categoria_do_item (categoria_id);

revoke execute on function public.item_sem_unidade(text) from public, anon, authenticated;
grant execute on function public.item_sem_unidade(text) to service_role;
revoke execute on function public.unidade_do_plano(text) from public, anon, authenticated;
grant execute on function public.unidade_do_plano(text) to service_role;
revoke execute on function public.natureza_do_plano(text) from public, anon, authenticated;
grant execute on function public.natureza_do_plano(text) to service_role;

alter table public.categorias enable row level security;
alter table public.categorias force row level security;
alter table public.categoria_do_item enable row level security;
alter table public.categoria_do_item force row level security;

revoke all on public.categorias, public.categoria_do_item from public, anon, authenticated;
revoke all on sequence public.categorias_id_seq from public, anon, authenticated;
