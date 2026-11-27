-- Issue 11 (S3, D-3 e D-4): categorias do Hub e a ligação inicial, montada a partir dos itens do plano financeiro
-- gravado em 26/11/2026 (códigos raiz.natureza.grupo.item; nomes sem o sufixo da unidade). Natureza da ligação pela
-- segunda parte do código: 01 → receber, 02 → pagar.
-- Ficam sem categoria, de propósito (não se encaixam claramente em D-3; viram pendência "a revisar", D-5):
--   a pagar: Deflator de Produção Unimed, Despesas Financeiras sobre a Venda, Devolução de Venda, Frete de Compra, IRPF,
--            Pagamentos de Empréstimos, Repasse Insumos e Honorários Unidade Sabin;
--   a receber: Abertura / Fechamento de Caixa, Receita Avaliação de Composição Corporal BIA, Receitas Acompanhamento
--            Nutricional, Receitas Aplicação de Plasma de Agônio, Receitas Balão Intragástrico, Receitas CPRE, Receitas
--            Dilatação de Esôfago/Estômago/Duodeno, Receitas Enteroscopia, Receitas Gastrostomia, Receitas Ligadura
--            Elástica, Receitas Passagem de Sonda Naso Enteral, Receitas Repasse Gastrocenter (28%), Receitas
--            Retossigmoidoscopia.
-- A mesma lista está em supabase/tests/categorias.sql. Idempotente.

insert into public.categorias (natureza, nome, ordem)
values
  ('pagar', 'Imposto', 1),
  ('pagar', 'Taxa de cartão', 2),
  ('pagar', 'Despesa bancária', 3),
  ('pagar', 'Pessoal', 4),
  ('pagar', 'Repasse de honorário médico', 5),
  ('pagar', 'Repasse TNI', 6),
  ('pagar', 'Insumos', 7),
  ('pagar', 'Manutenção e exames', 8),
  ('pagar', 'Administrativo', 9),
  ('pagar', 'Marketing', 10),
  ('pagar', 'Investimento', 11),
  ('pagar', 'Retirada', 12),
  ('pagar', 'Transferência', 13),
  ('receber', 'Endoscopia', 1),
  ('receber', 'Colonoscopia', 2),
  ('receber', 'Consultas', 3),
  ('receber', 'Testes respiratórios', 4),
  ('receber', 'Manometria', 5),
  ('receber', 'pH-metria', 6),
  ('receber', 'Exames diversos', 7),
  ('receber', 'TNI', 8),
  ('receber', 'Aluguel de sala', 9),
  ('receber', 'Outras receitas não operacionais', 10),
  ('receber', 'Transição de sistema', 11)
on conflict (natureza, nome) do nothing;

