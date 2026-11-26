-- =============================================================================
-- HUB FINANCEIRO GASTROCENTER - ESTRUTURA INICIAL DO BANCO
-- =============================================================================
-- IMPORTANTE: este arquivo NAO precisa da chave da API.
-- Voce pode rodar agora, mesmo com a senha do ProDoctor pendente.
--
-- Onde rodar: Supabase > projeto > SQL Editor > New query > colar tudo > Run.
--
-- Ideia simples:
--   - As tabelas abaixo sao os "comodos" onde os dados vao morar.
--   - Cada tabela de dados importada tem uma coluna chave_integracao:
--     e o "RG" que evita o mesmo dado entrar duas vezes.
--   - Campos de data/hora ficam como TEXTO no inicio, porque o ProDoctor
--     devolve "DD/MM/YYYY". Depois a gente converte com calma. Melhor assim
--     do que errar a conversao e perder informacao.
-- =============================================================================

create extension if not exists pgcrypto;

-- 1. UNIDADES
create table if not exists unidades (
    id                  integer primary key,
    nome                text not null,
    cnpj                text,
    chave_integracao    text unique,
    ativo               boolean default true,
    criado_em           timestamptz default now()
);
comment on table unidades is 'Unidades da clinica. Vem de /api/v1/LocaisProDoctor.';
comment on column unidades.cnpj is 'Cada unidade pode faturar por um CNPJ diferente.';

-- 2. USUARIOS
create table if not exists usuarios (
    id                  integer primary key,
    nome                text not null,
    ativo               boolean default true,
    criado_em           timestamptz default now()
);
comment on table usuarios is 'Usuarios do ProDoctor (medicos, tecnicos, funcionarios).';

-- 3. MEDICOS
create table if not exists medicos (
    usuario_id          integer primary key references usuarios(id),
    cnpj_pj             text,
    regra_tipo          text,
    regra_valor         numeric(18,2),
    base_calculo        text,
    observacao          text,
    atualizado_em       timestamptz default now()
);
comment on table medicos is 'Regra de repasse cadastrada pela clinica. NAO e calculada pela API.';
comment on column medicos.regra_valor is 'Se regra_tipo=percentual, guarda 30.00 para 30%.';

-- 4. CONVENIOS
create table if not exists convenios (
    id                  integer primary key,
    nome                text not null,
    ativo               boolean default true,
    criado_em           timestamptz default now()
);
comment on table convenios is 'Convênios do ProDoctor. Vem de /api/v1/Convenios.';

-- 5. FATURAS
create table if not exists faturas (
    id                      bigserial primary key,
    chave_integracao        text unique not null,
    unidade_id              integer references unidades(id),
    convenio_id             integer references convenios(id),
    numero_fatura           text,
    situacao                text,
    data_criacao            text,
    data_fechamento         text,
    data_envio              text,
    total_conta             numeric(18,2),
    total_procedimentos     numeric(18,2),
    total_materiais         numeric(18,2),
    total_medicamentos      numeric(18,2),
    total_glosa             numeric(18,2),
    total_recuperado        numeric(18,2),
    total_recursado         numeric(18,2),
    a_receber               numeric(18,2),
    quantidade_contas       integer,
    atualizado_em           timestamptz default now()
);
comment on table faturas is 'Faturas de convênio. Base da conferencia de receita (F1).';
comment on column faturas.a_receber is 'Valor que o convenio realmente deve pagar. Se mudou, houve glosa.';

-- 6. CONTAS DE PACIENTES
create table if not exists contas_pacientes (
    id                          bigserial primary key,
    chave_integracao            text unique not null,
    unidade_id                  integer references unidades(id),
    convenio_id                 integer references convenios(id),
    usuario_id                  integer references usuarios(id),
    numero_fatura               text,
    numero_conta                text,
    paciente_codigo             text,
    paciente_nome               text,
    data_entrada                text,
    total_procedimentos         numeric(18,2),
    total_materiais             numeric(18,2),
    total_medicamentos          numeric(18,2),
    total_gases                 numeric(18,2),
    total_taxas                 numeric(18,2),
    total_diarias               numeric(18,2),
    total_glosas                numeric(18,2),
    total_recuperado            numeric(18,2),
    atualizado_em               timestamptz default now()
);
comment on table contas_pacientes is 'Atendimentos. Liga receita, medico e unidade (RN-01).';
comment on column contas_pacientes.paciente_nome is 'Dado sensivel. Em testes, usar nome ficticio.';

