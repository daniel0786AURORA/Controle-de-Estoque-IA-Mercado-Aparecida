import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  formatarMoeda, 
  formatarQuantidade, 
  formatarDataSP 
} from '../utils/formatters';
import { 
  Truck, 
  Copy, 
  Check, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  CircleDollarSign, 
  TrendingUp, 
  Boxes, 
  ShieldAlert, 
  CheckCircle2, 
  RotateCcw,
  Plus,
  Minus,
  MessageSquare,
  Info,
  Trash2,
  PackagePlus,
  PackageX,
  X,
  FilePlus2,
  Sparkles
} from 'lucide-react';

export type OrigemItem = 'sugestao' | 'manual' | 'avulso';

export interface ItemPedidoCompra {
  id: string; // ID único na lista (produto_id ou `avulso_${timestamp}`)
  produto_id: string | null;
  nome: string;
  ean?: string | null;
  categoria_id?: string | null;
  unidade: string;
  custo: number;
  preco: number;
  saldo: number;
  vendido_30d: number;
  media_dia: number;
  estoque_minimo: number;
  cobertura_dias: number;
  sugestao_original: number;
  quantidade: number;
  origem: OrigemItem;
  modificado_manualmente?: boolean;
  urgencia?: 'CRÍTICO' | 'ATENÇÃO' | 'OK' | 'EXCESSO';
  explicacao_educativa?: string;
  alerta_personalizado?: string | null;
  meta_cobertura_aplicada?: number;
}

