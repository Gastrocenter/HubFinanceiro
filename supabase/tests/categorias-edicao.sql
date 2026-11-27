-- Teste S6 (issue 11): edição de categorias (itens_para_categorizar, definir_categoria_do_item, salvar_categoria).
-- Termina em erro de propósito (rollback): nada fica gravado. Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  n integer;
  v_imposto bigint;
  v_endoscopia bigint;
  v_nova bigint;
  v_mudou boolean;
begin
  select id into v_imposto from public.categorias where natureza = 'pagar' and nome = 'Imposto';
  select id into v_endoscopia from public.categorias where natureza = 'receber' and nome = 'Endoscopia';

  -- Listagem: o item das três raízes aparece uma vez, sem sufixo, com a categoria da ligação.
  select count(*) into n from public.itens_para_categorizar()
   where natureza = 'pagar' and item = 'Taxa de Cartão sobre a Venda' and categoria_id is not null
     and raizes @> array['1', '2'];
  if n <> 1 then falhas := falhas || ' LISTA_ITEM_TRES_RAIZES'; end if;
  if exists (select 1 from public.itens_para_categorizar() where item ~* '\((stella|sabin|tni)\)\s*$') then
    falhas := falhas || ' LISTA_COM_SUFIXO';
  end if;
  if exists (select 1 from public.itens_para_categorizar() group by natureza, item having count(*) > 1) then
    falhas := falhas || ' LISTA_REPETIDA';
  end if;
  -- Item deixado sem categoria de propósito aparece sem categoria.
  if not exists (select 1 from public.itens_para_categorizar() where natureza = 'pagar' and item = 'IRPF' and categoria_id is null) then
    falhas := falhas || ' LISTA_SEM_CATEGORIA';
  end if;
  -- As contas da lista somam as contas com natureza de plano conhecida e item.
  if (select sum(contas) from public.itens_para_categorizar()) is distinct from
     (select count(*) from public.contas_pagar_receber c
       where public.natureza_do_plano(c.grupo_receita_despesa) is not null
         and public.item_sem_unidade(c.nome_grupo_receita_despesa) <> '') then
    falhas := falhas || ' LISTA_CONTAS_NAO_BATEM';
  end if;

  -- Ligar um item sem categoria, auditar, e repetir sem efeito.
  v_mudou := public.definir_categoria_do_item('pagar', 'IRPF', v_imposto, null);
  if not v_mudou then falhas := falhas || ' DEFINIR_NAO_MUDOU'; end if;
  if not exists (select 1 from public.categoria_do_item where natureza = 'pagar' and item = 'IRPF' and categoria_id = v_imposto) then
    falhas := falhas || ' DEFINIR_NAO_GRAVOU';
  end if;
  if not exists (select 1 from public.auditoria where acao = 'categoria_do_item_alterada' and entidade_id = 'pagar:IRPF'
                    and detalhes ->> 'depois' = 'Imposto' and detalhes -> 'antes' = 'null'::jsonb) then
    falhas := falhas || ' DEFINIR_SEM_AUDITORIA';
  end if;
  v_mudou := public.definir_categoria_do_item('pagar', 'IRPF', v_imposto, null);
  if v_mudou then falhas := falhas || ' DEFINIR_REPETIDO_MUDOU'; end if;
  -- Só a primeira gravação audita.
  if (select count(*) from public.auditoria where acao = 'categoria_do_item_alterada' and entidade_id = 'pagar:IRPF'
         and ocorrido_em = now()) <> 1 then
    falhas := falhas || ' DEFINIR_REPETIDO_AUDITOU';
  end if;
  -- Tirar a ligação: volta a "Sem categoria".
  perform public.definir_categoria_do_item('pagar', 'IRPF', null, null);
  if exists (select 1 from public.categoria_do_item where natureza = 'pagar' and item = 'IRPF') then
    falhas := falhas || ' TIRAR_NAO_APAGOU';
  end if;

  -- Recusas: categoria da outra lista, item com sufixo, item que não existe, natureza inválida.
  begin
    perform public.definir_categoria_do_item('pagar', 'IRPF', v_endoscopia, null);
    falhas := falhas || ' ACEITOU_OUTRA_LISTA';
  exception when raise_exception then null;
  end;
  begin
    perform public.definir_categoria_do_item('pagar', 'IRPF (SABIN)', v_imposto, null);
    falhas := falhas || ' ACEITOU_SUFIXO';
  exception when raise_exception then null;
  end;
  begin
    perform public.definir_categoria_do_item('pagar', 'Item que não existe', v_imposto, null);
    falhas := falhas || ' ACEITOU_ITEM_INEXISTENTE';
  exception when raise_exception then null;
  end;
  begin
    perform public.definir_categoria_do_item('outra', 'IRPF', v_imposto, null);
    falhas := falhas || ' ACEITOU_NATUREZA';
  exception when raise_exception then null;
  end;

  -- Criar categoria: espaços normalizados, no fim da lista, auditada.
  v_nova := public.salvar_categoria('pagar', null, '  Serviços   de terceiros ', null);
  if (select nome from public.categorias where id = v_nova) is distinct from 'Serviços de terceiros' then
    falhas := falhas || ' CRIAR_NOME';
  end if;
  if (select ordem from public.categorias where id = v_nova) <= (select max(ordem) from public.categorias where natureza = 'pagar' and id <> v_nova) then
    falhas := falhas || ' CRIAR_ORDEM';
  end if;
  if not exists (select 1 from public.auditoria where acao = 'categoria_criada' and entidade_id = v_nova::text) then
    falhas := falhas || ' CRIAR_SEM_AUDITORIA';
  end if;
  -- Repetida sem diferenciar maiúsculas: recusa; na outra lista, vale.
  begin
    perform public.salvar_categoria('pagar', null, 'IMPOSTO', null);
    falhas := falhas || ' ACEITOU_REPETIDA';
  exception when raise_exception then null;
  end;
  begin
    perform public.salvar_categoria('pagar', null, '   ', null);
    falhas := falhas || ' ACEITOU_VAZIA';
  exception when raise_exception then null;
  end;
  begin
    perform public.salvar_categoria('pagar', null, repeat('a', 61), null);
    falhas := falhas || ' ACEITOU_LONGA';
  exception when raise_exception then null;
  end;
  perform public.salvar_categoria('receber', null, 'Serviços de terceiros', null);

  -- Renomear: só a própria pode mudar a grafia; categoria da outra lista não é encontrada.
  perform public.salvar_categoria('pagar', v_nova, 'SERVIÇOS DE TERCEIROS', null);
  if (select nome from public.categorias where id = v_nova) is distinct from 'SERVIÇOS DE TERCEIROS' then
    falhas := falhas || ' RENOMEAR';
  end if;
  if not exists (select 1 from public.auditoria where acao = 'categoria_renomeada' and entidade_id = v_nova::text
                    and detalhes ->> 'antes' = 'Serviços de terceiros') then
    falhas := falhas || ' RENOMEAR_SEM_AUDITORIA';
  end if;
  begin
    perform public.salvar_categoria('receber', v_imposto, 'Outro nome', null);
    falhas := falhas || ' RENOMEOU_OUTRA_LISTA';
  exception when raise_exception then null;
  end;
  begin
    perform public.salvar_categoria('pagar', v_nova, 'Imposto', null);
    falhas := falhas || ' RENOMEOU_PARA_REPETIDA';
  exception when raise_exception then null;
  end;

  -- Fechadas ao navegador.
  select count(*) into n from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('itens_para_categorizar', 'definir_categoria_do_item', 'salvar_categoria')
     and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'));
  if n <> 0 then falhas := falhas || ' FUNCAO_ABERTA_AO_NAVEGADOR'; end if;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
