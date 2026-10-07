-- ==============================================================================
-- SECURE ONE-TIME SUPERVISOR APPROVAL FOR HIGH DISCOUNTS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

CREATE TABLE IF NOT EXISTS private.autorizacao_caixa (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
    autorizador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 minutes'),
    usado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_autorizacao_caixa_lookup
ON private.autorizacao_caixa(token, empresa_id, expira_em)
WHERE usado_em IS NULL;

CREATE OR REPLACE FUNCTION public.criar_autorizacao_caixa()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
    v_user_id UUID := auth.uid();
    v_empresa_id UUID;
    v_token UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    SELECT p.empresa_id
      INTO v_empresa_id
      FROM public.perfil p
     WHERE p.id = v_user_id
       AND p.papel = 'dono';

    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Somente um dono pode autorizar desconto acima do limite';
    END IF;

    DELETE FROM private.autorizacao_caixa
     WHERE expira_em < now() - INTERVAL '1 day';

    INSERT INTO private.autorizacao_caixa (empresa_id, autorizador_id)
    VALUES (v_empresa_id, v_user_id)
    RETURNING token INTO v_token;

    RETURN v_token;
END;
$func$;

REVOKE ALL ON FUNCTION public.criar_autorizacao_caixa() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_autorizacao_caixa() FROM anon;
GRANT EXECUTE ON FUNCTION public.criar_autorizacao_caixa() TO authenticated;

-- ==============================================================================
-- HARDEN CHECKOUT: atomic discounts, tenant validation and stock concurrency
-- ==============================================================================

DROP FUNCTION IF EXISTS public.fechar_venda(JSONB, TEXT);
DROP FUNCTION IF EXISTS public.fechar_venda(JSONB, TEXT, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.fechar_venda(JSONB, TEXT, TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION public.fechar_venda(
    p_itens JSONB,
    p_forma TEXT,
    p_desconto_motivo TEXT DEFAULT NULL,
    p_autorizador_id UUID DEFAULT NULL,
    p_autorizacao_token UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_empresa_id UUID;
    v_papel TEXT;
    v_venda_id UUID;

    v_item JSONB;
    v_produto_id UUID;
    v_qtd NUMERIC(12,3);
    v_qtd_total_produto NUMERIC(12,3);

    v_custo NUMERIC(12,2);
    v_preco_cheio NUMERIC(12,2);
    v_preco_base NUMERIC(12,2);
    v_preco_final NUMERIC(12,2);
    v_promo_pct NUMERIC(5,2);
    v_desconto_promo_unit NUMERIC(12,2);
    v_desconto_manual_unit NUMERIC(12,2);
    v_desconto_total_unit NUMERIC(12,2);
    v_desconto_origem TEXT;

    v_total NUMERIC(12,2) := 0;
    v_total_base_promocional NUMERIC(12,2) := 0;
    v_custo_total NUMERIC(12,2) := 0;
    v_desconto_manual_total NUMERIC(12,2) := 0;
    v_desconto_manual_pct NUMERIC(8,4) := 0;
    v_desconto_por UUID;

    v_saldo NUMERIC(12,3);
    v_limite_operador NUMERIC(5,2) := 5;
    v_taxa_pct NUMERIC(6,4) := 0;
    v_taxa_valor NUMERIC(12,2) := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    SELECT p.empresa_id, p.papel
      INTO v_empresa_id, v_papel
      FROM public.perfil p
     WHERE p.id = v_user_id;

    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário sem empresa vinculada';
    END IF;

    IF v_papel NOT IN ('dono', 'operador') THEN
        RAISE EXCEPTION 'Perfil sem permissão para fechar venda';
    END IF;

    IF p_forma NOT IN ('dinheiro', 'pix', 'debito', 'credito') THEN
        RAISE EXCEPTION 'Forma de pagamento inválida';
    END IF;

    IF p_itens IS NULL
       OR jsonb_typeof(p_itens) <> 'array'
       OR jsonb_array_length(p_itens) = 0 THEN
        RAISE EXCEPTION 'O carrinho de vendas não pode estar vazio';
    END IF;

    -- Lock determinístico por produto para serializar vendas concorrentes
    -- da mesma mercadoria e evitar duas baixas simultâneas da última unidade.
    FOR v_produto_id IN
        SELECT DISTINCT (item->>'produto_id')::UUID
          FROM jsonb_array_elements(p_itens) AS item
         ORDER BY 1
    LOOP
        PERFORM 1
          FROM public.produto p
         WHERE p.id = v_produto_id
           AND p.empresa_id = v_empresa_id
           AND p.ativo = true
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produto inválido, inativo ou pertencente a outra empresa';
        END IF;
    END LOOP;

    -- Valida quantidade total por produto contra o saldo após adquirir os locks.
    FOR v_produto_id, v_qtd_total_produto IN
        SELECT
            (item->>'produto_id')::UUID,
            SUM((item->>'quantidade')::NUMERIC)
        FROM jsonb_array_elements(p_itens) AS item
        GROUP BY (item->>'produto_id')::UUID
        ORDER BY 1
    LOOP
        IF v_qtd_total_produto <= 0 THEN
            RAISE EXCEPTION 'Quantidade inválida para produto %', v_produto_id;
        END IF;

        SELECT COALESCE(SUM(
            CASE
                WHEN m.tipo IN ('entrada', 'devolucao') THEN m.quantidade
                WHEN m.tipo IN ('venda', 'perda') THEN -m.quantidade
                WHEN m.tipo = 'ajuste' THEN m.quantidade
                ELSE 0
            END
        ), 0)
          INTO v_saldo
          FROM public.movimento m
         WHERE m.empresa_id = v_empresa_id
           AND m.produto_id = v_produto_id;

        IF v_saldo < v_qtd_total_produto THEN
            RAISE EXCEPTION
                'Estoque insuficiente para o produto %. Disponível: %, solicitado: %',
                v_produto_id, v_saldo, v_qtd_total_produto;
        END IF;
    END LOOP;

    -- Calcula tudo no servidor. Custo e preço-base nunca são confiados ao navegador.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_produto_id := (v_item->>'produto_id')::UUID;
        v_qtd := (v_item->>'quantidade')::NUMERIC;
        v_preco_final := (v_item->>'preco_unit')::NUMERIC;

        IF v_qtd <= 0 OR v_preco_final < 0 THEN
            RAISE EXCEPTION 'Item de venda inválido';
        END IF;

        SELECT
            p.custo,
            p.preco,
            COALESCE(MAX(pr.percentual) FILTER (
                WHERE pr.ativa = true
                  AND CURRENT_DATE BETWEEN pr.inicio AND pr.fim
            ), 0)
          INTO v_custo, v_preco_cheio, v_promo_pct
          FROM public.produto p
          LEFT JOIN public.promocao pr
            ON pr.produto_id = p.id
           AND pr.empresa_id = p.empresa_id
         WHERE p.id = v_produto_id
           AND p.empresa_id = v_empresa_id
           AND p.ativo = true
         GROUP BY p.custo, p.preco;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produto inválido ou indisponível';
        END IF;

        v_preco_base := ROUND(v_preco_cheio * (1 - v_promo_pct / 100.0), 2);

        -- O cliente pode solicitar desconto adicional, mas nunca elevar o preço acima
        -- do preço promocional vigente nem enviar preço negativo.
        IF v_preco_final > v_preco_base + 0.01 THEN
            RAISE EXCEPTION 'Preço enviado diverge do preço vigente do produto %', v_produto_id;
        END IF;

        v_desconto_promo_unit := GREATEST(v_preco_cheio - v_preco_base, 0);
        v_desconto_manual_unit := GREATEST(v_preco_base - v_preco_final, 0);
        v_desconto_total_unit := v_desconto_promo_unit + v_desconto_manual_unit;

        v_total := v_total + (v_qtd * v_preco_final);
        v_total_base_promocional := v_total_base_promocional + (v_qtd * v_preco_base);
        v_custo_total := v_custo_total + (v_qtd * v_custo);
        v_desconto_manual_total := v_desconto_manual_total + (v_qtd * v_desconto_manual_unit);
    END LOOP;

    IF v_desconto_manual_total > 0 THEN
        IF p_desconto_motivo IS NULL OR btrim(p_desconto_motivo) = '' THEN
            RAISE EXCEPTION 'Motivo do desconto é obrigatório';
        END IF;

        IF v_total_base_promocional > 0 THEN
            v_desconto_manual_pct := (v_desconto_manual_total / v_total_base_promocional) * 100;
        END IF;

        SELECT COALESCE(ct.desconto_max_operador, 5)
          INTO v_limite_operador
          FROM public.config_taxa ct
         WHERE ct.empresa_id = v_empresa_id;

        IF v_limite_operador IS NULL THEN
            v_limite_operador := 5;
        END IF;

        IF v_papel = 'operador' AND v_desconto_manual_pct > v_limite_operador THEN
            IF p_autorizacao_token IS NULL THEN
                RAISE EXCEPTION
                    'Desconto de % %% excede o limite do operador de % %% e exige autorização válida',
                    ROUND(v_desconto_manual_pct, 2), v_limite_operador;
            END IF;

            UPDATE private.autorizacao_caixa a
               SET usado_em = now()
             WHERE a.token = p_autorizacao_token
               AND a.empresa_id = v_empresa_id
               AND a.usado_em IS NULL
               AND a.expira_em > now()
             RETURNING a.autorizador_id INTO v_desconto_por;

            IF v_desconto_por IS NULL THEN
                RAISE EXCEPTION 'Autorização inválida, expirada ou já utilizada';
            END IF;
        ELSE
            v_desconto_por := v_user_id;
        END IF;
    END IF;

    SELECT CASE p_forma
             WHEN 'dinheiro' THEN COALESCE(ct.dinheiro, 0)
             WHEN 'pix'      THEN COALESCE(ct.pix, 0)
             WHEN 'debito'   THEN COALESCE(ct.debito, 0)
             WHEN 'credito'  THEN COALESCE(ct.credito, 0)
             ELSE 0
           END
      INTO v_taxa_pct
      FROM public.config_taxa ct
     WHERE ct.empresa_id = v_empresa_id;

    IF v_taxa_pct IS NULL THEN
        v_taxa_pct := 0;
    END IF;

    v_taxa_valor := ROUND(v_total * v_taxa_pct, 2);

    INSERT INTO public.venda (
        empresa_id,
        operador_id,
        total,
        custo_total,
        desconto,
        desconto_por,
        desconto_motivo,
        forma_pagamento,
        taxa
    ) VALUES (
        v_empresa_id,
        v_user_id,
        ROUND(v_total, 2),
        ROUND(v_custo_total, 2),
        ROUND(v_desconto_manual_total, 2),
        v_desconto_por,
        CASE WHEN v_desconto_manual_total > 0 THEN p_desconto_motivo ELSE NULL END,
        p_forma,
        v_taxa_valor
    )
    RETURNING id INTO v_venda_id;

    -- Recalcula por item sob os mesmos locks e grava tudo dentro da mesma transação.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_produto_id := (v_item->>'produto_id')::UUID;
        v_qtd := (v_item->>'quantidade')::NUMERIC;
        v_preco_final := (v_item->>'preco_unit')::NUMERIC;

        SELECT
            p.custo,
            p.preco,
            COALESCE(MAX(pr.percentual) FILTER (
                WHERE pr.ativa = true
                  AND CURRENT_DATE BETWEEN pr.inicio AND pr.fim
            ), 0)
          INTO v_custo, v_preco_cheio, v_promo_pct
          FROM public.produto p
          LEFT JOIN public.promocao pr
            ON pr.produto_id = p.id
           AND pr.empresa_id = p.empresa_id
         WHERE p.id = v_produto_id
           AND p.empresa_id = v_empresa_id
         GROUP BY p.custo, p.preco;

        v_preco_base := ROUND(v_preco_cheio * (1 - v_promo_pct / 100.0), 2);
        v_desconto_promo_unit := GREATEST(v_preco_cheio - v_preco_base, 0);
        v_desconto_manual_unit := GREATEST(v_preco_base - v_preco_final, 0);
        v_desconto_total_unit := v_desconto_promo_unit + v_desconto_manual_unit;

        v_desconto_origem := CASE
            WHEN v_desconto_promo_unit > 0 AND v_desconto_manual_unit > 0 THEN 'ambos'
            WHEN v_desconto_promo_unit > 0 THEN 'promocao'
            WHEN v_desconto_manual_unit > 0 THEN 'caixa'
            ELSE NULL
        END;

        INSERT INTO public.venda_item (
            venda_id,
            produto_id,
            quantidade,
            preco_unit,
            custo_unit,
            desconto_unit,
            desconto_origem
        ) VALUES (
            v_venda_id,
            v_produto_id,
            v_qtd,
            ROUND(v_preco_final, 2),
            ROUND(v_custo, 2),
            ROUND(v_desconto_total_unit, 2),
            v_desconto_origem
        );

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
            ROUND(v_preco_final, 2),
            ROUND(v_custo, 2),
            v_venda_id::TEXT,
            v_user_id
        );
    END LOOP;

    RETURN v_venda_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fechar_venda(JSONB, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fechar_venda(JSONB, TEXT, TEXT, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.fechar_venda(JSONB, TEXT, TEXT, UUID, UUID)
IS 'Fecha a venda de forma atômica, valida tenant, preço, desconto, autorização e saldo sob lock concorrente.';
