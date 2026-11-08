# Indiki+: estado do projeto (02/11/2026)

Documento de retomada: o que existe, o que foi decidido e o que falta.

## Modelo
- A empresa contrata o Indiki+. Clientes viram "indicadores" e ganham comissão.
- Fluxo do dinheiro: a empresa repassa ao Indiki+ o valor das comissões; o Indiki+ paga os indicadores uma vez por mês (último dia). O Indiki+ é a fonte pagadora.
- A taxa do plano é cobrada da empresa **por cima** da comissão (o indicador recebe a comissão cheia, menos retenção de imposto se houver).
- Um banco Supabase (`indiquemais`) serve os três ambientes do site: teste (develop), homologação (staging) e produção (main).

## Decisões já tomadas
- **Planos:** Inicial, Intermediário, Avançado, Avançado+ (preços ainda indefinidos; taxas propostas 1% / 0,8% / 0,6% / 0,5%).
- **Selos das empresas:** Bronze, Prata, Ouro, Platina, Diamante, por mérito (vendas com contrato, avaliações dos indicadores, contestações, tempo de casa, faturas em dia). Certificado verificável em `/verificar/CÓDIGO` e selo incorporável em `/selo/CÓDIGO`.
- **Ranking de indicadores:** níveis 1 a 5 (nomes provisórios), benefícios a definir. Tudo parametrizável, com ativar/desativar.
- **Regra de comissão por produto:** fixo, % do contrato total, ou fixo + %, com teto opcional. A empresa informa valor e número do contrato ao marcar "fechou".
- **Regra congelada na indicação:** editar a comissão do produto vale só para indicações criadas depois. Cada indicação guarda a regra de quando nasceu. Só o admin corrige uma indicação, com motivo, antes da liberação.
- **Fiscal:** recibo não substitui NFS-e. Regras de retenção (IRRF/INSS) existem, mas inativas e zeradas até o contador definir.

## Banco (migrações em supabase/migrations, todas aplicadas na produção)
1 esquema central · 2 admin (e-mail pré-autorizado: depaulajardim.bruno@gmail.com) · 3 cadastro de indicadores · 4 regra de comissão · 5 planos e selos · 6 grupos, certificados e ranking · 7 cobrança, recibos e fiscal · 8 repasse das comissões · 9 regra congelada e histórico de versões.
Testes locais: `supabase/tests/run_local.sh` (0 FAIL/ERROR na última rodada). Detalhes em `docs/BANCO-DE-DADOS.md`.

## Site
- Em 07/11/2026 o protótipo foi tirado do site e o banco foi limpo (sobrou só a conta admin e as configurações). O protótipo completo está guardado na branch `arquivo/prototipo-v1` (consulte com `git show arquivo/prototipo-v1:app/...`). Ao ligar cada tela real, reaproveite o layout de lá.
- Hoje o site tem (tudo real): página inicial; `/entrar` (e-mail e senha, esqueci a senha) e `/redefinir-senha`; `/convite/[token]` (criar conta ou entrar + cadastro completo); `/i/[code]` (amigo pede orçamento); `/termos`; `/conta`; `/admin` (início); painel `/empresa` com Início, Produtos (criar/editar com histórico da regra), Indicadores (link de convite, cadastro manual, enviar acesso por WhatsApp, pausar) e Dados da empresa.
- Produção: empresa Soulglass cadastrada (plano Avançado+) com 1 responsável e link de convite.
- Fluxo de cadastro (07/11): empresa pede em `/cadastro-empresa` e o admin aprova em Empresas (cria a empresa e libera o responsável); indicador entra pelo convite da empresa ou pelo site em `/cadastro` (cadastro completo + escolhe empresas da vitrine). Cada empresa escolhe: só por convite, com aprovação (padrão) ou aberta. Pedidos pendentes aparecem em Indicadores da empresa. Indicador acompanha em `/conta`.
- Admin `/admin`: visão geral (números, funil, dinheiro, por empresa), empresas (pedidos, acessos, plano, dados legais, abas), indicadores, produtos, indicações e vendas, comissões.
- 07/11 (noite): tela de Indicações na empresa (abas por etapa, chamar no WhatsApp, orçamento enviado, fechou com valor + contrato e prévia da comissão, instalado e pago, não fechou); painel do indicador em `/conta` (a receber, recebido, indicações com etapa, comissão e data de liberação, chave PIX, confirmar indicações declaradas, compartilhar no WhatsApp); PIX saiu do cadastro e é exigido para pagar; tela de pedido enviado para o amigo com botão para falar com a empresa.
- 08/11: página inicial refeita no estilo do piloto indikimais.com.br (preto + laranja #ff6600, fonte Inter, leão, 3 passos, recursos, preços Mensal 397 / Semestral 297 / Anual 197). Redirects `/login` → `/entrar` e `/register` → `/cadastro` ou `/cadastro-empresa` (user_type=empresa), para os links antigos funcionarem quando o DNS mudar. Cores também atualizadas em `brand_settings`. Sem depoimentos e sem teste grátis de 7 dias por enquanto.
- Falta: pagamentos (liberar comissões, fechar o mês, pagar), admin de empresas/planos/cobrança, SMTP próprio.
- **Real:** login por link no e-mail (`/entrar`, `/auth/callback`) e proteção do painel `/admin` (só administradores).
- Supabase Auth configurado: Site URL `https://indiquemais.vercel.app`; redirects `/auth/callback` na produção e em `localhost:3100`.

## Pendências
1. Testar o login na produção e o fluxo de convite (empresa copia o link, cliente se cadastra).
2. Ligar as telas aos dados reais (Produtos, Indicações, Empresas, Planos, Cobrança), uma a uma.
3. SMTP próprio (o padrão do Supabase limita e-mails por hora).
4. Adicionar os endereços de teste e homologação da Vercel nos redirects do login, se for testar lá.
5. Gateway de pagamento (Asaas / Mercado Pago) para confirmar pagamentos sozinho; hoje o admin confirma na mão.
6. Contador: taxas reais de retenção, emissão de NFS-e, CNPJ emissor, tratamento fiscal do repasse.
7. Definir benefícios do ranking.
8. Agendar o recálculo de selos e ranking; rotina de anonimização (LGPD).
9. Higiene de dados: banco único mistura teste e dados reais.
10. Troca de DNS para indikimais.com.br: adicionar o domínio na Vercel e trocar Site URL + redirects no Supabase Auth.
11. Planos (08/11): Mensal 397 (1%), Semestral 297 (0,8%), Anual 197 (0,6%) sobre as vendas por indicação; Avançado+ reservado para plano extra. Falta: cobrança da mensalidade e regra de fidelidade/cancelamento.

## Como trabalhar
- Branches: develop → staging → main, promovendo com merge. Commits com `Co-Authored-By` e `Claude-Session`.
- Migração no Supabase: SQL Editor (colar o arquivo e rodar). Nunca rodar testes no banco real.
