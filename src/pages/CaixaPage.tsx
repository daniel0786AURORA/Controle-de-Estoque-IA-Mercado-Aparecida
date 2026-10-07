import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatarMoeda, formatarQuantidade } from '../utils/formatters';
import { Search, ShoppingCart, Trash2, X, AlertCircle, CheckCircle2, DollarSign, CreditCard, Wallet, QrCode, Banknote } from 'lucide-react';

type SugestaoProduto = {
  id: string;
  ean: string | null;
  nome: string;
  unidade: 'un' | 'kg';
  custo: number;
  saldo: number;
  preco_cheio: number;
  desconto_pct: number;
  preco_venda: number;
};

type ItemCarrinho = SugestaoProduto & {
  id_carrinho: string;
  quantidade: number;
  subtotal: number;
};

export const CaixaPage: React.FC = () => {
  const { usuario, papel, empresaId } = useAuth();
  const [termoBusca, setTermoBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<SugestaoProduto[]>([]);
  const [itemSelecionadoIndex, setItemSelecionadoIndex] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [mensagemErroBusca, setMensagemErroBusca] = useState<string | null>(null);

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  
  const [multiplicador, setMultiplicador] = useState<number | null>(null);

  type ModalQtdType = {
    modo: 'novo' | 'editar';
    id_carrinho?: string;
    produto: SugestaoProduto;
  };
  const [modalQtd, setModalQtd] = useState<ModalQtdType | null>(null);
  const [valorDigitadoModal, setValorDigitadoModal] = useState('');

  const [fechandoVenda, setFechandoVenda] = useState(false);
  const [mensagemErroVenda, setMensagemErroVenda] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [modalCancelamento, setModalCancelamento] = useState(false);
  const [descontoMaxOperador, setDescontoMaxOperador] = useState(5);
  useEffect(() => {
    async function fetchConfig() {
      if (!empresaId) return;
      const { data } = await supabase.from('config_taxa').select('desconto_max_operador').eq('empresa_id', empresaId).single();
      if (data && data.desconto_max_operador !== undefined) {
         setDescontoMaxOperador(data.desconto_max_operador);
      }
    }
    fetchConfig();
  }, [empresaId]);

  const [painelDescontoAberto, setPainelDescontoAberto] = useState(false);
  const [descontoAplicadoValor, setDescontoAplicadoValor] = useState(0);
  const [descontoAplicadoPor, setDescontoAplicadoPor] = useState<string | null>(null);
  const [descontoAutorizacaoToken, setDescontoAutorizacaoToken] = useState<string | null>(null);
  const [descontoMotivo, setDescontoMotivo] = useState('');
  
  const [valorACobrarInput, setValorACobrarInput] = useState('');
  const [descontoPctInput, setDescontoPctInput] = useState('');
  const [motivoInput, setMotivoInput] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [validandoAuth, setValidandoAuth] = useState(false);

  const totalNormal = carrinho.reduce((acc, item) => acc + (item.preco_cheio * item.quantidade), 0);
  const totalComDescontoItem = carrinho.reduce((acc, item) => acc + item.subtotal, 0); // before total discount
  const custoTotalVenda = carrinho.reduce((acc, item) => acc + (item.custo * item.quantidade), 0);
  const totalDescontoItens = totalNormal - totalComDescontoItem;


  const inputRef = useRef<HTMLInputElement>(null);

  const manterFoco = useCallback((e?: React.FocusEvent) => {
    if (e && e.relatedTarget && ['input-peso', 'input-valor', 'input-pct'].includes((e.relatedTarget as HTMLElement).id)) return;
    if (modalQtd || fechandoVenda || painelDescontoAberto || modalCancelamento) return;
    
    setTimeout(() => {
      if (!modalQtd && !fechandoVenda && !painelDescontoAberto && !modalCancelamento) {
        inputRef.current?.focus();
      }
    }, 10);
  }, [modalQtd, fechandoVenda, painelDescontoAberto, modalCancelamento]);

  useEffect(() => {
    manterFoco();
  }, [manterFoco, carrinho.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.endsWith('*')) {
      const numPart = val.slice(0, -1);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setMultiplicador(parsed);
        setTermoBusca('');
        return;
      }
    }
    setTermoBusca(val);
  };


  const realizarBusca = async (termo: string, forceEnter: boolean = false) => {
    if (!termo) {
      setSugestoes([]);
      return;
    }
    setBuscando(true);
    setMensagemErroBusca(null);
    try {
      const { data: produtos, error: errProd } = await supabase
        .from('produto')
        .select('id, empresa_id, ean, nome, unidade, custo, preco')
        .or(`nome.ilike.%${termo}%,ean.ilike.%${termo}%`)
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .limit(7);

      if (errProd) throw errProd;

      if (!produtos || produtos.length === 0) {
        setSugestoes([]);
        setMensagemErroBusca('Produto não encontrado. Verifique o código ou cadastre o item.');
        return;
      }

      const produtoIds = produtos.map((p) => p.id);

      const [resEstoque, resPreco] = await Promise.all([
        supabase.from('v_estoque').select('produto_id, saldo').in('produto_id', produtoIds),
        supabase.from('v_preco_atual').select('produto_id, preco_cheio, desconto_pct, preco_venda').in('produto_id', produtoIds),
      ]);

      const estoqueMap = new Map<string, number>();
      if (resEstoque.data) {
        resEstoque.data.forEach((item: any) => estoqueMap.set(item.produto_id, Number(item.saldo || 0)));
      }

      const precoMap = new Map<string, any>();
      if (resPreco.data) {
        resPreco.data.forEach((item: any) => precoMap.set(item.produto_id, item));
      }

      const resultados = produtos.map((p): SugestaoProduto => {
        const precoInfo = precoMap.get(p.id) || {};
        return {
          id: p.id,
          ean: p.ean || null,
          nome: p.nome,
          unidade: p.unidade as 'un' | 'kg',
          custo: Number(p.custo || 0),
          saldo: estoqueMap.get(p.id) || 0,
          preco_cheio: Number(precoInfo.preco_cheio ?? p.preco),
          desconto_pct: Number(precoInfo.desconto_pct ?? 0),
          preco_venda: Number(precoInfo.preco_venda ?? p.preco),
        };
      });

      // EAN Exato -> Adiciona e limpa
      if (/^\d{8,}$/.test(termo) || forceEnter) {
        const exactMatch = resultados.find((r) => r.ean === termo);
        if (exactMatch && /^\d{8,}$/.test(termo)) {
          adicionarAoCarrinho(exactMatch);
          return;
        } else if (forceEnter && resultados.length === 1) {
          adicionarAoCarrinho(resultados[0]);
          return;
        } else if (forceEnter && resultados.length > 0) {
          adicionarAoCarrinho(resultados[itemSelecionadoIndex < resultados.length ? itemSelecionadoIndex : 0]);
          return;
        }
      }

      setSugestoes(resultados);
      setItemSelecionadoIndex(0);
    } catch (err) {
      console.error(err);
      setMensagemErroBusca('Erro ao buscar produtos.');
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    if (!termoBusca.trim()) {
      setSugestoes([]);
      setMensagemErroBusca(null);
      return;
    }

    const timer = setTimeout(() => {
      realizarBusca(termoBusca.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [termoBusca]);

  const adicionarAoCarrinho = (produto: SugestaoProduto, qtdDigitada?: number) => {
    let qtdInicial = qtdDigitada;
    if (qtdDigitada === undefined && multiplicador !== null) {
      qtdInicial = multiplicador;
    }

    if (produto.unidade === 'kg' && qtdInicial === undefined) {
      setModalQtd({ modo: 'novo', produto });
      setValorDigitadoModal('');
      return;
    }

    const qtd = qtdInicial ?? 1;
    adicionarAoCarrinhoFinal(produto, qtd);
  };

  const adicionarAoCarrinhoFinal = (produto: SugestaoProduto, qtd: number) => {
    setCarrinho((prev) => {
      const index = prev.findIndex((item) => item.id === produto.id);
      if (index >= 0) {
        const novoCarrinho = [...prev];
        const item = novoCarrinho[index];
        const novaQtd = item.quantidade + qtd;
        novoCarrinho[index] = {
          ...item,
          quantidade: novaQtd,
          subtotal: novaQtd * item.preco_venda,
        };
        return novoCarrinho;
      }

      return [
        ...prev,
        {
          ...produto,
          id_carrinho: crypto.randomUUID(),
          quantidade: qtd,
          subtotal: qtd * produto.preco_venda,
        },
      ];
    });

    setTermoBusca('');
    setSugestoes([]);
    setMensagemErroBusca(null);
    setMultiplicador(null);
  };

  const atualizarQuantidade = (id_carrinho: string, novaQtd: number) => {
    if (novaQtd <= 0) {
      if (window.confirm('Remover item?')) {
        removerDoCarrinho(id_carrinho);
      }
      return;
    }
    setCarrinho((prev) => 
      prev.map(item => 
        item.id_carrinho === id_carrinho 
          ? { ...item, quantidade: novaQtd, subtotal: novaQtd * item.preco_venda }
          : item
      )
    );
  };

  const removerDoCarrinho = (id_carrinho: string) => {
    setCarrinho((prev) => prev.filter(item => item.id_carrinho !== id_carrinho));
    manterFoco();
  };

  const cancelarVenda = () => {
    setModalCancelamento(true);
  };
  
  const confirmarCancelamento = () => {
    setCarrinho([]);
    setTermoBusca('');
    setSugestoes([]);
    setMultiplicador(null);
    setPainelDescontoAberto(false);
    setModalCancelamento(false);
    setDescontoAplicadoValor(0);
    setDescontoAplicadoPor(null);
    setDescontoAutorizacaoToken(null);
    setDescontoMotivo('');
    manterFoco();
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setMultiplicador(null);
      setTermoBusca('');
      setSugestoes([]);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (sugestoes.length > 0 && itemSelecionadoIndex >= 0 && itemSelecionadoIndex < sugestoes.length) {
        adicionarAoCarrinho(sugestoes[itemSelecionadoIndex]);
      } else if (termoBusca.trim() !== '') {
        await realizarBusca(termoBusca.trim(), true);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setItemSelecionadoIndex((prev) => (prev < sugestoes.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setItemSelecionadoIndex((prev) => (prev > 0 ? prev - 1 : prev));
    }
  };

  const confirmarModalQtd = () => {
    if (!modalQtd) return;
    const isKg = modalQtd.produto.unidade === 'kg';
    let num = parseFloat(valorDigitadoModal.replace(',', '.'));
    if (isNaN(num) || num <= 0) return;
    
    if (!isKg) {
      num = Math.floor(num);
    }

    if (modalQtd.modo === 'editar') {
      atualizarQuantidade(modalQtd.id_carrinho!, num);
    } else {
      adicionarAoCarrinhoFinal(modalQtd.produto, num);
    }
    setModalQtd(null);
    setValorDigitadoModal('');
    manterFoco();
  };

  const cancelarModalQtd = () => {
    setModalQtd(null);
    setValorDigitadoModal('');
    setTermoBusca('');
    setSugestoes([]);
    manterFoco();
  };

  const fecharVenda = async (forma: 'dinheiro' | 'pix' | 'debito' | 'credito') => {
    if (carrinho.length === 0) return;
    setFechandoVenda(true);
    setMensagemErroVenda(null);
    setMensagemSucesso(null);

    // O frontend apenas calcula o preço final para UX. O banco recalcula custo,
    // promoção, desconto, taxa e autorização dentro da mesma transação.
    const totalDaVenda = totalComDescontoItem;
    const descontoManualTotal = descontoAplicadoValor;

    const itensParaRpc = carrinho.map((item) => {
      let descontoCaixaPorUnidade = 0;

      if (descontoManualTotal > 0 && totalDaVenda > 0) {
        const descontoCaixaDoItem = descontoManualTotal * (item.subtotal / totalDaVenda);
        descontoCaixaPorUnidade = descontoCaixaDoItem / item.quantidade;
      }

      const precoFinal = Math.max(0, Number(item.preco_venda) - descontoCaixaPorUnidade);

      return {
        produto_id: item.id,
        quantidade: item.quantidade,
        preco_unit: Number(precoFinal.toFixed(2)),
      };
    });

    try {
      const { data, error } = await supabase.rpc('fechar_venda', {
        p_itens: itensParaRpc,
        p_forma: forma,
        p_desconto_motivo: descontoManualTotal > 0 ? descontoMotivo : null,
        p_autorizador_id: descontoManualTotal > 0 ? descontoAplicadoPor : null,
        p_autorizacao_token: descontoManualTotal > 0 ? descontoAutorizacaoToken : null,
      });

      if (error) {
        console.error('Erro na RPC fechar_venda:', error);
        setMensagemErroVenda(error.message || 'Falha ao registrar venda.');
        return;
      }

      const vendaId = data;
      if (!vendaId || typeof vendaId !== 'string' || vendaId.length < 10) {
        setMensagemErroVenda('O servidor não retornou um identificador válido para a venda. A operação precisa ser verificada antes de continuar.');
        console.error('RPC fechar_venda não retornou UUID confiável:', data);
        return;
      }

      const totalFinal = totalComDescontoItem - descontoManualTotal;
      setMensagemSucesso(`Venda de ${formatarMoeda(totalFinal)} em ${forma.charAt(0).toUpperCase() + forma.slice(1)} registrada.`);
      setCarrinho([]);
      setTermoBusca('');
      setSugestoes([]);
      setDescontoAplicadoValor(0);
      setDescontoAplicadoPor(null);
      setDescontoAutorizacaoToken(null);
      setDescontoMotivo('');
      setPainelDescontoAberto(false);
      
      setTimeout(() => {
        setMensagemSucesso(null);
      }, 5000);

    } catch (err: any) {
       console.error('Erro inesperado no fechamento da venda:', err);
       setMensagemErroVenda(err.message || 'Erro inesperado ao fechar venda.');
    } finally {
       setFechandoVenda(false);
       manterFoco();
    }
  };


  const abrirPainelDesconto = () => {
    setValorACobrarInput('');
    setDescontoPctInput('');
    setMotivoInput('');
    setAuthEmail('');
    setAuthPassword('');
    setAuthError(null);
    setPainelDescontoAberto(true);
  };

  const handleValorACobrarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/[^0-9,]/g, '');
    if ((rawValue.match(/,/g) || []).length > 1) {
       rawValue = rawValue.replace(/,$/, '');
    }
    setValorACobrarInput(rawValue);
    
    const val = parseFloat(rawValue.replace(',', '.')) || 0;
    if (totalComDescontoItem > 0 && val > 0) {
       const pct = ((totalComDescontoItem - val) / totalComDescontoItem) * 100;
       setDescontoPctInput(pct.toFixed(2).replace('.', ','));
    } else {
       setDescontoPctInput('');
    }
  };

  const handleDescontoPctChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/[^0-9,]/g, '');
    if ((rawValue.match(/,/g) || []).length > 1) {
       rawValue = rawValue.replace(/,$/, '');
    }
    setDescontoPctInput(rawValue);
    
    const pct = parseFloat(rawValue.replace(',', '.')) || 0;
    if (pct > 0 && totalComDescontoItem > 0) {
       const val = totalComDescontoItem * (1 - pct / 100);
       setValorACobrarInput(val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else {
       setValorACobrarInput('');
    }
  };

  const aplicarDesconto = async () => {
    setAuthError(null);
    const pct = parseFloat(descontoPctInput.replace(',', '.')) || 0;
    const valorCobrar = parseFloat(valorACobrarInput.replace(/\./g, '').replace(',', '.')) || 0;
    
    if (pct <= 0 || valorCobrar <= 0 || valorCobrar >= totalComDescontoItem) {
       setAuthError('Valores de desconto inválidos.');
       return;
    }
    
    if (!motivoInput) {
       setAuthError('O motivo do desconto é obrigatório.');
       return;
    }
    
    const needsAuth = papel === 'operador' && pct > descontoMaxOperador;
    
    if (needsAuth) {
       if (!authEmail || !authPassword) {
          setAuthError(`Desconto de ${pct.toFixed(1)}% exige autorização (limite é ${descontoMaxOperador}%). Informe e-mail e senha do dono.`);
          return;
       }
       setValidandoAuth(true);
       try {
          // Using fetch to not override the current session
          const res = await fetch(`${(import.meta as any).env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': (import.meta as any).env.VITE_SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ email: authEmail, password: authPassword })
          });
          const data = await res.json();
          if (!res.ok) {
             setAuthError('Credenciais inválidas ou e-mail/senha incorretos.');
             setValidandoAuth(false);
             return;
          }
          const autorizadorId = data.user.id;
          const approvalRes = await fetch(
            `${(import.meta as any).env.VITE_SUPABASE_URL}/rest/v1/rpc/criar_autorizacao_caixa`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': (import.meta as any).env.VITE_SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${data.access_token}`,
              },
              body: '{}',
            }
          );

          const approvalToken = await approvalRes.json();
          if (!approvalRes.ok || typeof approvalToken !== 'string') {
            setAuthError('O usuário informado não possui permissão de dono para autorizar este desconto.');
            setValidandoAuth(false);
            return;
          }

          setDescontoAplicadoPor(autorizadorId);
          setDescontoAutorizacaoToken(approvalToken);
       } catch (err) {
          setAuthError('Erro ao validar autorização.');
          setValidandoAuth(false);
          return;
       }
       setValidandoAuth(false);
    } else {
       setDescontoAplicadoPor(usuario?.id || null);
    }
    
    const descontoVal = totalComDescontoItem - valorCobrar;
    setDescontoAplicadoValor(descontoVal);
    setDescontoMotivo(motivoInput);
    setPainelDescontoAberto(false);
    manterFoco();
  };

  const totalComDesconto = totalComDescontoItem - descontoAplicadoValor; // re-calculating for render
  const totalDesconto = totalDescontoItens;

  return (
    <div className="w-full max-w-[1180px] mx-auto h-[calc(100dvh-8.25rem)] min-h-[560px] flex flex-col md:flex-row overflow-hidden bg-white/88 backdrop-blur-xl rounded-[22px] border border-white/70 shadow-[0_16px_50px_rgba(45,76,61,.08)] mt-3 mb-4">
      {/* Coluna Esquerda: Busca e Feedback */}
      <div className="flex-1 flex flex-col border-r border-[#14211C]/8 p-3 sm:p-4 md:p-5 overflow-hidden relative">
        <h1 className="text-xl sm:text-xl font-bold text-[#14211C] mb-4 shrink-0">Caixa</h1>
        
        {/* Campo de Bipagem */}
        <div className="relative shrink-0 z-20">
          {multiplicador !== null && (
            <div className="mb-2 text-[#2C4A3E] font-bold text-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1">
               <span className="bg-[#2C4A3E] text-white px-3 py-1 rounded-lg">{multiplicador}×</span>
               <span>Aguardando produto... (Esc para cancelar)</span>
            </div>
          )}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-[#14211C]/40" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={termoBusca}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={(e) => {
                // If focus is moving to a modal element, ignore
                if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.fixed')) return;
                manterFoco(e);
              }}
              className={`block w-full pl-12 pr-4 py-3.5 text-lg md:text-xl font-semibold border-2 rounded-xl focus:ring-0 focus:border-[#2C4A3E] focus:bg-white outline-none transition-all placeholder:text-[#14211C]/30 ${multiplicador !== null ? 'border-[#2C4A3E] ring-4 ring-[#2C4A3E]/20 bg-[#2C4A3E]/5' : 'bg-[#EEF1EC]/30 border-[#14211C]/20'}`}
              placeholder="Bipe o código ou digite o nome..."
              autoFocus
            />
          </div>
          
          {/* Menu Suspenso de Sugestões */}
          {sugestoes.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-[#14211C]/10 overflow-hidden max-h-[60vh] overflow-y-auto">
              {sugestoes.map((item, index) => (
                <div 
                  key={item.id}
                  onClick={() => adicionarAoCarrinho(item)}
                  className={`px-4 py-3 cursor-pointer flex justify-between items-center border-b border-[#14211C]/5 last:border-0 ${index === itemSelecionadoIndex ? 'bg-[#2C4A3E]/10' : 'hover:bg-[#EEF1EC]'}`}
                >
                  <div>
                    <div className="font-bold text-[#14211C] text-lg">{item.nome}</div>
                    <div className="flex gap-4 text-sm text-[#14211C]/60 mt-0.5">
                      {item.ean && <span className="font-mono">EAN: {item.ean}</span>}
                      <span>Estoque: <strong className={item.saldo > 0 ? 'text-[#2C4A3E]' : 'text-[#C4361A]'}>{formatarQuantidade(item.saldo, item.unidade)}</strong></span>
                    </div>
                  </div>
                  <div className="text-right">
                    {item.desconto_pct > 0 && (
                      <div className="text-xs text-[#14211C]/40 line-through mb-0.5">{formatarMoeda(item.preco_cheio)}</div>
                    )}
                    <div className="font-bold text-xl text-[#14211C]">{formatarMoeda(item.preco_venda)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mensagens de Feedback */}
        <div className="mt-6 flex-1 flex flex-col justify-center shrink-0">
          {mensagemErroBusca && (
            <div className="text-center p-6 bg-red-50 text-[#C4361A] rounded-2xl border border-[#C4361A]/20">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-80" />
              <p className="text-lg font-medium">{mensagemErroBusca}</p>
            </div>
          )}
          
          {mensagemSucesso && (
            <div className="text-center p-6 bg-[#2C4A3E]/10 text-[#2C4A3E] rounded-2xl border border-[#2C4A3E]/20 animate-in fade-in zoom-in duration-300">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-3" />
              <p className="text-xl font-bold">{mensagemSucesso}</p>
            </div>
          )}
          
          {mensagemErroVenda && (
            <div className="text-center p-6 bg-red-50 text-[#C4361A] rounded-2xl border border-[#C4361A]/20 mt-4">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-80" />
              <p className="font-bold">Erro ao fechar venda</p>
              <p className="text-sm opacity-90 font-mono mt-2">{mensagemErroVenda}</p>
            </div>
          )}
        </div>
      </div>

      {/* Coluna Direita: Carrinho */}
      <div className="w-full md:w-[450px] lg:w-[500px] bg-[#EEF1EC]/30 flex flex-col h-full border-l border-[#14211C]/10 shrink-0">
        
        {/* Cabeçalho do Carrinho */}
        <div className="p-3 sm:p-4 border-b border-[#14211C]/10 bg-white flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-[#14211C] flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Carrinho
          </h2>
          <span className="bg-[#2C4A3E]/10 text-[#2C4A3E] px-3 py-1 rounded-full text-sm font-bold">
            {carrinho.length} itens
          </span>
        </div>

        {/* Lista de Itens */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {carrinho.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#14211C]/40">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-medium text-lg">O carrinho está vazio</p>
            </div>
          ) : (
            carrinho.map((item, index) => (
              <div key={item.id_carrinho} className="bg-white p-4 rounded-xl shadow-sm border border-[#14211C]/5 flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#14211C] text-lg truncate">{item.nome}</span>
                    {item.desconto_pct > 0 && (
                      <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                        -{item.desconto_pct}%
                      </span>
                    )}
                  </div>
                  
                  {/* Controles de Quantidade */}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => atualizarQuantidade(item.id_carrinho, item.quantidade - (item.unidade === 'kg' ? 0.1 : 1))}
                        className="w-9 h-9 bg-[#EEF1EC] text-[#14211C] hover:bg-[#14211C]/10 rounded-xl flex items-center justify-center font-bold text-2xl transition-colors shrink-0"
                      >
                        −
                      </button>
                      
                      <div 
                        onClick={() => {
                          setModalQtd({ modo: 'editar', id_carrinho: item.id_carrinho, produto: item });
                          setValorDigitadoModal(item.quantidade.toString().replace('.', ','));
                        }}
                        className="h-11 min-w-[64px] px-2 bg-[#EEF1EC] hover:bg-[#14211C]/10 transition-colors cursor-pointer text-[#14211C] rounded-xl flex items-center justify-center font-bold text-lg"
                      >
                        {item.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: item.unidade === 'kg' ? 3 : 0, maximumFractionDigits: 3 })}
                      </div>

                      <button 
                        onClick={() => atualizarQuantidade(item.id_carrinho, item.quantidade + (item.unidade === 'kg' ? 0.1 : 1))}
                        className="w-9 h-9 bg-[#EEF1EC] text-[#14211C] hover:bg-[#14211C]/10 rounded-xl flex items-center justify-center font-bold text-2xl transition-colors shrink-0"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-sm text-[#14211C]/60 flex items-center gap-1.5">
                      <span>×</span>
                      <span className={item.desconto_pct > 0 ? "text-green-700 font-medium" : ""}>
                        {formatarMoeda(item.preco_venda)}
                      </span>
                      {item.desconto_pct > 0 && (
                        <span className="line-through text-[10px] opacity-50">{formatarMoeda(item.preco_cheio)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2 shrink-0">
                  <div className="font-bold text-xl text-[#14211C]">{formatarMoeda(item.subtotal)}</div>
                  <button 
                    onClick={() => removerDoCarrinho(item.id_carrinho)}
                    className="text-[#C4361A]/50 hover:text-[#C4361A] w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#C4361A]/10 transition-colors mt-auto"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé: Totais e Pagamento */}
        <div className="p-3 sm:p-4 bg-white border-t border-[#14211C]/10 shrink-0">
          <div className="flex flex-col items-end mb-4">
            <span className="text-sm font-semibold text-[#14211C]/60 uppercase tracking-wide">Total a Pagar</span>
            {descontoAplicadoValor > 0 && (
               <div className="flex flex-col items-end">
                 <span className="text-xl font-bold text-[#14211C]/40 line-through mb-1">{formatarMoeda(totalComDescontoItem)}</span>
                 <span className="text-green-600 font-bold text-lg mb-1">Desconto venda: -{formatarMoeda(descontoAplicadoValor)}</span>
               </div>
            )}
            <span className="text-4xl sm:text-5xl font-black text-[#14211C]">{formatarMoeda(totalComDescontoItem - descontoAplicadoValor)}</span>
            
            {totalDesconto > 0 && (
              <span className="text-green-600 font-bold mt-1 text-sm">
                Desconto itens: {formatarMoeda(totalDesconto)}
              </span>
            )}
            
            {carrinho.length > 0 && descontoAplicadoValor === 0 && (
              <button onClick={abrirPainelDesconto} className="text-sm font-bold text-[#0E7A4F] hover:text-[#0a5a3a] mt-2 transition-colors flex items-center gap-1">
                 Adicionar Desconto na Venda
              </button>
            )}
            {descontoAplicadoValor > 0 && (
              <button onClick={() => { setDescontoAplicadoValor(0); setDescontoAplicadoPor(null); setDescontoAutorizacaoToken(null); setDescontoMotivo(''); }} className="text-sm font-bold text-[#C4361A] hover:text-[#9c2b15] mt-2 transition-colors">
                 Remover Desconto
              </button>
            )}
            

          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button 
              onClick={() => fecharVenda('dinheiro')}
              disabled={carrinho.length === 0 || fechandoVenda}
              className="flex flex-col items-center justify-center p-4 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-green-50 text-green-800 hover:bg-green-100 border border-green-200"
            >
              <Banknote className="w-6 h-6 mb-2" />
              Dinheiro
            </button>
            <button 
              onClick={() => fecharVenda('pix')}
              disabled={carrinho.length === 0 || fechandoVenda}
              className="flex flex-col items-center justify-center p-4 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200"
            >
              <QrCode className="w-6 h-6 mb-2" />
              Pix
            </button>
            <button 
              onClick={() => fecharVenda('debito')}
              disabled={carrinho.length === 0 || fechandoVenda}
              className="flex flex-col items-center justify-center p-4 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
            >
              <CreditCard className="w-6 h-6 mb-2" />
              Débito
            </button>
            <button 
              onClick={() => fecharVenda('credito')}
              disabled={carrinho.length === 0 || fechandoVenda}
              className="flex flex-col items-center justify-center p-4 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200"
            >
              <CreditCard className="w-6 h-6 mb-2" />
              Crédito
            </button>
          </div>

          {carrinho.length > 0 && (
            <button
              type="button"
              onClick={cancelarVenda}
              disabled={fechandoVenda}
              className="mt-4 w-full py-4 rounded-xl font-bold border-2 border-[#C4361A] text-[#C4361A] hover:bg-[#C4361A]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancelar venda
            </button>
          )}
        </div>
      </div>

      {/* Modal de Quantidade / Peso */}
      {modalQtd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 sm:p-8 flex flex-col relative animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-black text-[#14211C] mb-2">
                {modalQtd.produto.unidade === 'kg' ? 'Informar Peso' : 'Informar Quantidade'}
              </h3>
              <p className="text-lg text-[#14211C]/80 font-medium">
                {modalQtd.produto.nome}
              </p>
              <p className="text-sm font-mono text-[#14211C]/50 mt-1">
                {formatarMoeda(modalQtd.produto.preco_venda)} / {modalQtd.produto.unidade}
              </p>
            </div>
            
            <input 
              id="input-peso"
              type="text"
              inputMode={modalQtd.produto.unidade === 'kg' ? 'decimal' : 'numeric'}
              autoFocus
              value={valorDigitadoModal}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9,]/g, '');
                if (modalQtd.produto.unidade === 'un') {
                  setValorDigitadoModal(val.replace(/,/g, ''));
                } else {
                  if ((val.match(/,/g) || []).length <= 1) {
                    setValorDigitadoModal(val);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmarModalQtd();
                if (e.key === 'Escape') cancelarModalQtd();
              }}
              className="w-full h-16 text-center text-4xl font-black border-2 border-[#14211C]/20 rounded-xl focus:border-[#2C4A3E] focus:ring-0 outline-none mb-6 placeholder:text-[#14211C]/20"
              placeholder={modalQtd.produto.unidade === 'kg' ? '0,000' : '0'}
            />
            
            <div className="flex gap-3">
              <button 
                onClick={cancelarModalQtd} 
                className="flex-1 py-4 bg-gray-100 rounded-xl text-[#14211C] font-bold text-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmarModalQtd} 
                className="flex-1 py-4 bg-[#2C4A3E] rounded-xl text-white font-bold text-lg hover:bg-[#1f352c] transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento */}
      {modalCancelamento && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 sm:p-8 flex flex-col relative animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-[#C4361A]/10 text-[#C4361A] rounded-full flex items-center justify-center mx-auto mb-4">
               <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-[#14211C] mb-2">Cancelar Venda</h3>
            <p className="text-[#14211C]/70 font-medium mb-6">Tem certeza que deseja cancelar a venda e limpar todos os itens?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setModalCancelamento(false)} 
                className="flex-1 py-4 bg-gray-100 rounded-xl text-[#14211C] font-bold text-lg hover:bg-gray-200 transition-colors"
              >
                Voltar
              </button>
              <button 
                onClick={confirmarCancelamento} 
                className="flex-1 py-4 bg-[#C4361A] rounded-xl text-white font-bold text-lg hover:bg-[#9c2b15] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Painel de Desconto */}
      {painelDescontoAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 flex flex-col relative animate-in zoom-in-95 duration-200 my-8">
            <button onClick={() => setPainelDescontoAberto(false)} className="absolute top-4 right-4 text-[#14211C]/40 hover:text-[#14211C] bg-[#EEF1EC] p-2 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-2xl font-black text-[#14211C] mb-1">Aplicar Desconto</h3>
            <p className="text-[#14211C]/60 text-sm mb-6">Total da venda: <strong className="text-[#14211C]">{formatarMoeda(totalComDescontoItem)}</strong></p>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-[#14211C]/60 uppercase tracking-wide mb-1">Valor a cobrar (R$)</label>
                <input 
                  id="input-valor"
                  type="text" 
                  value={valorACobrarInput} 
                  onChange={handleValorACobrarChange}
                  autoFocus
                  className="w-full bg-[#EEF1EC]/50 border border-[#14211C]/20 rounded-xl px-4 py-3 text-lg font-bold text-[#14211C] outline-none focus:border-[#0E7A4F] focus:ring-1 focus:ring-[#0E7A4F] transition-all placeholder:text-[#14211C]/30"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#14211C]/60 uppercase tracking-wide mb-1">Desconto (%)</label>
                <input 
                  id="input-pct"
                  type="text" 
                  value={descontoPctInput} 
                  onChange={handleDescontoPctChange}
                  className="w-full bg-[#EEF1EC]/50 border border-[#14211C]/20 rounded-xl px-4 py-3 text-lg font-bold text-[#14211C] outline-none focus:border-[#0E7A4F] focus:ring-1 focus:ring-[#0E7A4F] transition-all placeholder:text-[#14211C]/30"
                  placeholder="0,00"
                />
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-[#14211C]/60 uppercase tracking-wide mb-1">Motivo do Desconto</label>
              <select 
                value={motivoInput}
                onChange={(e) => setMotivoInput(e.target.value)}
                className="w-full bg-[#EEF1EC]/50 border border-[#14211C]/20 rounded-xl px-4 py-3 text-base font-medium text-[#14211C] outline-none focus:border-[#0E7A4F] focus:ring-1 focus:ring-[#0E7A4F] transition-all"
              >
                <option value="">Selecione um motivo...</option>
                <option value="Ajuste de centavos">Ajuste de centavos</option>
                <option value="Cliente fiel">Cliente fiel</option>
                <option value="Produto com avaria">Produto com avaria</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            
            {/* Alerta de Margem */}
            {valorACobrarInput && (parseFloat(valorACobrarInput.replace(/\./g, '').replace(',', '.')) || 0) < custoTotalVenda && (parseFloat(valorACobrarInput.replace(/\./g, '').replace(',', '.')) || 0) > 0 && (
              <div className="mb-6 p-4 bg-[#C4361A]/10 border border-[#C4361A]/20 rounded-xl flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-[#C4361A] shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-[#C4361A] leading-relaxed">
                  Com esse desconto você vende abaixo do custo, perdendo <strong className="whitespace-nowrap">{formatarMoeda(custoTotalVenda - (parseFloat(valorACobrarInput.replace(/\./g, '').replace(',', '.')) || 0))}</strong> nesta venda.
                </p>
              </div>
            )}
            
            {/* Requisito de Autorizacao */}
            {papel === 'operador' && (parseFloat(descontoPctInput.replace(',', '.')) || 0) > descontoMaxOperador && (
              <div className="mb-6 p-4 bg-[#935A12]/10 border border-[#935A12]/20 rounded-xl">
                <p className="text-sm font-bold text-[#935A12] mb-3">
                  Descontos acima de {descontoMaxOperador}% exigem autorização.
                </p>
                <div className="space-y-3">
                  <input 
                    type="email" 
                    placeholder="E-mail do Dono"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-white border border-[#14211C]/20 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#935A12]"
                  />
                  <input 
                    type="password" 
                    placeholder="Senha do Dono"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-white border border-[#14211C]/20 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#935A12]"
                  />
                </div>
              </div>
            )}
            
            {authError && (
              <div className="mb-4 text-sm font-bold text-[#C4361A] bg-[#C4361A]/10 p-3 rounded-lg text-center">
                {authError}
              </div>
            )}
            
            <button 
              onClick={aplicarDesconto} 
              disabled={validandoAuth}
              className="w-full py-4 bg-[#0E7A4F] text-white rounded-xl font-bold text-lg hover:bg-[#0a5a3a] transition-colors disabled:opacity-70 flex items-center justify-center"
            >
              {validandoAuth ? 'Autorizando...' : 'Confirmar Desconto'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

