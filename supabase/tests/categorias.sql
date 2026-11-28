-- Teste S3 (issue 11): categorias do Hub, ligação item → categoria e as funções do plano. Termina em erro de propósito
-- (rollback). Esperado: "TESTE_OK".
do $$
declare
  falhas text := '';
  n integer;
  t record;
  v_cat bigint;
  -- Itens do plano deixados sem categoria de propósito (não se encaixam claramente em D-3). Se um deles ganhar
  -- categoria, tire daqui; se um item novo aparecer sem categoria, ligue-o ou ponha aqui.
  v_sem_categoria text[] := array[
    'pagar:Deflator de Produção Unimed',
    'pagar:Despesas Financeiras sobre a Venda',
    'pagar:Devolução de Venda',
    'pagar:Frete de Compra',
    'pagar:IRPF',
    'pagar:Pagamentos de Empréstimos',
    'pagar:Repasse Insumos e Honorários Unidade Sabin',
    'receber:Abertura / Fechamento de Caixa',
    'receber:Receita Avaliação de Composição Corporal BIA',
    'receber:Receitas Acompanhamento Nutricional',
    'receber:Receitas Aplicação de Plasma de Agônio',
    'receber:Receitas Balão Intragástrico',
    'receber:Receitas CPRE',
    'receber:Receitas Dilatação de Esôfago/Estômago/Duodeno',
    'receber:Receitas Enteroscopia',
    'receber:Receitas Gastrostomia',
    'receber:Receitas Ligadura Elástica',
    'receber:Receitas Passagem de Sonda Naso Enteral',
    'receber:Receitas Repasse Gastrocenter (28%)',
    'receber:Receitas Retossigmoidoscopia'];
