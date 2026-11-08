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
- Protótipo visual completo (admin, empresa, indicador, páginas públicas) com dados fictícios. Porta de entrada: `/prototipo`.
- **Real:** login por link no e-mail (`/entrar`, `/auth/callback`) e proteção do painel `/admin` (só administradores).
- Supabase Auth configurado: Site URL `https://indiquemais.vercel.app`; redirects `/auth/callback` na produção e em `localhost:3100`.

## Pendências
1. Testar o login na produção e o fluxo de convite (empresa copia o link, cliente se cadastra).
2. Ligar as telas aos dados reais (Produtos, Indicações, Empresas, Planos, Cobrança), uma a uma.
3. SMTP próprio (o padrão do Supabase limita e-mails por hora).
4. Adicionar os endereços de teste e homologação da Vercel nos redirects do login, se for testar lá.
5. Gateway de pagamento (Asaas / Mercado Pago) para confirmar pagamentos sozinho; hoje o admin confirma na mão.
6. Contador: taxas reais de retenção, emissão de NFS-e, CNPJ emissor, tratamento fiscal do repasse.
7. Definir preços dos planos, nomes e benefícios do ranking.
8. Agendar o recálculo de selos e ranking; rotina de anonimização (LGPD).
9. Higiene de dados: banco único mistura teste e dados reais.

## Como trabalhar
- Branches: develop → staging → main, promovendo com merge. Commits com `Co-Authored-By` e `Claude-Session`.
- Migração no Supabase: SQL Editor (colar o arquivo e rodar). Nunca rodar testes no banco real.
