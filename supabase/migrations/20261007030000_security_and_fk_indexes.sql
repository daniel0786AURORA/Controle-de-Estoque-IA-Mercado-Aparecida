-- Security hardening after initial restore
REVOKE EXECUTE ON FUNCTION public.get_minha_empresa_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_meu_papel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fechar_venda(JSONB, TEXT, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_entrada_produto(
    UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, DATE
) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_minha_empresa_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meu_papel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_venda(JSONB, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_produto(
    UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, DATE
) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_lote_produto_id ON public.lote(produto_id);
CREATE INDEX IF NOT EXISTS idx_movimento_criado_por ON public.movimento(criado_por);
CREATE INDEX IF NOT EXISTS idx_movimento_lote_id ON public.movimento(lote_id);
CREATE INDEX IF NOT EXISTS idx_perfil_empresa_id ON public.perfil(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produto_categoria_id ON public.produto(categoria_id);
CREATE INDEX IF NOT EXISTS idx_promocao_produto_id ON public.promocao(produto_id);
CREATE INDEX IF NOT EXISTS idx_venda_desconto_por ON public.venda(desconto_por);
CREATE INDEX IF NOT EXISTS idx_venda_operador_id ON public.venda(operador_id);
