# Auditoria Técnica Completa do Backend Supabase

> **Sistema:** Controle de Estoque e Caixa - Mercado Aparecida  
> **Data do Levantamento:** 07 de Outubro de 2026  
> **Ambiente Auditado:** Google AI Studio Applet / Frontend React TypeScript / Backend Node.js Express  

---

## 1. Identificação da Instância Supabase

* **Nome do Projeto:** Controle de Estoque e Caixa - Mercado Aparecida
* **Project Ref (ID do Projeto):** `heqgopqddrsjiwnypiqc`
* **URL da API Supabase:** `https://heqgopqddrsjiwnypiqc.supabase.co`
* **Chave Pública Anon (JWT Audience):** Configurada via `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` (`iss: supabase`, `ref: heqgopqddrsjiwnypiqc`, `role: anon`).

---

## 2. Inventário de Tabelas

O backend é estruturado em uma arquitetura **multi-tenant por empresa**, totalizando **11 tabelas principais**:

| # | Tabela | Finalidade Principal | Chave Primária | Relacionamentos Chave |
|---|---|---|---|---|
| 1 | `empresa` | Tenant / Raiz corporativa da loja | `id` (UUID) | Raiz de todos os dados do lojista |
| 2 | `perfil` | Vínculo entre `auth.users`, a empresa e o papel (`dono` / `operador`) | `id` (UUID) | `id -> auth.users.id`, `empresa_id -> empresa.id` |
| 3 | `categoria` | Agrupamento de produtos (Mercearia, Bebidas, etc.) | `id` (UUID) | `empresa_id -> empresa.id` |
| 4 | `produto` | Cadastro mestre de itens comercializáveis (EAN, preço, custo, unidade) | `id` (UUID) | `empresa_id -> empresa.id`, `categoria_id -> categoria.id` |
| 5 | `lote` | Rastreabilidade de datas de validade e custos por lote de entrega | `id` (UUID) | `empresa_id -> empresa.id`, `produto_id -> produto.id` |
| 6 | `movimento` | Ledger de movimentação de estoque (entradas, vendas, quebras, ajustes) | `id` (UUID) | `empresa_id -> empresa.id`, `produto_id -> produto.id`, `lote_id -> lote.id` |
| 7 | `venda` | Cabeçalho e totalizador de cada transação no caixa/PDV | `id` (UUID) | `empresa_id -> empresa.id`, `operador_id -> auth.users.id` |
| 8 | `venda_item` | Detalhamento dos produtos comercializados em cada venda | `id` (UUID) | `venda_id -> venda.id`, `produto_id -> produto.id` |
| 9 | `promocao` | Descontos vigentes por período para queima de estoque | `id` (UUID) | `empresa_id -> empresa.id`, `produto_id -> produto.id` |
| 10 | `config_taxa` | Parâmetros de taxas de maquininha de cartão e limite de desconto | `id` (UUID) | `empresa_id -> empresa.id` (UNIQUE) |
| 11 | `relatorio` | Histórico e cache de resumos gerados pela IA executiva | `id` (UUID) | `empresa_id -> empresa.id` |

---

## 3. Inventário de Views

O sistema depende de **3 views analíticas em tempo real**, que simplificam o frontend e mantêm a integridade dos cálculos:

1. **`v_estoque`**
   - **Campos:** `produto_id`, `empresa_id`, `saldo`, `valor_custo`.
   - **Regra de Cálculo:** Agrega todos os registros da tabela `movimento` (somando entradas, devoluções e ajustes; subtraindo vendas e perdas). O `valor_custo` é calculado multiplicando o `saldo` pelo custo unitário atual do produto.
   - **Uso no Frontend:** Caixa, Estoque, Compras, Validade, Dinheiro Parado, Painel, Financeiro e Relatórios.

2. **`v_preco_atual`**
   - **Campos:** `produto_id`, `empresa_id`, `preco_cheio`, `desconto_pct`, `preco_venda`.
   - **Regra de Cálculo:** Cruza os produtos com a tabela `promocao` onde a data atual (`CURRENT_DATE`) está dentro da vigência (`inicio` e `fim`) e `ativa = true`. Retorna o `preco_venda` com o percentual deduzido.
   - **Uso no Frontend:** Caixa (PDV rápido) e Estoque.

3. **`v_giro` (ou `v_giro_30d`)**
   - **Campos:** `produto_id`, `empresa_id`, `vendido_30d`, `media_dia`.
   - **Regra de Cálculo:** Consolida as vendas da tabela `venda_item` / `venda` dos últimos 30 dias corridos e calcula a média diária de saída (`vendido_30d / 30.0`).
   - **Uso no Frontend:** Painel Executivo (curva ABC e itens em falta), Compras (sugestão de pedido e cobertura) e Dinheiro Parado.

---

## 4. Inventário de RPCs / Funções

* **`fechar_venda(p_itens JSONB, p_forma TEXT)`**:
  - Função principal executada no momento do checkout no PDV.
  - Recebe os itens do carrinho e a forma de pagamento selecionada.
  - Insere o cabeçalho em `venda`, os registros em `venda_item` e cria as saídas correspondentes na tabela `movimento` para abater o estoque.
