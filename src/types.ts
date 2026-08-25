export type PapelUsuario = 'dono' | 'operador';

export interface Perfil {
  id: string;
  empresa_id: string;
  nome: string;
  papel: PapelUsuario;
  created_at?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  cnpj?: string;
  created_at?: string;
}

export interface Categoria {
  id: string;
  empresa_id: string;
  nome: string;
  created_at?: string;
}

export interface Fornecedor {
  id: string;
  empresa_id: string;
  nome: string;
  contato?: string;
  telefone?: string;
  created_at?: string;
}

export interface Produto {
  id: string;
  empresa_id: string;
  categoria_id?: string;
  codigo_barras?: string;
  nome: string;
  unidade: string; // 'UN', 'KG', etc.
  preco_venda: number;
  custo_medio?: number;
  estoque_minimo?: number;
  ativo: boolean;
  created_at?: string;
}

export interface NotaEntrada {
  id: string;
  empresa_id: string;
  fornecedor_id?: string;
  numero_nota?: string;
  data_emissao?: string;
  valor_total: number;
  created_at?: string;
}

export interface Lote {
  id: string;
  empresa_id: string;
  produto_id: string;
  nota_entrada_id?: string;
  numero_lote?: string;
  data_validade?: string;
  quantidade_inicial: number;
  custo_unitario: number;
  created_at?: string;
}

export interface Movimento {
  id: string;
  empresa_id: string;
  produto_id: string;
  lote_id?: string;
  tipo: 'entrada' | 'saida' | 'ajuste' | 'venda' | 'perda';
  quantidade: number;
  motivo?: string;
  created_at?: string;
}

export interface Venda {
  id: string;
  empresa_id: string;
  operador_id: string;
  valor_bruto: number;
  desconto: number;
  valor_liquido: number;
  forma_pagamento: 'dinheiro' | 'pix' | 'debito' | 'credito';
  status: 'concluida' | 'cancelada';
  created_at?: string;
}

export interface VendaItem {
  id: string;
  venda_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  created_at?: string;
}

export interface ConfigTaxa {
  id: string;
  empresa_id: string;
  tipo_pagamento: string;
  taxa_percentual: number;
}

export interface Promocao {
  id: string;
  empresa_id: string;
  produto_id: string;
  preco_promocional: number;
  data_inicio: string;
  data_fim: string;
  ativa: boolean;
}

// Views existentes no Supabase
export interface VEstoque {
  produto_id: string;
  empresa_id: string;
  codigo_barras?: string;
  nome_produto: string;
  unidade: string;
  saldo_estoque: number;
}

export interface VGiro {
  produto_id: string;
  empresa_id: string;
  nome_produto: string;
  quantidade_vendida_30d: number;
  giro_classificacao: string;
}

export interface VPrecoAtual {
  produto_id: string;
  empresa_id: string;
  preco_normal: number;
  preco_promocional?: number;
  preco_vigente: number;
}

export type TabRota =
  | 'painel'
  | 'caixa'
  | 'cadastrar'
  | 'estoque'
  | 'compras'
  | 'validade'
  | 'dinheiro-parado'
  | 'financeiro'
  | 'relatorios';
