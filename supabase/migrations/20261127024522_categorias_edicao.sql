-- Issue 11 (S6, D-4): tela Cadastros → Categorias. Lista os itens do plano financeiro (sem o sufixo da unidade) com
-- a categoria atual, e grava a troca de categoria e a criação/renomeação de categoria, cada uma atômica e auditada.
-- Acesso só pelo servidor (a permissão é conferida na server action, D-11).

-- Itens por natureza da ligação (natureza_do_plano), item sem sufixo: os do plano gravado (código
-- raiz.natureza.grupo.item) e os usados em conta, que incluem conta lançada direto num grupo, sem item. Item que
-- só existe em conta volta com no_plano = false. Natureza desconhecida (raiz 0 sem natureza) fica fora.
create function public.itens_para_categorizar()
returns table (natureza text, item text, raizes text[], no_plano boolean, contas bigint, categoria_id bigint)
language sql
stable
set search_path = ''
as $$
  with usos as (
    select public.natureza_do_plano(p.codigo) as natureza, public.item_sem_unidade(p.nome) as item,
           split_part(btrim(p.codigo), '.', 1) as raiz, true as no_plano, 0::bigint as contas
      from public.plano_financeiro p
     where p.tipo = 'grupo_receita_despesa' and p.visto_na_ultima_sync and p.codigo ~ '^\d+\.\d+\.\d+\.\d+$'
    union all
    select public.natureza_do_plano(c.grupo_receita_despesa), public.item_sem_unidade(c.nome_grupo_receita_despesa),
           split_part(btrim(c.grupo_receita_despesa), '.', 1), false, count(*)
      from public.contas_pagar_receber c
     group by 1, 2, 3
  )
  select u.natureza, u.item, array_agg(distinct u.raiz order by u.raiz), bool_or(u.no_plano), sum(u.contas)::bigint,
         l.categoria_id
    from usos u
    left join public.categoria_do_item l on l.natureza = u.natureza and l.item = u.item
   where u.natureza is not null and u.item <> ''
   group by u.natureza, u.item, l.categoria_id
   order by u.natureza, u.item;
$$;

-- Liga o item a uma categoria da mesma natureza; p_categoria_id null tira a ligação (volta a "Sem categoria", D-5).
-- O item tem que existir no plano ou em alguma conta. Sem mudança, não grava nem audita; devolve se mudou.
create function public.definir_categoria_do_item(p_natureza text, p_item text, p_categoria_id bigint, p_usuario uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_antes bigint;
  v_nome_antes text;
  v_nome text;
begin
  if p_natureza is null or p_natureza not in ('pagar', 'receber') then
    raise exception 'natureza inválida: %', coalesce(p_natureza, 'null');
  end if;
  if p_item is null or p_item = '' or p_item is distinct from public.item_sem_unidade(p_item) then
    raise exception 'item inválido: %', coalesce(p_item, 'null');
  end if;
  if not exists (select 1 from public.plano_financeiro p
                  where p.tipo = 'grupo_receita_despesa' and public.natureza_do_plano(p.codigo) = p_natureza
                    and public.item_sem_unidade(p.nome) = p_item)
     and not exists (select 1 from public.contas_pagar_receber c
                      where public.natureza_do_plano(c.grupo_receita_despesa) = p_natureza
                        and public.item_sem_unidade(c.nome_grupo_receita_despesa) = p_item) then
    raise exception 'o item "%" não está no plano financeiro nem em conta', p_item;
  end if;
  if p_categoria_id is not null then
    select c.nome into v_nome from public.categorias c where c.id = p_categoria_id and c.natureza = p_natureza;
    if not found then raise exception 'a categoria % não existe na lista a %', p_categoria_id, p_natureza; end if;
  end if;

  select l.categoria_id, c.nome into v_antes, v_nome_antes
    from public.categoria_do_item l join public.categorias c on c.id = l.categoria_id
   where l.natureza = p_natureza and l.item = p_item
     for update of l;
  if v_antes is not distinct from p_categoria_id then return false; end if;

  if p_categoria_id is null then
    delete from public.categoria_do_item where natureza = p_natureza and item = p_item;
  else
    insert into public.categoria_do_item (natureza, item, categoria_id) values (p_natureza, p_item, p_categoria_id)
    on conflict (natureza, item) do update set categoria_id = excluded.categoria_id, atualizado_em = now();
  end if;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, detalhes)
  values (p_usuario, 'categoria_do_item_alterada', 'categoria_do_item', p_natureza || ':' || p_item,
          jsonb_build_object('natureza', p_natureza, 'item', p_item, 'antes', v_nome_antes, 'depois', v_nome));
  return true;
end;
$$;

-- Cria (p_id null, no fim da lista) ou renomeia uma categoria. Nome sem espaço sobrando, até 60 caracteres e sem
-- repetir outra da mesma natureza, sem diferenciar maiúsculas. Devolve o id.
create function public.salvar_categoria(p_natureza text, p_id bigint, p_nome text, p_usuario uuid)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_nome text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_antes text;
  v_id bigint;
begin
  if p_natureza is null or p_natureza not in ('pagar', 'receber') then
    raise exception 'natureza inválida: %', coalesce(p_natureza, 'null');
  end if;
  if v_nome = '' then raise exception 'nome da categoria vazio'; end if;
  if length(v_nome) > 60 then raise exception 'nome da categoria passa de 60 caracteres'; end if;

  -- Serializa as gravações da mesma lista: a checagem de repetido sem maiúsculas não tem índice que a garanta.
  perform pg_advisory_xact_lock(hashtext('salvar_categoria:' || p_natureza));
  if exists (select 1 from public.categorias c
              where c.natureza = p_natureza and lower(c.nome) = lower(v_nome) and c.id is distinct from p_id) then
    raise exception 'já existe a categoria "%" na lista a %', v_nome, p_natureza;
  end if;

  if p_id is null then
    insert into public.categorias (natureza, nome, ordem)
    values (p_natureza, v_nome,
            coalesce((select max(c.ordem) from public.categorias c where c.natureza = p_natureza), 0) + 1)
    returning id into v_id;
    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, detalhes)
    values (p_usuario, 'categoria_criada', 'categoria', v_id::text,
            jsonb_build_object('natureza', p_natureza, 'nome', v_nome));
    return v_id;
  end if;

  select c.nome into v_antes from public.categorias c where c.id = p_id and c.natureza = p_natureza for update;
  if not found then raise exception 'a categoria % não existe na lista a %', p_id, p_natureza; end if;
  if v_antes = v_nome then return p_id; end if;
  update public.categorias set nome = v_nome, atualizado_em = now() where id = p_id;
  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, detalhes)
  values (p_usuario, 'categoria_renomeada', 'categoria', p_id::text,
          jsonb_build_object('natureza', p_natureza, 'antes', v_antes, 'depois', v_nome));
  return p_id;
end;
$$;

revoke execute on function public.itens_para_categorizar() from public, anon, authenticated;
grant execute on function public.itens_para_categorizar() to service_role;
revoke execute on function public.definir_categoria_do_item(text, text, bigint, uuid) from public, anon, authenticated;
grant execute on function public.definir_categoria_do_item(text, text, bigint, uuid) to service_role;
revoke execute on function public.salvar_categoria(text, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.salvar_categoria(text, bigint, text, uuid) to service_role;
