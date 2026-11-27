-- Correção de 20261127102724: slug_da_categoria(null) devolve '' (não null), então a conta sem categoria saía com
-- slug vazio e o filtro "sem-categoria" não a encontrava (pego pelo teste supabase/tests/contas_filtradas.sql).

create or replace function public.contas_filtradas(
  p_natureza text, p_aba text, p_de date, p_ate date, p_tipo_data text, p_situacoes text[], p_categorias text[],
  p_fornecedor text, p_hoje date default null)
returns table (id bigint, codigo_local text, numero text, data_inclusao date, data_vencimento date, data_efetivacao date,
               situacao text, fornecedor text, item text, categoria_id bigint, categoria text, categoria_slug text,
               categoria_natureza text, categoria_ordem integer, valor numeric, efetivado numeric, aberta boolean,
               efetivada boolean, vencida boolean)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_hoje date := coalesce(p_hoje, (now() at time zone 'America/Sao_Paulo')::date);
  v_trecho text := nullif(btrim(coalesce(p_fornecedor, '')), '');
begin
  if p_natureza is null or p_natureza not in ('pagar', 'receber') then
    raise exception 'natureza inválida: %', coalesce(p_natureza, 'null');
  end if;
  if p_aba is null or p_aba not in ('stella', 'sabin', 'todas') then
    raise exception 'aba inválida: %', coalesce(p_aba, 'null');
  end if;
  if p_tipo_data is null or p_tipo_data not in ('vencimento', 'entrada', 'efetivacao') then
    raise exception 'tipo de data inválido: %', coalesce(p_tipo_data, 'null');
  end if;
  if p_de is null or p_ate is null or p_de > p_ate then
    raise exception 'período inválido: % a %', coalesce(p_de::text, 'null'), coalesce(p_ate::text, 'null');
  end if;
  if exists (select 1 from unnest(coalesce(p_situacoes, '{}')) s where s is null or s not in ('aberta', 'efetivada', 'vencida')) then
    raise exception 'situação inválida em %', p_situacoes;
  end if;

  return query
  with base as (
    select c.id, c.codigo_local, c.numero, c.data_inclusao, c.data_vencimento, c.data_efetivacao, c.situacao,
           c.grupo_receita_despesa,
           case when nullif(c.cliente_fornecedor, '') is not null then c.cliente_fornecedor
                else nullif(c.tipo_cliente_fornecedor, '') end as v_fornecedor,
           public.item_sem_unidade(c.nome_grupo_receita_despesa) as v_item,
           coalesce(c.debito_valor, 0) + coalesce(c.credito_valor, 0) as v_valor,
           coalesce(c.debito_valor_efetivacao, 0) + coalesce(c.credito_valor_efetivacao, 0) as v_efetivado,
           c.situacao in ('PAGAR', 'RECEBER') as v_aberta,
           c.situacao in ('PAGA', 'RECEBIDA') as v_efetivada,
           c.situacao in ('PAGAR', 'RECEBER') and c.data_vencimento < v_hoje as v_vencida
      from public.contas_pagar_receber c
     where c.visto_na_ultima_sync
       and public.natureza_da_conta(c.situacao) = p_natureza
       and (p_aba = 'todas' or public.unidade_do_plano(c.grupo_receita_despesa) = p_aba)
       and case p_tipo_data when 'vencimento' then c.data_vencimento
                            when 'entrada' then c.data_inclusao
                            else c.data_efetivacao end between p_de and p_ate
  ),
  com_categoria as (
    select b.*, cat.id as v_categoria_id, coalesce(cat.nome, 'Sem categoria') as v_categoria,
           case when cat.id is null then 'sem-categoria' else public.slug_da_categoria(cat.nome) end as v_slug, cat.natureza as v_categoria_natureza,
           cat.ordem as v_ordem
      from base b
      left join public.categoria_do_item ci
        on ci.natureza = public.natureza_do_plano(b.grupo_receita_despesa) and ci.item = b.v_item
      left join public.categorias cat on cat.id = ci.categoria_id
  )
  select x.id, x.codigo_local, x.numero, x.data_inclusao, x.data_vencimento, x.data_efetivacao, x.situacao, x.v_fornecedor,
         x.v_item, x.v_categoria_id, x.v_categoria, x.v_slug, x.v_categoria_natureza, x.v_ordem, x.v_valor, x.v_efetivado,
         x.v_aberta, x.v_efetivada, x.v_vencida
    from com_categoria x
   where (coalesce(cardinality(p_situacoes), 0) = 0
          or (x.v_aberta and 'aberta' = any (p_situacoes))
          or (x.v_efetivada and 'efetivada' = any (p_situacoes))
          or (x.v_vencida and 'vencida' = any (p_situacoes)))
     and (coalesce(cardinality(p_categorias), 0) = 0 or x.v_slug = any (p_categorias))
     and (v_trecho is null
          or x.v_fornecedor ilike '%' || replace(replace(replace(v_trecho, '\', '\\'), '%', '\%'), '_', '\_') || '%');
end;
$$;
