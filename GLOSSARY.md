# Hub Financeiro Gastrocenter

Sistema central que une os dados do ProDoctor (e, depois, do Omie), aplica as regras financeiras da clínica e substitui as planilhas de rateio, repasse e conferência.

## Fontes e sistemas

**Hub**:
O sistema que estamos construindo. É dono das regras (repasse, rateio, DRE) e arbitra divergências.
_Avoid_: Painel, sistema novo

**ProDoctor**:
Sistema de gestão clínica e fonte operacional dos dados (atendimentos, procedimentos, faturas, repasses). Só leitura para o Hub.
_Avoid_: PD (exceto na chave de idempotência)

**Omie**:
ERP financeiro/contábil que será adotado depois da validação do Hub. Ainda não é usado pela clínica.
_Avoid_: ERP

**Payload bruto**:
A resposta original de uma API guardada sem alteração, para permitir reprocessar quando a regra mudar.
_Avoid_: Cache, dump

## Estrutura da clínica

**Empresa**:
Cada CNPJ do grupo, com sua própria chave de API do ProDoctor.
_Avoid_: Cliente, tenant

**Unidade**:
Local de atendimento (local ProDoctor). Cada atendimento pertence a uma unidade.
_Avoid_: Filial, local

**Médico**:
Profissional que executa procedimentos e recebe repasse por uma pessoa jurídica.
_Avoid_: Usuário, profissional

**Convênio**:
Operadora de plano de saúde que paga pelos procedimentos de seus beneficiários.
_Avoid_: Plano, operadora

**Centro de custo**:
Dimensão de acúmulo de receita e custo. Na Fase 1 é o par médico + unidade.

## Receita e repasse

**Fatura**:
Cobrança agrupada enviada a um convênio, com valor a receber e situação.
_Avoid_: Nota

**Recebível**:
Valor que a clínica tem a receber, originado de um procedimento faturado, vinculado a um centro de custo.
_Avoid_: Receita (receita é o conceito contábil, recebível é o registro)

**Repasse**:
Valor devido ao médico pela produção, por regra de percentual ou valor fixo, com composição bruto, imposto e líquido.
_Avoid_: Comissão, pagamento do médico

**Glosa**:
Recusa ou redução de pagamento pelo convênio, que obriga a ajustar o repasse provisionado.
_Avoid_: Desconto

**Repasse provisionado**:
Repasse calculado mas ainda não pago, que só se torna devido depois que o convênio paga.

## Controle

**Pendência**:
Divergência ou anomalia que o Hub não resolve sozinho (registro excluído no ProDoctor, glosa, de-para ausente, sincronização falha) e que exige decisão humana.
_Avoid_: Erro, alerta

**De-para**:
Correspondência entre um código de uma fonte externa e a entidade do Hub (unidade, médico, convênio).
_Avoid_: Mapeamento

**Alçada**:
Limite de permissão para lançar, aprovar ou pagar, separável por usuário e tipo de despesa.

**Perfil restrito**:
Perfil com acesso a dados sensíveis como folha e salário individual.

**Rateio**:
Divisão de uma despesa entre centros de custo, registrada já dividida.
