import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { DivulgacaoModal, PromocaoInfo } from '../components/DivulgacaoModal';

import { 
  CircleDollarSign, AlertCircle, AlertTriangle, Share2, 
  CheckCircle2, Tags, ShieldAlert, X, Percent,
  TrendingDown, Layers, Power, PowerOff, Sparkles,
  Info, ArrowDownRight, PackageX
} from 'lucide-react';
import { 
  formatarMoeda, 
  formatarDataSP, 
  formatarQuantidade, 
  formatarPercentual 
} from '../utils/formatters';
import { 
  addDays, 
  startOfDay, 
  differenceInDays, 
  format, 
  parseISO 
} from 'date-fns';

interface ProdutoParado {
  id: string;
  nome: string;
  ean?: string | null;
  categoria_id?: string | null;
  categoria_nome: string;
  unidade: string;
  custo: number;
  preco: number;
  ativo: boolean;
  saldo: number;
  valor_custo: number;
  vendido_30d: number;
  media_dia: number;
  ultimaVenda: string | null;
  diasSemVenda: number;
  cobertura: number;
  sugestao: string;
  diasParaVencer: number | null;
  grupo: 'liquidar' | 'reduzir' | 'investigar';
  descontoSugerido: number;
  planoTexto: string;
}

interface CategoriaParado {
  id: string;
  nome: string;
  valorTotal: number;
  quantidadeItens: number;
  porcentagemDoParado: number;
}


