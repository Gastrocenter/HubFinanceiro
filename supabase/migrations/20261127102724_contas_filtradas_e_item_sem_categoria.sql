-- Issue 11 (S4 e S5): lista, totais e resumo por categoria das páginas /contas/pagar e /contas/receber, com os
-- filtros de src/contas/filtros.ts (D-2, D-6 a D-10), e a pendência "a revisar" de item sem categoria (D-5).
-- Só leitura em contas_pagar_receber; acesso só pelo servidor.

-- Slug da categoria no endereço da página ("Manutenção e exames" → "manutencao-e-exames"). "sem-categoria" é
-- reservado para as contas cujo item não tem ligação (D-5). As telas recebem o slug pronto do banco.
create function public.slug_da_categoria(p_nome text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
           translate(lower(btrim(coalesce(p_nome, ''))), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
           '[^a-z0-9]+', '-', 'g'), '-');
$$;

-- O filtro de categoria é pelo slug: dois nomes com o mesmo slug na mesma natureza seriam a mesma categoria.
alter table public.categorias
  add constraint categorias_slug_valido
  check (public.slug_da_categoria(nome) <> '' and public.slug_da_categoria(nome) <> 'sem-categoria');
create unique index categorias_natureza_slug_idx on public.categorias (natureza, public.slug_da_categoria(nome));

