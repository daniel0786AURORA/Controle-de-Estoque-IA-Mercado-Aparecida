import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Categoria } from '../types';
import { 
  formatarMoeda, 
  formatarQuantidade, 
  formatarPercentual, 
  calcularMargem, 
  calcularValorEstoque 
} from '../utils/formatters';
import { 
  Search, 
  X, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Boxes, 
  AlertCircle, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  PackageX,
  Layers,
  MoreVertical,
  Edit,
  AlertTriangle,
  Power,
  Save
} from 'lucide-react';

interface ItemEstoqueFormatado {
  id: string;
  nome: string;
  ean?: string;
  categoria_id?: string;
  categoria_nome: string;
  custo?: number;
  preco: number;
  preco_original: number;
  saldo: number;
  unidade: string;
  margem_percentual: number | null;
  valor_em_estoque: number;
  perecivel: boolean;
  estoque_minimo: number;
  ativo: boolean;
}

type ColunaOrdenavel = 
  | 'nome' 
  | 'categoria' 
  | 'custo' 
  | 'preco' 
  | 'margem' 
  | 'saldo' 
  | 'valor_em_estoque';

const AcoesMenu: React.FC<{ 
  item: ItemEstoqueFormatado; 
  onEdit: () => void; 
  onPerda: () => void; 
  onAjuste: () => void; 
  onToggleAtivo: () => void; 
}> = ({ item, onEdit, onPerda, onAjuste, onToggleAtivo }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-1.5 hover:bg-[#14211C]/10 rounded-lg transition-colors text-[#14211C]/60 hover:text-[#14211C]"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#14211C]/10 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
          <button 
            onClick={() => { setIsOpen(false); onEdit(); }} 
            className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-[#EEF1EC] flex items-center gap-2.5 transition-colors"
          >
            <Edit className="w-4 h-4 opacity-70" /> Editar Produto
          </button>
          <button 
            onClick={() => { setIsOpen(false); onPerda(); }} 
            className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-[#EEF1EC] text-[#C4361A] flex items-center gap-2.5 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" /> Registrar Perda
          </button>
          <button 
            onClick={() => { setIsOpen(false); onAjuste(); }} 
            className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-[#EEF1EC] flex items-center gap-2.5 transition-colors"
          >
            <RefreshCw className="w-4 h-4 opacity-70" /> Corrigir Estoque
          </button>
          <div className="h-px bg-[#14211C]/10 my-1"></div>
          <button 
            onClick={() => { setIsOpen(false); onToggleAtivo(); }} 
            className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-[#EEF1EC] flex items-center gap-2.5 transition-colors"
          >
            <Power className="w-4 h-4 opacity-70" /> 
            {item.ativo ? 'Desativar Produto' : 'Reativar Produto'}
          </button>
        </div>
      )}
    </div>
  );
};

const ITENS_POR_PAGINA = 50;

const ModalAjuste = ({ item, onClose, onSuccess }: { item: ItemEstoqueFormatado, onClose: () => void, onSuccess: () => void }) => {
  const { empresaId, usuario } = useAuth();
  const [novoSaldo, setNovoSaldo] = useState<string>(item.saldo.toString());
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    const numNovo = parseFloat(novoSaldo.replace(',', '.'));
    if (isNaN(numNovo)) return;
    const diff = numNovo - item.saldo;
    if (diff === 0) {
      onClose();
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.from('movimento').insert({
        empresa_id: empresaId,
        produto_id: item.id,
        tipo: 'ajuste',
        quantidade: diff,
        motivo: 'Correção de cadastro',
        criado_por: usuario?.id
      });
      if (error) throw error;
      onSuccess();
    } catch (e) {
      console.error(e);
      alert('Erro ao corrigir estoque');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-[#14211C]/10 bg-[#EEF1EC]/30">
          <h2 className="font-bold text-[#14211C] flex items-center gap-2"><RefreshCw className="w-5 h-5"/> Corrigir Estoque</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#14211C]/10 rounded-lg text-[#14211C]/60 transition-colors"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm text-[#14211C]/70 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            Use isto apenas para corrigir erro de digitação. Se a mercadoria existiu e foi perdida, use <strong>Registrar perda</strong> — senão o prejuízo não aparece no financeiro.
          </div>
          <div>
            <label className="block text-sm font-medium text-[#14211C] mb-1">Saldo Atual</label>
            <div className="font-semibold text-lg text-[#14211C]/50">{item.saldo} {item.unidade}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#14211C] mb-1">Saldo Correto</label>
            <input type="number" step="any" value={novoSaldo} onChange={(e) => setNovoSaldo(e.target.value)} className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-lg focus:ring-2 focus:ring-[#0E7A4F] outline-none text-[#14211C] font-semibold" autoFocus />
          </div>
        </div>
        <div className="p-4 border-t border-[#14211C]/10 flex justify-end gap-3 bg-[#14211C]/5">
          <button onClick={onClose} className="px-4 py-2 font-medium text-[#14211C]/70 hover:text-[#14211C] transition-colors">Cancelar</button>
          <button onClick={handleSalvar} disabled={salvando} className="px-4 py-2 bg-[#0E7A4F] text-white font-medium rounded-lg hover:bg-[#0b633f] transition-colors disabled:opacity-50">Salvar Correção</button>
        </div>
      </div>
    </div>
  );
};

const ModalPerda = ({ item, onClose, onSuccess }: { item: ItemEstoqueFormatado, onClose: () => void, onSuccess: () => void }) => {
  const { empresaId, usuario } = useAuth();
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState('Vencimento');
  const [salvando, setSalvando] = useState(false);

  const perdaValorNum = parseFloat(qtd.replace(',', '.'));
  const qtdInvalida = isNaN(perdaValorNum) || perdaValorNum <= 0 || perdaValorNum > item.saldo;
  const prejuizo = isNaN(perdaValorNum) ? 0 : perdaValorNum * (item.custo || 0);

  const handleSalvar = async () => {
    if (qtdInvalida) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from('movimento').insert({
        empresa_id: empresaId,
        produto_id: item.id,
        tipo: 'perda',
        quantidade: -Math.abs(perdaValorNum),
        custo_unit: item.custo,
        motivo,
        criado_por: usuario?.id
      });
      if (error) throw error;
      onSuccess();
    } catch (e) {
      console.error(e);
      alert('Erro ao registrar perda');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-[#14211C]/10 bg-[#C4361A]/10">
          <h2 className="font-bold text-[#C4361A] flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Registrar Perda</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#14211C]/10 rounded-lg text-[#14211C]/60 transition-colors"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#14211C] mb-1">Quantidade Perdida (Max: {item.saldo} {item.unidade})</label>
            <input type="number" step="any" value={qtd} onChange={(e) => setQtd(e.target.value)} className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-lg focus:ring-2 focus:ring-[#C4361A] outline-none text-[#14211C] font-semibold" autoFocus placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#14211C] mb-1">Motivo</label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-lg focus:ring-2 focus:ring-[#C4361A] outline-none text-[#14211C]">
              <option>Vencimento</option>
              <option>Estragou</option>
              <option>Quebra/Avaria</option>
              <option>Furto</option>
              <option>Outro</option>
            </select>
          </div>
          <div className="pt-3 border-t border-[#14211C]/10">
            <div className="flex justify-between items-center">
              <span className="text-[#14211C]/60 text-sm font-medium">Prejuízo financeiro:</span>
              <span className="text-[#C4361A] font-bold text-lg">{formatarMoeda(prejuizo)}</span>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-[#14211C]/10 flex justify-end gap-3 bg-[#14211C]/5">
          <button onClick={onClose} className="px-4 py-2 font-medium text-[#14211C]/70 hover:text-[#14211C] transition-colors">Cancelar</button>
          <button onClick={handleSalvar} disabled={salvando || qtdInvalida} className="px-4 py-2 bg-[#C4361A] text-white font-medium rounded-lg hover:bg-[#a62c14] transition-colors disabled:opacity-50">Confirmar Perda</button>
        </div>
      </div>
    </div>
  );
};

const ModalEditar = ({ item, categorias, onClose, onSuccess }: { item: ItemEstoqueFormatado, categorias: Categoria[], onClose: () => void, onSuccess: () => void }) => {
  const [form, setForm] = useState({
    nome: item.nome,
    ean: item.ean || '',
    categoria_id: item.categoria_id || '',
    unidade: item.unidade,
    custo: item.custo || 0,
    preco: item.preco_original,
    perecivel: item.perecivel,
    estoque_minimo: item.estoque_minimo,
  });
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const { error } = await supabase.from('produto').update({
        nome: form.nome,
        ean: form.ean || null,
        categoria_id: form.categoria_id || null,
        unidade: form.unidade,
        custo: form.custo,
        preco: form.preco,
        perecivel: form.perecivel,
        estoque_minimo: form.estoque_minimo
      }).eq('id', item.id);
      
      if (error) throw error;
      onSuccess();
    } catch (e) {
      console.error(e);
      alert('Erro ao editar produto');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-[#14211C]/10 bg-[#EEF1EC]/30 shrink-0">
          <h2 className="font-bold text-[#14211C] flex items-center gap-2"><Edit className="w-5 h-5"/> Editar Produto</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#14211C]/10 rounded-lg text-[#14211C]/60 transition-colors"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          
          <div className="text-sm text-[#14211C]/70 p-3 bg-blue-50 rounded-lg border border-blue-200">
            O estoque não é editado diretamente por aqui. Para alterar quantidades, use <strong>Registrar perda</strong> ou <strong>Corrigir estoque</strong> no menu de ações.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#14211C] mb-1">Nome do Produto</label>
              <input type="text" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-lg focus:ring-2 focus:ring-[#0E7A4F] outline-none text-[#14211C]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#14211C] mb-1">Código de Barras (EAN)</label>
              <input type="text" value={form.ean} onChange={(e) => setForm({...form, ean: e.target.value})} className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-lg focus:ring-2 focus:ring-[#0E7A4F] outline-none text-[#14211C] font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#14211C] mb-1">Categoria</label>
              <select value={form.categoria_id} onChange={(e) => setForm({...form, categoria_id: e.target.value})} className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-lg focus:ring-2 focus:ring-[#0E7A4F] outline-none text-[#14211C]">
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#14211C] mb-1">Preço de Compra (Custo)</label>
              <input type="number" step="0.01" value={form.custo} onChange={(e) => setForm({...form, custo: parseFloat(e.target.value) || 0})} className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-lg focus:ring-2 focus:ring-[#0E7A4F] outline-none text-[#14211C]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#14211C] mb-1">Preço de Venda</label>
              <input type="number" step="0.01" value={form.preco} onChange={(e) => setForm({...form, preco: parseFloat(e.target.value) || 0})} className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-lg focus:ring-2 focus:ring-[#0E7A4F] outline-none text-[#14211C]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#14211C] mb-1">Unidade de Medida</label>
              <select value={form.unidade} onChange={(e) => setForm({...form, unidade: e.target.value})} className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-lg focus:ring-2 focus:ring-[#0E7A4F] outline-none text-[#14211C]">
                <option value="un">Unidade (un)</option>
                <option value="kg">Quilo (kg)</option>
                <option value="g">Grama (g)</option>
                <option value="l">Litro (l)</option>
                <option value="ml">Mililitro (ml)</option>
                <option value="cx">Caixa (cx)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#14211C] mb-1">Comprar a cada quantos dias</label>
              <input type="number" min="1" step="any" value={form.estoque_minimo} onChange={(e) => setForm({...form, estoque_minimo: parseInt(e.target.value) || 21})} className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-lg focus:ring-2 focus:ring-[#0E7A4F] outline-none text-[#14211C]" />
              <p className="text-[10px] text-[#14211C]/60 mt-1 leading-tight">
                Carne e hortifruti: 3 a 7 dias. Mercearia: 21 a 30.
              </p>
            </div>
            <div className="md:col-span-2 pt-2 border-t border-[#14211C]/10 mt-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#14211C]">
                <input type="checkbox" checked={form.perecivel} onChange={(e) => setForm({...form, perecivel: e.target.checked})} className="w-5 h-5 rounded border-[#14211C]/20 text-[#0E7A4F] focus:ring-[#0E7A4F]"/>
                Produto Perecível
              </label>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-[#14211C]/10 flex justify-end gap-3 bg-[#14211C]/5 shrink-0">
          <button onClick={onClose} className="px-4 py-2 font-medium text-[#14211C]/70 hover:text-[#14211C] transition-colors">Cancelar</button>
          <button onClick={handleSalvar} disabled={salvando || !form.nome} className="px-4 py-2 bg-[#0E7A4F] text-white font-medium rounded-lg hover:bg-[#0b633f] transition-colors disabled:opacity-50">
            <span className="flex items-center gap-2"><Save className="w-4 h-4"/> Salvar Alterações</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const EstoquePage: React.FC = () => {
  const { papel, empresaId } = useAuth();
  const ehDono = papel === 'dono';

  // Estados de busca e filtros
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('todas');
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  // Estados de ordenação e paginação
  const [colunaOrdenacao, setColunaOrdenacao] = useState<ColunaOrdenavel>('nome');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc'>('asc');
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // Estados de dados e interface
  const [produtos, setProdutos] = useState<ItemEstoqueFormatado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarInativos, setMostrarInativos] = useState(false);

  // Estados dos Modais de Ação
  const [modalEditar, setModalEditar] = useState<ItemEstoqueFormatado | null>(null);
  const [modalPerda, setModalPerda] = useState<ItemEstoqueFormatado | null>(null);
  const [modalAjuste, setModalAjuste] = useState<ItemEstoqueFormatado | null>(null);

  // Debounce de 300ms para o campo de busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca);
      setPaginaAtual(0); // Reseta para a primeira página ao buscar
    }, 300);

    return () => clearTimeout(timer);
  }, [busca]);

  // Carrega lista de categorias para os chips de filtro
  useEffect(() => {
    let montado = true;

    async function carregarCategorias() {
      try {
        const { data, error } = await supabase
          .from('categoria')
          .select('id, nome, empresa_id')
          .order('nome', { ascending: true });

        if (error) {
          console.error('Erro ao carregar categorias:', error);
          return;
        }

        if (montado && data) {
          setCategorias(data as Categoria[]);
        }
      } catch (err) {
        console.error('Exceção ao buscar categorias:', err);
      }
    }

    carregarCategorias();

    return () => {
      montado = false;
    };
  }, []);

  // Mapa de categorias por ID para consulta rápida e segura
  const categoriasMap = useMemo(() => {
    const mapa = new Map<string, string>();
    categorias.forEach((c) => mapa.set(c.id, c.nome));
    return mapa;
  }, [categorias]);

  // Função principal de carregamento de produtos com views v_estoque e v_preco_atual
  const carregarProdutos = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      // 1. Constrói query de produtos no Supabase
      let query = supabase
        .from('produto')
        .select('id, empresa_id, categoria_id, ean, nome, unidade, preco, custo, estoque_minimo, ativo, perecivel', { count: 'exact' });

      // Filtro de Inativos
      if (!mostrarInativos) {
        query = query.eq('ativo', true);
      }

      // Filtro por Categoria
      if (categoriaSelecionada !== 'todas') {
        query = query.eq('categoria_id', categoriaSelecionada);
      }

      // Filtro por Nome ou Código de Barras (EAN) com ilike no servidor
      if (buscaDebounced.trim()) {
        const termo = buscaDebounced.trim();
        query = query.or(`nome.ilike.%${termo}%,ean.ilike.%${termo}%`);
      }

      // Ordenação no banco para colunas nativas da tabela produto
      if (colunaOrdenacao === 'nome') {
        query = query.order('nome', { ascending: direcaoOrdenacao === 'asc' });
      } else if (colunaOrdenacao === 'preco') {
        query = query.order('preco', { ascending: direcaoOrdenacao === 'asc' });
      } else if (colunaOrdenacao === 'custo' && ehDono) {
        query = query.order('custo', { ascending: direcaoOrdenacao === 'asc', nullsFirst: false });
      }

      // Paginação de 50 em 50 registros
      const inicio = paginaAtual * ITENS_POR_PAGINA;
      const fim = inicio + ITENS_POR_PAGINA - 1;
      query = query.range(inicio, fim);

      const { data: produtosData, count, error: erroProdutos } = await query;

      if (erroProdutos) {
        console.error('Erro ao consultar produtos:', erroProdutos);
        setErro('Não foi possível carregar os produtos do estoque. Verifique sua conexão e tente novamente.');
        setProdutos([]);
        setTotalRegistros(0);
        return;
      }

      const listaBruta = (produtosData || []) as Array<{
        id: string;
        empresa_id: string;
        categoria_id?: string;
        ean?: string;
        nome: string;
        unidade: string;
        preco: number;
        custo?: number;
        ativo: boolean;
        perecivel: boolean;
        estoque_minimo: number;
      }>;

      setTotalRegistros(count ?? listaBruta.length);

      if (listaBruta.length === 0) {
        setProdutos([]);
        return;
      }

      // 2. Busca dados complementares nas views v_estoque e v_preco_atual para os produtos desta página
      const produtoIds = listaBruta.map((p) => p.id);

      const [resEstoque, resPreco] = await Promise.all([
        supabase
          .from('v_estoque')
          .select('*')
          .in('produto_id', produtoIds),
        supabase
          .from('v_preco_atual')
          .select('*')
          .in('produto_id', produtoIds),
      ]);

      // Mapeia o saldo da view v_estoque por produto_id
      const estoqueMap = new Map<string, number>();
      if (resEstoque.data) {
        resEstoque.data.forEach((item: Record<string, unknown>) => {
          const pId = String(item.produto_id || item.id || '');
          const saldo = Number(item.saldo ?? item.saldo_estoque ?? 0);
          if (pId) {
            estoqueMap.set(pId, saldo);
          }
        });
      }

      // Mapeia o preço atual da view v_preco_atual por produto_id (já considerando promoção)
      const precoAtualMap = new Map<string, number>();
      if (resPreco.data) {
        resPreco.data.forEach((item: Record<string, unknown>) => {
          const pId = String(item.produto_id || item.id || '');
          const preco = Number(item.preco_venda ?? item.preco ?? item.preco_vigente ?? item.preco_promocional ?? item.preco_normal);
          if (pId && !isNaN(preco)) {
            precoAtualMap.set(pId, preco);
          }
        });
      }

      // 3. Monta os itens formatados com cálculos de margem e valor em estoque
      const itensFormatados: ItemEstoqueFormatado[] = listaBruta.map((p) => {
        const saldoEstoque = estoqueMap.has(p.id) ? (estoqueMap.get(p.id) as number) : 0;
        const precoVendaVigente = precoAtualMap.has(p.id) ? (precoAtualMap.get(p.id) as number) : (p.preco || 0);
        const custoUnit = p.custo ?? 0;
        const margem = calcularMargem(precoVendaVigente, custoUnit);
        const valorEstoque = calcularValorEstoque(custoUnit, saldoEstoque);
        const nomeCategoria = (p.categoria_id && categoriasMap.get(p.categoria_id)) || 'Sem categoria';

        return {
          id: p.id,
          nome: p.nome || 'Produto sem nome',
          ean: p.ean || '',
          categoria_id: p.categoria_id,
          categoria_nome: nomeCategoria,
          custo: custoUnit,
          preco: precoVendaVigente,
          preco_original: p.preco || 0,
          saldo: saldoEstoque,
          unidade: p.unidade || 'un',
          margem_percentual: margem,
          valor_em_estoque: valorEstoque,
          perecivel: p.perecivel || false,
          estoque_minimo: p.estoque_minimo || 0,
          ativo: p.ativo,
        };
      });

      // 4. Ordenação em memória para colunas derivadas (categoria, margem, saldo, valor_em_estoque)
      if (['categoria', 'margem', 'saldo', 'valor_em_estoque'].includes(colunaOrdenacao)) {
        itensFormatados.sort((a, b) => {
          let valorA: number | string = 0;
          let valorB: number | string = 0;

          if (colunaOrdenacao === 'categoria') {
            valorA = a.categoria_nome.toLowerCase();
            valorB = b.categoria_nome.toLowerCase();
            return direcaoOrdenacao === 'asc' 
              ? (valorA as string).localeCompare(valorB as string)
              : (valorB as string).localeCompare(valorA as string);
          }

          if (colunaOrdenacao === 'margem') {
            valorA = a.margem_percentual ?? -9999;
            valorB = b.margem_percentual ?? -9999;
          } else if (colunaOrdenacao === 'saldo') {
            valorA = a.saldo;
            valorB = b.saldo;
          } else if (colunaOrdenacao === 'valor_em_estoque') {
            valorA = a.valor_em_estoque;
            valorB = b.valor_em_estoque;
          }

          return direcaoOrdenacao === 'asc' 
            ? (valorA as number) - (valorB as number)
            : (valorB as number) - (valorA as number);
        });
      }

      setProdutos(itensFormatados);
    } catch (err) {
      console.error('Exceção ao carregar estoque:', err);
      setErro('Ocorreu uma falha ao comunicar com o servidor. Verifique sua conexão e tente recarregar.');
      setProdutos([]);
    } finally {
      setCarregando(false);
    }
  }, [
    categoriaSelecionada,
    buscaDebounced,
    colunaOrdenacao,
    direcaoOrdenacao,
    paginaAtual,
    ehDono,
    categoriasMap,
    mostrarInativos,
  ]);

  // Recarrega sempre que filtros, ordenação ou página mudarem
  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  // Manipulador de clique no cabeçalho das colunas para alternar ordenação
  const alternarOrdenacao = (coluna: ColunaOrdenavel) => {
    if (colunaOrdenacao === coluna) {
      setDirecaoOrdenacao((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setColunaOrdenacao(coluna);
      setDirecaoOrdenacao('asc');
    }
    setPaginaAtual(0);
  };

  // Renderiza o indicador de ordenação no cabeçalho da coluna
  const renderIconeOrdenacao = (coluna: ColunaOrdenavel) => {
    if (colunaOrdenacao !== coluna) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-[#14211C]/30 group-hover:text-[#14211C]/60" />;
    }
    return direcaoOrdenacao === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#0E7A4F]" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#0E7A4F]" />
    );
  };

  // Renderiza o selo colorido de Margem %
  const renderSeloMargem = (margem: number | null) => {
    if (margem === null) {
      return <span className="text-xs text-[#14211C]/40 font-medium">-</span>;
    }

    // Regra: verde >= 30%, âmbar 22-29%, vermelho < 22%
    let estiloBadge = '';
    if (margem >= 30) {
      estiloBadge = 'bg-[#0E7A4F]/10 text-[#0E7A4F] border-[#0E7A4F]/30';
    } else if (margem >= 22) {
      estiloBadge = 'bg-[#B87503]/10 text-[#B87503] border-[#B87503]/30';
    } else {
      estiloBadge = 'bg-[#C4361A]/10 text-[#C4361A] border-[#C4361A]/30';
    }

    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${estiloBadge}`}
      >
        {formatarPercentual(margem)}
      </span>
    );
  };

  const totalPaginas = Math.ceil(totalRegistros / ITENS_POR_PAGINA) || 1;
  const registroInicial = totalRegistros === 0 ? 0 : paginaAtual * ITENS_POR_PAGINA + 1;
  const registroFinal = Math.min((paginaAtual + 1) * ITENS_POR_PAGINA, totalRegistros);

  const handleToggleAtivo = async (item: ItemEstoqueFormatado) => {
    try {
      const { error } = await supabase
        .from('produto')
        .update({ ativo: !item.ativo })
        .eq('id', item.id);
      if (error) throw error;
      carregarProdutos();
    } catch (err) {
      console.error('Erro ao alternar status do produto:', err);
      alert('Erro ao alterar o status do produto.');
    }
  };

  const temFiltroAtivo = busca.trim() !== '' || categoriaSelecionada !== 'todas';

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#14211C]/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14211C] tracking-tight flex items-center gap-2.5">
            <Boxes className="w-7 h-7 text-[#0E7A4F]" />
            Estoque
          </h1>
          <p className="text-xs sm:text-sm text-[#14211C]/70 mt-0.5">
            Consulta em tempo real de saldos e preços vigentes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {ehDono && (
            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 min-h-[44px] rounded-lg border border-[#14211C]/20 text-[#14211C] text-sm font-medium hover:bg-[#EEF1EC] transition-colors shadow-sm">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-[#14211C]/20 text-[#0E7A4F] focus:ring-[#0E7A4F]"
                checked={mostrarInativos}
                onChange={(e) => {
                  setMostrarInativos(e.target.checked);
                  setPaginaAtual(0);
                }}
              />
              Mostrar inativos
            </label>
          )}

          {/* Botão de Atualizar Manual */}
          <button
            id="btn-atualizar-estoque"
            onClick={() => carregarProdutos()}
            disabled={carregando}
            className="min-h-[44px] px-4 py-2 bg-white border border-[#14211C]/20 hover:bg-[#EEF1EC] active:bg-[#EEF1EC]/80 text-[#14211C] rounded-lg text-sm font-medium flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin text-[#0E7A4F]' : 'text-[#14211C]/70'}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Barra de Busca com Debounce de 300ms */}
      <div className="bg-white p-4 rounded-xl border border-[#14211C]/15 shadow-sm space-y-3.5">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#14211C]/50">
            <Search className="w-5 h-5" />
          </div>
          <input
            id="input-busca-estoque"
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome do produto ou código de barras (EAN)..."
            className="w-full min-h-[44px] h-12 pl-10 pr-10 rounded-lg border border-[#14211C]/20 bg-[#EEF1EC]/40 text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] text-sm sm:text-base transition-all"
          />
          {busca && (
            <button
              id="btn-limpar-busca"
              onClick={() => {
                setBusca('');
                setBuscaDebounced('');
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#14211C]/40 hover:text-[#14211C] cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Chips de Filtro por Categoria */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
          <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider flex items-center gap-1 mr-1 flex-shrink-0">
            <Layers className="w-3.5 h-3.5" />
            Categorias:
          </span>

          {/* Chip "Todas" */}
          <button
            id="chip-categoria-todas"
            onClick={() => {
              setCategoriaSelecionada('todas');
              setPaginaAtual(0);
            }}
            className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
              categoriaSelecionada === 'todas'
                ? 'bg-[#0E7A4F] text-white shadow-sm font-semibold'
                : 'bg-[#EEF1EC] text-[#14211C]/80 hover:bg-[#14211C]/10 border border-[#14211C]/15'
            }`}
          >
            <span>Todas</span>
          </button>

          {/* Chips das Categorias Dinâmicas */}
          {categorias.map((cat) => {
            const ativa = categoriaSelecionada === cat.id;
            return (
              <button
                key={cat.id}
                id={`chip-categoria-${cat.id}`}
                onClick={() => {
                  setCategoriaSelecionada(cat.id);
                  setPaginaAtual(0);
                }}
                className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                  ativa
                    ? 'bg-[#0E7A4F] text-white shadow-sm font-semibold'
                    : 'bg-[#EEF1EC] text-[#14211C]/80 hover:bg-[#14211C]/10 border border-[#14211C]/15'
                }`}
              >
                <span>{cat.nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerta de Erro com diagnóstico claro */}
      {erro && (
        <div 
          id="alerta-erro-estoque"
          className="p-4 bg-red-50 border border-[#C4361A]/30 rounded-xl text-sm text-[#C4361A] flex items-start gap-3 shadow-sm"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold block text-base">Falha ao consultar estoque</strong>
            <p className="mt-0.5">{erro}</p>
            <button
              onClick={() => carregarProdutos()}
              className="mt-2.5 min-h-[44px] px-3.5 py-1.5 bg-[#C4361A] text-white font-medium rounded-lg text-xs hover:bg-[#C4361A]/90 cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Tabela de Produtos */}
      <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden flex flex-col">
        
        {/* Barra superior de status com contador */}
        <div className="px-4 py-3 bg-[#14211C]/5 border-b border-[#14211C]/10 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-[#14211C]/80 font-medium">
          <div>
            {carregando ? (
              <span>Consultando registros...</span>
            ) : totalRegistros > 0 ? (
              <span>
                Mostrando <strong>{registroInicial}</strong>–<strong>{registroFinal}</strong> de <strong>{totalRegistros}</strong> produtos
              </span>
            ) : (
              <span>Nenhum registro a exibir</span>
            )}
          </div>

          {temFiltroAtivo && !carregando && (
            <button
              onClick={() => {
                setBusca('');
                setBuscaDebounced('');
                setCategoriaSelecionada('todas');
                setPaginaAtual(0);
              }}
              className="text-xs text-[#0E7A4F] hover:underline font-semibold cursor-pointer"
            >
              Limpar filtros aplicados
            </button>
          )}
        </div>

        {/* Tabela Responsiva */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#14211C]/5 border-b border-[#14211C]/10 text-[#14211C] font-semibold select-none">
                
                {/* 1. Coluna Produto */}
                <th
                  id="th-produto"
                  onClick={() => alternarOrdenacao('nome')}
                  className="px-4 py-3.5 cursor-pointer hover:bg-[#14211C]/10 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Produto</span>
                    {renderIconeOrdenacao('nome')}
                  </div>
                </th>

                {/* 2. Coluna Categoria */}
                <th
                  id="th-categoria"
                  onClick={() => alternarOrdenacao('categoria')}
                  className="px-4 py-3.5 cursor-pointer hover:bg-[#14211C]/10 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Categoria</span>
                    {renderIconeOrdenacao('categoria')}
                  </div>
                </th>

                {/* 3. Coluna Preço de Compra (APENAS DONO) */}
                {ehDono && (
                  <th
                    id="th-preco-compra"
                    onClick={() => alternarOrdenacao('custo')}
                    className="px-4 py-3.5 text-right cursor-pointer hover:bg-[#14211C]/10 transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Preço de compra</span>
                      {renderIconeOrdenacao('custo')}
                    </div>
                  </th>
                )}

                {/* 4. Coluna Preço de Venda */}
                <th
                  id="th-preco-venda"
                  onClick={() => alternarOrdenacao('preco')}
                  className="px-4 py-3.5 text-right cursor-pointer hover:bg-[#14211C]/10 transition-colors group"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Preço de venda</span>
                    {renderIconeOrdenacao('preco')}
                  </div>
                </th>

                {/* 5. Coluna Margem % (APENAS DONO) */}
                {ehDono && (
                  <th
                    id="th-margem"
                    onClick={() => alternarOrdenacao('margem')}
                    className="px-4 py-3.5 text-center cursor-pointer hover:bg-[#14211C]/10 transition-colors group"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Margem %</span>
                      {renderIconeOrdenacao('margem')}
                    </div>
                  </th>
                )}

                {/* 6. Coluna Estoque (Saldo) */}
                <th
                  id="th-estoque"
                  onClick={() => alternarOrdenacao('saldo')}
                  className="px-4 py-3.5 text-right cursor-pointer hover:bg-[#14211C]/10 transition-colors group"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Estoque</span>
                    {renderIconeOrdenacao('saldo')}
                  </div>
                </th>

                {/* 7. Coluna Valor em Estoque (APENAS DONO) */}
                {ehDono && (
                  <th
                    id="th-valor-estoque"
                    onClick={() => alternarOrdenacao('valor_em_estoque')}
                    className="px-4 py-3.5 text-right cursor-pointer hover:bg-[#14211C]/10 transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Valor em estoque</span>
                      {renderIconeOrdenacao('valor_em_estoque')}
                    </div>
                  </th>
                )}
                {/* 8. Coluna Ações (APENAS DONO) */}
                {ehDono && (
                  <th className="px-4 py-3.5 text-center w-16"></th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#14211C]/10">
              {carregando ? (
                // Linhas Skeleton de Carregamento
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="px-4 py-3.5">
                      <div className="h-4 bg-[#14211C]/10 rounded w-48 mb-1"></div>
                      <div className="h-3 bg-[#14211C]/5 rounded w-24"></div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 bg-[#14211C]/10 rounded w-28"></div>
                    </td>
                    {ehDono && (
                      <td className="px-4 py-3.5 text-right">
                        <div className="h-4 bg-[#14211C]/10 rounded w-20 ml-auto"></div>
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-right">
                      <div className="h-4 bg-[#14211C]/10 rounded w-20 ml-auto"></div>
                    </td>
                    {ehDono && (
                      <td className="px-4 py-3.5 text-center">
                        <div className="h-5 bg-[#14211C]/10 rounded w-16 mx-auto"></div>
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-right">
                      <div className="h-4 bg-[#14211C]/10 rounded w-16 ml-auto"></div>
                    </td>
                    {ehDono && (
                      <td className="px-4 py-3.5 text-right">
                        <div className="h-4 bg-[#14211C]/10 rounded w-24 ml-auto"></div>
                      </td>
                    )}
                    {ehDono && (
                      <td className="px-4 py-3.5 text-center">
                        <div className="h-6 bg-[#14211C]/10 rounded-full w-6 mx-auto"></div>
                      </td>
                    )}
                  </tr>
                ))
              ) : produtos.length === 0 ? (
                // Estado Vazio
                <tr>
                  <td
                    colSpan={ehDono ? 8 : 4}
                    className="px-4 py-12 text-center text-[#14211C]"
                  >
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-2">
                      <div className="w-12 h-12 rounded-full bg-[#14211C]/5 flex items-center justify-center text-[#14211C]/40 mb-1">
                        <PackageX className="w-6 h-6" />
                      </div>
                      <p className="text-base font-semibold text-[#14211C]">
                        {temFiltroAtivo 
                           ? 'Nenhum produto encontrado com os filtros aplicados.' 
                           : 'Nenhum produto encontrado. Cadastre o primeiro produto.'}
                      </p>
                      <p className="text-xs text-[#14211C]/60">
                        {temFiltroAtivo 
                           ? 'Tente ajustar o termo de busca ou selecionar outra categoria.' 
                           : 'Adicione novos itens ao catálogo na aba Cadastrar.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                // Linhas com Dados Reais
                produtos.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#EEF1EC]/60 transition-colors"
                  >
                    {/* Produto: Nome e EAN */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#14211C] leading-snug">
                        {item.nome}
                      </div>
                      {item.ean ? (
                        <div className="text-xs text-[#14211C]/60 font-mono tracking-tight mt-0.5">
                          EAN: {item.ean}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#14211C]/40 italic mt-0.5">
                          Sem código de barras
                        </div>
                      )}
                    </td>

                    {/* Categoria */}
                    <td className="px-4 py-3 text-xs sm:text-sm text-[#14211C]/80">
                      <span className="inline-block px-2 py-0.5 bg-[#14211C]/5 rounded text-[#14211C]/80 font-medium">
                        {item.categoria_nome}
                      </span>
                    </td>

                    {/* Preço de Compra (APENAS DONO) */}
                    {ehDono && (
                      <td className="px-4 py-3 text-right font-medium text-xs sm:text-sm text-[#14211C]/80 whitespace-nowrap">
                        {formatarMoeda(item.custo)}
                      </td>
                    )}

                    {/* Preço de Venda */}
                    <td className="px-4 py-3 text-right font-bold text-xs sm:text-sm text-[#14211C] whitespace-nowrap">
                      {formatarMoeda(item.preco)}
                    </td>

                    {/* Margem % (APENAS DONO) */}
                    {ehDono && (
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {renderSeloMargem(item.margem_percentual)}
                      </td>
                    )}

                    {/* Estoque (Saldo) */}
                    <td className="px-4 py-3 text-right font-semibold text-xs sm:text-sm whitespace-nowrap">
                      <span
                        className={
                          item.saldo <= 0
                            ? 'text-[#C4361A] font-bold'
                            : item.saldo < 5
                            ? 'text-[#B87503] font-bold'
                            : 'text-[#14211C]'
                        }
                      >
                        {formatarQuantidade(item.saldo, item.unidade)}
                      </span>
                    </td>

                    {/* Valor em Estoque (APENAS DONO) */}
                    {ehDono && (
                      <td className="px-4 py-3 text-right font-semibold text-xs sm:text-sm text-[#14211C] whitespace-nowrap">
                        {formatarMoeda(item.valor_em_estoque)}
                      </td>
                    )}
                    {/* Ações (APENAS DONO) */}
                    {ehDono && (
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <AcoesMenu 
                          item={item} 
                          onEdit={() => setModalEditar(item)}
                          onPerda={() => setModalPerda(item)}
                          onAjuste={() => setModalAjuste(item)}
                          onToggleAtivo={() => handleToggleAtivo(item)}
                        />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé com Paginação de 50 em 50 */}
        <div className="px-4 py-3 bg-[#14211C]/5 border-t border-[#14211C]/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#14211C]/70">
            Página <strong>{paginaAtual + 1}</strong> de <strong>{totalPaginas}</strong> (50 produtos por página)
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-pagina-anterior"
              onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 0))}
              disabled={paginaAtual === 0 || carregando}
              className="min-h-[44px] px-3.5 py-2 rounded-lg bg-white border border-[#14211C]/20 hover:bg-[#EEF1EC] text-xs sm:text-sm font-medium text-[#14211C] flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <button
              id="btn-pagina-proxima"
              onClick={() => setPaginaAtual((prev) => Math.min(prev + 1, totalPaginas - 1))}
              disabled={paginaAtual >= totalPaginas - 1 || carregando}
              className="min-h-[44px] px-3.5 py-2 rounded-lg bg-white border border-[#14211C]/20 hover:bg-[#EEF1EC] text-xs sm:text-sm font-medium text-[#14211C] flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
      {/* Modais */}
      {modalAjuste && (
        <ModalAjuste 
          item={modalAjuste} 
          onClose={() => setModalAjuste(null)} 
          onSuccess={() => { setModalAjuste(null); carregarProdutos(); }} 
        />
      )}
      {modalPerda && (
        <ModalPerda 
          item={modalPerda} 
          onClose={() => setModalPerda(null)} 
          onSuccess={() => { setModalPerda(null); carregarProdutos(); }} 
        />
      )}
      {modalEditar && (
        <ModalEditar 
          item={modalEditar} 
          categorias={categorias}
          onClose={() => setModalEditar(null)} 
          onSuccess={() => { setModalEditar(null); carregarProdutos(); }} 
        />
      )}
    </div>
  );
};