export const ComprasPage: React.FC = () => {
  const { papel, empresaId } = useAuth();
  const ehDono = papel === 'dono';

  const [itensPedido, setItensPedido] = useState<ItemPedidoCompra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroCobertura, setFiltroCobertura] = useState<'todos' | 'comprar_hoje'>('todos');
  const [nomeEmpresa, setNomeEmpresa] = useState('Mercado Aparecida');
  const [copiado, setCopiado] = useState(false);

  // Modais e Diálogos
  const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
  const [dialogoRecalcularAberto, setDialogoRecalcularAberto] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  // Estados da Modal de Adicionar Item
  const [abaAdicionar, setAbaAdicionar] = useState<'catalogo' | 'avulso'>('catalogo');
  const [termoBuscaModal, setTermoBuscaModal] = useState('');
  const [buscandoProdutos, setBuscandoProdutos] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState<Array<{
    id: string;
    nome: string;
    ean?: string | null;
    unidade: string;
    custo: number;
    preco: number;
    saldo: number;
    media_dia: number;
    vendido_30d: number;
    estoque_minimo: number;
  }>>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<{
    id: string;
    nome: string;
    ean?: string | null;
    unidade: string;
    custo: number;
    preco: number;
    saldo: number;
    media_dia: number;
    vendido_30d: number;
    estoque_minimo: number;
  } | null>(null);
  const [quantidadeModal, setQuantidadeModal] = useState('1');

  // Estado do Item Avulso
  const [nomeAvulso, setNomeAvulso] = useState('');
  const [unidadeAvulso, setUnidadeAvulso] = useState('un');
  const [quantidadeAvulso, setQuantidadeAvulso] = useState('1');
  const [custoAvulso, setCustoAvulso] = useState('');

  // Tooltip interativo
  const [tooltipAtivo, setTooltipAtivo] = useState<string | null>(null);
  const buscaTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notificação com timeout
  const mostrarMensagem = (msg: string) => {
    setMensagemSucesso(msg);
    setTimeout(() => {
      setMensagemSucesso(null);
    }, 4500);
  };

  // Busca dados da empresa para o cabeçalho do pedido
  useEffect(() => {
    let montado = true;
    async function carregarEmpresa() {
      if (!empresaId) return;
      try {
        const { data, error } = await supabase
          .from('empresa')
          .select('nome')
          .eq('id', empresaId)
          .single();

        if (!error && data?.nome && montado) {
          setNomeEmpresa(data.nome);
        }
      } catch (err) {
        console.error('Erro ao buscar nome da empresa:', err);
      }
    }
    carregarEmpresa();
    return () => {
      montado = false;
    };
  }, [empresaId]);

  // Função para carregar cálculo de sugestões do banco
  const carregarSugestoes = useCallback(async (preservarModificacoes: boolean = false) => {
    try {
      setCarregando(true);
      setErro(null);

      // 1. Consulta produtos ativos
      let queryProdutos = supabase
        .from('produto')
        .select('id, empresa_id, ean, nome, categoria_id, unidade, custo, preco, ativo, estoque_minimo')
        .eq('ativo', true);

      if (empresaId) {
        queryProdutos = queryProdutos.eq('empresa_id', empresaId);
      }

      // 2. Consulta giro (v_giro) e estoque (v_estoque)
      let queryGiro = supabase
        .from('v_giro')
        .select('produto_id, empresa_id, vendido_30d, media_dia');

      let queryEstoque = supabase
        .from('v_estoque')
        .select('produto_id, empresa_id, saldo, valor_custo');

      if (empresaId) {
        queryGiro = queryGiro.eq('empresa_id', empresaId);
        queryEstoque = queryEstoque.eq('empresa_id', empresaId);
      }

      const [resProdutos, resGiro, resEstoque] = await Promise.all([
        queryProdutos,
        queryGiro,
        queryEstoque,
      ]);

      if (resProdutos.error) {
        throw resProdutos.error;
      }

      const produtosLista = (resProdutos.data || []) as Array<{
        id: string;
        empresa_id: string;
        ean?: string | null;
        nome: string;
        categoria_id?: string | null;
        unidade: string;
        custo: number;
        preco: number;
        estoque_minimo?: number | null;
        ativo: boolean;
      }>;

      // Mapeamento de giro por produto_id
      const giroMap = new Map<string, { media_dia: number; vendido_30d: number }>();
      if (resGiro.data) {
        resGiro.data.forEach((g: Record<string, unknown>) => {
          const pId = String(g.produto_id || '');
          if (pId) {
            giroMap.set(pId, {
              media_dia: Number(g.media_dia || 0),
              vendido_30d: Number(g.vendido_30d || 0),
            });
          }
        });
      }

      // Mapeamento de estoque por produto_id
      const estoqueMap = new Map<string, number>();
      if (resEstoque.data) {
        resEstoque.data.forEach((e: Record<string, unknown>) => {
          const pId = String(e.produto_id || '');
          if (pId) {
            estoqueMap.set(pId, Number(e.saldo || 0));
          }
        });
      }

      // Processa cálculos de cobertura e sugestão
      const sugestoesNovas: ItemPedidoCompra[] = [];

      produtosLista.forEach((prod) => {
        const giro = giroMap.get(prod.id);
        const media_dia = Number(giro?.media_dia || 0);
        const vendido_30d = Number(giro?.vendido_30d || 0);
        const saldo = estoqueMap.has(prod.id) ? Number(estoqueMap.get(prod.id)) : 0;

        // Regra de negócio: Apenas produtos com media_dia > 0
        if (media_dia <= 0) return;

        // Passo 1: Calcular Cobertura Atual
        const cobertura_atual = saldo / media_dia;

        // Passo 2: Definir Meta Dinâmica
        const meta_cobertura = prod.estoque_minimo || 21;

        // Passo 3 e 4: Cálculo e Arredondamento
        let sugestao_base = (media_dia * meta_cobertura) - saldo;
        if (sugestao_base < 0) sugestao_base = 0;
        const sugestao_final = Math.ceil(sugestao_base);

        if (sugestao_final <= 0) return;

        // Passo 5 e 6: Classificar Urgência e Gerar Explicação
        let urgencia: 'CRÍTICO' | 'ATENÇÃO' | 'OK' | 'EXCESSO' = 'OK';
        let explicacao_educativa = '';

        if (cobertura_atual <= 3 || (saldo === 0 && media_dia > 0)) {
          urgencia = 'CRÍTICO';
          explicacao_educativa = `Acaba em ${Math.floor(cobertura_atual)} dias. Compre agora para não perder venda.`;
        } else if (cobertura_atual <= 7) {
          urgencia = 'ATENÇÃO';
          explicacao_educativa = 'Estoque baixo. Reposição garante tranquilidade até o próximo pedido.';
        } else if (cobertura_atual > meta_cobertura * 1.5) {
          urgencia = 'EXCESSO';
          explicacao_educativa = `Já tem estoque para ${Math.floor(cobertura_atual)} dias. Só compre se houver promoção imperdível.`;
        } else {
          urgencia = 'OK';
          explicacao_educativa = `Reposição preventiva para manter a meta de ${meta_cobertura} dias de segurança.`;
        }

        sugestoesNovas.push({
          id: prod.id,
          produto_id: prod.id,
          nome: prod.nome,
          ean: prod.ean,
          categoria_id: prod.categoria_id,
          unidade: prod.unidade || 'un',
          custo: Number(prod.custo || 0),
          preco: Number(prod.preco || 0),
          saldo,
          vendido_30d,
          media_dia,
          estoque_minimo: prod.estoque_minimo || 21,
          cobertura_dias: cobertura_atual,
          meta_cobertura_aplicada: meta_cobertura,
          sugestao_original: sugestao_final,
          quantidade: sugestao_final,
          urgencia,
          explicacao_educativa,
          alerta_personalizado: null,
          origem: 'sugestao',
          modificado_manualmente: false,
        });
      });

      // Se for recálculo preservando modificações e manuais
      if (preservarModificacoes) {
        setItensPedido((itensAtuais) => {
          const itensManuaisEAvulsos = itensAtuais.filter(
            (it) => it.origem === 'manual' || it.origem === 'avulso'
          );

          // Mapa de quantidades personalizadas anteriores
          const mapaPersonalizados = new Map<string, number>();
          itensAtuais.forEach((it) => {
            if (it.modificado_manualmente && it.produto_id) {
              mapaPersonalizados.set(it.produto_id, it.quantidade);
            }
          });

          // Atualiza as sugestões aplicando as edições prévias se existirem
          const sugestoesAtualizadas = sugestoesNovas.map((sug) => {
            if (mapaPersonalizados.has(sug.produto_id!)) {
              return {
                ...sug,
                quantidade: mapaPersonalizados.get(sug.produto_id!)!,
                modificado_manualmente: true,
              };
            }
            return sug;
          });

          // Unifica mantendo a ordem: primeiro sugestões ordenadas por urgência, depois itens manuais/avulsos
          sugestoesAtualizadas.sort((a, b) => a.cobertura_dias - b.cobertura_dias);
          return [...sugestoesAtualizadas, ...itensManuaisEAvulsos];
        });
      } else {
        // Ordenar pela menor cobertura primeiro (o mais urgente no topo)
        sugestoesNovas.sort((a, b) => a.cobertura_dias - b.cobertura_dias);
        setItensPedido(sugestoesNovas);
      }
    } catch (err: unknown) {
      console.error('Erro ao carregar dados de compras:', err);
      setErro('Não foi possível carregar a lista de compras. Verifique sua conexão e tente novamente.');
      setItensPedido([]);
    } finally {
      setCarregando(false);
      setRecalculando(false);
    }
  }, [empresaId]);

  // Carregamento inicial
  useEffect(() => {
    carregarSugestoes(false);
  }, [carregarSugestoes]);

  // Busca de produtos do catálogo na modal (com debounce)
  useEffect(() => {
    if (!modalAdicionarAberto || abaAdicionar !== 'catalogo') return;

    const termo = termoBuscaModal.trim();
    if (!termo) {
      setResultadosBusca([]);
      setBuscandoProdutos(false);
      return;
    }

    if (buscaTimeoutRef.current) {
      clearTimeout(buscaTimeoutRef.current);
    }

    setBuscandoProdutos(true);

    buscaTimeoutRef.current = setTimeout(async () => {
      try {
        let query = supabase
          .from('produto')
          .select('id, empresa_id, ean, nome, unidade, custo, preco, estoque_minimo')
          .or(`nome.ilike.%${termo}%,ean.ilike.%${termo}%`)
          .eq('ativo', true)
          .limit(8);

        if (empresaId) {
          query = query.eq('empresa_id', empresaId);
        }

        const { data: prods, error: errProds } = await query;
        if (errProds) throw errProds;

        if (!prods || prods.length === 0) {
          setResultadosBusca([]);
          setBuscandoProdutos(false);
          return;
        }

        const pIds = prods.map((p) => p.id);
        const [resEstoque, resGiro] = await Promise.all([
          supabase.from('v_estoque').select('produto_id, saldo').in('produto_id', pIds),
          supabase.from('v_giro').select('produto_id, media_dia, vendido_30d').in('produto_id', pIds),
        ]);

        const estMap = new Map<string, number>();
        if (resEstoque.data) {
          resEstoque.data.forEach((e: Record<string, unknown>) => estMap.set(String(e.produto_id), Number(e.saldo || 0)));
        }

        const girMap = new Map<string, { media_dia: number; vendido_30d: number }>();
        if (resGiro.data) {
          resGiro.data.forEach((g: Record<string, unknown>) => {
            girMap.set(String(g.produto_id), {
              media_dia: Number(g.media_dia || 0),
              vendido_30d: Number(g.vendido_30d || 0),
            });
          });
        }

        const resultadosFormatados = prods.map((p) => {
          const giro = girMap.get(p.id);
          return {
            id: p.id,
            nome: p.nome,
            ean: p.ean,
            unidade: p.unidade || 'un',
            custo: Number(p.custo || 0),
            preco: Number(p.preco || 0),
            saldo: estMap.get(p.id) || 0,
            media_dia: Number(giro?.media_dia || 0),
            vendido_30d: Number(giro?.vendido_30d || 0),
            estoque_minimo: Number(p.estoque_minimo || 21),
          };
        });

        setResultadosBusca(resultadosFormatados);
      } catch (err) {
        console.error('Erro na busca de produtos da modal:', err);
      } finally {
        setBuscandoProdutos(false);
      }
    }, 280);

    return () => {
      if (buscaTimeoutRef.current) {
        clearTimeout(buscaTimeoutRef.current);
      }
    };
  }, [termoBuscaModal, modalAdicionarAberto, abaAdicionar, empresaId]);

  // Adiciona produto cadastrado selecionado na modal
  const handleAdicionarProdutoCatalogo = () => {
    if (!produtoSelecionado) return;
    const qtdNum = Math.max(0.01, parseFloat(quantidadeModal.replace(',', '.')) || 1);

    const indexExistente = itensPedido.findIndex(
      (it) => it.produto_id === produtoSelecionado.id
    );

    if (indexExistente !== -1) {
      // Produto já existe na lista: soma a quantidade e avisa o dono
      const itemExistente = itensPedido[indexExistente];
      const novaQtd = itemExistente.quantidade + qtdNum;

      setItensPedido((prev) => {
        const copia = [...prev];
        copia[indexExistente] = {
          ...itemExistente,
          quantidade: novaQtd,
          modificado_manualmente: true,
        };
        return copia;
      });

      mostrarMensagem(
        itemExistente.origem === 'sugestao'
          ? 'Este item já estava sugerido. Quantidade atualizada.'
          : `Quantidade de "${produtoSelecionado.nome}" atualizada para ${novaQtd} ${produtoSelecionado.unidade}.`
      );
    } else {
      // Novo item manual
      const saldo = produtoSelecionado.saldo;
      const media_dia = produtoSelecionado.media_dia;
      const cobertura_dias = media_dia > 0 ? saldo / media_dia : 999;
      const diasCoberturaDesejada = produtoSelecionado.estoque_minimo || 21;
      const sugestao = media_dia > 0 ? Math.ceil(media_dia * diasCoberturaDesejada - saldo) : 0;

      const novoItem: ItemPedidoCompra = {
        id: produtoSelecionado.id,
        produto_id: produtoSelecionado.id,
        nome: produtoSelecionado.nome,
        ean: produtoSelecionado.ean,
        unidade: produtoSelecionado.unidade,
        custo: produtoSelecionado.custo,
        preco: produtoSelecionado.preco,
        saldo: saldo,
        vendido_30d: produtoSelecionado.vendido_30d,
        media_dia: media_dia,
        estoque_minimo: diasCoberturaDesejada,
        cobertura_dias: cobertura_dias,
        sugestao_original: sugestao > 0 ? sugestao : 0,
        quantidade: qtdNum,
        origem: 'manual',
        modificado_manualmente: true,
      };

      setItensPedido((prev) => [novoItem, ...prev]);
      mostrarMensagem(`"${produtoSelecionado.nome}" adicionado ao pedido.`);
    }

    // Fecha e reseta a modal
    setModalAdicionarAberto(false);
    setProdutoSelecionado(null);
    setTermoBuscaModal('');
    setQuantidadeModal('1');
  };

  // Adiciona item avulso fora do cadastro
  const handleAdicionarItemAvulso = () => {
    const nomeLimpo = nomeAvulso.trim();
    if (!nomeLimpo) return;

    const qtdNum = Math.max(0.01, parseFloat(quantidadeAvulso.replace(',', '.')) || 1);
    const custoNum = Math.max(0, parseFloat(custoAvulso.replace(',', '.')) || 0);

    const novoItemAvulso: ItemPedidoCompra = {
      id: `avulso_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      produto_id: null,
      nome: nomeLimpo,
      unidade: unidadeAvulso || 'un',
      custo: custoNum,
      preco: custoNum,
      saldo: 0,
      vendido_30d: 0,
      media_dia: 0,
      estoque_minimo: 0,
      cobertura_dias: 0,
      sugestao_original: 0,
      quantidade: qtdNum,
      origem: 'avulso',
      modificado_manualmente: true,
    };

    setItensPedido((prev) => [novoItemAvulso, ...prev]);
    mostrarMensagem(`Item avulso "${nomeLimpo}" adicionado ao pedido.`);

    // Fecha e reseta modal
    setModalAdicionarAberto(false);
    setNomeAvulso('');
    setQuantidadeAvulso('1');
    setCustoAvulso('');
  };

  // Edição livre de quantidade na linha
  const handleAlterarQuantidade = (itemId: string, novoValor: number) => {
    const valorSeguro = Math.max(0, isNaN(novoValor) ? 0 : novoValor);
    setItensPedido((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          return {
            ...it,
            quantidade: valorSeguro,
            modificado_manualmente: true,
          };
        }
        return it;
      })
    );
  };

  // Restaura a sugestão original calculada
  const handleRestaurarSugestao = (itemId: string, sugestaoOriginal: number) => {
    setItensPedido((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          return {
            ...it,
            quantidade: sugestaoOriginal,
            modificado_manualmente: false,
          };
        }
        return it;
      })
    );
  };

  // Remover item da lista de compras ativa
  const handleRemoverItem = (itemId: string) => {
    setItensPedido((prev) => prev.filter((it) => it.id !== itemId));
    mostrarMensagem('Item removido da lista atual.');
  };

  // Executa o recálculo preservando itens manuais e edições
  const handleConfirmarRecalculo = async () => {
    setDialogoRecalcularAberto(false);
    setRecalculando(true);
    await carregarSugestoes(true);
    mostrarMensagem('Sugestões recalculadas com sucesso. Itens manuais mantidos.');
  };

  // Filtra itens da tabela pela busca no topo
  const itensFiltrados = useMemo(() => {
    let result = itensPedido;
    
    if (filtroCobertura === 'comprar_hoje') {
      result = result.filter(p => p.cobertura_dias < (p.estoque_minimo || 21));
    }

    const termo = busca.trim().toLowerCase();
    if (termo) {
      result = result.filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          (p.ean && p.ean.toLowerCase().includes(termo))
      );
    }
    
    return result;
  }, [itensPedido, busca, filtroCobertura]);

  // Cálculos dos Totais e Breakdown (Sugerido vs Manual)
  const { 
    totalItensRepor, 
    investimentoTotal, 
    investimentoSugerido, 
    investimentoManual, 
    lucroTotal 
  } = useMemo(() => {
    let totalItens = 0;
    let invTotal = 0;
    let invSug = 0;
    let invMan = 0;
    let lucro = 0;

    itensPedido.forEach((p) => {
      if (p.quantidade > 0) {
        totalItens += 1;
        const custoLinha = p.quantidade * p.custo;
        invTotal += custoLinha;

        if (p.origem === 'sugestao') {
          invSug += custoLinha;
        } else {
          invMan += custoLinha;
        }

        const lucroUnitario = Math.max(0, p.preco - p.custo);
        lucro += p.quantidade * lucroUnitario;
      }
    });

    return {
      totalItensRepor: totalItens,
      investimentoTotal: invTotal,
      investimentoSugerido: invSug,
      investimentoManual: invMan,
      lucroTotal: lucro,
    };
  }, [itensPedido]);

  // Copiar lista formatada para WhatsApp
  const handleCopiarLista = async () => {
    const itensComprar = itensPedido.filter((p) => p.quantidade > 0);
    if (itensComprar.length === 0) return;

    const dataFormatada = formatarDataSP(new Date().toISOString());
    const linhas = itensComprar.map((p) => {
      const qtdStr = Number.isInteger(p.quantidade) 
        ? p.quantidade.toString() 
        : p.quantidade.toLocaleString('pt-BR');
      return `${qtdStr}x ${p.nome}`;
    });

    const textoFormatado = `*Pedido - ${nomeEmpresa}*\n${dataFormatada}\n\n${linhas.join('\n')}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textoFormatado);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textoFormatado;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (err) {
      console.error('Erro ao copiar pedido:', err);
    }
  };

  // Se o usuário logado não for dono, bloqueia o acesso
  if (!ehDono) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white p-8 rounded-2xl border border-[#14211C]/15 shadow-sm text-center max-w-md">
          <div className="w-14 h-14 bg-[#C4361A]/10 text-[#C4361A] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#14211C] mb-2">Acesso Restrito ao Dono</h2>
          <p className="text-sm text-[#14211C]/70 leading-relaxed">
            A seção de pedidos e reposição de compras é restrita aos administradores da loja.
          </p>
        </div>
      </div>
    );
  }

  // Renderiza selo colorido de cobertura
  const renderSeloCobertura = (item: ItemPedidoCompra) => {
    if (item.origem === 'avulso') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#14211C]/5 text-[#14211C]/50 border border-[#14211C]/10 whitespace-nowrap">
          Avulso
        </span>
      );
    }

    if (item.media_dia <= 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#14211C]/5 text-[#14211C]/60 border border-[#14211C]/10 whitespace-nowrap">
          Sem giro 30d
        </span>
      );
    }

    const cobertura = item.cobertura_dias;
    const diasRotulo = cobertura < 1 ? '< 1 dia' : `${Math.floor(cobertura)} dias`;

    let corClasses = '';
    let icone = null;

    if (item.urgencia === 'CRÍTICO') {
      corClasses = 'bg-[#C4361A]/10 text-[#C4361A] border-[#C4361A]/25 font-bold';
      icone = <AlertCircle className="w-3.5 h-3.5 mr-1" />;
    } else if (item.urgencia === 'ATENÇÃO') {
      corClasses = 'bg-[#B87503]/10 text-[#B87503] border-[#B87503]/25 font-bold';
      icone = <AlertCircle className="w-3.5 h-3.5 mr-1" />;
    } else if (item.urgencia === 'EXCESSO') {
      corClasses = 'bg-[#14211C]/5 text-[#14211C]/60 border-[#14211C]/15 font-medium';
      icone = <PackageX className="w-3.5 h-3.5 mr-1" />;
    } else {
      corClasses = 'bg-[#0E7A4F]/10 text-[#0E7A4F] border-[#0E7A4F]/25 font-semibold';
      icone = <CheckCircle2 className="w-3.5 h-3.5 mr-1" />;
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider border whitespace-nowrap shadow-2xs ${corClasses}`} title={item.explicacao_educativa}>
        {icone}
        {diasRotulo} {item.urgencia ? `• ${item.urgencia}` : ''}
      </span>
    );
  };

  // Renderiza a explicação do cálculo da sugestão
  const formatarExplicacaoCalculo = (item: ItemPedidoCompra) => {
    if (item.explicacao_educativa) {
      return (
        <span className="flex flex-col gap-1.5">
          <span className="text-emerald-300 font-bold mb-1">Motivo da Sugestão:</span>
          <span>{item.explicacao_educativa}</span>
          <span className="text-white/60 text-[10px] mt-1 border-t border-white/10 pt-1">
            Vende {item.media_dia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/dia • Saldo: {formatarQuantidade(item.saldo, item.unidade)} • Meta: {item.meta_cobertura_aplicada} dias
          </span>
        </span>
      );
    }
    
    const mediaStr = item.media_dia.toLocaleString('pt-BR', { 
      minimumFractionDigits: 1, 
      maximumFractionDigits: 1 
    });
    const saldoStr = formatarQuantidade(item.saldo, item.unidade);
    const sugestaoStr = item.sugestao_original;
    const diasConfigStr = item.estoque_minimo;

    return `Vende ${mediaStr} por dia. Você compra a cada ${diasConfigStr} dias. Tem ${saldoStr}, então precisa de ${sugestaoStr}.`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* Cabeçalho Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14211C] tracking-tight flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-[#0E7A4F]" />
            Compras e Reposição
          </h1>
          <p className="text-xs sm:text-sm text-[#14211C]/70 mt-0.5">
            Lista de compras editável com sugestões automáticas baseadas na sua meta de cobertura
          </p>
        </div>

        {/* Botões de Ação do Topo */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botão + Adicionar Item */}
          <button
            id="btn-adicionar-item-compra"
            onClick={() => {
              setModalAdicionarAberto(true);
              setAbaAdicionar('catalogo');
              setTermoBuscaModal('');
              setProdutoSelecionado(null);
              setQuantidadeModal('1');
            }}
            className="min-h-[44px] px-4 py-2 bg-[#0E7A4F] hover:bg-[#0b633f] active:bg-[#094d31] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar item</span>
          </button>

          {/* Botão Copiar Lista para WhatsApp */}
          <button
            id="btn-copiar-lista-whatsapp"
            onClick={handleCopiarLista}
            disabled={carregando || totalItensRepor === 0}
            className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all ${
              copiado
                ? 'bg-[#0E7A4F] text-white'
                : 'bg-[#14211C] hover:bg-[#14211C]/90 active:bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {copiado ? (
              <>
                <Check className="w-4 h-4 text-white animate-bounce" />
                <span>Lista Copiada!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar lista</span>
              </>
            )}
          </button>

          {/* Botão Recalcular Sugestões */}
          <button
            id="btn-recalcular-sugestoes"
            onClick={() => setDialogoRecalcularAberto(true)}
            disabled={carregando || recalculando}
            className="min-h-[44px] px-3.5 py-2 bg-white border border-[#14211C]/20 hover:bg-[#EEF1EC] active:bg-[#EEF1EC]/80 text-[#14211C] rounded-lg text-sm font-medium flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
            title="Recalcular sugestões do sistema mantendo itens manuais"
          >
            <RotateCcw className={`w-4 h-4 ${recalculando ? 'animate-spin text-[#0E7A4F]' : 'text-[#14211C]/70'}`} />
            <span className="hidden sm:inline">Recalcular sugestões</span>
          </button>
        </div>
      </div>

      {/* Banner de Feedback / Notificação */}
      {mensagemSucesso && (
        <div className="p-3.5 bg-[#0E7A4F]/10 border border-[#0E7A4F]/30 rounded-xl text-[#0E7A4F] flex items-center justify-between gap-3 text-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{mensagemSucesso}</span>
          </div>
          <button 
            onClick={() => setMensagemSucesso(null)}
            className="p-1 hover:bg-[#0E7A4F]/20 rounded text-[#0E7A4F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Banner de Erro se houver */}
      {erro && (
        <div className="p-4 bg-[#C4361A]/10 border border-[#C4361A]/30 rounded-xl text-[#C4361A] flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{erro}</span>
          </div>
          <button
            onClick={() => carregarSugestoes(false)}
            className="px-3 py-1.5 bg-[#C4361A] text-white rounded-lg text-xs font-semibold hover:bg-[#a62c14] transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* 3 Cartões de Indicadores no Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Itens a Repor */}
        <div className="bg-white p-5 rounded-xl border border-[#14211C]/15 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider block">
              Itens no Pedido
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-[#14211C] tracking-tight">
              {carregando ? (
                <div className="h-8 bg-[#14211C]/10 rounded w-16 animate-pulse" />
              ) : (
                `${totalItensRepor} ${totalItensRepor === 1 ? 'item' : 'itens'}`
              )}
            </div>
            <span className="text-xs text-[#14211C]/60 block">
              Soma de sugeridos e adicionados
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#0E7A4F]/10 text-[#0E7A4F] flex items-center justify-center flex-shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Investimento Total + Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-[#14211C]/15 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider block">
                Investimento Total
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#14211C] tracking-tight">
                {carregando ? (
                  <div className="h-8 bg-[#14211C]/10 rounded w-28 animate-pulse" />
                ) : (
                  formatarMoeda(investimentoTotal)
                )}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#14211C]/5 text-[#14211C] flex items-center justify-center flex-shrink-0">
              <CircleDollarSign className="w-6 h-6 text-[#0E7A4F]" />
            </div>
          </div>

          {/* Breakdown: Sugerido vs Manual */}
          <div className="mt-3 pt-2.5 border-t border-[#14211C]/10 text-[11px] sm:text-xs text-[#14211C]/75 flex flex-wrap items-center gap-1.5">
            <span>Sugerido pelo sistema: <strong className="text-[#0E5E7A]">{formatarMoeda(investimentoSugerido)}</strong></span>
            <span>·</span>
            <span>Adicionado por você: <strong className="text-[#14211C]">{formatarMoeda(investimentoManual)}</strong></span>
          </div>
        </div>

        {/* Card 3: Lucro Esperado */}
        <div className="bg-white p-5 rounded-xl border border-[#14211C]/15 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider block">
              Lucro Esperado
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-[#0E7A4F] tracking-tight">
              {carregando ? (
                <div className="h-8 bg-[#0E7A4F]/10 rounded w-28 animate-pulse" />
              ) : (
                formatarMoeda(lucroTotal)
              )}
            </div>
            <span className="text-xs text-[#14211C]/60 block">
              Margem bruta estimada após a venda
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#0E7A4F]/10 text-[#0E7A4F] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Barra de Filtro de Produtos */}
      <div className="bg-white p-3.5 rounded-xl border border-[#14211C]/15 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#14211C]/40">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="input-busca-compras"
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar produtos no pedido por nome ou código de barras (EAN)..."
            className="w-full min-h-[44px] h-10 pl-9 pr-8 rounded-lg border border-[#14211C]/20 bg-[#EEF1EC]/40 text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] text-sm transition-all"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#14211C]/40 hover:text-[#14211C]"
              title="Limpar busca"
            >
              ×
            </button>
          )}
        </div>
        
        <div className="w-full sm:w-auto shrink-0">
          <select
            value={filtroCobertura}
            onChange={(e) => setFiltroCobertura(e.target.value as 'todos' | 'comprar_hoje')}
            className="w-full sm:w-44 min-h-[44px] h-10 px-3 rounded-lg border border-[#14211C]/20 bg-white text-[#14211C] focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] text-sm cursor-pointer"
          >
            <option value="todos">Todos</option>
            <option value="comprar_hoje">Comprar hoje</option>
          </select>
        </div>
      </div>

      {/* Tabela do Pedido ou Estado Vazio */}
      <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden">
        {carregando ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center justify-between gap-4 py-2">
                <div className="h-5 bg-[#14211C]/10 rounded w-1/3" />
                <div className="h-5 bg-[#14211C]/10 rounded w-28" />
                <div className="h-5 bg-[#14211C]/10 rounded w-20" />
                <div className="h-8 bg-[#14211C]/10 rounded w-28" />
                <div className="h-5 bg-[#14211C]/10 rounded w-24" />
              </div>
            ))}
          </div>
        ) : itensPedido.length === 0 ? (
          /* Estado Vazio Conforme Solicitado */
          <div className="p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 bg-[#0E7A4F]/10 text-[#0E7A4F] rounded-2xl flex items-center justify-center mx-auto mb-2">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#14211C]">
              Nenhuma sugestão ainda
            </h3>
            <p className="text-sm text-[#14211C]/70 leading-relaxed">
              Nenhuma sugestão ainda — o sistema aprende com as vendas dos últimos 30 dias. Você pode montar seu pedido manualmente pelo botão Adicionar item.
            </p>
            <button
              onClick={() => {
                setModalAdicionarAberto(true);
                setAbaAdicionar('catalogo');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0E7A4F] hover:bg-[#0b633f] text-white font-semibold rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar item agora</span>
            </button>
          </div>
        ) : itensFiltrados.length === 0 ? (
          /* Sem resultados para o filtro de busca */
          <div className="p-10 text-center text-[#14211C]/60 text-sm">
            Nenhum produto encontrado com o termo &quot;{busca}&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#14211C]/15 bg-[#EEF1EC]/60 text-xs font-bold text-[#14211C]/80 uppercase tracking-wider">
                  <th className="px-4 py-3.5">Produto & Origem</th>
                  <th className="px-4 py-3.5 text-center">Cobertura</th>
                  <th className="px-4 py-3.5 text-right">Estoque atual</th>
                  <th className="px-4 py-3.5 text-center">Quantidade a comprar</th>
                  <th className="px-4 py-3.5 text-right">Custo estimado</th>
                  <th className="px-3 py-3.5 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14211C]/10">
                {itensFiltrados.map((item) => {
                  const custoLinha = item.quantidade * item.custo;
                  const foiAlterado = item.origem === 'sugestao' && item.quantidade !== item.sugestao_original;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-[#EEF1EC]/40 transition-colors ${
                        item.quantidade === 0 ? 'opacity-50 bg-[#14211C]/2' : ''
                      }`}
                    >
                      {/* 1. Coluna: Produto & Origem */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm sm:text-base text-[#14211C]">
                            {item.nome}
                          </span>

                          {/* Etiqueta de Origem com Tooltip de Cálculo */}
                          {item.origem === 'sugestao' ? (
                            <div className="relative inline-flex items-center">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                                <span>Sugerido pelo sistema</span>
                                <button
                                  type="button"
                                  onMouseEnter={() => setTooltipAtivo(item.id)}
                                  onMouseLeave={() => setTooltipAtivo(null)}
                                  onClick={() => setTooltipAtivo(tooltipAtivo === item.id ? null : item.id)}
                                  className="text-blue-600 hover:text-blue-800 focus:outline-none cursor-pointer"
                                  title="Ver explicação do cálculo"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              </span>

                              {/* Tooltip explicativo Flutuante */}
                              {tooltipAtivo === item.id && (
                                <div 
                                  className="absolute left-0 top-full mt-1 z-30 w-72 p-3 bg-[#14211C] text-white text-xs rounded-xl shadow-xl border border-white/10 space-y-1 animate-fadeIn"
                                  onMouseEnter={() => setTooltipAtivo(item.id)}
                                  onMouseLeave={() => setTooltipAtivo(null)}
                                >
                                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Memória de Cálculo</span>
                                  </div>
                                  <p className="text-white/90 leading-relaxed">
                                    {formatarExplicacaoCalculo(item)}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#14211C]/8 text-[#14211C]/75 border border-[#14211C]/15">
                              Adicionado por você
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[#14211C]/50 flex items-center gap-2 mt-0.5">
                          {item.ean && <span className="font-mono">EAN: {item.ean}</span>}
                          {item.media_dia > 0 && (
                            <>
                              {item.ean && <span>•</span>}
                              <span>Média: {formatarQuantidade(item.media_dia)}/dia</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* 2. Coluna: Cobertura com Selo Colorido */}
                      <td className="px-4 py-3.5 text-center">
                        {renderSeloCobertura(item)}
                      </td>

                      {/* 3. Coluna: Estoque Atual */}
                      <td className="px-4 py-3.5 text-right font-medium text-sm text-[#14211C] whitespace-nowrap">
                        {item.origem === 'avulso' ? '-' : formatarQuantidade(item.saldo, item.unidade)}
                      </td>

                      {/* 4. Coluna: Quantidade a Comprar (EM NEGRITO e EDITÁVEL) */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAlterarQuantidade(item.id, item.quantidade - 1)}
                            disabled={item.quantidade <= 0}
                            className="w-8 h-8 rounded-lg border border-[#14211C]/20 bg-white hover:bg-[#EEF1EC] text-[#14211C] flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer flex-shrink-0"
                            title="Diminuir"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step={item.unidade === 'kg' ? '0.1' : '1'}
                              value={item.quantidade}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleAlterarQuantidade(item.id, isNaN(val) ? 0 : val);
                              }}
                              className="w-20 min-h-[38px] text-center font-bold text-[#14211C] text-base bg-[#EEF1EC]/60 border border-[#14211C]/25 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:bg-white transition-all px-1"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAlterarQuantidade(item.id, item.quantidade + 1)}
                            className="w-8 h-8 rounded-lg border border-[#14211C]/20 bg-white hover:bg-[#EEF1EC] text-[#14211C] flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                            title="Aumentar"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão para restaurar sugestão original */}
                          {foiAlterado && (
                            <button
                              type="button"
                              onClick={() => handleRestaurarSugestao(item.id, item.sugestao_original)}
                              title={`Restaurar sugestão (${item.sugestao_original})`}
                              className="p-1 text-[#14211C]/40 hover:text-[#0E7A4F] rounded transition-colors ml-0.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 5. Coluna: Custo Estimado */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="font-bold text-sm sm:text-base text-[#14211C]">
                          {formatarMoeda(custoLinha)}
                        </div>
                        {item.custo > 0 ? (
                          <div className="text-xs text-[#14211C]/50">
                            {formatarMoeda(item.custo)} / {item.unidade}
                          </div>
                        ) : (
                          <div className="text-xs text-[#14211C]/40 italic">
                            Sem custo cadastrado
                          </div>
                        )}
                      </td>

                      {/* 6. Coluna: Ação Remover da Lista */}
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleRemoverItem(item.id)}
                          className="p-1.5 text-[#14211C]/40 hover:text-[#C4361A] hover:bg-[#C4361A]/10 rounded-lg transition-colors cursor-pointer"
                          title="Remover do pedido"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé da Tabela Informativo */}
        {!carregando && itensFiltrados.length > 0 && (
          <div className="px-4 py-3 bg-[#14211C]/5 border-t border-[#14211C]/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#14211C]/70">
            <span>
              Exibindo <strong>{itensFiltrados.length}</strong> de <strong>{itensPedido.length}</strong> itens no pedido
            </span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#0E7A4F]" />
              Clique em &quot;Copiar lista&quot; para enviar a relação via WhatsApp
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Adicionar Item (Catálogo ou Avulso Fora do Cadastro) */}
      {/* ========================================================================= */}
      {modalAdicionarAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header da Modal */}
            <div className="flex justify-between items-center p-4 border-b border-[#14211C]/10 bg-[#EEF1EC]/40 shrink-0">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-[#0E7A4F]" />
                <h2 className="font-bold text-[#14211C] text-lg">Adicionar Item ao Pedido</h2>
              </div>
              <button 
                onClick={() => setModalAdicionarAberto(false)}
                className="p-1 hover:bg-[#14211C]/10 rounded-lg text-[#14211C]/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas: Buscar no Cadastro vs Item Avulso */}
            <div className="flex border-b border-[#14211C]/10 bg-[#EEF1EC]/20 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAbaAdicionar('catalogo');
                  setProdutoSelecionado(null);
                }}
                className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-b-2 cursor-pointer ${
                  abaAdicionar === 'catalogo'
                    ? 'border-[#0E7A4F] text-[#0E7A4F] bg-white'
                    : 'border-transparent text-[#14211C]/60 hover:text-[#14211C]'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Produto Cadastrado</span>
              </button>
              <button
                type="button"
                onClick={() => setAbaAdicionar('avulso')}
                className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-b-2 cursor-pointer ${
                  abaAdicionar === 'avulso'
                    ? 'border-[#0E7A4F] text-[#0E7A4F] bg-white'
                    : 'border-transparent text-[#14211C]/60 hover:text-[#14211C]'
                }`}
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Item Fora do Cadastro (Avulso)</span>
              </button>
            </div>

            {/* Conteúdo da Modal */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {abaAdicionar === 'catalogo' ? (
                /* Aba 1: Catálogo */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#14211C]/70 uppercase tracking-wider mb-1.5">
                      Buscar Produto
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#14211C]/40">
                        <Search className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={termoBuscaModal}
                        onChange={(e) => {
                          setTermoBuscaModal(e.target.value);
                          setProdutoSelecionado(null);
                        }}
                        placeholder="Digite o nome ou bipe o código de barras (EAN)..."
                        autoFocus
                        className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-[#14211C]/20 bg-[#EEF1EC]/30 text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] text-sm"
                      />
                    </div>
                  </div>

                  {/* Resultados da Busca */}
                  {buscandoProdutos ? (
                    <div className="p-6 text-center text-xs text-[#14211C]/60 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#0E7A4F]" />
                      <span>Buscando produtos no cadastro...</span>
                    </div>
                  ) : resultadosBusca.length > 0 && !produtoSelecionado ? (
                    <div className="border border-[#14211C]/15 rounded-xl overflow-hidden divide-y divide-[#14211C]/10 max-h-48 overflow-y-auto">
                      {resultadosBusca.map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => {
                            setProdutoSelecionado(prod);
                            setTermoBuscaModal(prod.nome);
                          }}
                          className="p-3 hover:bg-[#EEF1EC] transition-colors cursor-pointer flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="font-semibold text-sm text-[#14211C]">{prod.nome}</div>
                            <div className="text-xs text-[#14211C]/50 flex items-center gap-2">
                              {prod.ean && <span>EAN: {prod.ean}</span>}
                              <span>•</span>
                              <span>Estoque: {formatarQuantidade(prod.saldo, prod.unidade)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-semibold text-[#0E7A4F]">
                              {formatarMoeda(prod.custo)} / {prod.unidade}
                            </div>
                            <span className="text-[11px] text-[#14211C]/50">Selecionar</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : termoBuscaModal.trim().length > 1 && !buscandoProdutos && resultadosBusca.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#14211C]/60 bg-[#14211C]/3 rounded-xl">
                      Nenhum produto encontrado. Tente buscar por outra palavra ou use a aba &quot;Item Fora do Cadastro&quot;.
                    </div>
                  ) : null}

                  {/* Detalhes do Produto Selecionado */}
                  {produtoSelecionado && (
                    <div className="p-4 bg-[#0E7A4F]/5 border border-[#0E7A4F]/20 rounded-xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-semibold text-[#0E7A4F] uppercase tracking-wider">
                            Produto Selecionado
                          </div>
                          <div className="font-bold text-[#14211C] text-base">
                            {produtoSelecionado.nome}
                          </div>
                          <div className="text-xs text-[#14211C]/60 mt-0.5">
                            Estoque atual: <strong>{formatarQuantidade(produtoSelecionado.saldo, produtoSelecionado.unidade)}</strong> · Custo: <strong>{formatarMoeda(produtoSelecionado.custo)}</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProdutoSelecionado(null)}
                          className="text-xs text-[#14211C]/50 hover:text-[#C4361A]"
                        >
                          Trocar
                        </button>
                      </div>

                      {/* Campo Quantidade */}
                      <div>
                        <label className="block text-xs font-semibold text-[#14211C]/70 uppercase tracking-wider mb-1">
                          Quantidade a Comprar ({produtoSelecionado.unidade})
                        </label>
                        <input
                          type="number"
                          step={produtoSelecionado.unidade === 'kg' ? '0.1' : '1'}
                          min="0.01"
                          value={quantidadeModal}
                          onChange={(e) => setQuantidadeModal(e.target.value)}
                          className="w-full min-h-[44px] px-3 font-bold text-lg text-[#14211C] border border-[#14211C]/20 rounded-xl focus:ring-2 focus:ring-[#0E7A4F] outline-none"
                          placeholder="1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Aba 2: Item Avulso Fora do Cadastro */
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs leading-relaxed">
                    Itens avulsos são incluídos exclusivamente no pedido atual e <strong>não cadastram produto</strong> no banco de dados.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#14211C]/70 uppercase tracking-wider mb-1">
                      Nome do Produto / Marca *
                    </label>
                    <input
                      type="text"
                      value={nomeAvulso}
                      onChange={(e) => setNomeAvulso(e.target.value)}
                      placeholder="Ex: Arroz Especial 5kg Marca Nova"
                      autoFocus
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#14211C]/20 bg-[#EEF1EC]/30 text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#14211C]/70 uppercase tracking-wider mb-1">
                        Quantidade *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={quantidadeAvulso}
                        onChange={(e) => setQuantidadeAvulso(e.target.value)}
                        className="w-full min-h-[44px] px-3 font-bold text-base text-[#14211C] border border-[#14211C]/20 rounded-xl focus:ring-2 focus:ring-[#0E7A4F] outline-none"
                        placeholder="1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#14211C]/70 uppercase tracking-wider mb-1">
                        Unidade
                      </label>
                      <select
                        value={unidadeAvulso}
                        onChange={(e) => setUnidadeAvulso(e.target.value)}
                        className="w-full min-h-[44px] px-3 border border-[#14211C]/20 rounded-xl focus:ring-2 focus:ring-[#0E7A4F] outline-none text-[#14211C] text-sm"
                      >
                        <option value="un">Unidade (un)</option>
                        <option value="cx">Caixa (cx)</option>
                        <option value="kg">Quilo (kg)</option>
                        <option value="pct">Pacote (pct)</option>
                        <option value="fd">Fardo (fd)</option>
                        <option value="l">Litro (l)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#14211C]/70 uppercase tracking-wider mb-1">
                      Custo Unitário Estimado (R$) - Opcional
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={custoAvulso}
                      onChange={(e) => setCustoAvulso(e.target.value)}
                      placeholder="0,00"
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#14211C]/20 bg-[#EEF1EC]/30 text-[#14211C] focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer da Modal */}
            <div className="p-4 border-t border-[#14211C]/10 flex justify-end gap-3 bg-[#EEF1EC]/30 shrink-0">
              <button
                type="button"
                onClick={() => setModalAdicionarAberto(false)}
                className="px-4 py-2 text-sm font-medium text-[#14211C]/70 hover:text-[#14211C] transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              {abaAdicionar === 'catalogo' ? (
                <button
                  type="button"
                  onClick={handleAdicionarProdutoCatalogo}
                  disabled={!produtoSelecionado}
                  className="px-5 py-2 bg-[#0E7A4F] hover:bg-[#0b633f] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                >
                  Adicionar ao Pedido
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAdicionarItemAvulso}
                  disabled={!nomeAvulso.trim()}
                  className="px-5 py-2 bg-[#0E7A4F] hover:bg-[#0b633f] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                >
                  Adicionar Item Avulso
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIÁLOGO: Confirmar Recalcular Sugestões */}
      {/* ========================================================================= */}
      {dialogoRecalcularAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#14211C]">
                Recalcular Sugestões do Sistema?
              </h3>
              <p className="text-sm text-[#14211C]/70 mt-1.5 leading-relaxed">
                As sugestões do sistema serão atualizadas com base no giro de vendas dos últimos 30 dias. 
                <strong> Seus itens adicionados manualmente e quantidades já editadas serão mantidos intactos.</strong>
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDialogoRecalcularAberto(false)}
                className="px-4 py-2 text-sm font-medium text-[#14211C]/70 hover:text-[#14211C] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarRecalculo}
                className="px-4 py-2 bg-[#0E7A4F] hover:bg-[#0b633f] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Confirmar Recálculo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