-- Base das três funções: as contas de uma página (natureza pela situação, D-1) com os filtros aplicados.
--   p_natureza: pagar | receber; p_aba: stella | sabin | todas (raiz do plano, D-2);
--   p_de, p_ate: período inclusivo sobre p_tipo_data: vencimento | entrada (inclusão) | efetivacao;
--   p_situacoes: aberta | efetivada | vencida, com OU (vazio = todas); vencida = em aberto com vencimento antes de
--   p_hoje (null: hoje em São Paulo); p_categorias: slugs, "sem-categoria" incluso (vazio = todas);
--   p_fornecedor: trecho do fornecedor/cliente, sem diferenciar maiúsculas (null ou vazio = todos).
-- Valor fora da lista é erro de programação: recusa, em vez de devolver lista vazia em silêncio.
-- Categoria da conta: pela natureza do ITEM no plano e pelo item sem sufixo (D-3), não pela natureza da conta; conta
-- lançada direto num grupo usa o nome do grupo como item. Fornecedor sem nome gravado (paciente e outros, ADR-0005)
-- sai pelo tipo: "Paciente".
create function public.contas_filtradas(
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
           coalesce(public.slug_da_categoria(cat.nome), 'sem-categoria') as v_slug, cat.natureza as v_categoria_natureza,
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

-- Tabela da página (D-9), ordenada por p_ordem (entrada | vencimento | efetivacao | numero | fornecedor | categoria |
-- item | valor | situacao; padrão vencimento), com desempate estável por vencimento e id: lida página a página por
-- .range() (src/lib/ler-tudo.ts). Dinheiro como texto (ADR-0004).
create function public.listar_contas(
  p_natureza text, p_aba text, p_de date, p_ate date, p_tipo_data text, p_situacoes text[], p_categorias text[],
  p_fornecedor text, p_hoje date default null, p_ordem text default 'vencimento', p_decrescente boolean default false)
returns table (id bigint, codigo_local text, numero text, data_inclusao date, data_vencimento date, data_efetivacao date,
               situacao text, vencida boolean, fornecedor text, categoria_id bigint, categoria text, categoria_slug text,
               item text, valor text, efetivado text)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_ordem is null or p_ordem not in ('entrada', 'vencimento', 'efetivacao', 'numero', 'fornecedor', 'categoria', 'item',
                                         'valor', 'situacao') then
    raise exception 'ordem inválida: %', coalesce(p_ordem, 'null');
  end if;

  return query
  select f.id, f.codigo_local, f.numero, f.data_inclusao, f.data_vencimento, f.data_efetivacao, f.situacao, f.vencida,
         f.fornecedor, f.categoria_id, f.categoria, f.categoria_slug, f.item, f.valor::text, f.efetivado::text
    from public.contas_filtradas(p_natureza, p_aba, p_de, p_ate, p_tipo_data, p_situacoes, p_categorias, p_fornecedor,
                                 p_hoje) f
   order by
     -- Datas
     case when not p_decrescente then case p_ordem when 'entrada' then f.data_inclusao when 'efetivacao' then f.data_efetivacao
                                                    when 'vencimento' then f.data_vencimento end end asc nulls last,
     case when p_decrescente then case p_ordem when 'entrada' then f.data_inclusao when 'efetivacao' then f.data_efetivacao
                                                when 'vencimento' then f.data_vencimento end end desc nulls last,
     -- Números (nº da conta só quando é número; os outros vão ao fim e desempatam pelo texto)
     case when not p_decrescente then case p_ordem when 'valor' then f.valor
                                                    when 'numero' then case when f.numero ~ '^\d{1,30}$' then f.numero::numeric end
                                      end end asc nulls last,
     case when p_decrescente then case p_ordem when 'valor' then f.valor
                                                when 'numero' then case when f.numero ~ '^\d{1,30}$' then f.numero::numeric end
                                  end end desc nulls last,
     -- Textos
     case when not p_decrescente then case p_ordem when 'numero' then f.numero when 'fornecedor' then lower(f.fornecedor)
                                                    when 'categoria' then lower(f.categoria) when 'item' then lower(f.item)
                                                    when 'situacao' then f.situacao end end asc nulls last,
     case when p_decrescente then case p_ordem when 'numero' then f.numero when 'fornecedor' then lower(f.fornecedor)
                                                when 'categoria' then lower(f.categoria) when 'item' then lower(f.item)
                                                when 'situacao' then f.situacao end end desc nulls last,
     f.data_vencimento nulls last, f.id;
end;
$$;

-- Cartões da página (D-10), sobre os mesmos filtros: em aberto e vencido pelo valor, pago/recebido pelo valor
-- efetivado. Somados em numeric exato e devolvidos como texto (ADR-0004).
create function public.totais_contas_filtradas(
  p_natureza text, p_aba text, p_de date, p_ate date, p_tipo_data text, p_situacoes text[], p_categorias text[],
  p_fornecedor text, p_hoje date default null)
returns table (contas bigint, em_aberto text, vencido text, efetivado text)
language sql
stable
set search_path = ''
as $$
  select count(*),
         coalesce(sum(f.valor) filter (where f.aberta), 0)::text,
         coalesce(sum(f.valor) filter (where f.vencida), 0)::text,
         coalesce(sum(f.efetivado) filter (where f.efetivada), 0)::text
    from public.contas_filtradas(p_natureza, p_aba, p_de, p_ate, p_tipo_data, p_situacoes, p_categorias, p_fornecedor,
                                 p_hoje) f;
$$;

-- Menu de categorias (D-8), sobre os mesmos filtros: uma linha por categoria (item nulo) seguida das linhas dos
-- seus itens sem sufixo, cada uma com quantidade, em aberto e pago/recebido. Ordem: as categorias da natureza da
-- página, as da outra natureza (conta a receber em item de despesa, D-3) e "Sem categoria" por último. `ordem` é a
-- ordem de exibição.
create function public.resumo_por_categoria(
  p_natureza text, p_aba text, p_de date, p_ate date, p_tipo_data text, p_situacoes text[], p_categorias text[],
  p_fornecedor text, p_hoje date default null)
returns table (ordem bigint, categoria_id bigint, categoria text, categoria_slug text, item text, contas bigint,
               em_aberto text, efetivado text)
language sql
stable
set search_path = ''
as $$
  with grupos as (
    select f.categoria_id, f.categoria, f.categoria_slug, f.categoria_natureza, min(f.categoria_ordem) as categoria_ordem,
           case when grouping(f.item) = 1 then null else f.item end as item, grouping(f.item) = 1 as eh_categoria,
           count(*) as contas,
           coalesce(sum(f.valor) filter (where f.aberta), 0) as em_aberto,
           coalesce(sum(f.efetivado) filter (where f.efetivada), 0) as efetivado
      from public.contas_filtradas(p_natureza, p_aba, p_de, p_ate, p_tipo_data, p_situacoes, p_categorias, p_fornecedor,
                                   p_hoje) f
     group by grouping sets ((f.categoria_id, f.categoria, f.categoria_slug, f.categoria_natureza),
                             (f.categoria_id, f.categoria, f.categoria_slug, f.categoria_natureza, f.item))
  )
  select row_number() over w, g.categoria_id, g.categoria, g.categoria_slug, g.item, g.contas, g.em_aberto::text,
         g.efetivado::text
    from grupos g
  window w as (order by g.categoria_id is null, g.categoria_natureza is distinct from p_natureza, g.categoria_ordem,
                        g.categoria, g.categoria_id, not g.eh_categoria, g.item)
   order by 1;
$$;

-- S5 (D-5): item do plano usado em conta (vista na última sync) sem ligação com categoria vira pendência
-- "a revisar"; a pendência fecha sozinha quando o item ganha categoria ou deixa de ser usado. Contas da raiz 0
-- (abertura/fechamento de caixa) ficam fora; conta lançada direto num grupo (sem item) conta como item, pelo nome
-- do grupo, como em itens_para_categorizar. Idempotente. Chamada no fim da normalização das contas e depois de
-- salvar uma ligação (S6). Devolve quantas abriu e quantas resolveu.
create function public.conferir_itens_sem_categoria()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_novas integer;
  v_resolvidas integer;
begin
  -- Duas rodadas ao mesmo tempo (sync e tela de categorias) não abrem a mesma pendência duas vezes.
  perform pg_advisory_xact_lock(hashtext('conferir_itens_sem_categoria'));

  with usados as (
    select c.empresa, public.natureza_do_plano(c.grupo_receita_despesa) as natureza,
           public.item_sem_unidade(c.nome_grupo_receita_despesa) as item, min(c.grupo_receita_despesa) as grupo
      from public.contas_pagar_receber c
     where c.visto_na_ultima_sync and split_part(btrim(c.grupo_receita_despesa), '.', 1) <> '0'
     group by 1, 2, 3
  ),
  sem_categoria as (
    select u.* from usados u
     where u.natureza is not null and u.item <> ''
       and not exists (select 1 from public.categoria_do_item ci where ci.natureza = u.natureza and ci.item = u.item)
  ),
  novas as (
    insert into public.pendencias (tipo, empresa, referencia, descricao, detalhes)
    select 'item_sem_categoria', s.empresa, s.natureza || ':' || s.item, 'Item do plano financeiro sem categoria do Hub',
           jsonb_build_object('natureza', s.natureza, 'item', s.item, 'grupo', s.grupo)
      from sem_categoria s
     where not exists (select 1 from public.pendencias p
                        where p.tipo = 'item_sem_categoria' and p.empresa = s.empresa
                          and p.referencia = s.natureza || ':' || s.item and p.estado = 'aberta')
    returning 1
  ),
  resolvidas as (
    update public.pendencias p
       set estado = 'resolvida', resolvido_em = now()
     where p.tipo = 'item_sem_categoria' and p.estado = 'aberta'
       and not exists (select 1 from sem_categoria s
                        where s.empresa = p.empresa and s.natureza || ':' || s.item = p.referencia)
    returning 1
  )
  select (select count(*) from novas), (select count(*) from resolvidas) into v_novas, v_resolvidas;

  if v_novas + v_resolvidas > 0 then
    insert into public.auditoria (acao, entidade, entidade_id, detalhes)
    values ('itens_sem_categoria_conferidos', 'pendencias', 'item_sem_categoria',
            jsonb_build_object('novas', v_novas, 'resolvidas', v_resolvidas));
  end if;
  return jsonb_build_object('novas', v_novas, 'resolvidas', v_resolvidas);
end;
$$;

-- Item sem categoria, como de-para (D-C), não fecha à mão: reabriria na próxima conferência. Fecha ligando o item a
-- uma categoria em Cadastros → Categorias. Igual à versão de 20261126123242_integridade_sem_bruto.sql, mais essa recusa.
create or replace function public.resolver_pendencia(p_id bigint, p_usuario uuid, p_justificativa text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v public.pendencias;
  v_justificativa text := btrim(coalesce(p_justificativa, ''));
begin
  if v_justificativa = '' then
    raise exception 'resolver pendência exige justificativa';
  end if;
  if length(v_justificativa) > 1000 then
    raise exception 'justificativa com mais de 1000 caracteres';
  end if;

  select * into v from public.pendencias where id = p_id for update;
  if not found then
    raise exception 'pendência % não existe', p_id;
  end if;
  if v.estado <> 'aberta' then
    raise exception 'pendência % não está aberta', p_id;
  end if;
  if v.tipo ~ '_(sem_par|ambiguo)$' then
    raise exception 'pendência de de-para fecha corrigindo o cadastro, não à mão';
  end if;
  if v.tipo = 'item_sem_categoria' then
    raise exception 'pendência de item sem categoria fecha ligando o item a uma categoria, não à mão';
  end if;

  update public.pendencias
     set estado = 'resolvida', resolvido_em = now(), resolvido_por = p_usuario, justificativa = v_justificativa
   where id = p_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, detalhes)
  values (p_usuario, 'pendencia_resolvida', 'pendencias', p_id::text,
          jsonb_build_object('tipo', v.tipo, 'empresa', v.empresa, 'referencia', v.referencia,
                             'justificativa', v_justificativa));
end;
$$;

revoke execute on function public.slug_da_categoria(text) from public, anon, authenticated;
grant execute on function public.slug_da_categoria(text) to service_role;
revoke execute on function public.contas_filtradas(text, text, date, date, text, text[], text[], text, date)
  from public, anon, authenticated;
grant execute on function public.contas_filtradas(text, text, date, date, text, text[], text[], text, date) to service_role;
revoke execute on function public.listar_contas(text, text, date, date, text, text[], text[], text, date, text, boolean)
  from public, anon, authenticated;
grant execute on function public.listar_contas(text, text, date, date, text, text[], text[], text, date, text, boolean)
  to service_role;
revoke execute on function public.totais_contas_filtradas(text, text, date, date, text, text[], text[], text, date)
  from public, anon, authenticated;
grant execute on function public.totais_contas_filtradas(text, text, date, date, text, text[], text[], text, date)
  to service_role;
revoke execute on function public.resumo_por_categoria(text, text, date, date, text, text[], text[], text, date)
  from public, anon, authenticated;
grant execute on function public.resumo_por_categoria(text, text, date, date, text, text[], text[], text, date)
  to service_role;
revoke execute on function public.conferir_itens_sem_categoria() from public, anon, authenticated;
grant execute on function public.conferir_itens_sem_categoria() to service_role;
revoke execute on function public.resolver_pendencia(bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.resolver_pendencia(bigint, uuid, text) to service_role;
