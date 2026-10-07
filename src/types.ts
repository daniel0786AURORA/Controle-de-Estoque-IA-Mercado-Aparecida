export type PapelUsuario = 'dono' | 'operador';

export interface Perfil {
  id: string;
  empresa_id: string;
  nome: string;
  papel: PapelUsuario;
}

export interface Categoria {
  id: string;
  empresa_id: string;
  nome: string;
}

export interface Produto {
  id: string;
  empresa_id: string;
  ean?: string | null;
  nome: string;
  categoria_id?: string | null;
  unidade: 'un' | 'kg';
  custo: number;
  preco: number;
  perecivel: boolean;
  estoque_minimo?: number | null;
  ativo: boolean;
  criado_em?: string;
}

export interface Lote {
  id: string;
  empresa_id: string;
  produto_id: string;
  validade?: string | null;
  custo: number;
  criado_em?: string;
}

export interface Movimento {
  id: string;
  empresa_id: string;
  produto_id: string;
  lote_id?: string | null;
  tipo: 'entrada' | 'venda' | 'perda' | 'ajuste' | 'devolucao';
  quantidade: number;
  custo_unit?: number | null;
  preco_unit?: number | null;
  motivo?: string | null;
  ref_id?: string | null;
  criado_por?: string | null;
  criado_em?: string;
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
  | 'relatorios'
  | 'configuracoes';

