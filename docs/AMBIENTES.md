# Ambientes do Indique Mais

Quatro lugares onde o sistema roda. Cada mudança passa por todos, na ordem, antes de chegar ao público.

| Ambiente | Branch | Para quê | Quem usa | Endereço |
| --- | --- | --- | --- | --- |
| Desenvolvimento | feature/* (local) | Construir e experimentar | Desenvolvimento | `localhost:3000` |
| **Teste** | `develop` | Ver se a mudança funciona e não quebrou nada | Time técnico | `indiquemais-git-develop-depaulajardimbruno-oss-projects.vercel.app` |
| **Homologação** | `staging` | Cliente valida; réplica da produção | Cliente e time | `indiquemais-git-staging-depaulajardimbruno-oss-projects.vercel.app` |
| **Produção** | `main` | Versão final, a que o público usa | Todos | `indiquemais.vercel.app` |

Cada ambiente mostra uma faixa colorida no topo (azul = teste, roxo = homologação). Produção não tem faixa.

## Caminho de uma mudança

1. Crie um branch a partir de `develop`: `feature/nome-da-mudanca`.
2. Abra um pull request para `develop`. O CI (lint + build) roda sozinho. Se passar e a revisão aprovar, faça o merge: a mudança sobe para **Teste**.
3. Testou e está certo? Abra um pull request de `develop` para `staging`. Ao fazer o merge, sobe para **Homologação** e o cliente valida.
4. Cliente aprovou? Abra um pull request de `staging` para `main`. Ao fazer o merge, sobe para **Produção**.

Regra de ouro: **ninguém comita direto em `staging` ou `main`.** Sempre pull request.

Correção urgente em produção (hotfix): branch a partir de `main`, pull request para `main`, e depois traga a correção de volta para `staging` e `develop` para não perder.

## Banco de dados (Supabase)

- **Produção** usa o projeto `indiquemais`.
- Teste e homologação **não devem apontar para o banco de produção** quando houver dados reais. O plano gratuito do Supabase permite 2 projetos ativos; criar um segundo projeto (por exemplo `indiquemais-staging`) para teste + homologação exige liberar espaço ou migrar de plano. Decisão pendente.
- Hoje o único dado no banco é a tabela `brand_settings` (nome e cores), que é de leitura pública e não tem dado pessoal. Por isso o risco atual é baixo.
- Mudanças de estrutura do banco viram arquivos em `supabase/` e passam pelos mesmos ambientes, nunca direto na produção.

## Variáveis de ambiente (Vercel)

| Variável | Produção | Preview (teste/homologação) |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | projeto de produção | projeto de teste/homologação |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave de produção | chave de teste/homologação |

Nunca commitar chaves. `service_role` nunca vai em variável `NEXT_PUBLIC_*`.
