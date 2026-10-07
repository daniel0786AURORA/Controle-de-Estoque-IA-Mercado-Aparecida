-- ==============================================================================
-- SEED DE DEMONSTRAÇÃO - DADOS PURAMENTE FICTÍCIOS
-- Sistema: Mercado Aparecida (Ambiente Demo Seguro)
-- ATENÇÃO: NÃO EXECUTE ESTE SCRIPT EM AMBIENTE DE PRODUÇÃO REAL.
-- Todos os IDs, CNPJs, nomes e valores são fictícios e criados apenas para
-- possibilitar a auditoria, reconstrução e testes do frontend/dashboard.
-- ==============================================================================

DO $$
DECLARE
    v_empresa_id UUID := '11111111-1111-1111-1111-111111111111';
    v_user_dono_id UUID := '22222222-2222-2222-2222-222222222222';
    v_user_op_id UUID := '33333333-3333-3333-3333-333333333333';
    
    -- Categorias
    v_cat_mercearia UUID := 'c0000000-0000-0000-0000-000000000001';
    v_cat_bebidas UUID := 'c0000000-0000-0000-0000-000000000002';
    v_cat_laticinios UUID := 'c0000000-0000-0000-0000-000000000003';
    v_cat_limpeza UUID := 'c0000000-0000-0000-0000-000000000004';
    v_cat_hortifruti UUID := 'c0000000-0000-0000-0000-000000000005';
    v_cat_padaria UUID := 'c0000000-0000-0000-0000-000000000006';

    -- Produtos
    v_prod_arroz UUID := 'p0000000-0000-0000-0000-000000000001';
    v_prod_feijao UUID := 'p0000000-0000-0000-0000-000000000002';
    v_prod_oleo UUID := 'p0000000-0000-0000-0000-000000000003';
    v_prod_leite UUID := 'p0000000-0000-0000-0000-000000000004';
    v_prod_cafe UUID := 'p0000000-0000-0000-0000-000000000005';
    v_prod_coca UUID := 'p0000000-0000-0000-0000-000000000006';
    v_prod_sabao UUID := 'p0000000-0000-0000-0000-000000000007';
    v_prod_detergente UUID := 'p0000000-0000-0000-0000-000000000008';
    v_prod_mussarela UUID := 'p0000000-0000-0000-0000-000000000009';
    v_prod_iogurte UUID := 'p0000000-0000-0000-0000-000000000010';
    v_prod_palmito_parado UUID := 'p0000000-0000-0000-0000-000000000011';
    v_prod_tomate UUID := 'p0000000-0000-0000-0000-000000000012';

    -- Lotes
    v_lote_iogurte UUID := 'l0000000-0000-0000-0000-000000000001';
    v_lote_mussarela UUID := 'l0000000-0000-0000-0000-000000000002';
    v_lote_leite UUID := 'l0000000-0000-0000-0000-000000000003';

    -- Vendas
    v_venda_1 UUID := 'v0000000-0000-0000-0000-000000000001';
    v_venda_2 UUID := 'v0000000-0000-0000-0000-000000000002';
    v_venda_3 UUID := 'v0000000-0000-0000-0000-000000000003';
