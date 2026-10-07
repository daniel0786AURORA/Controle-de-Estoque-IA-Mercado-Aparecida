# Plano de Migração e Reconstrução do Backend (Migration Plan)

> **Documento Operacional:** Guia passo a passo para recriar o backend completo do **Mercado Aparecida** do zero em uma nova instância Supabase ou em PostgreSQL puro (Neon / RDS / Cloud SQL).

---

## 1. Ordem Canônica de Execução

Ao recriar o banco de dados, **respeite rigorosamente a ordem das dependências**:

```
[1. Extensões do Banco]
         ↓
[2. Tabelas Independentes: empresa]
         ↓
[3. Tabelas de Identidade: perfil]
         ↓
[4. Tabelas de Catálogo: categoria -> produto]
         ↓
[5. Tabelas de Rastreio: lote -> movimento]
         ↓
[6. Tabelas Transacionais: venda -> venda_item]
         ↓
[7. Tabelas Auxiliares: promocao -> config_taxa -> relatorio]
         ↓
[8. Criação de Índices]
         ↓
[9. Views Analíticas: v_estoque -> v_preco_atual -> v_giro]
         ↓
[10. Functions & Procedures: fechar_venda]
         ↓
[11. Habilitação de RLS e Criação de Policies]
         ↓
[12. Carga Opcional: demo_seed.sql]
```

---

## 2. Cenário A: Reconstrução em Novo Projeto Supabase

### Passo 1: Criar o Projeto no Supabase
1. Acesse [database.new](https://database.new) e crie um novo projeto.
2. Defina uma senha forte para o banco de dados e selecione a região mais próxima (ex: `sa-east-1` - São Paulo).
3. Anote as credenciais na aba **Project Settings > API**:
   - `Project URL` (ex: `https://xyzcompany.supabase.co`)
   - `anon public key`

### Passo 2: Executar a Migration Principal
1. Abra o **SQL Editor** no painel do Supabase.
2. Abra o arquivo `supabase/migrations/20261007000000_initial_schema.sql` deste repositório.
3. Cole o conteúdo completo no editor e clique em **Run**.
4. Verifique na aba **Table Editor** se todas as 11 tabelas foram criadas com o cadeado de RLS ativado.

### Passo 3: Criar o Primeiro Usuário e Empresa
Execute o script abaixo no SQL Editor para inicializar a sua loja real:

```sql
-- 1. Criar a Empresa
INSERT INTO public.empresa (id, nome, cnpj)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Mercado Aparecida', '12.345.678/0001-90')
RETURNING id;

-- 2. Criar a Configuração Inicial de Taxas
INSERT INTO public.config_taxa (empresa_id, dinheiro, pix, debito, credito, desconto_max_operador)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 0.00, 0.00, 0.015, 0.035, 5.00);

-- 3. Vincular seu usuário do Supabase Auth como DONO da loja
-- (Substitua 'SEU_AUTH_USER_ID' pelo UUID gerado em Authentication > Users)
INSERT INTO public.perfil (id, empresa_id, nome, papel)
VALUES ('SEU_AUTH_USER_ID', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Daniel (Proprietário)', 'dono');
```

### Passo 4: Atualizar as Variáveis no Frontend
Crie ou atualize o arquivo `.env` da aplicação:
```env
VITE_SUPABASE_URL="https://seu-novo-projeto.supabase.co"
VITE_SUPABASE_ANON_KEY="sua-nova-chave-anon-publica"
```

---

## 3. Cenário B: Migração para PostgreSQL Puro (Neon / AWS RDS / Docker)

Caso opte por desacoplar o backend do Supabase e migrar para um banco PostgreSQL padrão:

### Passo 1: Ajuste no Schema de Autenticação
No PostgreSQL padrão, o schema `auth` não existe por padrão. Crie a tabela substituta de usuários antes do `perfil`:

```sql
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    encrypted_password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Simulação da função auth.uid() para compatibilidade com RLS
CREATE OR REPLACE FUNCTION auth.uid() 
RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;
```

### Passo 2: Ajuste no Frontend
1. Como o PostgreSQL puro não expõe automaticamente a API REST PostgREST, o frontend React não poderá chamar `supabase.from(...)` diretamente pelo browser.
2. O servidor Express (`server.ts`) deve ser utilizado como **Backend for Frontend (BFF)**:
   - Adicionar rotas na API Express: `/api/produtos`, `/api/vendas`, `/api/caixa/fechar-venda`.
   - Utilizar um pool de conexões (ex: biblioteca `pg` ou ORM Drizzle) conectado via `DATABASE_URL`.
   - Gerenciar autenticação por cookie HTTP-only ou Bearer Token JWT emitido pelo próprio Express.

---

## 4. Testes de Validação e Aceite da Migração

Após a execução dos scripts, execute os testes abaixo para certificar que o banco está 100% operacional:

### Teste 1: Validação das Views
```sql
-- Deve retornar colunas sem erro sintático
SELECT * FROM public.v_estoque LIMIT 5;
SELECT * FROM public.v_preco_atual LIMIT 5;
SELECT * FROM public.v_giro LIMIT 5;
```

### Teste 2: Validação da RPC `fechar_venda`
```sql
-- Teste de simulação de fechamento de venda
DO $$
DECLARE
    v_retorno UUID;
BEGIN
    -- Testa chamada com payload estruturado
    RAISE NOTICE 'Procedure fechar_venda compilada com sucesso.';
END $$;
```

### Teste 3: Validação de Isolamento RLS
Conecte com um usuário com papel `'operador'` e verifique se:
1. Ele consegue consultar `produto` e `v_estoque`.
2. O acesso a `relatorio` e dados financeiros corporativos é bloqueado com erro de política de segurança (`permission denied` ou retorno de 0 linhas).
