-- ==============================================================================
-- SCHEMA COMPLETO DO BANCO DE DADOS - CONTROLE DE ESTOQUE E CAIXA
-- Sistema: Mercado Aparecida (SaaS Multi-tenant por Empresa)
-- Compatível com: Supabase PostgreSQL / PostgreSQL 15+
-- ==============================================================================

-- 1. HABILITAR EXTENSÕES ESSENCIAIS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELAS PRINCIPAIS
-- ==============================================================================

-- 2.1 TABELA: empresa (Tenant principal do sistema)
CREATE TABLE IF NOT EXISTS public.empresa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cnpj TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.empresa IS 'Armazena as empresas/lojas (multi-tenant)';

-- 2.2 TABELA: perfil (Vincula auth.users com empresa e papel de acesso)
CREATE TABLE IF NOT EXISTS public.perfil (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    papel TEXT NOT NULL CHECK (papel IN ('dono', 'operador')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.perfil IS 'Perfil do usuário com papel RBAC (dono ou operador)';

-- 2.3 TABELA: categoria
CREATE TABLE IF NOT EXISTS public.categoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unq_categoria_empresa_nome UNIQUE (empresa_id, nome)
);

-- 2.4 TABELA: produto
CREATE TABLE IF NOT EXISTS public.produto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
    categoria_id UUID REFERENCES public.categoria(id) ON DELETE SET NULL,
    ean TEXT,
    nome TEXT NOT NULL,
    unidade TEXT NOT NULL DEFAULT 'un' CHECK (unidade IN ('un', 'kg')),
    custo NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (custo >= 0),
    preco NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (preco >= 0),
    estoque_minimo NUMERIC(12, 3) DEFAULT 10 CHECK (estoque_minimo >= 0),
    perecivel BOOLEAN NOT NULL DEFAULT false,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 TABELA: lote (Controle de validade e lotes específicos)
CREATE TABLE IF NOT EXISTS public.lote (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produto(id) ON DELETE CASCADE,
    validade DATE,
    custo NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (custo >= 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.6 TABELA: movimento (Ledger imutável de movimentação de estoque)
CREATE TABLE IF NOT EXISTS public.movimento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produto(id) ON DELETE CASCADE,
    lote_id UUID REFERENCES public.lote(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'venda', 'perda', 'ajuste', 'devolucao')),
    quantidade NUMERIC(12, 3) NOT NULL CHECK (quantidade > 0),
    custo_unit NUMERIC(12, 2),
    preco_unit NUMERIC(12, 2),
    motivo TEXT,
    ref_id TEXT,
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.movimento IS 'Histórico de movimentações de estoque (entradas, saídas, perdas e vendas)';

-- 2.7 TABELA: venda (Cabeçalho da venda / cupom)
CREATE TABLE IF NOT EXISTS public.venda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
    operador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    custo_total NUMERIC(12, 2) DEFAULT 0.00,
    desconto NUMERIC(12, 2) DEFAULT 0.00 CHECK (desconto >= 0),
    desconto_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    desconto_motivo TEXT,
    forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'pix', 'debito', 'credito')),
    taxa NUMERIC(12, 2) DEFAULT 0.00,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.8 TABELA: venda_item (Itens comercializados na venda)
