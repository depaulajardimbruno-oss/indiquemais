# Banco de dados do Indiki+

Arquivo: `supabase/migrations/20261102000100_core_schema.sql` (pode ser rodada mais de uma vez).
Teste: `supabase/tests/security_smoke.sql` (roda num Postgres de teste, nunca em produção).

## Como as tabelas se ligam

```mermaid
erDiagram
  auth_users ||--|| profiles : "1 pessoa = 1 perfil"
  profiles ||--o| platform_admins : "admin Indiki+"
  companies ||--o{ company_members : "quem acessa"
  profiles  ||--o{ company_members : ""
  companies ||--o{ offers : "produtos"
  companies ||--o{ referrer_links : "link do indicador"
  profiles  ||--o{ referrer_links : "uma pessoa, várias empresas"
  companies ||--o{ referrals : ""
  offers    ||--o{ referrals : "produto pedido"
  referrer_links |o--o{ referrals : "quem indicou"
  referrals ||--o{ referral_stage_history : "cada mudança de etapa"
  referrals ||--o| commissions : "1 comissão por venda"
  referrer_links ||--o{ commissions : "quem recebe"
  payout_batches ||--o{ commissions : "pagamento do mês"
```

Regras de ligação que o banco garante (chaves compostas, não dá para furar):
- A indicação só aponta para produto **da mesma empresa**.
- O link do indicador na indicação é **da mesma empresa** da indicação.
- A comissão aponta para a indicação e para o link da **mesma empresa**.
- Sem indicador confirmado, a indicação não passa de "orçamento" (não existe comissão sem quem receber).

## Nada se perde

| Proteção | O que faz |
|---|---|
| `ON DELETE RESTRICT` em toda chave estrangeira | Não dá para apagar algo que outra tabela usa |
| Gatilho contra DELETE | Mesmo o dono do banco não apaga empresa, pessoa, indicação nem comissão. "Excluir" = `archived_at` |
| `referral_stage_history` e `audit_log` | Só aceitam inserir. Não alteram nem apagam |
| Campos congelados | Nome/telefone do amigo, consentimento, valor e vínculos da comissão não mudam depois de criados |
| Auditoria | Toda criação e alteração nas tabelas principais guarda antes/depois e quem fez |
| Etapa | Cada mudança vira uma linha do histórico, automaticamente |

## Quem pode o quê

| Papel | Vê | Pode alterar |
|---|---|---|
| Visitante (sem login) | Produtos ativos para o formulário | Só **pedir orçamento** (função com consentimento LGPD) |
| Indicador | Só as **suas** indicações e comissões, com o amigo reduzido ("Carla M."), sem telefone, endereço ou valor da venda | Só **confirmar recebimento** (recebi / não recebi), **aceitar ou recusar** indicação declarada em seu nome, e **sua chave PIX** |
| Empresa (operador) | Só as indicações e comissões **da sua empresa** (sem a chave PIX do indicador) | Só a **etapa** da indicação (uma por vez, e informa o valor da venda ao fechar) |
| Empresa (administrador) | O mesmo | Além da etapa: **cadastra, edita e arquiva seus produtos** e define a comissão (valor fixo ou porcentagem). Mudança vale só para vendas futuras |
| Indiki+ (admin) | Tudo | Libera comissões, fecha o mês, resolve disputas |

Como funciona por baixo: as telas **não escrevem nas tabelas**. O papel logado só tem leitura (filtrada por RLS)
e chama funções que validam a regra: `company_set_referral_stage`, `indicator_respond_commission`,
`indicator_answer_declared`, `indicator_update_payment_info`, `company_save_offer`, `company_archive_offer`, `submit_quote_request`,
`admin_release_due_commissions`, `admin_pay_month`, `admin_resolve_dispute`.

## Ciclo de uma comissão

`pendente` (indicação fechada) → `liberada` (obra instalada e paga + prazo de segurança) →
`paga` (Indiki+ paga no último dia do mês) → `confirmada` (indicador confirma) ou `contestada`
(Indiki+ resolve e volta para `paga`, ou `cancelada`). Indicação perdida cancela a comissão pendente.

## Regra de comissão e contrato (migração 4)
Cada produto define `commission_fixed_cents`, `commission_percent_bps` e, opcionalmente, `commission_cap_cents` (teto).
Comissão = fixo + (percentual × **valor total do contrato**), limitada ao teto (`calc_commission`).
Ao marcar "fechou" a empresa informa **valor e número do contrato** (único por empresa). O valor da comissão fica
congelado; só pode ser corrigido com motivo (`company_correct_sale`) enquanto estiver `pendente`.

## Cadastro de indicadores (migração 3)
A empresa cadastra o indicador (nome, e-mail, telefone) e o sistema gera **código e link**. O amigo pode usar o link/código
ou declarar nome e telefone do indicador (vincula pelo telefone, depois pelo nome único); o indicador precisa confirmar
antes da venda fechar.

## Planos e selos (migração 5) — tudo por parâmetros
| Tabela | O que guarda |
|---|---|
| `plans` | Planos: `inicial`, `intermediario`, `avancado`, `avancado_mais`. Preço (vazio = a definir), taxa, limites (indicadores, produtos, usuários; vazio = ilimitado), nível de relatório, integração CRM, destaque, suporte, `active` |
| `company_plan_history` | Qual plano cada empresa teve e quando, com a taxa daquele momento. Só o fim do período muda |
| `seal_criteria` | O que conta pontos (vendas com contrato, indicadores que confirmaram, contestações, tempo de casa, taxa em dia): peso, teto de pontos, `active` |
| `seal_levels` | Bronze, Prata, Ouro, Platina, Diamante: pontos mínimos, vendas mínimas, `active` (nível desativado é pulado) |
| `company_seals` | Registro do selo ao longo do tempo (só cresce), com "desde quando" |