* **`get_minha_empresa_id()`**:
  - Função `SECURITY DEFINER` que resgata o `empresa_id` do usuário logado através da tabela `perfil`.
* **`get_meu_papel()`**:
  - Função `SECURITY DEFINER` que retorna se o usuário autenticado é `'dono'` ou `'operador'`.

---

## 5. Triggers e Automações

1. **`on_auth_user_created` (Auth Hook)**:
   - Acionado após inserção na tabela `auth.users` do Supabase para associar o usuário recém-criado à tabela `public.perfil`.
2. **`trg_atualizar_timestamp`**:
   - Acionado em `config_taxa` e `produto` para manter o campo `atualizado_em` sincronizado com `now()`.

---

## 6. Auditoria de Row Level Security (RLS) e Policies

**Status:** Todas as 11 tabelas públicas possuem RLS ativado (`ENABLE ROW LEVEL SECURITY`).

### Resumo das Políticas por Tabela:

* **`empresa`**:
  - `SELECT`: Apenas usuários autenticados pertencentes à respectiva empresa (`id = get_minha_empresa_id()`).
  - `INSERT/UPDATE/DELETE`: Acesso administrativo restrito a donos da empresa.
* **`perfil`**:
  - `SELECT`: Membros da mesma empresa podem consultar perfis (para identificação de operador).
  - `INSERT/UPDATE/DELETE`: Restrito a usuários com papel `'dono'`.
* **`produto` e `categoria`**:
  - `SELECT`: Liberado para qualquer funcionário autenticado da empresa (`dono` e `operador`).
  - `INSERT/UPDATE/DELETE`: Operadores podem consultar produtos no caixa; cadastro e alteração de preço são restritos ao `dono` (ou permitidos se concedida permissão no cadastro).
* **`lote`**:
  - Isolamento por `empresa_id`.
* **`movimento`**:
  - `SELECT`: Dono pode auditar todo o histórico; operador pode registrar movimentos provenientes de vendas.
  - `INSERT`: Liberado para registrar entradas, baixas e saídas com carimbo de `empresa_id`.
* **`venda` e `venda_item`**:
  - `SELECT/INSERT`: Operador pode emitir vendas e consultar suas próprias vendas do turno; Dono possui visão ampla de todas as vendas da empresa.
* **`promocao` e `config_taxa`**:
  - `SELECT`: Leitura liberada para cálculo no Caixa e Estoque.
  - `UPDATE/INSERT`: Restrito ao papel `'dono'`.
* **`relatorio`**:
  - Acesso exclusivo (`SELECT`, `INSERT`, `UPDATE`) para usuários com papel `'dono'`. Operadores não possuem visibilidade.

---

## 7. Recursos do Supabase Utilizados Atualmente pelo Frontend

1. **PostgREST Client (`supabase-js`)**:
   - Construção declarativa de queries via cliente TypeScript (`.from().select().eq().in().gte().lte().or()`).
   - Filtros dinâmicos como `.or('nome.ilike.%...,ean.ilike.%...')` para leitura com leitor de código de barras.
   - Joins relacionais declarativos: `.select('*, venda!inner(...), produto(nome)')`.
2. **Supabase Auth**:
   - Autenticação por e-mail e senha (`supabase.auth.signInWithPassword`).
   - Gestão de sessão por tokens JWT (`auth.getSession`, `auth.onAuthStateChange`).
3. **Database RPCs**:
   - Invocação de procedures no PostgreSQL (`supabase.rpc('fechar_venda', ...)`).
4. **Storage (Buckets)**:
   - **Não há dependência direta de buckets de Storage no banco hoje.** O upload de notas fiscais (DANFE) e geração de artes de promoção para WhatsApp são processados em memória pelo client/backend e repassados ao Google Gemini via rota Express.

---

## 8. Dependências Específicas do Supabase vs Migração para PostgreSQL Puro / Neon

Se o sistema for migrado para um PostgreSQL padrão (ex: Neon, RDS, Cloud SQL), as seguintes alterações serão obrigatórias:

| Recurso Supabase Atual | Dependência Específica | Alteração Necessária para PostgreSQL Puro / Neon |
|---|---|---|
| `auth.users` | Schema interno gerenciado pelo Supabase Auth | Criar tabela própria `public.usuarios` com hash de senha (bcrypt/argon2) ou integrar com provedor OAuth/Auth0/Clerk. |
| `auth.uid()` | Função de contexto da sessão JWT do Supabase | Substituir por passagem do ID do usuário via `SET LOCAL app.current_user_id = '...'` ou tratar autorização no backend Express. |
| Sintaxe PostgREST no Frontend | Chamadas diretas do client React ao banco via REST | Criar endpoints REST/GraphQL no Node.js Express ou utilizar um ORM (Drizzle/Prisma/Kysely) intermediário no backend. |
| Chave Pública `anon` | Acesso direto do browser ao banco de dados | Em PostgreSQL padrão, o browser **não** conecta diretamente ao banco; todas as chamadas devem passar por rotas no servidor Express (`server.ts`). |
| RLS via JWT | Políticas avaliam `auth.jwt()` | Políticas RLS deverão ser adaptadas para avaliar variáveis de sessão do PostgreSQL ou a segurança deverá ser movida para a camada de serviços da API. |

