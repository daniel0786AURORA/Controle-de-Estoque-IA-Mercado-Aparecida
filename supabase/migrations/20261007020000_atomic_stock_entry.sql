-- ==============================================================================
-- ATOMIC STOCK ENTRY: product + optional lot + movement in one transaction
-- ==============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS unq_produto_empresa_ean
ON public.produto(empresa_id, ean)
WHERE ean IS NOT NULL AND btrim(ean) <> '';

CREATE OR REPLACE FUNCTION public.registrar_entrada_produto(
    p_produto_id UUID,
    p_ean TEXT,
    p_nome TEXT,
    p_categoria_id UUID,
    p_unidade TEXT,
    p_custo NUMERIC,
    p_preco NUMERIC,
    p_perecivel BOOLEAN,
    p_meta_cobertura_dias NUMERIC,
    p_quantidade NUMERIC,
    p_validade DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
    v_user_id UUID := auth.uid();
    v_empresa_id UUID;
    v_produto_id UUID;
    v_lote_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    SELECT p.empresa_id
      INTO v_empresa_id
      FROM public.perfil p
     WHERE p.id = v_user_id;

    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário sem empresa vinculada';
    END IF;

    IF p_nome IS NULL OR btrim(p_nome) = '' THEN
        RAISE EXCEPTION 'Nome do produto é obrigatório';
    END IF;

    IF p_unidade NOT IN ('un', 'kg') THEN
        RAISE EXCEPTION 'Unidade inválida';
    END IF;

    IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
        RAISE EXCEPTION 'Quantidade de entrada deve ser maior que zero';
    END IF;

    IF COALESCE(p_custo, 0) < 0 OR COALESCE(p_preco, 0) < 0 THEN
        RAISE EXCEPTION 'Custo e preço não podem ser negativos';
    END IF;

    IF p_perecivel AND p_validade IS NULL THEN
        RAISE EXCEPTION 'Produto perecível exige data de validade';
    END IF;

    IF p_categoria_id IS NOT NULL THEN
        PERFORM 1
          FROM public.categoria c
         WHERE c.id = p_categoria_id
           AND c.empresa_id = v_empresa_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Categoria inválida para esta empresa';
        END IF;
    END IF;

    IF p_produto_id IS NOT NULL THEN
        SELECT p.id
          INTO v_produto_id
          FROM public.produto p
         WHERE p.id = p_produto_id
           AND p.empresa_id = v_empresa_id
         FOR UPDATE;

        IF v_produto_id IS NULL THEN
            RAISE EXCEPTION 'Produto informado não pertence à empresa';
        END IF;

        UPDATE public.produto
           SET ean = NULLIF(btrim(p_ean), ''),
               nome = btrim(p_nome),
               categoria_id = p_categoria_id,
               unidade = p_unidade,
               custo = COALESCE(p_custo, 0),
               preco = COALESCE(p_preco, 0),
               perecivel = p_perecivel,
               estoque_minimo = GREATEST(COALESCE(p_meta_cobertura_dias, 21), 0),
               ativo = true
         WHERE id = v_produto_id;
    ELSE
        INSERT INTO public.produto (
            empresa_id,
            ean,
            nome,
            categoria_id,
            unidade,
            custo,
            preco,
            perecivel,
            estoque_minimo,
            ativo
        ) VALUES (
            v_empresa_id,
            NULLIF(btrim(p_ean), ''),
            btrim(p_nome),
            p_categoria_id,
            p_unidade,
            COALESCE(p_custo, 0),
            COALESCE(p_preco, 0),
            p_perecivel,
            GREATEST(COALESCE(p_meta_cobertura_dias, 21), 0),
            true
        )
        RETURNING id INTO v_produto_id;
    END IF;

    IF p_validade IS NOT NULL THEN
        INSERT INTO public.lote (
            empresa_id,
            produto_id,
            validade,
            custo
        ) VALUES (
            v_empresa_id,
            v_produto_id,
            p_validade,
            COALESCE(p_custo, 0)
        )
        RETURNING id INTO v_lote_id;
    END IF;

    INSERT INTO public.movimento (
        empresa_id,
        produto_id,
        lote_id,
        tipo,
        quantidade,
        custo_unit,
        preco_unit,
        motivo,
        criado_por
    ) VALUES (
        v_empresa_id,
        v_produto_id,
        v_lote_id,
        'entrada',
        p_quantidade,
        COALESCE(p_custo, 0),
        COALESCE(p_preco, 0),
        'Entrada manual / Cadastro',
        v_user_id
    );

    RETURN v_produto_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.registrar_entrada_produto(
    UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, DATE
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.registrar_entrada_produto(
    UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, DATE
) TO authenticated;

COMMENT ON FUNCTION public.registrar_entrada_produto(
    UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, DATE
)
IS 'Cria/atualiza produto, registra lote opcional e entrada de estoque atomicamente.';