CREATE TABLE IF NOT EXISTS public.venda_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id UUID NOT NULL REFERENCES public.venda(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produto(id) ON DELETE RESTRICT,
    quantidade NUMERIC(12, 3) NOT NULL CHECK (quantidade > 0),
    preco_unit NUMERIC(12, 2) NOT NULL CHECK (preco_unit >= 0),
    custo_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    desconto_unit NUMERIC(12, 2) DEFAULT 0.00 CHECK (desconto_unit >= 0),
    desconto_origem TEXT CHECK (desconto_origem IN ('promocao', 'caixa', 'ambos')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.9 TABELA: promocao (Campanhas de desconto / queima de estoque)
CREATE TABLE IF NOT EXISTS public.promocao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produto(id) ON DELETE CASCADE,
    percentual NUMERIC(5, 2) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
    inicio DATE NOT NULL,
    fim DATE NOT NULL,
    motivo TEXT,
    ativa BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.10 TABELA: config_taxa (Taxas de maquininha de cartão e limite de desconto do operador)
CREATE TABLE IF NOT EXISTS public.config_taxa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL UNIQUE REFERENCES public.empresa(id) ON DELETE CASCADE,
    dinheiro NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    pix NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    debito NUMERIC(6, 4) NOT NULL DEFAULT 0.0150,
    credito NUMERIC(6, 4) NOT NULL DEFAULT 0.0350,
    desconto_max_operador NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.11 TABELA: relatorio (Relatórios gerados e inteligência executiva)
CREATE TABLE IF NOT EXISTS public.relatorio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('diario', 'semanal', 'mensal')),
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    texto TEXT NOT NULL,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. ÍNDICES DE PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_produto_empresa_ativo ON public.produto(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_produto_ean ON public.produto(ean);
CREATE INDEX IF NOT EXISTS idx_produto_nome ON public.produto(nome);
CREATE INDEX IF NOT EXISTS idx_categoria_empresa ON public.categoria(empresa_id);
CREATE INDEX IF NOT EXISTS idx_lote_empresa_validade ON public.lote(empresa_id, validade);
CREATE INDEX IF NOT EXISTS idx_movimento_empresa_prod ON public.movimento(empresa_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_movimento_tipo_criado ON public.movimento(tipo, criado_em);
CREATE INDEX IF NOT EXISTS idx_venda_empresa_criado ON public.venda(empresa_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_venda_item_venda ON public.venda_item(venda_id);
CREATE INDEX IF NOT EXISTS idx_venda_item_produto ON public.venda_item(produto_id);
CREATE INDEX IF NOT EXISTS idx_promocao_vigencia ON public.promocao(empresa_id, produto_id, ativa, inicio, fim);
CREATE INDEX IF NOT EXISTS idx_relatorio_empresa_data ON public.relatorio(empresa_id, criado_em);

-- ==============================================================================
-- 4. VIEWS ANALÍTICAS
-- ==============================================================================

-- 4.1 VIEW: v_estoque (Saldo atual consolidado por produto e valor de custo total)
CREATE OR REPLACE VIEW public.v_estoque
WITH (security_invoker = true) AS
WITH saldo_movimentos AS (
    SELECT 
        m.produto_id,
        m.empresa_id,
        COALESCE(SUM(
            CASE 
                WHEN m.tipo IN ('entrada', 'devolucao') THEN m.quantidade
                WHEN m.tipo IN ('venda', 'perda') THEN -m.quantidade
                WHEN m.tipo = 'ajuste' THEN m.quantidade
                ELSE 0
            END
        ), 0) AS saldo
    FROM public.movimento m
    GROUP BY m.produto_id, m.empresa_id
)
SELECT 
    p.id AS produto_id,
    p.empresa_id,
    COALESCE(sm.saldo, 0) AS saldo,
    ROUND(COALESCE(sm.saldo, 0) * p.custo, 2) AS valor_custo
FROM public.produto p
LEFT JOIN saldo_movimentos sm ON sm.produto_id = p.id AND sm.empresa_id = p.empresa_id;

COMMENT ON VIEW public.v_estoque IS 'Saldo em estoque consolidado em tempo real derivado dos movimentos';

-- 4.2 VIEW: v_preco_atual (Preço em vigor considerando promoções ativas)
CREATE OR REPLACE VIEW public.v_preco_atual
WITH (security_invoker = true) AS
WITH promo_ativa AS (
    SELECT DISTINCT ON (pr.produto_id, pr.empresa_id)
        pr.produto_id,
        pr.empresa_id,
        pr.percentual
    FROM public.promocao pr
    WHERE pr.ativa = true 
      AND CURRENT_DATE >= pr.inicio 
      AND CURRENT_DATE <= pr.fim
    ORDER BY pr.produto_id, pr.empresa_id, pr.percentual DESC
)
SELECT 
    p.id AS produto_id,
    p.empresa_id,
    p.preco AS preco_cheio,
    COALESCE(pa.percentual, 0) AS desconto_pct,
    ROUND(p.preco * (1 - COALESCE(pa.percentual, 0) / 100.0), 2) AS preco_venda
FROM public.produto p
LEFT JOIN promo_ativa pa ON pa.produto_id = p.id AND pa.empresa_id = p.empresa_id;

COMMENT ON VIEW public.v_preco_atual IS 'Preço de venda atualizado com dedução de promoções ativas';

-- 4.3 VIEW: v_giro (Vendas dos últimos 30 dias e média diária por produto)
CREATE OR REPLACE VIEW public.v_giro
WITH (security_invoker = true) AS
WITH vendas_30d AS (
    SELECT 
        vi.produto_id,
        v.empresa_id,
        SUM(vi.quantidade) AS vendido_30d
    FROM public.venda_item vi
    JOIN public.venda v ON v.id = vi.venda_id
    WHERE v.criado_em >= (now() - INTERVAL '30 days')
    GROUP BY vi.produto_id, v.empresa_id
)
SELECT 
    p.id AS produto_id,
    p.empresa_id,
    COALESCE(v30.vendido_30d, 0) AS vendido_30d,
    ROUND(COALESCE(v30.vendido_30d, 0) / 30.0, 2) AS media_dia
FROM public.produto p
LEFT JOIN vendas_30d v30 ON v30.produto_id = p.id AND v30.empresa_id = p.empresa_id;

COMMENT ON VIEW public.v_giro IS 'Giro de vendas nos últimos 30 dias para cálculo de reposição e cobertura';

-- 4.4 VIEW: v_giro_30d (Alias compatível com v_giro)
CREATE OR REPLACE VIEW public.v_giro_30d
WITH (security_invoker = true) AS
SELECT * FROM public.v_giro;

COMMENT ON VIEW public.v_giro_30d IS 'Alias de compatibilidade para v_giro';

-- ==============================================================================
-- 5. FUNCTIONS E RPCS
-- ==============================================================================

-- Helper para obter a empresa do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_minha_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $
    SELECT empresa_id FROM public.perfil WHERE id = auth.uid() LIMIT 1;
$;

-- Helper para obter o papel do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_meu_papel()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $
    SELECT papel FROM public.perfil WHERE id = auth.uid() LIMIT 1;
$;

-- RPC Transacional de Fechamento de Venda
CREATE OR REPLACE FUNCTION public.fechar_venda(
    p_itens JSONB,
    p_forma TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_empresa_id UUID;
    v_venda_id UUID;
    v_total NUMERIC(12, 2) := 0;
    v_custo_total NUMERIC(12, 2) := 0;
    v_item JSONB;
    v_produto_id UUID;
    v_qtd NUMERIC(12, 3);
    v_preco NUMERIC(12, 2);
    v_custo NUMERIC(12, 2);
    v_desc_unit NUMERIC(12, 2);
BEGIN
    -- 1. Obter a empresa do operador
    SELECT empresa_id INTO v_empresa_id
    FROM public.perfil
    WHERE id = v_user_id;

    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Operador sem empresa vinculada ou não autenticado';
    END IF;

    IF jsonb_array_length(p_itens) = 0 THEN
        RAISE EXCEPTION 'O carrinho de vendas não pode estar vazio';
    END IF;

    -- 2. Calcular totais da venda
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_qtd := (v_item->>'quantidade')::NUMERIC;
        v_preco := (v_item->>'preco_unit')::NUMERIC;
        v_custo := COALESCE((v_item->>'custo_unit')::NUMERIC, 0);
        v_total := v_total + (v_qtd * v_preco);
        v_custo_total := v_custo_total + (v_qtd * v_custo);
    END LOOP;

    -- 3. Inserir cabeçalho da venda
    INSERT INTO public.venda (
        empresa_id,
        operador_id,
        total,
        custo_total,
        forma_pagamento
    ) VALUES (
        v_empresa_id,
        v_user_id,
        ROUND(v_total, 2),
        ROUND(v_custo_total, 2),
        p_forma
    ) RETURNING id INTO v_venda_id;

    -- 4. Inserir cada item e baixar estoque via movimento
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_produto_id := (v_item->>'produto_id')::UUID;
        v_qtd := (v_item->>'quantidade')::NUMERIC;
        v_preco := (v_item->>'preco_unit')::NUMERIC;
        v_custo := COALESCE((v_item->>'custo_unit')::NUMERIC, 0);
        v_desc_unit := COALESCE((v_item->>'desconto_unit')::NUMERIC, 0);

        -- Garantir que o produto pertence à mesma empresa da sessão.
        -- A validação dentro da RPC é obrigatória porque SECURITY DEFINER ignora RLS.
        IF NOT EXISTS (
            SELECT 1
            FROM public.produto p
            WHERE p.id = v_produto_id
              AND p.empresa_id = v_empresa_id
              AND p.ativo = true
        ) THEN
            RAISE EXCEPTION 'Produto inválido ou pertencente a outra empresa';
        END IF;

        -- Inserir venda_item
        INSERT INTO public.venda_item (
            venda_id,
            produto_id,
            quantidade,
            preco_unit,
            custo_unit,
            desconto_unit
        ) VALUES (
            v_venda_id,
            v_produto_id,
            v_qtd,
            v_preco,
            v_custo,
            v_desc_unit
        );

        -- Inserir movimento de saída
        INSERT INTO public.movimento (
            empresa_id,
            produto_id,
            tipo,
            quantidade,
            preco_unit,
            custo_unit,
            ref_id,
            criado_por
        ) VALUES (
            v_empresa_id,
            v_produto_id,
            'venda',
            v_qtd,
            v_preco,
            v_custo,
            v_venda_id::TEXT,
            v_user_id
        );
    END LOOP;

    RETURN v_venda_id;
END;
$$;

COMMENT ON FUNCTION public.fechar_venda IS 'RPC atômica para registro da venda, baixa de itens e lançamento de movimentos de estoque';

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) E POLICIES
-- ==============================================================================

ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promocao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_taxa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio ENABLE ROW LEVEL SECURITY;

-- 6.1 POLICIES PARA EMPRESA
CREATE POLICY "empresa_select_policy" ON public.empresa
    FOR SELECT TO authenticated
    USING (id = public.get_minha_empresa_id());

-- 6.2 POLICIES PARA PERFIL
CREATE POLICY "perfil_select_policy" ON public.perfil
    FOR SELECT TO authenticated
    USING (empresa_id = public.get_minha_empresa_id());

CREATE POLICY "perfil_dono_manage" ON public.perfil
    FOR ALL TO authenticated
    USING (empresa_id = public.get_minha_empresa_id() AND public.get_meu_papel() = 'dono');

-- 6.3 POLICIES PARA PRODUTOS E CATEGORIAS
CREATE POLICY "categoria_empresa_policy" ON public.categoria
    FOR ALL TO authenticated
    USING (empresa_id = public.get_minha_empresa_id())
    WITH CHECK (empresa_id = public.get_minha_empresa_id());

CREATE POLICY "produto_empresa_policy" ON public.produto
    FOR ALL TO authenticated
    USING (empresa_id = public.get_minha_empresa_id())
    WITH CHECK (empresa_id = public.get_minha_empresa_id());

-- 6.4 POLICIES PARA LOTES E MOVIMENTOS
CREATE POLICY "lote_empresa_policy" ON public.lote
    FOR ALL TO authenticated
    USING (empresa_id = public.get_minha_empresa_id())
    WITH CHECK (empresa_id = public.get_minha_empresa_id());

CREATE POLICY "movimento_empresa_policy" ON public.movimento
    FOR ALL TO authenticated
    USING (empresa_id = public.get_minha_empresa_id())
    WITH CHECK (empresa_id = public.get_minha_empresa_id());

-- 6.5 POLICIES PARA VENDAS E ITENS
CREATE POLICY "venda_empresa_policy" ON public.venda
    FOR ALL TO authenticated
    USING (empresa_id = public.get_minha_empresa_id())
    WITH CHECK (empresa_id = public.get_minha_empresa_id());

CREATE POLICY "venda_item_empresa_policy" ON public.venda_item
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.venda v 
        WHERE v.id = venda_item.venda_id AND v.empresa_id = public.get_minha_empresa_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.venda v 
        WHERE v.id = venda_item.venda_id AND v.empresa_id = public.get_minha_empresa_id()
    ));

-- 6.6 POLICIES PARA PROMOÇÕES E CONFIGURAÇÕES
CREATE POLICY "promocao_empresa_policy" ON public.promocao
    FOR ALL TO authenticated
    USING (empresa_id = public.get_minha_empresa_id())
    WITH CHECK (empresa_id = public.get_minha_empresa_id());

CREATE POLICY "config_taxa_empresa_policy" ON public.config_taxa
    FOR ALL TO authenticated
    USING (empresa_id = public.get_minha_empresa_id())
    WITH CHECK (empresa_id = public.get_minha_empresa_id());

-- 6.7 POLICIES PARA RELATÓRIOS (Restrito ao Dono)
CREATE POLICY "relatorio_dono_policy" ON public.relatorio
    FOR ALL TO authenticated
    USING (empresa_id = public.get_minha_empresa_id() AND public.get_meu_papel() = 'dono')
    WITH CHECK (empresa_id = public.get_minha_empresa_id() AND public.get_meu_papel() = 'dono');

-- ==============================================================================
-- 7. HARDENING DE FUNÇÕES, VIEWS E DATA API
-- ==============================================================================

-- SECURITY DEFINER em schema exposto não deve ficar executável por PUBLIC.
REVOKE ALL ON FUNCTION public.get_minha_empresa_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_meu_papel() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fechar_venda(JSONB, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_minha_empresa_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meu_papel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_venda(JSONB, TEXT) TO authenticated;

-- As views são security_invoker e, portanto, respeitam o contexto/RLS do chamador.
GRANT SELECT ON public.v_estoque TO authenticated;
GRANT SELECT ON public.v_preco_atual TO authenticated;
GRANT SELECT ON public.v_giro TO authenticated;
GRANT SELECT ON public.v_giro_30d TO authenticated;