begin
  -- item_sem_unidade: os mesmos casos de itemSemUnidade (src/contas/unidade-do-plano.test.ts).
  for t in select * from (values
      ('Taxa de Cartão sobre a Venda (STELLA)', 'Taxa de Cartão sobre a Venda'),
      ('Taxa de Cartão sobre a Venda (SABIN)', 'Taxa de Cartão sobre a Venda'),
      ('Taxa de Cartão sobre a Venda (TNI)', 'Taxa de Cartão sobre a Venda'),
      ('ISSQN ( Stella )  ', 'ISSQN'),
      ('ISSQN(sabin)', 'ISSQN'),
      ('  ISSQN   (Tni)', 'ISSQN'),
      ('Repasse (TNI) sobre Venda', 'Repasse (TNI) sobre Venda'),
      ('Repasse TNI (STELLA)', 'Repasse TNI'),
      ('Repasse (TNI) (STELLA)', 'Repasse'),
      ('Manometria (esofágica)', 'Manometria (esofágica)'),
      ('  Aluguel de Sala ', 'Aluguel de Sala'),
      ('Assistência Médica Mensalidade (Upgrade E Dependentes) (SABIN)', 'Assistência Médica Mensalidade (Upgrade E Dependentes)')
    ) as x(entrada, esperado) loop
    if public.item_sem_unidade(t.entrada) is distinct from t.esperado then
      falhas := falhas || ' ITEM_SEM_UNIDADE[' || t.entrada || ']=' || coalesce(public.item_sem_unidade(t.entrada), 'null');
    end if;
  end loop;
  if public.item_sem_unidade(null) is not null then falhas := falhas || ' ITEM_SEM_UNIDADE_NULL'; end if;

  -- unidade_do_plano: os mesmos casos de unidadeDoPlano.
  for t in select * from (values
      ('1.02.008.0005', 'stella'), ('3.01.001.0002', 'stella'), ('2.02.008.0005', 'sabin'), ('0.01.001', 'caixa'),
      ('0', 'caixa'), ('1.01.001', 'stella'), ('4.01.001.0001', 'caixa'), ('12.01.001', 'caixa'), ('', 'caixa'),
      ('  2.02.008.0005 ', 'sabin')
    ) as x(entrada, esperado) loop
    if public.unidade_do_plano(t.entrada) is distinct from t.esperado then
      falhas := falhas || ' UNIDADE_DO_PLANO[' || t.entrada || ']=' || coalesce(public.unidade_do_plano(t.entrada), 'null');
    end if;
  end loop;
  if public.unidade_do_plano(null) is distinct from 'caixa' then falhas := falhas || ' UNIDADE_DO_PLANO_NULL'; end if;

  -- natureza_do_plano: segunda parte do código.
  if public.natureza_do_plano('1.01.001.0003') is distinct from 'receber' then falhas := falhas || ' NATUREZA_01'; end if;
  if public.natureza_do_plano('2.02.008.0005') is distinct from 'pagar' then falhas := falhas || ' NATUREZA_02'; end if;
  if public.natureza_do_plano('1.01.001') is distinct from 'receber' then falhas := falhas || ' NATUREZA_GRUPO'; end if;
  if public.natureza_do_plano('0') is not null or public.natureza_do_plano(null) is not null
     or public.natureza_do_plano('1.03.001') is not null then
    falhas := falhas || ' NATUREZA_DESCONHECIDA_DEVIA_SER_NULL';
  end if;

  -- Imutáveis (usadas em índice e check).
  select count(*) into n from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('item_sem_unidade', 'unidade_do_plano', 'natureza_do_plano')
     and provolatile = 'i';
  if n <> 3 then falhas := falhas || ' FUNCOES_NAO_IMUTAVEIS'; end if;

  -- Esquema: RLS ligado, sem policy, sem acesso para anon/authenticated.
  select count(*) into n from pg_class
   where oid in ('public.categorias'::regclass, 'public.categoria_do_item'::regclass) and relrowsecurity and relforcerowsecurity;
  if n <> 2 then falhas := falhas || ' RLS_DESLIGADO'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('categorias', 'categoria_do_item');
  if n <> 0 then falhas := falhas || ' TEM_POLICY'; end if;
  if has_table_privilege('anon', 'public.categorias', 'select') or has_table_privilege('authenticated', 'public.categorias', 'select')
     or has_table_privilege('anon', 'public.categoria_do_item', 'select')
     or has_table_privilege('authenticated', 'public.categoria_do_item', 'insert') then
    falhas := falhas || ' ACESSO_DO_NAVEGADOR';
  end if;

  -- A ligação guarda o item já sem sufixo.
  select id into v_cat from public.categorias where natureza = 'pagar' and nome = 'Imposto';
  begin
    insert into public.categoria_do_item (natureza, item, categoria_id) values ('pagar', 'Item Teste (STELLA)', v_cat);
    falhas := falhas || ' ACEITOU_ITEM_COM_SUFIXO';
  exception when check_violation then null;
  end;
  -- Categoria de pagar não serve a item de receber (listas separadas, D-3).
  begin
    insert into public.categoria_do_item (natureza, item, categoria_id) values ('receber', 'Item Teste', v_cat);
    falhas := falhas || ' ACEITOU_NATUREZA_TROCADA';
  exception when foreign_key_violation then null;
  end;
  -- Categoria em uso não some.
  begin
    delete from public.categorias where id = v_cat;
    falhas := falhas || ' APAGOU_CATEGORIA_EM_USO';
  exception when foreign_key_violation then null;
  end;

  -- Ligação inicial (D-3): as duas listas, na ordem da issue.
  if (select string_agg(nome, '|' order by ordem) from public.categorias where natureza = 'pagar') is distinct from
     'Imposto|Taxa de cartão|Despesa bancária|Pessoal|Repasse de honorário médico|Repasse TNI|Insumos|Manutenção e exames|'
     'Administrativo|Marketing|Investimento|Retirada|Transferência' then
    falhas := falhas || ' LISTA_PAGAR';
  end if;
  if (select string_agg(nome, '|' order by ordem) from public.categorias where natureza = 'receber') is distinct from
     'Endoscopia|Colonoscopia|Consultas|Testes respiratórios|Manometria|pH-metria|Exames diversos|TNI|Aluguel de sala|'
     'Outras receitas não operacionais|Transição de sistema' then
    falhas := falhas || ' LISTA_RECEBER';
  end if;

  -- Alguns itens conferidos um a um (as três raízes caem no mesmo item).
  for t in select * from (values
      ('pagar', 'ISSQN', 'Imposto'), ('pagar', 'IPTU', 'Imposto'), ('pagar', 'PIS/COFINS/CSLL/IRPJ- Retido na Fonte', 'Imposto'),
      ('pagar', 'Taxa de Cartão sobre a Venda', 'Taxa de cartão'), ('pagar', 'Tarifas Bancárias', 'Despesa bancária'),
      ('pagar', 'Salários CMOI', 'Pessoal'), ('pagar', 'Repasse Honorários Médicos', 'Repasse de honorário médico'),
      ('pagar', 'Repasse Terapia Nutricional Injetável', 'Repasse TNI'), ('pagar', 'Custo dos Materiais e Medicamentos', 'Insumos'),
      ('pagar', 'Manutenção Corretiva', 'Manutenção e exames'), ('pagar', 'Software', 'Administrativo'),
      ('pagar', 'Mídia Digital', 'Marketing'), ('pagar', 'Investimentos em Equipamentos', 'Investimento'),
      ('pagar', 'Retirada Pró-Labore', 'Retirada'), ('pagar', 'Transf', 'Transferência'),
      ('receber', 'Receitas Endoscopia', 'Endoscopia'), ('receber', 'Receitas Kit de Colonoscopia', 'Colonoscopia'),
      ('receber', 'Receitas Manometria Esofágica', 'Manometria'), ('receber', 'Receitas Tirzepatida', 'TNI'),
      ('receber', 'Receitas Transição de Sistema', 'Transição de sistema')
    ) as x(natureza, item, categoria) loop
    if not exists (select 1 from public.categoria_do_item l join public.categorias c on c.id = l.categoria_id
                    where l.natureza = t.natureza and l.item = t.item and c.nome = t.categoria) then
      falhas := falhas || ' LIGACAO[' || t.natureza || ':' || t.item || ']';
    end if;
  end loop;

  -- Todo item do plano gravado (código raiz.natureza.grupo.item) tem categoria, exceto os de propósito.
  for t in
    select distinct public.natureza_do_plano(p.codigo) || ':' || public.item_sem_unidade(p.nome) as chave
      from public.plano_financeiro p
     where p.tipo = 'grupo_receita_despesa' and p.visto_na_ultima_sync and p.codigo ~ '^\d+\.\d+\.\d+\.\d+$'
       and not exists (select 1 from public.categoria_do_item l
                        where l.natureza = public.natureza_do_plano(p.codigo) and l.item = public.item_sem_unidade(p.nome))
       and not (public.natureza_do_plano(p.codigo) || ':' || public.item_sem_unidade(p.nome) = any (v_sem_categoria))
  loop
    falhas := falhas || ' SEM_CATEGORIA[' || t.chave || ']';
  end loop;
  -- E a lista de exceções não fica velha: cada uma existe no plano e continua sem categoria.
  for t in select unnest(v_sem_categoria) as chave loop
    if exists (select 1 from public.categoria_do_item l where l.natureza || ':' || l.item = t.chave) then
      falhas := falhas || ' EXCECAO_TEM_CATEGORIA[' || t.chave || ']';
    end if;
    if not exists (select 1 from public.plano_financeiro p
                    where p.tipo = 'grupo_receita_despesa' and p.visto_na_ultima_sync
                      and public.natureza_do_plano(p.codigo) || ':' || public.item_sem_unidade(p.nome) = t.chave) then
      falhas := falhas || ' EXCECAO_FORA_DO_PLANO[' || t.chave || ']';
    end if;
  end loop;
  -- Nenhuma ligação de item que não existe no plano (erro de digitação na migration de dados).
  for t in select l.natureza || ':' || l.item as chave from public.categoria_do_item l
            where not exists (select 1 from public.plano_financeiro p
                               where p.tipo = 'grupo_receita_despesa' and p.codigo ~ '^\d+\.\d+\.\d+\.\d+$'
                                 and public.natureza_do_plano(p.codigo) = l.natureza
                                 and public.item_sem_unidade(p.nome) = l.item) loop
    falhas := falhas || ' LIGACAO_SEM_ITEM[' || t.chave || ']';
  end loop;

  if falhas <> '' then raise exception 'TESTE_FALHOU:%', falhas; end if;
  raise exception 'TESTE_OK';
end;
$$;