BEGIN

    -- 1. EMPRESA FICTÍCIA
    INSERT INTO public.empresa (id, nome, cnpj, criado_em)
    VALUES (v_empresa_id, 'Mercado Aparecida Demo Ltda', '12.345.678/0001-99', now() - INTERVAL '180 days')
    ON CONFLICT (id) DO NOTHING;

    -- 2. PERFIS DE DEMO
    -- Nota: em instâncias reais com Supabase Auth, estes IDs devem coincidir com auth.users
    INSERT INTO public.perfil (id, empresa_id, nome, papel, criado_em)
    VALUES 
        (v_user_dono_id, v_empresa_id, 'Daniel (Administrador Demo)', 'dono', now() - INTERVAL '180 days'),
        (v_user_op_id, v_empresa_id, 'Caixa Operador 01 (Demo)', 'operador', now() - INTERVAL '180 days')
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, papel = EXCLUDED.papel;

    -- 3. CONFIGURAÇÃO DE TAXAS DA MAQUININHA
    INSERT INTO public.config_taxa (empresa_id, dinheiro, pix, debito, credito, desconto_max_operador)
    VALUES (v_empresa_id, 0.0000, 0.0000, 0.0140, 0.0320, 5.00)
    ON CONFLICT (empresa_id) DO UPDATE SET
        debito = EXCLUDED.debito,
        credito = EXCLUDED.credito,
        desconto_max_operador = EXCLUDED.desconto_max_operador;

    -- 4. CATEGORIAS
    INSERT INTO public.categoria (id, empresa_id, nome)
    VALUES
        (v_cat_mercearia, v_empresa_id, 'Mercearia'),
        (v_cat_bebidas, v_empresa_id, 'Bebidas'),
        (v_cat_laticinios, v_empresa_id, 'Laticínios e Frios'),
        (v_cat_limpeza, v_empresa_id, 'Limpeza'),
        (v_cat_hortifruti, v_empresa_id, 'Hortifrúti'),
        (v_cat_padaria, v_empresa_id, 'Padaria e Biscoitos')
    ON CONFLICT (id) DO NOTHING;

    -- 5. PRODUTOS DO VAREJO
    INSERT INTO public.produto (id, empresa_id, categoria_id, ean, nome, unidade, custo, preco, estoque_minimo, perecivel, ativo)
    VALUES
        (v_prod_arroz, v_empresa_id, v_cat_mercearia, '7896006711124', 'Arroz Tipo 1 Camil 5kg', 'un', 21.50, 29.90, 20, false, true),
        (v_prod_feijao, v_empresa_id, v_cat_mercearia, '7896006721017', 'Feijão Carioca Camil 1kg', 'un', 5.90, 8.79, 25, false, true),
        (v_prod_oleo, v_empresa_id, v_cat_mercearia, '7891107101235', 'Óleo de Soja Soya 900ml', 'un', 5.10, 6.99, 30, false, true),
        (v_prod_leite, v_empresa_id, v_cat_laticinios, '7898215151234', 'Leite Integral Piracanjuba 1L', 'un', 3.80, 4.99, 40, true, true),
        (v_prod_cafe, v_empresa_id, v_cat_mercearia, '7891025101119', 'Café Torrado Melitta 500g', 'un', 13.50, 18.90, 15, false, true),
        (v_prod_coca, v_empresa_id, v_cat_bebidas, '7894900011517', 'Refrigerante Coca-Cola 2L', 'un', 7.20, 10.49, 20, false, true),
        (v_prod_sabao, v_empresa_id, v_cat_limpeza, '7891150028823', 'Sabão em Pó OMO Lavagem Perfeita 1,6kg', 'un', 16.80, 22.90, 12, false, true),
        (v_prod_detergente, v_empresa_id, v_cat_limpeza, '7891022100016', 'Detergente Líquido Ypê Neutro 500ml', 'un', 1.65, 2.49, 30, false, true),
        (v_prod_mussarela, v_empresa_id, v_cat_laticinios, '7896102500012', 'Queijo Mussarela Fatiado 200g', 'un', 7.50, 11.90, 15, true, true),
        (v_prod_iogurte, v_empresa_id, v_cat_laticinios, '7891025801200', 'Iogurte Morango Danone 170g', 'un', 2.10, 3.49, 12, true, true),
        (v_prod_palmito_parado, v_empresa_id, v_cat_mercearia, '7896541230019', 'Palmito Pupunha em Conserva 300g', 'un', 18.00, 26.90, 5, false, true),
        (v_prod_tomate, v_empresa_id, v_cat_hortifruti, '2000000000018', 'Tomate Italiano Selecionado', 'kg', 4.50, 7.99, 10, true, true)
    ON CONFLICT (id) DO NOTHING;

    -- 6. LOTES (Cenários de Validade: Urgente em 3 dias, Próximo em 7 dias, Normal)
    INSERT INTO public.lote (id, empresa_id, produto_id, validade, custo)
    VALUES
        (v_lote_iogurte, v_empresa_id, v_prod_iogurte, CURRENT_DATE + INTERVAL '3 days', 2.10),
        (v_lote_mussarela, v_empresa_id, v_prod_mussarela, CURRENT_DATE + INTERVAL '7 days', 7.50),
        (v_lote_leite, v_empresa_id, v_prod_leite, CURRENT_DATE + INTERVAL '35 days', 3.80)
    ON CONFLICT (id) DO NOTHING;

    -- 7. PROMOÇÃO ATIVA (Para validação de v_preco_atual e Dinheiro Parado)
    INSERT INTO public.promocao (empresa_id, produto_id, percentual, inicio, fim, motivo, ativa)
    VALUES
        (v_empresa_id, v_prod_iogurte, 20.00, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '5 days', 'Queima de lote próximo do vencimento', true)
    ON CONFLICT DO NOTHING;

    -- 8. MOVIMENTAÇÕES DE ENTRADA (Abastecimento inicial do estoque)
    INSERT INTO public.movimento (empresa_id, produto_id, lote_id, tipo, quantidade, custo_unit, preco_unit, motivo, criado_em)
    VALUES
        (v_empresa_id, v_prod_arroz, NULL, 'entrada', 60, 21.50, 29.90, 'Entrada NF Fornecedor Camil', now() - INTERVAL '30 days'),
        (v_empresa_id, v_prod_feijao, NULL, 'entrada', 80, 5.90, 8.79, 'Entrada NF Fornecedor Camil', now() - INTERVAL '30 days'),
        (v_empresa_id, v_prod_oleo, NULL, 'entrada', 90, 5.10, 6.99, 'Entrada NF Distribuidora ABC', now() - INTERVAL '30 days'),
        (v_empresa_id, v_prod_leite, v_lote_leite, 'entrada', 150, 3.80, 4.99, 'Entrada Laticínios Piracanjuba', now() - INTERVAL '15 days'),
        (v_empresa_id, v_prod_cafe, NULL, 'entrada', 45, 13.50, 18.90, 'Entrada NF Melitta', now() - INTERVAL '25 days'),
        (v_empresa_id, v_prod_coca, NULL, 'entrada', 80, 7.20, 10.49, 'Entrada NF FEMSA', now() - INTERVAL '20 days'),
        (v_empresa_id, v_prod_sabao, NULL, 'entrada', 30, 16.80, 22.90, 'Entrada Unilever', now() - INTERVAL '25 days'),
        (v_empresa_id, v_prod_detergente, NULL, 'entrada', 120, 1.65, 2.49, 'Entrada Química Amparo Ypê', now() - INTERVAL '25 days'),
        (v_empresa_id, v_prod_mussarela, v_lote_mussarela, 'entrada', 25, 7.50, 11.90, 'Entrada Frios', now() - INTERVAL '10 days'),
        (v_empresa_id, v_prod_iogurte, v_lote_iogurte, 'entrada', 30, 2.10, 3.49, 'Entrada Danone', now() - INTERVAL '10 days'),
        (v_empresa_id, v_prod_palmito_parado, NULL, 'entrada', 18, 18.00, 26.90, 'Entrada Antiga (Sem giro há > 60 dias)', now() - INTERVAL '75 days'),
        (v_empresa_id, v_prod_tomate, NULL, 'entrada', 25.0, 4.50, 7.99, 'Entrada Ceasa Hortifrúti', now() - INTERVAL '3 days')
    ON CONFLICT DO NOTHING;

    -- 9. VENDAS HISTÓRICAS E DO DIA
    -- Venda 1 (Hoje - PIX)
    INSERT INTO public.venda (id, empresa_id, operador_id, total, custo_total, desconto, forma_pagamento, taxa, criado_em)
    VALUES (v_venda_1, v_empresa_id, v_user_op_id, 47.38, 33.30, 0.00, 'pix', 0.00, now() - INTERVAL '2 hours')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.venda_item (venda_id, produto_id, quantidade, preco_unit, custo_unit, desconto_unit)
    VALUES
        (v_venda_1, v_prod_arroz, 1, 29.90, 21.50, 0.00),
        (v_venda_1, v_prod_feijao, 1, 8.79, 5.90, 0.00),
        (v_venda_1, v_prod_oleo, 1, 6.99, 5.10, 0.00),
        (v_venda_1, v_prod_detergente, 1, 2.49, 1.65, 0.00)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.movimento (empresa_id, produto_id, tipo, quantidade, preco_unit, custo_unit, ref_id, criado_em)
    VALUES
        (v_empresa_id, v_prod_arroz, 'venda', 1, 29.90, 21.50, v_venda_1::TEXT, now() - INTERVAL '2 hours'),
        (v_empresa_id, v_prod_feijao, 'venda', 1, 8.79, 5.90, v_venda_1::TEXT, now() - INTERVAL '2 hours'),
        (v_empresa_id, v_prod_oleo, 'venda', 1, 6.99, 5.10, v_venda_1::TEXT, now() - INTERVAL '2 hours'),
        (v_empresa_id, v_prod_detergente, 'venda', 1, 2.49, 1.65, v_venda_1::TEXT, now() - INTERVAL '2 hours')
    ON CONFLICT DO NOTHING;

    -- Venda 2 (Hoje - Cartão Crédito)
    INSERT INTO public.venda (id, empresa_id, operador_id, total, custo_total, desconto, forma_pagamento, taxa, criado_em)
    VALUES (v_venda_2, v_empresa_id, v_user_op_id, 44.28, 31.50, 0.00, 'credito', 1.42, now() - INTERVAL '1 hour')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.venda_item (venda_id, produto_id, quantidade, preco_unit, custo_unit, desconto_unit)
    VALUES
        (v_venda_2, v_prod_coca, 2, 10.49, 7.20, 0.00),
        (v_venda_2, v_prod_sabao, 1, 22.90, 16.80, 0.00)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.movimento (empresa_id, produto_id, tipo, quantidade, preco_unit, custo_unit, ref_id, criado_em)
    VALUES
        (v_empresa_id, v_prod_coca, 'venda', 2, 10.49, 7.20, v_venda_2::TEXT, now() - INTERVAL '1 hour'),
        (v_empresa_id, v_prod_sabao, 'venda', 1, 22.90, 16.80, v_venda_2::TEXT, now() - INTERVAL '1 hour')
    ON CONFLICT DO NOTHING;

    -- Venda 3 (Hoje - Dinheiro com Desconto de Operador)
    INSERT INTO public.venda (id, empresa_id, operador_id, total, custo_total, desconto, desconto_motivo, forma_pagamento, taxa, criado_em)
    VALUES (v_venda_3, v_empresa_id, v_user_op_id, 14.00, 9.60, 0.97, 'Arredondamento centavos', 'dinheiro', 0.00, now() - INTERVAL '30 minutes')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.venda_item (venda_id, produto_id, quantidade, preco_unit, custo_unit, desconto_unit)
    VALUES
        (v_venda_3, v_prod_leite, 3, 4.99, 3.80, 0.32)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.movimento (empresa_id, produto_id, tipo, quantidade, preco_unit, custo_unit, ref_id, criado_em)
    VALUES
        (v_empresa_id, v_prod_leite, 'venda', 3, 4.99, 3.80, v_venda_3::TEXT, now() - INTERVAL '30 minutes')
    ON CONFLICT DO NOTHING;

    -- 10. REGISTRO DE PERDA (Para tela Financeiro demonstrar controle de quebras)
    INSERT INTO public.movimento (empresa_id, produto_id, tipo, quantidade, custo_unit, motivo, criado_em)
    VALUES (v_empresa_id, v_prod_leite, 'perda', 2, 3.80, 'Embalagem furada no transporte', now() - INTERVAL '2 days')
    ON CONFLICT DO NOTHING;

    -- 11. RELATÓRIO EXECUTIVO DEMO
    INSERT INTO public.relatorio (empresa_id, tipo, data_inicio, data_fim, texto, dados, criado_em)
    VALUES (
        v_empresa_id,
        'diario',
        CURRENT_DATE,
        CURRENT_DATE,
        'Resumo diário consolidado da operação: Vendas estáveis no PDV com destaque para mercearia e bebidas. Controle de validade acionado para laticínios.',
        '{"faturamento_total": 105.66, "lucro_bruto": 31.26, "vendas_qtd": 3, "ticket_medio": 35.22}'::jsonb,
        now()
    )
    ON CONFLICT DO NOTHING;

END $$;