-- 7. PROCEDIMENTOS
create table if not exists procedimentos (
    id                          bigserial primary key,
    chave_integracao            text unique not null,
    unidade_id                  integer references unidades(id),
    convenio_id                 integer references convenios(id),
    usuario_id                  integer references usuarios(id),
    numero_fatura               text,
    numero_conta                text,
    linha_procedimento          text,
    codigo_procedimento         text,
    descricao_procedimento      text,
    quantidade                  numeric(18,2),
    valor_total                 numeric(18,2),
    valor_glosa                 numeric(18,2),
    valor_recuperado            numeric(18,2),
    funcao_repasse              text,
    grupo_repasses              text,
    nao_repassar                text,
    somente_repassa             text,
    nao_incluir_repasse         text,
    atualizado_em               timestamptz default now()
);
comment on table procedimentos is 'Itens faturados. Origem do repasse e da glosa (F1/F2).';

-- 8. REPASSES
create table if not exists repasses (
    id                          bigserial primary key,
    chave_integracao            text unique not null,
    unidade_id                  integer references unidades(id),
    usuario_id                  integer references usuarios(id),
    numero_repasse              text,
    data_repasse                text,
    numero_fatura               text,
    numero_conta                text,
    linha                       text,
    nome_convenio               text,
    tipo_repasse                text,
    funcao_repasse              text,
    total_conta                 numeric(18,2),
    base_calculo_bruto          numeric(18,2),
    percentual_imposto          numeric(18,2),
    valor_imposto               numeric(18,2),
    base_calculo_liquido        numeric(18,2),
    valor_repassado             numeric(18,2),
    valor_repassado_medico      numeric(18,2),
    valor_repassado_clinica     numeric(18,2),
    atualizado_em               timestamptz default now()
);
comment on table repasses is 'Repasse ja calculado pelo ProDoctor. Nao recalculamos (F2/A1).';
comment on column repasses.valor_repassado_medico is 'Vira a conta a pagar do medico.';
comment on column repasses.valor_repassado_clinica is 'Parte que fica com a clinica (margem).';

-- 9. CATEGORIA DRE
create table if not exists categoria_dre (
    id                  bigserial primary key,
    nome_origem         text not null,
    sistema_origem      text,
    linha_dre           text,
    natureza            text,
    unique (nome_origem, sistema_origem)
);
comment on table categoria_dre is 'De-para para o DRE. Sem linha definida, o lancamento gera alerta (RN-05).';

-- 10. LANCAMENTOS
create table if not exists lancamentos (
    id                  uuid primary key default gen_random_uuid(),
    chave_integracao    text unique,
    descricao           text not null,
    valor               numeric(18,2) not null,
    data_competencia    date,
    data_vencimento     date,
    categoria_dre_id    bigint references categoria_dre(id),
    origem              text default 'hub',
    status              text default 'rascunho',
    criado_por          text,
    aprovado_por        text,
    pago_por            text,
    observacao          text,
    criado_em           timestamptz default now(),
    aprovado_em         timestamptz,
    pago_em             timestamptz
);
comment on table lancamentos is 'Despesas do Hub. Substitui a planilha (F4).';
comment on column lancamentos.status is 'Aprovacao e pagamento sao permissoes diferentes (RN-06/07).';

-- 11. RATEIOS
create table if not exists rateios (
    id                  bigserial primary key,
    lancamento_id       uuid references lancamentos(id) on delete cascade,
    unidade_id          integer references unidades(id),
    valor               numeric(18,2) not null,
    percentual          numeric(18,2),
    unique (lancamento_id, unidade_id)
);
comment on table rateios is 'Divisao da despesa por unidade. Ex.: 6000/4000 (RN-04).';

-- 12. INTEGRACAO_EXECUCOES
create table if not exists integracao_execucoes (
    id                      bigserial primary key,
    endpoint                text not null,
    executado_em            timestamptz default now(),
    quantidade_registros    integer,
    arquivo                 text,
    status                  text default 'ok',
    detalhe                 text
);
comment on table integracao_execucoes is 'Historico de coletas. Ajuda a responder: o que falhou? (F7).';
