import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  CalendarDays, Search, AlertCircle, TrendingDown,
  ArrowUpDown, ArrowUp, ArrowDown, Tags, Trash2, 
  MoreVertical, Edit2, Share2, X, Download, MessageCircle, Image as ImageIcon, Type
} from 'lucide-react';
import { addDays, differenceInDays, format, parseISO } from 'date-fns';

// ---------------------------------------------------------
// FORMATADORES E HOOKS
// ---------------------------------------------------------
const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const formatarData = (dataIso?: string | null) => {
  if (!dataIso) return '-';
  try {
    return format(parseISO(dataIso), 'dd/MM/yyyy');
  } catch {
    return '-';
  }
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ---------------------------------------------------------
// INTERFACES
// ---------------------------------------------------------
interface ProdutoProcessado {
  id: string;
  nome: string;
  ean: string;
  custo: number;
  preco: number;
  perecivel: boolean;
  categoriaNome: string;
  estoque: number | null;
  validadeMaisProxima: string | null;
}

interface PromocaoAtiva {
  id: string;
  produto_id: string;
  percentual: number;
  inicio: string;
  fim: string;
  ativa: boolean;
  motivo?: string;
  produtoNome: string;
  produtoPreco: number;
  produtoCusto: number; // Precisamos para editar
}

// ---------------------------------------------------------
// COMPONENTES DE MODAL
// ---------------------------------------------------------

interface ModalCriarPromocaoProps {
  isOpen: boolean;
  onClose: () => void;
  produto: ProdutoProcessado | null;
  promocaoEdit?: PromocaoAtiva | null;
  onSuccess: (promo: PromocaoAtiva) => void;
  empresaId: string;
}

const ModalCriarPromocao: React.FC<ModalCriarPromocaoProps> = ({ isOpen, onClose, produto, promocaoEdit, onSuccess, empresaId }) => {
  const [percentual, setPercentual] = useState<number>(0);
  const [dias, setDias] = useState<number>(7);
  const [dataFim, setDataFim] = useState<string>('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen && produto) {
      if (promocaoEdit) {
        setPercentual(promocaoEdit.percentual);
        setDataFim(promocaoEdit.fim);
        const inicio = parseISO(promocaoEdit.inicio);
        const fim = parseISO(promocaoEdit.fim);
        setDias(Math.max(1, differenceInDays(fim, inicio)));
      } else {
        setPercentual(15);
        setDias(7);
        setDataFim(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
      }
    }
  }, [isOpen, produto, promocaoEdit]);

  if (!isOpen || !produto) return null;

  const handleDiasChange = (val: number) => {
    setDias(val);
    setDataFim(format(addDays(new Date(), val), 'yyyy-MM-dd'));
  };

  const precoAtual = produto.preco;
  const custo = produto.custo || 0.01;
  const margemAtual = ((precoAtual - custo) / precoAtual) * 100;

  const precoDesconto = precoAtual * (1 - percentual / 100);
  const lucro = precoDesconto - custo;
  const margemDesconto = precoDesconto > 0 ? ((lucro) / precoDesconto) * 100 : 0;

  const salvar = async () => {
    try {
      setSalvando(true);
      const hojeStr = format(new Date(), 'yyyy-MM-dd');
      
      let promoId = promocaoEdit?.id;

      if (promocaoEdit) {
        await supabase.from('promocao').update({
          percentual,
          fim: dataFim,
          motivo: 'manual'
        }).eq('id', promoId).eq('empresa_id', empresaId);
      } else {
        const { data, error } = await supabase.from('promocao').insert({
          empresa_id: empresaId,
          produto_id: produto.id,
          percentual,
          inicio: hojeStr,
          fim: dataFim,
          ativa: true,
          motivo: 'manual'
        }).select().single();
        if (error) throw error;
        promoId = data.id;
      }

      onSuccess({
        id: promoId!,
        produto_id: produto.id,
        percentual,
        inicio: promocaoEdit ? promocaoEdit.inicio : hojeStr,
        fim: dataFim,
        ativa: true,
        produtoNome: produto.nome,
        produtoPreco: produto.preco,
        produtoCusto: produto.custo
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar promoção.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14211C]/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[#14211C]">
            {promocaoEdit ? 'Editar Promoção' : 'Criar Promoção'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5"/></button>
        </div>

        {/* Info Read Only */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 space-y-2 text-sm">
          <div><span className="text-gray-500">Produto:</span> <strong className="text-gray-900">{produto.nome}</strong> {produto.ean && <span className="text-gray-400">({produto.ean})</span>}</div>
          <div className="flex justify-between">
            <div><span className="text-gray-500">Preço Atual:</span> <strong className="text-gray-900">{formatarMoeda(precoAtual)}</strong></div>
            <div><span className="text-gray-500">Custo:</span> <strong className="text-gray-900">{formatarMoeda(custo)}</strong></div>
            <div><span className="text-gray-500">Margem Atual:</span> <strong className="text-[#0E7A4F]">{margemAtual.toFixed(1)}%</strong></div>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-bold text-[#14211C] mb-1">Desconto (% OFF)</label>
            <input 
              type="number" min="0" max="100" step="5"
              value={percentual} onChange={e => setPercentual(Number(e.target.value))}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E7A4F] text-lg font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[#14211C] mb-1">Dias Válidos</label>
              <input 
                type="number" min="1" 
                value={dias} onChange={e => handleDiasChange(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E7A4F]"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#14211C] mb-1">Data Fim</label>
              <input 
                type="date"
                value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E7A4F]"
              />
            </div>
          </div>
        </div>

        {/* Real-time Analysis */}
        <div className="border-t border-gray-100 pt-4 mb-6 space-y-3">
          <div className="flex justify-between items-center text-lg">
            <span className="font-bold text-gray-700">Preço com Desconto:</span>
            <span className="font-black text-[#0E7A4F] text-2xl">{formatarMoeda(precoDesconto)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Lucro por Venda:</span>
            <strong className={lucro < 0 ? 'text-red-600' : 'text-gray-900'}>{formatarMoeda(lucro)}</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Margem com Desconto:</span>
            <strong className={margemDesconto < 10 ? 'text-orange-600' : 'text-[#0E7A4F]'}>{margemDesconto.toFixed(1)}%</strong>
          </div>

          <div className="mt-4 p-3 rounded-lg text-sm font-medium flex items-start gap-2">
            {percentual === 0 ? (
              <span className="text-gray-600">ℹ️ Sem desconto aplicado.</span>
            ) : lucro < 0 ? (
              <span className="text-red-700 bg-red-50 p-2 rounded-lg w-full">🔴 PREJUÍZO: Você perderá {formatarMoeda(Math.abs(lucro))} por venda. Não recomendado.</span>
            ) : margemDesconto < 10 ? (
              <span className="text-orange-700 bg-orange-50 p-2 rounded-lg w-full">🟡 ATENÇÃO: Margem muito baixa ({margemDesconto.toFixed(1)}%). Lucro de apenas {formatarMoeda(lucro)} por venda.</span>
            ) : (
              <span className="text-[#0E7A4F] bg-[#EEF1EC] p-2 rounded-lg w-full">🟢 OK: Margem saudável. Lucro de {formatarMoeda(lucro)} por venda.</span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-auto">
          <button onClick={onClose} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="px-5 py-2 font-bold text-white bg-[#0E7A4F] hover:bg-[#0b633f] rounded-lg disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Salvar Promoção'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModalDivulgarProps {
  isOpen: boolean;
  onClose: () => void;
  promo: PromocaoAtiva | null;
}

const ModalDivulgar: React.FC<ModalDivulgarProps> = ({ isOpen, onClose, promo }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [texto, setTexto] = useState('');
  const [shareText, setShareText] = useState(true);
  const [shareImage, setShareImage] = useState(true);

  useEffect(() => {
    if (isOpen && promo) {
      const precoPromo = promo.produtoPreco * (1 - promo.percentual / 100);
      setTexto(`🔥 PROMOÇÃO RELÂMPAGO! 🔥\n${promo.produtoNome}\nDe ${formatarMoeda(promo.produtoPreco)} por apenas ${formatarMoeda(precoPromo)}!\n💰 Economia de ${promo.percentual}% OFF\n⏰ Válida até ${formatarData(promo.fim)}\nCorra antes que acabe! 🏃‍♂️`);
      desenharCanvas();
    }
  }, [isOpen, promo]);

  const desenharCanvas = () => {
    if (!canvasRef.current || !promo) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Fundo Gradiente (amarelo/laranja/verde)
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, '#DFFF00');
    grad.addColorStop(0.5, '#FFD700');
    grad.addColorStop(1, '#FF7F50');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);
    
    // Toque verde superior direito para match com original
    const greenGrad = ctx.createRadialGradient(1080, 0, 0, 1080, 0, 800);
    greenGrad.addColorStop(0, 'rgba(124, 252, 0, 0.8)');
    greenGrad.addColorStop(1, 'rgba(124, 252, 0, 0)');
    ctx.fillStyle = greenGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Cabeçalho 'Promoção'
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 140px serif';
    ctx.textAlign = 'center';
    ctx.fillText('Promoção', 540, 180);

    // Nome do Produto
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 80px sans-serif';
    let name = promo.produtoNome;
    if (name.length > 25) name = name.substring(0, 22) + '...';
    ctx.fillText(name, 540, 400);

    // Unidade
    ctx.fillStyle = '#333333';
    ctx.font = '40px sans-serif';
    ctx.fillText('Un', 540, 460);

    // Preço Antigo
    ctx.fillStyle = '#FF0000';
    ctx.font = '50px sans-serif';
    const originalText = `De: ${formatarMoeda(promo.produtoPreco)}`;
    ctx.fillText(originalText, 540, 560);
    const metrics = ctx.measureText(originalText);
    ctx.beginPath();
    ctx.moveTo(540 - metrics.width / 2 - 10, 545);
    ctx.lineTo(540 + metrics.width / 2 + 10, 545);
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Preço Novo
    ctx.fillStyle = '#004d00';
    ctx.font = 'bold 120px sans-serif';
    const precoPromo = promo.produtoPreco * (1 - promo.percentual / 100);
    ctx.fillText(`Por: ${formatarMoeda(precoPromo)}`, 540, 680);

    // Validade
    ctx.fillStyle = '#444444';
    ctx.font = '36px sans-serif';
    ctx.fillText(`Válido até: ${formatarData(promo.fim)}`, 540, 760);

    // Assinatura 'Mercado Aparecida'
    ctx.fillStyle = '#000000';
    ctx.font = 'italic 90px "Brush Script MT", cursive, serif';
    ctx.fillText('Mercado Aparecida', 540, 1000);
  };

  const baixarImagem = (blobToSave?: Blob) => {
    if (!canvasRef.current) return;
    if (blobToSave) {
      const url = URL.createObjectURL(blobToSave);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promocao_${promo?.produtoNome.replace(/\s+/g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      canvasRef.current.toBlob(baixarImagem);
    }
  };

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async () => {
    if (shareText) await copiarTexto();

    if (shareImage && canvasRef.current) {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'promocao.png', { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              text: shareText ? texto : undefined,
              files: [file],
              title: 'Promoção'
            });
            return; // Sucesso com share nativo
          } catch (e) {
            console.error('Share failed', e);
          }
        }
        
        // Fallback imagem
        baixarImagem(blob);
        if (shareText) {
          window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
        } else {
          alert('Imagem baixada. Anexe manualmente no WhatsApp.');
        }
      }, 'image/png');
    } else if (shareText) {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    }
  };

  if (!isOpen || !promo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14211C]/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-xl flex flex-col md:flex-row gap-4 max-h-[90vh] overflow-y-auto">
        
        {/* Esquerda: Imagem */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 rounded-xl p-4">
          <canvas ref={canvasRef} width={1080} height={1080} className="w-full max-w-[350px] rounded-lg shadow-md bg-white mb-4" />
          <button onClick={() => baixarImagem()} className="flex items-center gap-2 text-sm font-bold text-[#0E7A4F] hover:underline">
            <Download className="w-4 h-4"/> Baixar Imagem Isolada
          </button>
        </div>

        {/* Direita: Texto e Controles */}
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-[#14211C]">Divulgar Promoção</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5"/></button>
          </div>

          <label className="block text-sm font-bold text-[#14211C] mb-2">Mensagem</label>
          <textarea 
            value={texto}
            onChange={e => setTexto(e.target.value)}
            className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0E7A4F] text-sm resize-none mb-4"
          />

          <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-2">O que deseja enviar?</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={shareText} onChange={e => setShareText(e.target.checked)} className="w-5 h-5 accent-[#0E7A4F]" />
              <div className="flex items-center gap-2 text-sm"><Type className="w-4 h-4 text-gray-500"/> Texto da Mensagem</div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={shareImage} onChange={e => setShareImage(e.target.checked)} className="w-5 h-5 accent-[#0E7A4F]" />
              <div className="flex items-center gap-2 text-sm"><ImageIcon className="w-4 h-4 text-gray-500"/> Imagem da Promoção</div>
            </label>
          </div>

          <div className="mt-auto flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-3 font-bold text-gray-600 hover:bg-gray-100 rounded-xl">Fechar</button>
            <button 
              onClick={handleShare}
              disabled={!shareText && !shareImage}
              className="px-5 py-3 font-bold text-white bg-[#25D366] hover:bg-[#1DA851] rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              <MessageCircle className="w-5 h-5" /> Enviar via WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ---------------------------------------------------------
// PÁGINA PRINCIPAL
// ---------------------------------------------------------

export const ValidadePage: React.FC = () => {
  const { empresaId } = useAuth();

  // Estados de Dados
  const [produtos, setProdutos] = useState<ProdutoProcessado[]>([]);
  const [promocoes, setPromocoes] = useState<PromocaoAtiva[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados Bloco 1 (Busca)
  const [busca, setBusca] = useState('');
  const buscaDebounced = useDebounce(busca, 300);

  // Estados Bloco 2 (Tabela / Paginação / Ordenação)
  const [page, setPage] = useState(0);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState<{ key: keyof ProdutoProcessado, direction: 'asc'|'desc' }>({ key: 'validadeMaisProxima', direction: 'asc' });

  // Estados Modais
  const [modalPromoProduto, setModalPromoProduto] = useState<ProdutoProcessado | null>(null);
  const [modalPromoEdit, setModalPromoEdit] = useState<PromocaoAtiva | null>(null);
  const [isModalPromoOpen, setIsModalPromoOpen] = useState(false);

  const [modalDivulgarPromo, setModalDivulgarPromo] = useState<PromocaoAtiva | null>(null);
  const [isModalDivulgarOpen, setIsModalDivulgarOpen] = useState(false);

  // Menu Ativo
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [promoParaCancelar, setPromoParaCancelar] = useState<string | null>(null);

  // ---------------------------------------------------------
  // FETCHERS
  // ---------------------------------------------------------
  const carregarDados = useCallback(async () => {
    if (!empresaId) return;
    try {
      setLoading(true);
      
      // Fetch Produtos
      const { data: prodData, error: prodErr } = await supabase
        .from('produto')
        .select(`
          id, nome, ean, custo, preco, perecivel,
          categoria:categoria_id(nome),
          lotes:lote(validade)
        `)
        .eq('empresa_id', empresaId)
        .eq('ativo', true);

      if (prodErr) throw prodErr;

      // Fetch Estoque separadamente lidando com nomenclatura dinâmica de view
      let estoqueMap: Record<string, number> = {};
      try {
        const { data: estData, error: estErr } = await supabase
          .from('v_estoque')
          .select('*')
          .eq('empresa_id', empresaId);
          
        if (!estErr && estData) {
          estData.forEach((est: any) => {
            const pId = est.produto_id || est.id_produto || est.id;
            const qtd = est.quantidade ?? est.estoque ?? est.qtd ?? est.saldo;
            if (pId) {
              estoqueMap[pId] = Number(qtd);
            }
          });
        }
      } catch (e) {
        console.warn('Erro ao carregar view v_estoque:', e);
      }

      // Fetch Promocoes
      const hojeStr = format(new Date(), 'yyyy-MM-dd');
      const { data: promoData, error: promoErr } = await supabase
        .from('promocao')
        .select(`
          id, produto_id, percentual, inicio, fim, ativa, motivo,
          produto:produto_id(nome, preco, custo)
        `)
        .eq('empresa_id', empresaId)
        .eq('ativa', true)
        .gte('fim', hojeStr)
        .order('fim', { ascending: true });

      if (promoErr) throw promoErr;

      // Process Products
      const processados: ProdutoProcessado[] = (prodData || []).map((p: any) => {
        const catNome = Array.isArray(p.categoria) ? p.categoria[0]?.nome : p.categoria?.nome;
        
        const est = estoqueMap[p.id];

        let valProxima: string | null = null;
        if (p.lotes && Array.isArray(p.lotes) && p.lotes.length > 0) {
           const validDates = p.lotes.map((l: any) => l.validade).filter(Boolean);
           if (validDates.length > 0) {
             validDates.sort(); // String sort works for YYYY-MM-DD
             valProxima = validDates[0];
           }
        }

        return {
          id: p.id,
          nome: p.nome,
          ean: p.ean || '',
          custo: p.custo || 0,
          preco: p.preco || 0,
          perecivel: p.perecivel,
          categoriaNome: catNome || '-',
          estoque: est !== undefined && !isNaN(est) ? est : null,
          validadeMaisProxima: valProxima
        };
      });

      setProdutos(processados);

      // Process Promocoes
      const promos: PromocaoAtiva[] = (promoData || []).map((p: any) => {
        const prodNome = Array.isArray(p.produto) ? p.produto[0]?.nome : p.produto?.nome;
        const prodPreco = Array.isArray(p.produto) ? p.produto[0]?.preco : p.produto?.preco;
        const prodCusto = Array.isArray(p.produto) ? p.produto[0]?.custo : p.produto?.custo;
        return {
          id: p.id,
          produto_id: p.produto_id,
          percentual: p.percentual,
          inicio: p.inicio,
          fim: p.fim,
          ativa: p.ativa,
          motivo: p.motivo,
          produtoNome: prodNome || 'Produto',
          produtoPreco: prodPreco || 0,
          produtoCusto: prodCusto || 0
        };
      });
      setPromocoes(promos);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // ---------------------------------------------------------
  // LÓGICA DE TABELA
  // ---------------------------------------------------------
  const handleSort = (key: keyof ProdutoProcessado) => {
    let direction: 'asc'|'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const produtosFiltradosEOrdenados = useMemo(() => {
    let filt = produtos;
    if (buscaDebounced) {
      const term = buscaDebounced.toLowerCase();
      filt = filt.filter(p => p.nome.toLowerCase().includes(term) || p.ean.toLowerCase().includes(term));
    }

    return filt.sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];
      
      // Tratamento especial para nulls (jogar pro fim)
      if (valA === null) valA = sortConfig.direction === 'asc' ? '\uFFFF' : '';
      if (valB === null) valB = sortConfig.direction === 'asc' ? '\uFFFF' : '';

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [produtos, buscaDebounced, sortConfig]);

  const totalPages = Math.ceil(produtosFiltradosEOrdenados.length / itemsPerPage);
  const currentData = produtosFiltradosEOrdenados.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  useEffect(() => { setPage(0); }, [buscaDebounced, sortConfig]);

  // ---------------------------------------------------------
  // AÇÕES
  // ---------------------------------------------------------
  const handleRegistrarPerda = () => {
    console.log('TODO: implementar registro de perda');
    alert('Ação de registrar perda está em desenvolvimento.');
  };

  const handleConfirmarCancelamento = async () => {
    if (!promoParaCancelar) return;
    try {
      await supabase.from('promocao').update({ ativa: false }).eq('id', promoParaCancelar).eq('empresa_id', empresaId);
      setPromocoes(prev => prev.filter(p => p.id !== promoParaCancelar));
      setPromoParaCancelar(null);
    } catch (e) {
      console.error(e);
      alert('Erro ao cancelar promoção.');
    }
  };

  const openDivulgar = (promo: PromocaoAtiva) => {
    setModalDivulgarPromo(promo);
    setIsModalDivulgarOpen(true);
    setMenuAberto(null);
  };

  const openEditarPromo = (promo: PromocaoAtiva) => {
    const prodRef: ProdutoProcessado = {
      id: promo.produto_id,
      nome: promo.produtoNome,
      preco: promo.produtoPreco,
      custo: promo.produtoCusto,
      ean: '', perecivel: false, categoriaNome: '', estoque: 0, validadeMaisProxima: ''
    };
    setModalPromoProduto(prodRef);
    setModalPromoEdit(promo);
    setIsModalPromoOpen(true);
    setMenuAberto(null);
  };

  const RenderSortIcon = ({ columnKey }: { columnKey: keyof ProdutoProcessado }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-[#0E7A4F]" /> : <ArrowDown className="w-3 h-3 ml-1 text-[#0E7A4F]" />;
  };

  return (
    <div className="w-full max-w-[1180px] mx-auto p-3 sm:p-4 md:p-5 space-y-4 sm:space-y-5">
      
      {/* HEADER */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#14211C] tracking-tight flex items-center gap-2.5">
          <CalendarDays className="w-7 h-7 text-[#0E7A4F]" />
          Controle de Validade e Promoções
        </h1>
        <p className="text-sm text-[#14211C]/70 mt-1">Gerencie estoques e aplique descontos para evitar perdas.</p>
      </div>

      {/* BLOCO 1: BUSCA */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou EAN..." 
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] text-sm"
          />
        </div>
      </div>

      {/* BLOCO 2: INVENTÁRIO (TABELA) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-[#14211C]">Inventário</h2>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : currentData.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Nenhum produto encontrado.</div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nome')}>
                    <div className="flex items-center">Produto <RenderSortIcon columnKey="nome"/></div>
                  </th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('categoriaNome')}>
                    <div className="flex items-center">Categoria <RenderSortIcon columnKey="categoriaNome"/></div>
                  </th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-gray-100 text-right" onClick={() => handleSort('estoque')}>
                    <div className="flex items-center justify-end">Quantidade em Estoque <RenderSortIcon columnKey="estoque"/></div>
                  </th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-gray-100 text-center" onClick={() => handleSort('validadeMaisProxima')}>
                    <div className="flex items-center justify-center">Validade <RenderSortIcon columnKey="validadeMaisProxima"/></div>
                  </th>
                  <th className="px-5 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentData.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-gray-900 truncate max-w-[250px]">{p.nome}</div>
                      <div className="text-xs text-gray-500">{p.ean || 'Sem EAN'}</div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{p.categoriaNome}</td>
                    <td className="px-5 py-4 text-right font-medium text-gray-900">{p.estoque !== null ? p.estoque : '-'}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`font-medium ${p.validadeMaisProxima && p.validadeMaisProxima < format(new Date(), 'yyyy-MM-dd') ? 'text-red-600 font-bold' : 'text-gray-800'}`}>
                        {formatarData(p.validadeMaisProxima)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button 
                        onClick={() => { setModalPromoProduto(p); setModalPromoEdit(null); setIsModalPromoOpen(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#0E7A4F] bg-[#0E7A4F]/10 hover:bg-[#0E7A4F]/20 rounded-lg transition-colors"
                      >
                        <Tags className="w-3.5 h-3.5" /> Criar Promoção
                      </button>
                      <button 
                        onClick={handleRegistrarPerda}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#C4361A] bg-[#C4361A]/10 hover:bg-[#C4361A]/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Perda
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Paginação */}
        {!loading && produtosFiltradosEOrdenados.length > 0 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm bg-white">
            <button 
              onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="px-4 py-2 font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span className="text-gray-500 font-medium">Página {page + 1} de {totalPages || 1}</span>
            <button 
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="px-4 py-2 font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>

      {/* BLOCO 3: PROMOÇÕES ATIVAS */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 bg-[#EEF1EC]/30">
          <h2 className="text-lg font-bold text-[#0E7A4F] flex items-center gap-2">
            <TrendingDown className="w-5 h-5" /> Promoções Ativas
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8"><div className="h-10 bg-gray-100 rounded animate-pulse" /></div>
          ) : promocoes.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Nenhuma promoção ativa no momento.</div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4">Produto</th>
                  <th className="px-5 py-4 text-right">% Desconto</th>
                  <th className="px-5 py-4 text-right">Preço Promo</th>
                  <th className="px-5 py-4 text-center">Válido até</th>
                  <th className="px-5 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {promocoes.map(promo => {
                  const precoPromo = promo.produtoPreco * (1 - promo.percentual / 100);
                  return (
                    <tr key={promo.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-bold text-gray-900">{promo.produtoNome}</td>
                      <td className="px-5 py-4 text-right font-black text-[#0E7A4F]">{promo.percentual}%</td>
                      <td className="px-5 py-4 text-right font-bold text-gray-900">{formatarMoeda(precoPromo)}</td>
                      <td className="px-5 py-4 text-center text-gray-600">{formatarData(promo.fim)}</td>
                      <td className="px-5 py-4 text-center relative">
                        <button onClick={() => setMenuAberto(menuAberto === promo.id ? null : promo.id)} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        
                        {menuAberto === promo.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(null)} />
                            <div className="absolute right-12 top-10 w-48 bg-white border border-gray-100 shadow-xl rounded-xl z-20 py-2">
                              <button onClick={() => openEditarPromo(promo)} className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                                <Edit2 className="w-4 h-4 text-gray-500" /> Editar Promoção
                              </button>
                              <button onClick={() => openDivulgar(promo)} className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                                <Share2 className="w-4 h-4 text-[#0E7A4F]" /> Divulgar Promoção
                              </button>
                              <div className="h-px bg-gray-100 my-1" />
                              <button onClick={() => { setMenuAberto(null); setPromoParaCancelar(promo.id); }} className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
                                <X className="w-4 h-4" /> Cancelar Promoção
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODALS */}
      <ModalCriarPromocao 
        isOpen={isModalPromoOpen}
        onClose={() => setIsModalPromoOpen(false)}
        produto={modalPromoProduto}
        promocaoEdit={modalPromoEdit}
        empresaId={empresaId || ''}
        onSuccess={(novaPromo) => {
          carregarDados();
          if (!modalPromoEdit) {
            // Se foi criação (não edição), abre a tela de divulgação
            setModalDivulgarPromo(novaPromo);
            setTimeout(() => setIsModalDivulgarOpen(true), 300);
          }
        }}
      />

      <ModalDivulgar
        isOpen={isModalDivulgarOpen}
        onClose={() => setIsModalDivulgarOpen(false)}
        promo={modalDivulgarPromo}
      />

      {promoParaCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14211C]/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl flex flex-col">
            <h2 className="text-lg font-bold text-[#14211C] mb-2">Cancelar Promoção</h2>
            <p className="text-sm text-gray-600 mb-6">Tem certeza que deseja cancelar esta promoção?</p>
            <div className="flex justify-end gap-3 mt-auto">
              <button onClick={() => setPromoParaCancelar(null)} className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Não, voltar</button>
              <button onClick={handleConfirmarCancelamento} className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg">Sim, cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