const GroupBlock = ({ title, icon, description, colorClass, headerBg, items, onPromote }: any) => {
  if (items.length === 0) return null;

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${colorClass}`}>
      <div className={`p-4 border-b border-[#14211C]/10 ${headerBg} flex flex-col sm:flex-row sm:items-center justify-between gap-2`}>
        <div>
          <h2 className="text-lg font-bold text-[#14211C] flex items-center gap-2">
            {icon}
            {title} <span className="bg-white text-xs font-bold px-2 py-0.5 rounded-full border border-[#14211C]/10">{items.length} itens</span>
          </h2>
          <p className="text-xs text-[#14211C]/70 mt-1">{description}</p>
        </div>
      </div>
      <div className="divide-y divide-[#14211C]/10">
        {items.map((prod: any) => (
          <div key={prod.id} className="p-4 sm:p-5 hover:bg-[#EEF1EC]/30 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-[#14211C]">{prod.nome}</h3>
                  <div className="text-xs text-[#14211C]/60 flex items-center gap-2 mt-0.5">
                    <span>{prod.categoria_nome}</span>
                    <span>&bull;</span>
                    <span>Custo Parado: <strong className="text-[#C4361A]">{formatarMoeda(prod.valor_custo)}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#14211C]/80 bg-[#EEF1EC] px-2.5 py-1.5 rounded-lg border border-[#14211C]/10">
                  <ArrowDownRight className="w-3.5 h-3.5 text-[#0E7A4F] flex-shrink-0" />
                  <span>{prod.sugestao}</span>
                </div>
              </div>
              <p className="text-sm text-[#14211C]/80 bg-[#14211C]/5 p-2.5 rounded-md border border-[#14211C]/10">
                {prod.planoTexto}
              </p>
            </div>
            
            <div className="w-full md:w-auto shrink-0 flex justify-end">
              <button
                onClick={() => onPromote(prod)}
                className="w-full md:w-auto min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-[#0E7A4F] hover:bg-[#0b633f] rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Tags className="w-4 h-4" />
                <span>Criar promoção {prod.descontoSugerido > 0 ? `(${prod.descontoSugerido}%)` : ''}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DinheiroParadoPage: React.FC = () => {
  const { papel, empresaId } = useAuth();
  const ehDono = papel === 'dono';

  const [produtosParados, setProdutosParados] = useState<ProdutoParado[]>([]);
  const [valorTotalEstoqueGeral, setValorTotalEstoqueGeral] = useState<number>(0);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [promocaoDivulgar, setPromocaoDivulgar] = useState<{ tipo: 'unica' | 'todas', lista: PromocaoInfo[] } | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [topGiroBaixaCobertura, setTopGiroBaixaCobertura] = useState<string[]>([]);

  // Modal de Promoção
  const [modalPromocao, setModalPromocao] = useState<ProdutoParado | null>(null);
  const [promoPercentual, setPromoPercentual] = useState<number>(20);
  const [promoDuracao, setPromoDuracao] = useState<number>(7);

  // Modal de Desativação
  const [modalDesativar, setModalDesativar] = useState<ProdutoParado | null>(null);
  const [processandoAcao, setProcessandoAcao] = useState<boolean>(false);

  // Inicializa modal de promoção com valores padrão inteligentes
  useEffect(() => {
    if (modalPromocao) {
      if (modalPromocao.descontoSugerido > 0) {
        setPromoPercentual(modalPromocao.descontoSugerido);
      } else if (modalPromocao.valor_custo > 200) {
        setPromoPercentual(30);
      } else {
        setPromoPercentual(20);
      }
      setPromoDuracao(7);
    }
  }, [modalPromocao]);

  const carregarDados = useCallback(async () => {
    if (!empresaId) return;
    try {
      setCarregando(true);
      setErro(null);

      const hoje = startOfDay(new Date());

      // Busca dados necessários em paralelo
      const [
        { data: produtosData, error: errProd },
        { data: categoriasData, error: errCat },
        { data: estoqueData, error: errEstoque },
        { data: giroData, error: errGiro },
        { data: vendasData, error: errVendas },
        { data: lotesData, error: errLotes }
      ] = await Promise.all([
        supabase
          .from('produto')
          .select('id, empresa_id, ean, nome, categoria_id, unidade, custo, preco, ativo')
          .eq('empresa_id', empresaId),
        supabase
          .from('categoria')
          .select('id, nome')
          .eq('empresa_id', empresaId),
        supabase
          .from('v_estoque')
          .select('produto_id, saldo, valor_custo')
          .eq('empresa_id', empresaId),
        supabase
          .from('v_giro')
          .select('produto_id, vendido_30d, media_dia')
          .eq('empresa_id', empresaId),
        supabase
          .from('movimento')
          .select('produto_id, criado_em')
          .eq('empresa_id', empresaId)
          .eq('tipo', 'venda')
          .order('criado_em', { ascending: false }),
        supabase
          .from('lote')
          .select('produto_id, validade')
          .eq('empresa_id', empresaId)
          .not('validade', 'is', null)
      ]);

      if (errProd) throw errProd;
      if (errCat) throw errCat;
      if (errEstoque) throw errEstoque;
      if (errGiro) throw errGiro;
      if (errVendas) throw errVendas;

      // Mapeamento de categorias
      const catMap = new Map<string, string>();
      categoriasData?.forEach(c => catMap.set(c.id, c.nome));

      // Mapeamento de estoque
      const estoqueMap = new Map<string, { saldo: number; valor_custo: number }>();
      let totalEstoqueLoja = 0;
      estoqueData?.forEach(e => {
        const s = Number(e.saldo || 0);
        const vc = Number(e.valor_custo || 0);
        estoqueMap.set(e.produto_id, { saldo: s, valor_custo: vc });
        if (s > 0) {
          totalEstoqueLoja += vc;
        }
      });
      setValorTotalEstoqueGeral(totalEstoqueLoja);

      // Mapeamento de giro
      const giroMap = new Map<string, { vendido_30d: number; media_dia: number }>();
      giroData?.forEach(g => {
        giroMap.set(g.produto_id, {
          vendido_30d: Number(g.vendido_30d || 0),
          media_dia: Number(g.media_dia || 0)
        });
      });

      // Mapeamento de última venda por produto
      const ultimaVendaMap = new Map<string, string>();
      vendasData?.forEach(v => {
        if (!ultimaVendaMap.has(v.produto_id) && v.criado_em) {
          ultimaVendaMap.set(v.produto_id, v.criado_em);
        }
      });

      // Mapeamento de dias para vencer (menor validade do lote)
      const validadeMap = new Map<string, number>();
      if (lotesData && lotesData.length > 0) {
        lotesData.forEach(l => {
          if (l.validade) {
            const valDate = startOfDay(parseISO(l.validade));
            const diasRestantes = differenceInDays(valDate, hoje);
            const atual = validadeMap.get(l.produto_id);
            if (atual === undefined || diasRestantes < atual) {
              validadeMap.set(l.produto_id, diasRestantes);
            }
          }
        });
      }

      // Processamento e identificação de produtos parados
      const listaParados: ProdutoParado[] = [];

      (produtosData || []).forEach(prod => {
        const estoque = estoqueMap.get(prod.id);
        const saldo = estoque?.saldo || 0;
        
        // Apenas produtos com saldo maior que zero podem estar parados
        if (saldo <= 0) return;

        const custo = Number(prod.custo || 0);
        const preco = Number(prod.preco || 0);
        const valorCusto = estoque?.valor_custo ?? (saldo * custo);
        
        const giro = giroMap.get(prod.id);
        const vendido30d = giro?.vendido_30d || 0;
        const mediaDia = giro?.media_dia || 0;

        const ultimaVenda = ultimaVendaMap.get(prod.id) || null;


        let diasSemVenda = Infinity;
        if (ultimaVenda) {
          diasSemVenda = differenceInDays(hoje, startOfDay(parseISO(ultimaVenda)));
        }

        // Cobertura de estoque em dias: saldo / media_dia
        let cobertura = Infinity;
        if (mediaDia > 0) {
          cobertura = saldo / mediaDia;
        }

        // Regra de produto parado (Ajustada para o Consultor Estratégico):
        // Cobertura > 45 dias ou sem vendas recentes.
        const isParado = cobertura > 45 || diasSemVenda > 45 || !ultimaVenda;

        if (isParado) {
          let grupo: 'liquidar' | 'reduzir' | 'investigar';
          let sugestao = '';
          let descontoSugerido = 0;
          
          let explicacaoPorque = '';
          let estrategiaRecomendada = '';
          let impactoFinanceiro = '';

          const isCritico = (diasSemVenda > 90 && valorCusto > 200) || (cobertura > 180 && isFinite(cobertura)) || (!isFinite(cobertura) && diasSemVenda > 90);
          const isAtencao = (cobertura >= 45 && cobertura <= 180) || (valorCusto >= 50 && valorCusto <= 200);

          if (isCritico) {
            grupo = 'liquidar';
            descontoSugerido = 35; // Desconto agressivo 30-40%
            sugestao = 'Liquidar Imediatamente (35% OFF)';
            
            if (cobertura > 180) {
              explicacaoPorque = `Estoque cobre mais de ${Math.round(cobertura)} dias no ritmo atual.`;
            } else {
              explicacaoPorque = `Sem vendas há ${diasSemVenda} dias com alto valor parado.`;
            }
            estrategiaRecomendada = "Seu dinheiro está 'dormindo'. Libere esse caixa agora para comprar produtos que realmente vendem. O custo de manter parado supera o pequeno prejuízo do desconto.";
          } else if (isAtencao) {
            grupo = 'reduzir';
            descontoSugerido = 20; // Moderado 15-20%
            sugestao = 'Reduzir e Girar (20% OFF)';
            
            if (cobertura >= 45 && cobertura <= 180) {
              explicacaoPorque = `Cobertura de estoque um pouco alta (${Math.round(cobertura)} dias).`;
            } else {
              explicacaoPorque = `Valor parado considerável (${formatarMoeda(valorCusto)}), mas com giro lento.`;
            }
            estrategiaRecomendada = "O giro está lento. Uma promoção leve acelera a saída e evita que vire estoque crítico no futuro. Suspenda a reposição deste item.";
          } else {
            grupo = 'investigar';
            descontoSugerido = 0;
            sugestao = 'Investigar Exposição (Sem Desconto)';
            
            if (valorCusto < 50) {
              explicacaoPorque = `Baixo impacto financeiro (${formatarMoeda(valorCusto)} parado).`;
            } else {
              explicacaoPorque = `Sem vendas recentes, mas ainda não é alarmante.`;
            }
            estrategiaRecomendada = "Antes de descontar, verifique se o produto está visível na loja. Pode ser apenas falta de exposição, não falta de interesse.";
          }

          if (descontoSugerido > 0) {
            const precoDesconto = preco * (1 - descontoSugerido / 100);
            const recupera = saldo * precoDesconto;
            const mesesParaVender = mediaDia > 0 ? (saldo / mediaDia) / 30 : 0;
            const mesesStr = mesesParaVender > 0 ? `${Math.round(mesesParaVender)} meses` : 'muito tempo';

            impactoFinanceiro = `Recupera ${formatarMoeda(recupera)} hoje. Sem desconto, levaria ${mesesStr} para vender.`;
          } else {
            impactoFinanceiro = `Valor em estoque: ${formatarMoeda(valorCusto)}. Mantenha a margem.`;
          }

          const planoTexto = `${explicacaoPorque} ${estrategiaRecomendada} ${impactoFinanceiro}`;

          const catNome = prod.categoria_id ? (catMap.get(prod.categoria_id) || 'Sem categoria') : 'Sem categoria';

          listaParados.push({
            id: prod.id,
            nome: prod.nome,
            ean: prod.ean,
            categoria_id: prod.categoria_id,
            categoria_nome: catNome,
            unidade: prod.unidade || 'UN',
            custo,
            preco,
            ativo: prod.ativo ?? true,
            saldo,
            valor_custo: valorCusto,
            vendido_30d: vendido30d,
            media_dia: mediaDia,
            ultimaVenda,
            diasSemVenda,
            cobertura,
            sugestao,
            diasParaVencer: validadeMap.get(prod.id) ?? null,
            grupo,
            descontoSugerido,
            planoTexto
          });
        }
      });

      // Ordenar pelo maior custo parado primeiro (o dinheiro grande no topo)
      listaParados.sort((a, b) => b.valor_custo - a.valor_custo);

      setProdutosParados(listaParados);

      const produtosGiroAlto: Array<{ nome: string; mediaDia: number }> = [];
      (produtosData || []).forEach(prod => {
         const estoque = estoqueMap.get(prod.id);
         const saldo = estoque?.saldo || 0;
         const giro = giroMap.get(prod.id);
         const mediaDia = giro?.media_dia || 0;
         if (mediaDia > 0 && saldo >= 0) {
            const cob = saldo / mediaDia;
            if (cob < 7) {
               produtosGiroAlto.push({ nome: prod.nome, mediaDia });
            }
         }
      });
      produtosGiroAlto.sort((a, b) => b.mediaDia - a.mediaDia);
      const top3Giro = produtosGiroAlto.slice(0, 3).map(p => p.nome);
      setTopGiroBaixaCobertura(top3Giro);
    } catch (err: any) {
      console.error('Erro ao carregar produtos parados:', err);
      setErro('Não foi possível carregar os dados de produtos parados.');
    } finally {
      setCarregando(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Cálculos dos 4 cartões
  const { dinheiroParado, qtdProdutosParados, percentualEstoqueTotal, valorVoltaCaixa20 } = useMemo(() => {
    let somaCusto = 0;
    let somaVoltaCaixa = 0;

    produtosParados.forEach(p => {
      somaCusto += p.valor_custo;
      // Liquidando com 20% de desconto: preço com 20% off * saldo
      const precoCom20Off = p.preco * 0.8;
      somaVoltaCaixa += p.saldo * precoCom20Off;
    });

    const pct = valorTotalEstoqueGeral > 0 ? (somaCusto / valorTotalEstoqueGeral) * 100 : 0;

    return {
      dinheiroParado: somaCusto,
      qtdProdutosParados: produtosParados.length,
      percentualEstoqueTotal: pct,
      valorVoltaCaixa20: somaVoltaCaixa
    };
  }, [produtosParados, valorTotalEstoqueGeral]);

  // Ação: Criar promoção
  const handleSalvarPromocao = async () => {
    if (!modalPromocao || !empresaId) return;

    try {
      setProcessandoAcao(true);
      const hoje = startOfDay(new Date());
      const fimDate = addDays(hoje, promoDuracao);

      const { error: errInsert } = await supabase.from('promocao').insert({
        empresa_id: empresaId,
        produto_id: modalPromocao.id,
        percentual: promoPercentual,
        inicio: format(hoje, 'yyyy-MM-dd'),
        fim: format(fimDate, 'yyyy-MM-dd'),
        motivo: 'Liquidação de estoque parado',
        ativa: true
      });

      if (errInsert) throw errInsert;

      const precoOriginal = modalPromocao.preco;
      const precoNovo = precoOriginal * (1 - promoPercentual / 100);
      setPromocaoDivulgar({
          tipo: 'unica',
          lista: [{
             id: 'new',
             produtoNome: modalPromocao.nome,
             precoAntigo: precoOriginal,
             precoNovo: precoNovo,
             percentual: promoPercentual,
             fim: format(fimDate, 'yyyy-MM-dd'),
             unidade: modalPromocao.unidade
          }]
      });


      setMensagemSucesso(`Promoção de ${promoPercentual}% criada com sucesso para ${modalPromocao.nome}!`);
      setModalPromocao(null);
      carregarDados();
      setTimeout(() => setMensagemSucesso(null), 5000);
    } catch (err: any) {
      console.error('Erro ao criar promoção:', err);
      setErro('Não foi possível criar a promoção.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Ação: Desativar / Reativar produto
  const handleConfirmarDesativacao = async () => {
    if (!modalDesativar || !empresaId) return;

    try {
      setProcessandoAcao(true);
      const novoStatus = !modalDesativar.ativo;

      const { error: errUpdate } = await supabase
        .from('produto')
        .update({ ativo: novoStatus })
        .eq('id', modalDesativar.id)
        .eq('empresa_id', empresaId);

      if (errUpdate) throw errUpdate;

      setMensagemSucesso(
        novoStatus
          ? `Produto ${modalDesativar.nome} reativado com sucesso!`
          : `Produto ${modalDesativar.nome} desativado. Ele não será mais reposto.`
      );
      setModalDesativar(null);
      carregarDados();
      setTimeout(() => setMensagemSucesso(null), 5000);
    } catch (err: any) {
      console.error('Erro ao alterar status do produto:', err);
      setErro('Não foi possível alterar o status do produto.');
    } finally {
      setProcessandoAcao(false);
    }
  };

  // Render do Modal de Promoção
  const renderModalPromocao = () => {
    if (!modalPromocao) return null;

    const precoOriginal = modalPromocao.preco;
    const custo = modalPromocao.custo;
    const precoDesconto = precoOriginal * (1 - promoPercentual / 100);

    const margemOriginal = precoOriginal > 0 ? ((precoOriginal - custo) / precoOriginal) * 100 : 0;
    const margemDesconto = precoDesconto > 0 ? ((precoDesconto - custo) / precoDesconto) * 100 : 0;

    const lucroOriginal = precoOriginal - custo;
    const lucroDesconto = precoDesconto - custo;

    const saldo = modalPromocao.saldo;
    const mediaDia = modalPromocao.media_dia;
    const diasParaVencer = modalPromocao.diasParaVencer;

    let corParecer = '';
    let textoParecer = '';

    // Análise automática por regras estritas (sem IA)
    if (margemDesconto < 0) {
      corParecer = 'bg-[#C4361A]/10 text-[#C4361A] border-[#C4361A]/20';
      const perdaUn = custo - precoDesconto;
      const custoTotalLote = saldo * custo;
      textoParecer = `Você vai vender abaixo do custo, perdendo ${formatarMoeda(perdaUn)} por unidade. Ainda assim pode valer a pena: jogar fora custaria ${formatarMoeda(custoTotalLote)}.`;
    } else if (diasParaVencer !== null && diasParaVencer <= 3 && saldo > (mediaDia * diasParaVencer)) {
      corParecer = 'bg-[#935A12]/10 text-[#935A12] border-[#935A12]/20';
      const sobra = Math.ceil(saldo - (mediaDia * diasParaVencer));
      const lixo = sobra * custo;
      textoParecer = `Você tem ${formatarQuantidade(saldo)} unidades e vende ${formatarQuantidade(mediaDia)} por dia. Nesse ritmo sobram ${formatarQuantidade(sobra)} unidades para o vencimento, ${formatarMoeda(lixo)} no lixo. O desconto vale a pena.`;
    } else if (mediaDia >= 1 && diasParaVencer !== null && diasParaVencer > 20) {
      corParecer = 'bg-blue-100 text-blue-800 border-blue-200';
      const maxVenda = Math.min(saldo, mediaDia * promoDuracao);
      const lucroDeixado = (lucroOriginal - lucroDesconto) * maxVenda;
      textoParecer = `Este produto já vende bem sem desconto: ${formatarQuantidade(mediaDia)} por dia. Você deixaria de ganhar cerca de ${formatarMoeda(lucroDeixado)} em lucro. Considere um desconto menor ou nenhum.`;
    } else {
      corParecer = 'bg-[#0E7A4F]/10 text-[#0E7A4F] border-[#0E7A4F]/20';
      textoParecer = `Bom desconto. Você mantém ${formatarMoeda(lucroDesconto)} de lucro por unidade e ainda gira o estoque a tempo.`;
    }

    const hoje = startOfDay(new Date());
    const fimDate = addDays(hoje, promoDuracao);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14211C]/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#0E7A4F]/10 text-[#0E7A4F] flex items-center justify-center">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#14211C]">
                  Criar Promoção de Liquidação
                </h3>
                <span className="text-xs text-[#14211C]/60 font-medium">
                  Liquidação de estoque parado
                </span>
              </div>
            </div>
            <button 
              id="modal-promo-fechar-btn"
              onClick={() => setModalPromocao(null)} 
              className="text-[#14211C]/40 hover:text-[#14211C] p-1.5 rounded-lg hover:bg-[#EEF1EC] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6 pb-6 border-b border-[#14211C]/10">
            <h4 className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider mb-1">
              Produto Selecionado
            </h4>
            <div className="text-lg font-bold text-[#14211C]">{modalPromocao.nome}</div>
            <div className="text-sm text-[#14211C]/70 flex flex-wrap items-center gap-4 mt-1.5">
              <span>Categoria: <strong>{modalPromocao.categoria_nome}</strong></span>
              <span>Saldo em estoque: <strong>{formatarQuantidade(modalPromocao.saldo, modalPromocao.unidade)}</strong></span>
              <span>Custo parado: <strong className="text-[#C4361A]">{formatarMoeda(modalPromocao.valor_custo)}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Controles de Desconto e Prazo */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-[#14211C] mb-2 flex justify-between">
                  <span>Percentual de Desconto</span>
                  <span className="text-[#0E7A4F] font-bold">{promoPercentual}%</span>
                </label>
                <input 
                  id="promo-percentual-slider"
                  type="range" 
                  min="1" 
                  max="90" 
                  value={promoPercentual}
                  onChange={e => setPromoPercentual(Number(e.target.value))}
                  className="w-full accent-[#0E7A4F] h-2 bg-[#EEF1EC] rounded-lg cursor-pointer"
                />
                <div className="flex items-center gap-2 mt-3">
                  <input 
                    id="promo-percentual-input"
                    type="number" 
                    min="1" 
                    max="90"
                    value={promoPercentual}
                    onChange={e => {
                      const val = Number(e.target.value);
                      if (val >= 1 && val <= 90) setPromoPercentual(val);
                    }}
                    className="w-24 h-11 px-3 border border-[#14211C]/20 rounded-lg text-center font-bold text-[#14211C] focus:outline-none focus:ring-2 focus:ring-[#0E7A4F]"
                  />
                  <span className="text-[#14211C]/70 text-sm font-semibold">% de desconto</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#14211C] mb-2">
                  Duração da Promoção (em dias)
                </label>
                <div className="flex gap-2 mb-2.5 flex-wrap">
                  {[1, 3, 7, 14].map(d => (
                    <button
                      key={d}
                      id={`btn-duracao-${d}-dias`}
                      type="button"
                      onClick={() => setPromoDuracao(d)}
                      className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all border ${
                        promoDuracao === d 
                          ? 'bg-[#0E7A4F] text-white border-[#0E7A4F] shadow-sm' 
                          : 'bg-white text-[#14211C] border-[#14211C]/20 hover:bg-[#EEF1EC]'
                      }`}
                    >
                      {d} {d === 1 ? 'dia' : 'dias'}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <input 
                      id="promo-duracao-custom-input"
                      type="number" 
                      min="1" 
                      max="90"
                      value={promoDuracao}
                      onChange={e => {
                        const v = Number(e.target.value);
                        if (v >= 1) setPromoDuracao(v);
                      }}
                      className="w-20 min-h-[44px] px-2 border border-[#14211C]/20 rounded-lg text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0E7A4F]"
                      title="Outro número de dias"
                    />
                    <span className="text-xs text-[#14211C]/60">dias</span>
                  </div>
                </div>
                <div className="text-xs text-[#14211C]/70 italic bg-[#EEF1EC]/60 p-2.5 rounded-lg border border-[#14211C]/10">
                  Termina em <strong>{format(fimDate, 'dd/MM/yyyy')}</strong> e o preço volta ao normal sozinho.
                </div>
              </div>
            </div>

            {/* Raio-X Financeiro em Tempo Real */}
            <div className="bg-[#EEF1EC]/50 p-5 rounded-xl border border-[#14211C]/10 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider block mb-3">
                  Comparativo em Tempo Real
                </span>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center pb-2.5 border-b border-[#14211C]/10">
                    <span className="text-[#14211C]/70">Preço de Venda</span>
                    <div className="text-right">
                      <div className="text-xs text-[#14211C]/40 line-through">
                        Hoje: {formatarMoeda(precoOriginal)}
                      </div>
                      <div className="font-bold text-base text-[#14211C]">
                        Com desconto: {formatarMoeda(precoDesconto)}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pb-2.5 border-b border-[#14211C]/10">
                    <span className="text-[#14211C]/70">Margem de Lucro</span>
                    <div className="text-right">
                      <div className="text-xs text-[#14211C]/40">
                        Hoje: {margemOriginal.toFixed(1)}%
                      </div>
                      <div className={`font-bold ${margemDesconto < 0 ? 'text-[#C4361A]' : 'text-[#0E7A4F]'}`}>
                        Com desconto: {margemDesconto.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#14211C]/70">Lucro por Unidade</span>
                    <div className="text-right">
                      <div className="text-xs text-[#14211C]/40">
                        Antes: {formatarMoeda(lucroOriginal)}
                      </div>
                      <div className={`font-bold ${lucroDesconto < 0 ? 'text-[#C4361A]' : 'text-[#0E7A4F]'}`}>
                        Depois: {formatarMoeda(lucroDesconto)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-[#14211C]/50 border-t border-[#14211C]/10 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                Custo unitário cadastrado: {formatarMoeda(custo)}
              </div>
            </div>
          </div>

          {/* Análise Automática baseada em regras */}
          <div className={`p-4 rounded-xl border ${corParecer} text-sm font-medium leading-relaxed mb-6`}>
            {textoParecer}
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#14211C]/10">
            <button
              id="modal-promo-cancelar-btn"
              type="button"
              onClick={() => setModalPromocao(null)}
              className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-[#14211C] hover:bg-[#EEF1EC] rounded-lg transition-colors border border-[#14211C]/15"
            >
              Cancelar
            </button>
            <button
              id="modal-promo-salvar-btn"
              type="button"
              disabled={processandoAcao}
              onClick={handleSalvarPromocao}
              className="min-h-[44px] px-6 py-2.5 text-sm font-semibold text-white bg-[#0E7A4F] hover:bg-[#0b633f] active:bg-[#08492e] rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {processandoAcao ? 'Salvando...' : 'Criar promoção'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render do Modal de Desativação
  const renderModalDesativacao = () => {
    if (!modalDesativar) return null;

    const vaiDesativar = modalDesativar.ativo;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14211C]/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              vaiDesativar ? 'bg-[#C4361A]/10 text-[#C4361A]' : 'bg-[#0E7A4F]/10 text-[#0E7A4F]'
            }`}>
              {vaiDesativar ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
            </div>
            <h3 className="text-xl font-bold text-[#14211C]">
              {vaiDesativar ? 'Desativar Produto' : 'Reativar Produto'}
            </h3>
          </div>

          <div className="text-[#14211C]/80 text-sm mb-6 leading-relaxed">
            {vaiDesativar ? (
              <p>
                Deseja desativar <strong>{modalDesativar.nome}</strong>?
                <br className="my-2" />
                Ao desativar, este produto não será mais incluído em pedidos de reposição para evitar novo acúmulo de estoque parado.
              </p>
            ) : (
              <p>
                Deseja reativar <strong>{modalDesativar.nome}</strong>?
                <br className="my-2" />
                Ele voltará a estar disponível para pedidos e rotinas operacionais.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              id="modal-desativar-cancelar-btn"
              type="button"
              onClick={() => setModalDesativar(null)}
              className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-[#14211C] hover:bg-[#EEF1EC] rounded-lg transition-colors border border-[#14211C]/15"
            >
              Cancelar
            </button>
            <button
              id="modal-desativar-confirmar-btn"
              type="button"
              disabled={processandoAcao}
              onClick={handleConfirmarDesativacao}
              className={`min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 ${
                vaiDesativar
                  ? 'bg-[#C4361A] hover:bg-[#a12c15] active:bg-[#7e2311]'
                  : 'bg-[#0E7A4F] hover:bg-[#0b633f] active:bg-[#08492e]'
              }`}
            >
              {processandoAcao ? 'Processando...' : vaiDesativar ? 'Sim, desativar' : 'Sim, reativar'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!ehDono) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white p-8 rounded-2xl border border-[#14211C]/15 shadow-sm text-center max-w-md">
          <div className="w-14 h-14 bg-[#C4361A]/10 text-[#C4361A] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#14211C] mb-2">Acesso Restrito ao Dono</h2>
          <p className="text-sm text-[#14211C]/70 leading-relaxed">
            A análise estratégica de dinheiro parado e estoques sem giro é restrita aos administradores da loja.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14211C] tracking-tight flex items-center gap-2.5">
            <CircleDollarSign className="w-7 h-7 text-[#0E7A4F]" />
            Dinheiro Parado
          </h1>
          <p className="text-xs sm:text-sm text-[#14211C]/70 mt-0.5">
            Identifique estoques com cobertura alta ou sem giro para liberar capital de giro.
          </p>
        </div>
      </div>

      {/* Alertas e Mensagens */}
      {erro && (
        <div className="p-4 bg-[#C4361A]/10 border border-[#C4361A]/30 rounded-xl text-[#C4361A] text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {mensagemSucesso && (
        <div className="p-4 bg-[#0E7A4F]/10 border border-[#0E7A4F]/30 rounded-xl text-[#0E7A4F] text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {/* Texto de Abertura */}
      <div className="bg-[#EEF1EC]/60 p-5 rounded-xl border border-[#14211C]/10 flex flex-col gap-2">
        <h2 className="text-[#14211C] font-bold text-lg flex items-center gap-2">
          <Info className="w-5 h-5 text-[#0E7A4F]" />
          Transforme prateleira em caixa
        </h2>
        <p className="text-[#14211C]/80 text-sm sm:text-base leading-relaxed">
          Esse é o dinheiro que você já pagou ao fornecedor e ainda não recebeu de volta. Enquanto está na prateleira, ele não compra o que vende. O objetivo não é vender com lucro máximo — é transformar prateleira em caixa.
        </p>
      </div>

      {/* 4 Cartões de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Cartão 1: Dinheiro parado */}
        <div className="bg-white p-5 rounded-xl border border-[#C4361A]/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#C4361A] uppercase tracking-wider block mb-1">
              Dinheiro parado
            </span>
            <TrendingDown className="w-4 h-4 text-[#C4361A]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#C4361A]">
            {carregando ? (
              <div className="h-9 bg-[#14211C]/10 rounded w-32 animate-pulse" />
            ) : (
              formatarMoeda(dinheiroParado)
            )}
          </div>
          <span className="text-[11px] text-[#14211C]/60 mt-1">
            Valor de custo sem retorno
          </span>
        </div>

        {/* Cartão 2: Quantidade de produtos parados */}
        <div className="bg-white p-5 rounded-xl border border-[#14211C]/15 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider block mb-1">
              Produtos parados
            </span>
            <PackageX className="w-4 h-4 text-[#935A12]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#14211C]">
            {carregando ? (
              <div className="h-9 bg-[#14211C]/10 rounded w-16 animate-pulse" />
            ) : (
              `${qtdProdutosParados} ${qtdProdutosParados === 1 ? 'item' : 'itens'}`
            )}
          </div>
          <span className="text-[11px] text-[#14211C]/60 mt-1">
            Com cobertura &gt; 60 dias ou sem venda
          </span>
        </div>

        {/* Cartão 3: Percentual do estoque total */}
        <div className="bg-white p-5 rounded-xl border border-[#14211C]/15 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider block mb-1">
              % do estoque total
            </span>
            <Percent className="w-4 h-4 text-[#14211C]/60" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#14211C]">
            {carregando ? (
              <div className="h-9 bg-[#14211C]/10 rounded w-20 animate-pulse" />
            ) : (
              `${percentualEstoqueTotal.toFixed(1)}%`
            )}
          </div>
          <span className="text-[11px] text-[#14211C]/60 mt-1">
            Do capital total investido
          </span>
        </div>

        {/* Cartão 4: Quanto voltaria ao caixa liquidando com 20% */}
        <div className="bg-white p-5 rounded-xl border border-[#0E7A4F]/30 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-[#0E7A4F]/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#0E7A4F] uppercase tracking-wider block mb-1">
              Volta ao caixa (-20%)
            </span>
            <Sparkles className="w-4 h-4 text-[#0E7A4F]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#0E7A4F]">
            {carregando ? (
              <div className="h-9 bg-[#0E7A4F]/10 rounded w-32 animate-pulse" />
            ) : (
              formatarMoeda(valorVoltaCaixa20)
            )}
          </div>
          <span className="text-[11px] text-[#0E7A4F]/80 mt-1 font-medium">
            Entrada imediata com liquidação
          </span>
        </div>
      </div>


      {/* Resumo do Plano */}
      {(() => {
        const itensLiquidar = produtosParados.filter(p => p.grupo === 'liquidar');
        const recuperaCaixa = itensLiquidar.reduce((acc, p) => acc + (p.saldo * (p.preco * (1 - p.descontoSugerido / 100))), 0);
        
        let txtProdutosDesejados = '';
        if (topGiroBaixaCobertura.length > 0) {
          txtProdutosDesejados = topGiroBaixaCobertura.join(', ');
        } else {
          txtProdutosDesejados = 'produtos de alto giro que estão faltando no seu estoque';
        }

        return (
          <div className="bg-[#0E7A4F]/10 border border-[#0E7A4F]/20 p-5 rounded-xl text-[#14211C] mt-2 mb-4">
            <h3 className="font-bold text-lg mb-2 text-[#0E7A4F] flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Plano de Ação
            </h3>
            <p className="text-sm sm:text-base leading-relaxed text-[#14211C]/90 font-medium">
              Liquidando os <strong>{itensLiquidar.length} itens</strong> do primeiro grupo, você recupera cerca de <strong>{formatarMoeda(recuperaCaixa)}</strong> em caixa. Isso compra aproximadamente <strong>{txtProdutosDesejados}</strong>.
            </p>
          </div>
        );
      })()}

      {/* 3 Blocos de Produtos */}
      <div className="space-y-6">
        {carregando ? (
          <div className="p-6 space-y-4 bg-white rounded-xl border border-[#14211C]/15">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-[#14211C]/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : produtosParados.length === 0 ? (
          <div className="p-12 text-center text-[#14211C]/70 text-sm space-y-3 bg-white rounded-xl border border-[#14211C]/15">
            <CheckCircle2 className="w-12 h-12 text-[#0E7A4F] mx-auto" />
            <div className="text-base font-bold text-[#14211C]">
              Nenhum produto parado. Todo o seu estoque está girando.
            </div>
            <p className="text-xs text-[#14211C]/60 max-w-md mx-auto">
              Parabéns! Todos os itens em estoque possuem histórico de vendas recente e cobertura equilibrada de reposição.
            </p>
          </div>
        ) : (
          <>
            {/* Bloco 1: Liquidar agora */}
            <GroupBlock 
              title="Liquidar agora"
              icon={<AlertCircle className="w-5 h-5 text-[#C4361A]" />}
              description="Dias sem venda > 90 e valor > R$ 200, ou estoque para mais de 180 dias."
              colorClass="bg-white border-[#C4361A]/30"
              headerBg="bg-[#C4361A]/5"
              items={produtosParados.filter(p => p.grupo === 'liquidar')}
              onPromote={setModalPromocao}
            />

            {/* Bloco 2: Reduzir e girar */}
            <GroupBlock 
              title="Reduzir e girar"
              icon={<TrendingDown className="w-5 h-5 text-[#B87503]" />}
              description="Estoque entre 45 e 180 dias ou valor financeiro em alerta."
              colorClass="bg-white border-[#B87503]/30"
              headerBg="bg-[#B87503]/5"
              items={produtosParados.filter(p => p.grupo === 'reduzir')}
              onPromote={setModalPromocao}
            />

            {/* Bloco 3: Investigar */}
            <GroupBlock 
              title="Investigar"
              icon={<PackageX className="w-5 h-5 text-[#14211C]/60" />}
              description="Sem vendas recentes, mas com baixo impacto financeiro. Analisar posição."
              colorClass="bg-white border-[#14211C]/15"
              headerBg="bg-[#14211C]/5"
              items={produtosParados.filter(p => p.grupo === 'investigar')}
              onPromote={setModalPromocao}
            />
          </>
        )}
      </div>

      {/* Renderização dos Modais */}
      
      {renderModalPromocao()}
      
      {promocaoDivulgar && (
        <DivulgacaoModal 
          promocoes={promocaoDivulgar.lista} 
          tipo={promocaoDivulgar.tipo} 
          onClose={() => setPromocaoDivulgar(null)} 
        />
      )}

      {renderModalDesativacao()}

    </div>
  );
};