- **Mudar valores = mudar dados.** O administrador usa `admin_save_plan`, `admin_save_seal_level`, `admin_save_seal_criterion`;
  nada precisa de deploy. Novos critérios exigem uma medição nova em `company_seal_metrics`.
- **Limites travados no banco** (gatilho `enforce_plan_limit`): passar do limite do plano falha mesmo que alguém mexa na tela.
  Rebaixar de plano só é permitido se a empresa já couber no plano menor.
- **Selo é mérito, não se compra.** Recalculado por `admin_recalculate_seals` (agendar diariamente quando houver rotina).
  Verificação pública: visão `public_company_seals` (só nome, nível e desde quando).
- Valores iniciais (pontos, limites, taxas 1% / 0,8% / 0,6% / 0,5%) são **propostas** e podem ser alterados a qualquer momento.

## Grupos de cliente, certificados e ranking (migração 6)
- **Grupos** (`customer_groups`): perfil da empresa (autônomo, pequena, média, grande) com **plano sugerido**. A empresa recebe um grupo
  (`admin_set_company_group`) e a visão `company_group_plan` mostra o plano atual contra o sugerido.
- **Certificados do selo** (`seal_certificates`): quando a empresa tem selo, recebe um certificado com **código público** (`IM-XXXX-XXXX`).
  Subiu ou desceu de nível: o certificado antigo é revogado e um novo é emitido. Validade em `platform_settings` (365 dias).
  Qualquer pessoa confere o código na função pública `verify_certificate` (valido, expirado, revogado, desatualizado, inexistente);
  não existe forma de listar certificados. O selo no site do parceiro carrega dessa verificação.
- **Ranking de indicadores**: `referrer_criteria` (pontos), `referrer_tiers` (níveis, nomes provisórios "Nível 1..5") e
  `referrer_benefits` (benefícios por nível). Pontuação soma todas as empresas em que a pessoa indicou. O indicador vê sua posição e o que
  falta para o próximo nível; o placar geral só mostra o nome de quem **aceitou aparecer** (padrão: anônimo, por causa da LGPD).

## Cobrança, recibos e fiscal (migração 7)
- **Faturas** (`invoices`, `invoice_items`): mensalidade do plano e taxa sobre vendas (uma linha por venda, cobrada uma única vez, com a taxa do
  plano vigente no dia do fechamento). Gerar duas vezes não duplica. Valor e identificação nunca mudam; fatura paga não volta atrás;
  cancelar exige motivo e libera a venda para ser cobrada de novo. Numeração sequencial sem buracos (`F-2026-000001`).
- **Pagamento e recibo**: `admin_record_payment` registra o pagamento (Pix, boleto, cartão, transferência) e **emite o recibo na hora**
  (`R-2026-000001`), com quem pagou, quem recebeu, valor e forma. Recibo e pagamento são somente-inserção. O recibo avisa que **não substitui
  a nota fiscal**; o número da NFS-e é anexado à fatura (`admin_set_fiscal_note`).
- **Quem paga e vê**: a empresa vê suas faturas, recibos e o total pago por ano; o administrador tem o painel `admin_billing_overview`
  (emitido, recebido, em aberto, vencido).
- **Pagamento de comissão** (`commission_payments`): cada comissão paga ao indicador registra bruto, retenções e líquido.
  **Regras de retenção** (`tax_rules`) nascem **desativadas e zeradas**; o contador define as alíquotas.
  A opção `require_cpf_for_payout` (padrão desligada) bloqueia o pagamento de quem não tem CPF cadastrado.
- **Dados fiscais do indicador** (`indicator_tax_profiles`): CPF validado, nome e endereço; só o próprio e o admin veem.
- **Informe de rendimentos** (`income_statements`): por indicador e ano, **versionado** (mudou valor ou CPF, nasce a versão 2 e a 1 fica guardada).
  O indicador vê o seu; a visão `admin_tax_pending` lista quem recebeu mas ainda não tem CPF.

### O que o banco NÃO resolve (precisa de contador e advogado)
Emissão de nota fiscal de serviço; alíquotas reais de IRRF e INSS (o imposto de renda usa tabela progressiva mensal); dados da empresa
emissora (razão social e CNPJ ficam em `platform_settings`); envio mensal das informações à Receita (a DIRF acabou em 2025; hoje é
eSocial e EFD-Reinf); e se o Indiki+ ficar responsável por receber das empresas e repassar aos indicadores, o enquadramento disso.

## Taxa do Indiki+
Percentual do **plano vigente no dia em que a venda fechou** (`company_plan_history`), aplicado ao valor total das vendas
fechadas. Mudar de plano não altera vendas passadas. A visão `company_platform_fees` calcula o total.

## Decisões tomadas
- **Um único ambiente de banco** (Supabase `indiquemais`), compartilhado por teste, homologação e produção. Como os três usam os mesmos dados, os dados de teste ficam misturados com os reais: usar empresas e indicadores de teste claramente marcados e limpar (arquivar) antes de operar com clientes reais.
- **A empresa cadastra os próprios produtos e a regra de comissão** (fixa, % do contrato ou os dois, com teto opcional). Trava de segurança: porcentagem acima de 50% exige validação com o Indiki+.

## Decisões em aberto
1. **Dados pessoais (LGPD):** o telefone do amigo fica também no log de auditoria, visível só ao admin. Falta a rotina de anonimização a pedido do titular.
2. **Quem é o primeiro administrador da plataforma** (cadastrar em `platform_admins`).