---

## 9. Mapeamento de Tabelas Críticas por Módulo Funcional

| Módulo do Sistema | Tabelas Críticas |
|---|---|
| **Caixa (PDV)** | `produto`, `venda`, `venda_item`, `movimento`, `config_taxa`, `v_estoque`, `v_preco_atual` |
| **Estoque** | `produto`, `categoria`, `movimento`, `lote`, `v_estoque`, `v_preco_atual` |
| **Compras** | `produto`, `categoria`, `lote`, `movimento`, `v_estoque`, `v_giro` |
| **Conferência DANFE** | `produto`, `categoria`, `lote`, `movimento` |
| **Validade** | `lote`, `produto`, `promocao`, `v_estoque` |
| **Dinheiro Parado** | `produto`, `v_estoque`, `v_giro`, `promocao`, `movimento` |
| **Financeiro** | `venda`, `venda_item`, `movimento` (perdas), `config_taxa` |
| **Relatórios** | `relatorio`, `venda`, `venda_item`, `movimento`, `v_estoque`, `v_giro` |
| **Usuários e Perfis** | `perfil`, `empresa`, `auth.users` |

---

## 10. Auditoria da Transacionalidade no Fechamento da Venda

### RPC Responsável:
* **`fechar_venda(p_itens, p_forma)`**

### Análise de Transacionalidade Atual:
* **A operação NÃO é 100% atômica de ponta a ponta na arquitetura atual.**
* **Motivo:** A chamada inicial `supabase.rpc('fechar_venda')` executa em transação única no banco (cria `venda`, `venda_item` e `movimento`). Contudo, o frontend realiza operações subsequentes via requisições HTTP adicionais:
  1. **Atualização de Desconto Geral:** Se o operador concedeu desconto manual no total da venda, o frontend executa um `supabase.from('venda').update({ desconto, desconto_por, desconto_motivo }).eq('id', vendaId)`.
  2. **Atualização de Descontos nos Itens:** Para cada item que teve desconto individual, o frontend executa um loop assíncrono emitindo `supabase.from('venda_item').update({ desconto_unit, desconto_origem }).eq('venda_id', vendaId).eq('produto_id', ...)`.
  3. **Fallback de Busca:** Caso a RPC não retorne o UUID da venda como string válida, o frontend faz uma consulta suplementar buscando a última venda do operador: `supabase.from('venda').select('id').order('criado_em', false).limit(1)`.

---

## 11. Riscos de Inconsistência Identificados

1. **Risco de Desconexão Parcial no Checkout:**
   Se a rede falhar ou o navegador for fechado logo após a resposta da RPC `fechar_venda`, a venda terá sido gravada no banco com o estoque baixado, mas **sem o registro do desconto manual e sem o motivo do desconto**, gerando discrepância no fechamento do caixa.
2. **Risco de Corrida no Fallback de ID:**
   Se dois caixas com o mesmo usuário ou em lojas movimentadas emitirem vendas quase simultaneamente e a RPC retornar vazio, o fallback por ordenação temporal pode atribuir o desconto de um cliente à venda de outro cliente.
3. **Risco de RLS no Update Pós-Venda:**
   Se as regras de segurança no banco bloquearem o comando `UPDATE` na tabela `venda_item` para operadores de caixa (permitindo apenas `INSERT`), os updates de desconto falharão silenciosamente ou travarão o fluxo do checkout.
4. **Concorrência em Estoque Negativo:**
   A baixa de estoque atualmente computa saldos sem bloqueio pessimista (`SELECT FOR UPDATE`). Se dois caixas venderem a última unidade do mesmo item no mesmo milissegundo, o estoque resultará em saldo negativo.

### Recomendação de Hardening para o Backend:
Evoluir a procedure para uma assinatura única:
```sql
fechar_venda_completa(
    p_itens JSONB,
    p_forma TEXT,
    p_desconto_geral NUMERIC,
    p_desconto_motivo TEXT,
    p_desconto_autorizado_por UUID
)
```
Desta forma, todo o ciclo de checkout é finalizado em uma **única transação atômica ACID**, eliminando requisições secundárias do navegador.

---

## 12. Recursos Não Versionados Anteriormente no Repositório

Antes desta auditoria e da criação da branch `mvp-hardening`:
- O repositório **não possuía nenhum script DDL (`.sql`)** versionado.
- As definições de views (`v_estoque`, `v_preco_atual`, `v_giro`) e a procedure `fechar_venda` existiam apenas diretamente na nuvem do Supabase.
- Com os arquivos gerados nesta entrega (`supabase/migrations/20261007000000_initial_schema.sql`, `supabase/demo_seed.sql`, `supabase/SCHEMA_MAP.md` e `supabase/MIGRATION_PLAN.md`), o backend está **100% documentado e versionado como Infraestrutura como Código (IaC)**.