insert into public.categoria_do_item (natureza, item, categoria_id)
select l.natureza, l.item, c.id
  from (values
    -- A pagar ------------------------------------------------------------------------------------------------------
    -- Imposto (grupos 007 tributárias e 008 variáveis)
    ('pagar', 'PIS/COFINS/CSLL/IRPJ', 'Imposto'),
    ('pagar', 'PIS/COFINS/CSLL/IRPJ- Retido na Fonte', 'Imposto'),
    ('pagar', 'ISSQN', 'Imposto'),
    ('pagar', 'ISSQN - Retido na Fonte', 'Imposto'),
    ('pagar', 'IPTU', 'Imposto'),
    ('pagar', 'IPVA', 'Imposto'),
    ('pagar', 'ICMS / Diferença de Alíquota', 'Imposto'),
    ('pagar', 'Taxa de Incêndio', 'Imposto'),
    -- Taxa de cartão
    ('pagar', 'Taxa de Cartão sobre a Venda', 'Taxa de cartão'),
    -- Despesa bancária (grupo 011 despesas financeiras)
    ('pagar', 'Tarifas Bancárias', 'Despesa bancária'),
    ('pagar', 'Anuidade Cartão Gastrocenter', 'Despesa bancária'),
    ('pagar', 'IOF', 'Despesa bancária'),
    ('pagar', 'Outras Despesas Financeiras', 'Despesa bancária'),
    -- Pessoal (grupo 002, menos IRPF)
    ('pagar', 'Salários CMOI', 'Pessoal'),
    ('pagar', 'Férias CMOI', 'Pessoal'),
    ('pagar', 'Décimo Terceiro CMOI', 'Pessoal'),
    ('pagar', 'FGTS CMOI', 'Pessoal'),
    ('pagar', 'INSS CMOI', 'Pessoal'),
    ('pagar', 'Outros Encargos CMOI', 'Pessoal'),
    ('pagar', 'Rescisão', 'Pessoal'),
    ('pagar', 'Insalubridade', 'Pessoal'),
    ('pagar', 'Assiduidade', 'Pessoal'),
    ('pagar', 'Prêmios CMOI', 'Pessoal'),
    ('pagar', 'Sobreaviso Enfermagem', 'Pessoal'),
    ('pagar', 'Estagiários', 'Pessoal'),
    ('pagar', 'Vale Transporte CMOI', 'Pessoal'),
    ('pagar', 'Alimentação CMOI', 'Pessoal'),
    ('pagar', 'Assistência Médica Co-Participação', 'Pessoal'),
    ('pagar', 'Assistência Médica Mensalidade', 'Pessoal'),
    ('pagar', 'Assistência Médica Mensalidade (Upgrade E Dependentes)', 'Pessoal'),
    ('pagar', 'Assistência Odontológica Mensalidade', 'Pessoal'),
    ('pagar', 'Saúde Ocupacional', 'Pessoal'),
    ('pagar', 'Capacitação', 'Pessoal'),
    ('pagar', 'Uniformes', 'Pessoal'),
    ('pagar', 'Empréstimo Funcionárias', 'Pessoal'),
    -- Repasse de honorário médico
    ('pagar', 'Repasse Honorários Médicos', 'Repasse de honorário médico'),
    ('pagar', 'Repasse Solicitantes', 'Repasse de honorário médico'),
    -- Repasse TNI
    ('pagar', 'Repasse Terapia Nutricional Injetável', 'Repasse TNI'),
    ('pagar', 'Repasse Insumos e Honorários Unidade TNI', 'Repasse TNI'),
    -- Insumos
    ('pagar', 'Custo dos Materiais e Medicamentos', 'Insumos'),
    ('pagar', 'Custo dos MAT/MED Terapia Nutricional Injetável', 'Insumos'),
    -- Manutenção e exames (grupos 005 gastos dos exames e 006 manutenção do imobilizado)
    ('pagar', 'Manutenção Corretiva', 'Manutenção e exames'),
    ('pagar', 'Manutenção Preventiva', 'Manutenção e exames'),
    ('pagar', 'Esterilização/Outros', 'Manutenção e exames'),
    ('pagar', 'Lavanderia', 'Manutenção e exames'),
    ('pagar', 'EPI', 'Manutenção e exames'),
    ('pagar', 'Termometros/Esfigmo/Lençol De Papel/Garrote/Perfex', 'Manutenção e exames'),
    ('pagar', 'DESPESA COM MANUTENÇÃO E GASTOS GERAIS RELATIVOS AOS EXAMES', 'Manutenção e exames'),
    ('pagar', 'Outras Despesas com Imobilizado', 'Manutenção e exames'),
    ('pagar', 'Pintura Mão de Obra', 'Manutenção e exames'),
    ('pagar', 'Pintura Material', 'Manutenção e exames'),
    -- Administrativo (grupo 001, mais Conselhos)
    ('pagar', 'Água', 'Administrativo'),
    ('pagar', 'Aluguel', 'Administrativo'),
    ('pagar', 'Artes Gráficas', 'Administrativo'),
    ('pagar', 'Condomínio', 'Administrativo'),
    ('pagar', 'Confraternização', 'Administrativo'),
    ('pagar', 'Consultores', 'Administrativo'),
    ('pagar', 'Contadores', 'Administrativo'),
    ('pagar', 'Correios', 'Administrativo'),
    ('pagar', 'Dedetização', 'Administrativo'),
    ('pagar', 'Despachantes', 'Administrativo'),
    ('pagar', 'Despesas com Processos Judiciais', 'Administrativo'),
    ('pagar', 'Energia Elétrica', 'Administrativo'),
    ('pagar', 'Hardware', 'Administrativo'),
    ('pagar', 'Internet e Telefone', 'Administrativo'),
    ('pagar', 'Lanches/Compras Mercado', 'Administrativo'),
    ('pagar', 'Material de Escritório', 'Administrativo'),
    ('pagar', 'Material de Limpeza', 'Administrativo'),
    ('pagar', 'Moto Entrega', 'Administrativo'),
    ('pagar', 'Outras Despesas Administrativas', 'Administrativo'),
    ('pagar', 'Seguros e Alarmes', 'Administrativo'),
    ('pagar', 'Serviços de Terceiros - Jurídicos', 'Administrativo'),
    ('pagar', 'Sindicatos', 'Administrativo'),
    ('pagar', 'Software', 'Administrativo'),
    ('pagar', 'Conselhos', 'Administrativo'),
    -- Marketing (grupo 003)
    ('pagar', 'Agência De Marketing', 'Marketing'),
    ('pagar', 'Assinaturas Jornais e Revistas', 'Marketing'),
    ('pagar', 'Brindes e Presentes para Parceiros', 'Marketing'),
    ('pagar', 'Mídia Digital', 'Marketing'),
    ('pagar', 'Mídia Tradicional', 'Marketing'),
    -- Investimento (grupo 009; na TNI, dentro do 008)
    ('pagar', 'INVESTIMENTO', 'Investimento'),
    ('pagar', 'Investimentos Eletrônicos', 'Investimento'),
    ('pagar', 'Investimentos em Equipamentos', 'Investimento'),
    ('pagar', 'Investimentos Imobilizado', 'Investimento'),
    ('pagar', 'Investimentos Mão de Obra', 'Investimento'),
    ('pagar', 'Investimentos Móveis e Outros', 'Investimento'),
    ('pagar', 'Aplicações Financeiras', 'Investimento'),
    -- Retirada (grupo 010; na TNI, dentro do 008)
    ('pagar', 'RETIRADA', 'Retirada'),
    ('pagar', 'Retirada Pró-Labore', 'Retirada'),
    ('pagar', 'Distribuição de Lucros', 'Retirada'),
    -- Transferência (grupo 013)
    ('pagar', 'Transf', 'Transferência'),
    -- A receber ----------------------------------------------------------------------------------------------------
    ('receber', 'Receitas Endoscopia', 'Endoscopia'),
    ('receber', 'Receitas Colonoscopia', 'Colonoscopia'),
    ('receber', 'Receitas CO2 na Colonoscopia', 'Colonoscopia'),
    ('receber', 'Receitas Kit de Colonoscopia', 'Colonoscopia'),
    ('receber', 'Receitas Consultas', 'Consultas'),
    ('receber', 'Receitas Testes Respiratório', 'Testes respiratórios'),
    ('receber', 'Receitas Manometria', 'Manometria'),
    ('receber', 'Receitas Manometria Esofágica', 'Manometria'),
    ('receber', 'Receitas Manometria Anorretal', 'Manometria'),
    ('receber', 'Receitas pH-Metria', 'pH-metria'),
    ('receber', 'Receitas Exames Diversos', 'Exames diversos'),
    ('receber', 'Receitas Tirzepatida', 'TNI'),
    ('receber', 'Receitas Intramusculares', 'TNI'),
    ('receber', 'Receitas Endovenosos', 'TNI'),
    ('receber', 'Receitas Terapia Nutricional Injetável', 'TNI'),
    ('receber', 'Receitas de Aluguel De Sala', 'Aluguel de sala'),
    -- Outras receitas não operacionais (grupo 002, menos aluguel de sala e TNI)
    ('receber', 'Impostos e Contribuições Recuperados', 'Outras receitas não operacionais'),
    ('receber', 'Receitas Aplicações Financeiras', 'Outras receitas não operacionais'),
    ('receber', 'Receitas Despesas pagas pela Filial ref. a Matriz', 'Outras receitas não operacionais'),
    ('receber', 'Receitas Despesas pagas pela Matriz ref. a Filial', 'Outras receitas não operacionais'),
    ('receber', 'Receitas Despesas pagas pela Matriz ref. a TNI', 'Outras receitas não operacionais'),
    ('receber', 'Receitas Guia de Honorário Individual', 'Outras receitas não operacionais'),
    ('receber', 'Receitas Máquinas e Equipamentos', 'Outras receitas não operacionais'),
    ('receber', 'Receitas Transição de Sistema', 'Transição de sistema')
  ) as l(natureza, item, categoria)
  join public.categorias c on c.natureza = l.natureza and c.nome = l.categoria
on conflict (natureza, item) do nothing;
