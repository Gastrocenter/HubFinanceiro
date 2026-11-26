-- Issue 10 (dívida do code-review de 26/11/2026).
-- Item 7: procedimento que some de um mês e reaparece (em outro mês ou no mesmo) fecha a pendência procedimento_sumiu.
-- Item 8: sinais_dos_profissionais em ordem estável, para ser lida página a página.

create or replace function public.aplicar_mes_de_procedimentos(p_empresa text, p_mes text, p_diferenca jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_gravados integer;
  v_sumiram integer;
  v_voltaram integer;
  v_pendencias integer;
  v_resolvidas integer;
  v_sumidas_resolvidas integer;
begin
  insert into public.recebiveis (
    empresa, codigo_local, conta, linha, mes, data, fatura, unidade_id, profissional_id, convenio_id,
    nome_profissional_origem, nome_convenio_origem, especialidade_profissional, funcao, funcao_repasse, codigo_procedimento,
    descricao_procedimento, tipo_procedimento, grupo_procedimentos_repasses, quantidade, valor_total,
    valor_diferenca, valor_glosa, valor_recuperado, total_materiais_medicamentos, total_taxas_diarias,
    total_glosas_materiais_medicamentos, total_glosas_taxas_diarias, total_recuperado_materiais_medicamentos,
    total_recuperado_taxas_diarias, nao_repassar, somente_repasse, nao_incluir_repasse, visto_na_ultima_sync)
  select p_empresa, r.codigo_local, r.conta, r.linha, p_mes, r.data, coalesce(r.fatura, ''), r.unidade_id, r.profissional_id, r.convenio_id,
    coalesce(r.nome_profissional_origem, ''), coalesce(r.nome_convenio_origem, ''), coalesce(r.especialidade_profissional, ''),
    coalesce(r.funcao, ''), coalesce(r.funcao_repasse, ''),
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
    especialidade_profissional = excluded.especialidade_profissional,
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

  -- Vínculo que passou a existir fecha a pendência correspondente (code-review item 2).
  update public.pendencias p
     set estado = 'resolvida', resolvido_em = now()
    from jsonb_to_recordset(coalesce(p_diferenca -> 'resolver', '[]'::jsonb)) as x(tipo text, referencia text)
   where p.empresa = p_empresa and p.tipo = x.tipo and p.referencia = x.referencia and p.estado = 'aberta';
  get diagnostics v_resolvidas = row_count;

  -- Linha gravada ou que voltou não está mais sumida, mesmo que tenha sumido de outro mês (code-review item 7).
  update public.pendencias p
     set estado = 'resolvida', resolvido_em = now()
   where p.empresa = p_empresa and p.tipo = 'procedimento_sumiu' and p.estado = 'aberta'
     and p.referencia in (
       select r.codigo_local || ':' || r.conta || ':' || r.linha
         from jsonb_to_recordset(coalesce(p_diferenca -> 'gravar', '[]'::jsonb)) as r(codigo_local text, conta text, linha text)
       union
       select jsonb_array_elements_text(coalesce(p_diferenca -> 'voltaram', '[]'::jsonb)));
  get diagnostics v_sumidas_resolvidas = row_count;
  v_resolvidas := v_resolvidas + v_sumidas_resolvidas;

  if v_gravados + v_sumiram + v_voltaram + v_pendencias + v_resolvidas > 0 then
    insert into public.auditoria (acao, entidade, entidade_id, detalhes)
    values ('receita_sincronizada', 'recebiveis', p_empresa || ':' || p_mes,
            jsonb_build_object('empresa', p_empresa, 'mes', p_mes, 'gravados', v_gravados, 'sumiram', v_sumiram,
                               'voltaram', v_voltaram, 'pendencias_novas', v_pendencias,
                               'pendencias_resolvidas', v_resolvidas));
  end if;
end;
$$;

create or replace function public.sinais_dos_profissionais()
returns table (de_para_id bigint, especialidades text[], procedimentos bigint, meses bigint)
language sql
stable
set search_path = ''
as $$
  select d.id,
         coalesce(array_agg(distinct r.especialidade_profissional) filter (where r.especialidade_profissional <> ''), '{}'),
         count(r.id),
         count(distinct r.mes)
    from public.de_para d
    left join public.recebiveis r on r.profissional_id = d.profissional_id and r.visto_na_ultima_sync
   where d.tipo = 'profissional'
   group by d.id
   order by d.id;
$$;
